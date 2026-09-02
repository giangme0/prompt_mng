import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedCategories, seedPrompts } from '../js/data/seed.js';

export function initializeDatabase(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_categories (
      prompt_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (prompt_id, category_id),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);
  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(db) {
  const hasPrompts = db.prepare('SELECT 1 FROM prompts LIMIT 1').get();
  const hasCategories = db.prepare('SELECT 1 FROM categories LIMIT 1').get();
  if (hasPrompts || hasCategories) return;

  const insertCategory = db.prepare(
    'INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertPrompt = db.prepare(
    'INSERT INTO prompts (id, name, summary, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertRelation = db.prepare(
    'INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)'
  );
  db.transaction(() => {
    const createdAt = new Date().toISOString();
    for (const category of seedCategories) {
      insertCategory.run(category.id, category.name, category.color, createdAt);
    }
    for (const prompt of seedPrompts) {
      insertPrompt.run(prompt.id, prompt.name, prompt.summary, prompt.content, prompt.createdAt, prompt.updatedAt);
      for (const categoryId of prompt.categoryIds) insertRelation.run(prompt.id, categoryId);
    }
  })();
}
