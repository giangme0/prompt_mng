import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDatabase } from '../server/database.js';
import { createCategoryRepository } from '../server/category-repository.js';
import { createPromptRepository } from '../server/prompt-repository.js';

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'prompt-mng-'));
  const db = initializeDatabase(join(directory, 'test.sqlite'));
  return { db, directory, categories: createCategoryRepository(db), prompts: createPromptRepository(db) };
}

test('database seeds once and stores many-to-many prompt categories', () => {
  const { db, directory, categories, prompts } = setup();
  try {
    assert.equal(prompts.list().length, 6);
    assert.equal(categories.list().length, 6);
    const prompt = prompts.create({ id: 'test-prompt', name: 'Test', summary: 'Summary', content: 'Content', categoryIds: ['cat-api', 'cat-testing'] });
    assert.deepEqual(prompt.categoryIds, ['cat-api', 'cat-testing']);
    assert.deepEqual(prompts.get('test-prompt').categoryIds.sort(), ['cat-api', 'cat-testing']);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid category rolls back prompt transaction and delete cascades relations', () => {
  const { db, directory, prompts } = setup();
  try {
    assert.throws(() => prompts.create({ id: 'invalid', name: 'Test', summary: 'Summary', content: 'Content', categoryIds: ['missing'] }));
    assert.equal(prompts.get('invalid'), null);
    prompts.create({ id: 'cascade', name: 'Test', summary: 'Summary', content: 'Content', categoryIds: ['cat-api'] });
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM prompt_categories WHERE prompt_id = ?').get('cascade').count, 1);
    assert.equal(prompts.delete('cascade'), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM prompt_categories WHERE prompt_id = ?').get('cascade').count, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
