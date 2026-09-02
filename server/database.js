import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedCategories, seedPrompts } from '../js/data/seed.js';

const GREEN_THEME_MIGRATION = { id: 'green-theme-001', version: 1 };
const SAMPLE_CATEGORY_COLORS = {
  'cat-coding': '#15803d',
  'cat-testing': '#059669',
  'cat-api': '#0f766e',
  'cat-analysis': '#16a34a',
  'cat-design': '#4d7c0f',
  'cat-documentation': '#647c6c'
};

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_categories (
      prompt_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (prompt_id, category_id),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);
  const categoryColumns = db.prepare('PRAGMA table_info(categories)').all();
  if (!categoryColumns.some((column) => column.name === 'updated_at')) {
    db.exec('ALTER TABLE categories ADD COLUMN updated_at TEXT');
    db.exec('UPDATE categories SET updated_at = created_at WHERE updated_at IS NULL');
  }
  seedIfEmpty(db);
  runGreenThemeMigration(db);
  return db;
}

function seedIfEmpty(db) {
  const hasPrompts = db.prepare('SELECT 1 FROM prompts LIMIT 1').get();
  const hasCategories = db.prepare('SELECT 1 FROM categories LIMIT 1').get();
  if (hasPrompts || hasCategories) return;

  const insertCategory = db.prepare(
    'INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
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
      insertCategory.run(category.id, category.name, category.color, createdAt, createdAt);
    }
    for (const prompt of seedPrompts) {
      insertPrompt.run(prompt.id, prompt.name, prompt.summary, prompt.content, prompt.createdAt, prompt.updatedAt);
      for (const categoryId of prompt.categoryIds) insertRelation.run(prompt.id, categoryId);
    }
  })();
}

function runGreenThemeMigration(db) {
  const currentVersion = db.pragma('user_version', { simple: true });
  if (currentVersion >= GREEN_THEME_MIGRATION.version) return;

  const updateCategoryColor = db.prepare('UPDATE categories SET color = ? WHERE id = ?');
  db.transaction(() => {
    for (const [categoryId, color] of Object.entries(SAMPLE_CATEGORY_COLORS)) {
      updateCategoryColor.run(color, categoryId);
    }
    db.pragma(`user_version = ${GREEN_THEME_MIGRATION.version}`);
  })();
}
