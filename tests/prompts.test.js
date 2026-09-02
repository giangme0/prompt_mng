import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrompt, updatePrompt } from '../js/modules/prompts.js';

test('createPrompt trims text and removes duplicate categories', () => {
  const prompt = createPrompt({
    name: '  My Prompt  ',
    categoryIds: ['one', 'one', 'two'],
    summary: '  Summary  ',
    content: '  Content  '
  }, 'prompt-id');

  assert.equal(prompt.name, 'My Prompt');
  assert.deepEqual(prompt.categoryIds, ['one', 'two']);
  assert.equal(prompt.summary, 'Summary');
  assert.equal(prompt.content, 'Content');
  assert.equal(prompt.id, 'prompt-id');
});

test('updatePrompt preserves identity and creation time', () => {
  const original = {
    id: 'prompt-id',
    name: 'Old',
    categoryIds: ['one'],
    summary: 'Old summary',
    content: 'Old content',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };
  const updated = updatePrompt(original, {
    name: 'New',
    categoryIds: ['two'],
    summary: 'New summary',
    content: 'New content'
  });

  assert.equal(updated.id, original.id);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.name, 'New');
  assert.notEqual(updated.updatedAt, original.updatedAt);
});
