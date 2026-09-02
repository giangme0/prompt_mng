import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCategoryFilters, matchesSearch, sortPrompts } from '../js/modules/filters.js';

const categories = [
  { id: 'cat-api', name: 'API' },
  { id: 'cat-test', name: 'Testing' }
];

const prompt = {
  id: 'one',
  name: 'API Test Generator',
  categoryIds: ['cat-api', 'cat-test'],
  summary: 'Generates boundary test cases.',
  input: 'OpenAPI requirements',
  output: 'Structured test cases',
  content: 'Analyze {{requirements}}',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z'
};

test('category filter uses OR matching', () => {
  assert.equal(matchesCategoryFilters(prompt, ['cat-missing', 'cat-api']), true);
  assert.equal(matchesCategoryFilters(prompt, ['cat-missing']), false);
  assert.equal(matchesCategoryFilters(prompt, []), true);
});

test('search checks name, summary, input, output, content and category names', () => {
  assert.equal(matchesSearch(prompt, categories, 'boundary'), true);
  assert.equal(matchesSearch(prompt, categories, 'testing'), true);
  assert.equal(matchesSearch(prompt, categories, '{{requirements}}'), true);
  assert.equal(matchesSearch(prompt, categories, 'openapi'), true);
  assert.equal(matchesSearch(prompt, categories, 'structured'), true);
  assert.equal(matchesSearch(prompt, categories, 'unrelated'), false);
});

test('search safely handles legacy prompts without input/output', () => {
  assert.equal(matchesSearch({ ...prompt, input: undefined, output: undefined }, categories, 'structured'), false);
});

test('sort returns a new array ordered by name', () => {
  const second = { ...prompt, id: 'two', name: 'Code Review' };
  const input = [prompt, second];
  const sorted = sortPrompts(input, 'name-asc');
  assert.deepEqual(sorted.map((item) => item.id), ['one', 'two']);
  assert.notEqual(sorted, input);
});
