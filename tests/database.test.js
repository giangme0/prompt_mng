import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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
    const prompt = prompts.create({ id: 'test-prompt', name: 'Test', summary: 'Summary', input: 'Input data', output: 'Output data', content: 'Content', categoryIds: ['cat-api', 'cat-testing'] });
    assert.equal(prompt.input, 'Input data');
    assert.equal(prompt.output, 'Output data');
    assert.deepEqual(prompt.categoryIds, ['cat-api', 'cat-testing']);
    assert.deepEqual(prompts.get('test-prompt').categoryIds.sort(), ['cat-api', 'cat-testing']);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('prompt input/output migration is idempotent and preserves legacy prompts and relations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'prompt-mng-'));
  const filename = join(directory, 'legacy.sqlite');
  const legacyDb = new Database(filename);
  legacyDb.exec(`
    CREATE TABLE prompts (id TEXT PRIMARY KEY, name TEXT NOT NULL, summary TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, color TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE prompt_categories (prompt_id TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY (prompt_id, category_id));
    INSERT INTO prompts VALUES ('legacy', 'Legacy', 'Summary', 'Content', '2026-01-01', '2026-01-01');
    INSERT INTO categories VALUES ('legacy-cat', 'Legacy category', '#15803d', '2026-01-01');
    INSERT INTO prompt_categories VALUES ('legacy', 'legacy-cat');
  `);
  legacyDb.close();
  try {
    const db = initializeDatabase(filename);
    assert.deepEqual(db.prepare('PRAGMA table_info(prompts)').all().map((column) => column.name), [
      'id', 'name', 'summary', 'content', 'created_at', 'updated_at', 'input_description', 'output_description'
    ]);
    const prompts = createPromptRepository(db);
    assert.deepEqual(prompts.get('legacy'), {
      id: 'legacy', name: 'Legacy', summary: 'Summary', input: '', output: '', content: 'Content',
      categoryIds: ['legacy-cat'], createdAt: '2026-01-01', updatedAt: '2026-01-01'
    });
    db.close();
    const secondDb = initializeDatabase(filename);
    assert.equal(secondDb.prepare('SELECT COUNT(*) AS count FROM prompts').get().count, 1);
    assert.equal(secondDb.prepare('SELECT COUNT(*) AS count FROM prompt_categories').get().count, 1);
    secondDb.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('prompt update persists input and output', () => {
  const { db, directory, prompts } = setup();
  try {
    prompts.create({ id: 'io-prompt', name: 'Test', summary: 'Summary', input: 'Old input', output: 'Old output', content: 'Content', categoryIds: ['cat-api'] });
    const updated = prompts.update('io-prompt', { name: 'Test', summary: 'Summary', input: 'New input', output: 'New output', content: 'Content', categoryIds: ['cat-api'] });
    assert.equal(updated.input, 'New input');
    assert.equal(prompts.get('io-prompt').output, 'New output');
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
