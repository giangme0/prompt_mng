import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt, mapSuggestedCategories } from '../server/services/llm-service.js';

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
    return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"promptName":" API Test Generator ","categories":["Testing"],"summary":" Generates API tests. ","input":" Requirements. ","output":" Structured test cases. "}\n```' } }] }) };
  };
  const result = await analyzePrompt(content);
  assert.deepEqual(result, { promptName: 'API Test Generator', categories: ['Testing'], summary: 'Generates API tests.', input: 'Requirements.', output: 'Structured test cases.', informationWarnings: [] });
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false);
});

test('maps category names case-insensitively, removes invalid duplicates, and limits to three', () => {
  const available = [
    { id: 'cat-testing', name: 'Testing', color: '#7c3aed' },
    { id: 'cat-api', name: 'API', color: '#0891b2' },
    { id: 'cat-coding', name: 'Coding', color: '#16a34a' },
    { id: 'cat-docs', name: 'Documentation', color: '#ea580c' }
  ];
  assert.deepEqual(mapSuggestedCategories(['testing', 'API', 'missing', 'TESTING', 'Coding', 'Documentation'], available), {
    categoryIds: ['cat-testing', 'cat-api', 'cat-coding'],
    categories: [available[0], available[1], available[2]]
  });
  assert.deepEqual(mapSuggestedCategories([], available), { categoryIds: [], categories: [] });
});

test('rejects an invalid prompt name', async () => {
  configure();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ promptName: 'x'.repeat(81), categories: [], summary: 'Summary', input: 'Input', output: 'Output' }) } }] }) });
  await assert.rejects(() => analyzePrompt(content), { status: 422 });
});

test('accepts title-case fields and common provider result wrappers', async () => {
  configure();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ analysis: {
    'Prompt Name': 'Wrapped analysis', Categories: ['Testing'], Summary: 'A summary.', Input: 'Requirements.', Output: 'Test cases.'
  } }) } }] }) });
  assert.deepEqual(await analyzePrompt(content), {
    promptName: 'Wrapped analysis', categories: ['Testing'], summary: 'A summary.', input: 'Requirements.', output: 'Test cases.', informationWarnings: []
  });
});

test('normalizes semantic input/output aliases and list values', async () => {
  configure();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
    promptName: 'Alias analysis', categories: [], summary: 'A summary.', requiredInputs: ['Requirements', 'business rules'], expectedOutput: ['A report', 'with recommendations']
  }) } }] }) });
  assert.deepEqual(await analyzePrompt(content), {
    promptName: 'Alias analysis', categories: [], summary: 'A summary.', input: 'Requirements business rules', output: 'A report with recommendations', informationWarnings: []
  });
});
