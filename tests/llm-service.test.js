import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt } from '../server/services/llm-service.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const content = 'You are an API testing specialist. Generate thorough test cases from the requirements and specification provided by the user.';

function configure() {
  process.env.LLM_API_URL = 'https://provider.invalid/v1/chat/completions';
  process.env.LLM_API_KEY = 'secret-test-key';
  process.env.LLM_MODEL = 'test-model';
  process.env.LLM_TIMEOUT_MS = '20';
}

test.afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

test('rejects empty and short prompt content', async () => {
  await assert.rejects(() => analyzePrompt(''), { status: 400 });
  await assert.rejects(() => analyzePrompt('too short'), { status: 400 });
});

test('returns 503 when LLM configuration is missing', async () => {
  delete process.env.LLM_API_URL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
  await assert.rejects(() => analyzePrompt(content), { status: 503 });
});

test('maps provider timeout to 504', async () => {
  configure();
  globalThis.fetch = async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(() => analyzePrompt(content), { status: 504 });
});

test('rejects malformed provider output and returns normalized valid output', async () => {
  configure();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"only summary"}' } }] }) });
  await assert.rejects(() => analyzePrompt(content), { status: 422 });

  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer secret-test-key');
    const request = JSON.parse(options.body);
    assert.equal(request.messages.length, 2);
    assert.equal(request.messages[1].content, content);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"summary":" Generates API tests. ","input":" Requirements. ","output":" Structured test cases. "}\n```' } }] }) };
  };
  const result = await analyzePrompt(content);
  assert.deepEqual(result, { summary: 'Generates API tests.', input: 'Requirements.', output: 'Structured test cases.' });
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false);
});
