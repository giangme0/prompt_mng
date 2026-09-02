export const SYSTEM_INSTRUCTION = `You analyze reusable prompts.

Given a prompt, generate:
1. Prompt Name: A short, specific and professional name describing the prompt's purpose.
2. Categories: Select up to 3 relevant categories from the provided category list.
3. Summary: A concise description of what the prompt does.
4. Input: The documents, data, variables or contextual information required to execute the prompt.
5. Output: The expected result, structure or format produced by the prompt.

Available categories:
{{availableCategories}}

Return valid JSON only: { "promptName": "...", "categories": ["..."], "summary": "...", "input": "...", "output": "..." }
Rules:
- Use only category names from Available categories.
- Do not create, translate or modify category names.
- Return no more than 3 categories, or an empty array if none is relevant.
- Keep Prompt Name under 80 characters and Summary under 240 characters.
- Do not include Markdown code fences, rewrite the original prompt, or return explanations outside the JSON.`;

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

function validatePromptName(value) {
  if (typeof value !== 'string') return false;
  const name = value.trim();
  return Boolean(name) && name.length <= 80 && !/[\r\n]/.test(name)
    && !((name.startsWith('"') && name.endsWith('"')) || (name.startsWith('“') && name.endsWith('”')));
}

export function mapSuggestedCategories(suggestedNames, availableCategories = []) {
  if (!Array.isArray(suggestedNames)) return { categoryIds: [], categories: [] };
  if (!Array.isArray(availableCategories)) return { categoryIds: [], categories: [] };
  const result = [];
  const seen = new Set();
  for (const suggestedName of suggestedNames) {
    if (typeof suggestedName !== 'string') continue;
    const category = availableCategories.find((item) => item.name.trim().toLocaleLowerCase() === suggestedName.trim().toLocaleLowerCase());
    if (category && !seen.has(category.id) && result.length < 3) {
      seen.add(category.id);
      result.push({ id: category.id, name: category.name, color: category.color });
    }
  }
  return { categoryIds: result.map((category) => category.id), categories: result };
}

function parseResult(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new LlmError('Invalid LLM response', 422);
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let result;
  try { result = JSON.parse(jsonText); } catch { throw new LlmError('Invalid LLM response', 422); }
  if (!validatePromptName(result.promptName)) throw new LlmError('Invalid LLM response', 422);
  const fields = ['summary', 'input', 'output'];
  if (fields.some((field) => typeof result[field] !== 'string' || !result[field].trim())) throw new LlmError('Invalid LLM response', 422);
  if (result.summary.trim().length > 240 || result.input.trim().length > 2000 || result.output.trim().length > 2000) throw new LlmError('Invalid LLM response', 422);
  return { promptName: result.promptName.trim(), categories: Array.isArray(result.categories) ? result.categories : [], ...Object.fromEntries(fields.map((field) => [field, result[field].trim()])) };
}

export async function analyzePrompt(content, availableCategories = []) {
  if (typeof content !== 'string' || !content.trim()) throw new LlmError('Prompt content is required', 400);
  const trimmed = content.trim();
  if (trimmed.length < 50) throw new LlmError('Prompt content must be at least 50 characters', 400);
  if (trimmed.length > 50000) throw new LlmError('Prompt content must be 50,000 characters or fewer', 400);
  const { endpoint, key, model, timeout } = configuration();
  const categoryNames = Array.isArray(availableCategories) ? availableCategories.map((category) => category.name).filter(Boolean) : [];
  const systemInstruction = SYSTEM_INSTRUCTION.replace('{{availableCategories}}', categoryNames.length ? categoryNames.map((name) => `- ${name}`).join('\n') : '- (none)');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let response;
    console.log(`[llm] Sending request: endpoint=${endpoint}, model=${model}, promptLength=${trimmed.length}, temperature=default`);
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: trimmed }] }), signal: controller.signal });
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