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

test('category CRUD validates names, counts prompts, and removes relations on delete', () => {
  const { db, directory, categories, prompts } = setup();
  try {
    const created = categories.create({ id: 'cat-security', name: ' Security ', color: '#15803d' });
    assert.equal(created.name, 'Security');
    assert.equal(created.promptCount, 0);
    assert.throws(
      () => categories.create({ id: 'cat-duplicate', name: ' SECURITY ', color: '#059669' }),
      (error) => error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    );

    prompts.create({ id: 'uses-security', name: 'Security prompt', summary: 'Summary', content: 'Content', categoryIds: ['cat-security'] });
    assert.equal(categories.list().find((category) => category.id === 'cat-security').promptCount, 1);
    const updated = categories.update('cat-security', { name: 'Infrastructure', color: '#059669' });
    assert.equal(updated.name, 'Infrastructure');
    assert.equal(updated.color, '#059669');
    assert.equal(updated.promptCount, 1);

    assert.deepEqual(categories.delete('cat-security'), { id: 'cat-security', deleted: true, affectedPromptCount: 1 });
    assert.equal(prompts.get('uses-security').id, 'uses-security');
    assert.deepEqual(prompts.get('uses-security').categoryIds, []);
    assert.equal(categories.update('missing', { name: 'Missing', color: '#15803d' }), null);
    assert.equal(categories.delete('missing'), null);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
