const SYSTEM_INSTRUCTION = `You analyze reusable prompts.

Given a prompt, identify:
1. Summary: A concise description of what the prompt does.
2. Input: The documents, data, variables or contextual information required to execute the prompt.
3. Output: The expected result, structure or format produced by the prompt.

Return valid JSON only: { "summary": "...", "input": "...", "output": "..." }
Rules: Do not include Markdown code fences. Do not modify or rewrite the original prompt. Do not invent specific inputs that are not implied by the prompt. Keep the summary under 240 characters and use clear, concise language.`;

export class LlmError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function configuration() {
  const { LLM_API_URL: url, LLM_API_KEY: key, LLM_MODEL: model } = process.env;
  if (!url || !key || !model) throw new LlmError('LLM is not configured', 503);
  const timeout = Number(process.env.LLM_TIMEOUT_MS || 30000);
  const endpoint = url.replace(/\/+$/, '').endsWith('/chat/completions')
    ? url.replace(/\/+$/, '')
    : `${url.replace(/\/+$/, '')}/chat/completions`;
  return { endpoint, key, model, timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000 };
}

function parseResult(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new LlmError('Invalid LLM response', 422);
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let result;
  try { result = JSON.parse(jsonText); } catch { throw new LlmError('Invalid LLM response', 422); }
  const fields = ['summary', 'input', 'output'];
  if (fields.some((field) => typeof result[field] !== 'string' || !result[field].trim())) throw new LlmError('Invalid LLM response', 422);
  if (result.summary.trim().length > 240 || result.input.trim().length > 2000 || result.output.trim().length > 2000) throw new LlmError('Invalid LLM response', 422);
  return Object.fromEntries(fields.map((field) => [field, result[field].trim()]));
}

export async function analyzePrompt(content) {
  if (typeof content !== 'string' || !content.trim()) throw new LlmError('Prompt content is required', 400);
  const trimmed = content.trim();
  if (trimmed.length < 50) throw new LlmError('Prompt content must be at least 50 characters', 400);
  if (trimmed.length > 50000) throw new LlmError('Prompt content must be 50,000 characters or fewer', 400);
  const { endpoint, key, model, timeout } = configuration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let response;
    console.log(`[llm] Sending request: endpoint=${endpoint}, model=${model}, promptLength=${trimmed.length}, temperature=default`);
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_INSTRUCTION }, { role: 'user', content: trimmed }] }), signal: controller.signal });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`[llm] Request timed out after ${timeout}ms: ${endpoint}`);
        throw new LlmError('LLM request timed out', 504);
      }
      console.log(`[llm] Request failed: ${error.message} (${endpoint})`);
      throw new LlmError('LLM provider unavailable', 502);
    }
    let body;
    try { body = await response.json(); } catch { throw new LlmError('Invalid LLM response', 422); }
    if (!response.ok) {
      const providerDetails = body?.error || body;
      console.log('[llm] Provider error details:', {
        status: response.status,
        endpoint,
        model,
        type: providerDetails?.type,
        code: providerDetails?.code,
        param: providerDetails?.param,
        message: providerDetails?.message || JSON.stringify(providerDetails)
      });
      throw new LlmError('LLM provider request failed', 502);
    }
    return parseResult(body);
  } finally { clearTimeout(timer); }
}