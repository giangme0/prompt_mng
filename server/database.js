import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedCategories, seedPrompts } from '../js/data/seed.js';

const GREEN_THEME_MIGRATION = { id: 'green-theme-001', version: 1 };
const PROMPT_INPUT_OUTPUT_MIGRATION = { id: 'prompt-input-output-001' };
const INFORMATION_REVIEW_MIGRATION = { id: 'replace-context-trace-with-information-review-001' };
const PROMPT_WORKFLOW_MIGRATION = { id: 'prompt-workflow-001' };
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
      input_description TEXT NOT NULL DEFAULT '',
      output_description TEXT NOT NULL DEFAULT '',
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
  runPromptInputOutputMigration(db);
  runInformationReviewMigration(db);
  runPromptWorkflowMigration(db);
  const categoryColumns = db.prepare('PRAGMA table_info(categories)').all();
  if (!categoryColumns.some((column) => column.name === 'updated_at')) {
    db.exec('ALTER TABLE categories ADD COLUMN updated_at TEXT');
    db.exec('UPDATE categories SET updated_at = created_at WHERE updated_at IS NULL');
  }
  seedIfEmpty(db);
  runGreenThemeMigration(db);
  return db;
}

function runPromptWorkflowMigration(db) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, prompt_id TEXT NOT NULL,
        step_order INTEGER NOT NULL, created_at TEXT NOT NULL,
        UNIQUE (workflow_id, step_order),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_steps_prompt_id ON workflow_steps(prompt_id);
    `);
  })();
}

function runInformationReviewMigration(db) {
  db.transaction(() => {
    const columns = new Set(db.prepare('PRAGMA table_info(prompts)').all().map((column) => column.name));
    const legacyColumns = ['context_trace_json', 'trace_status', 'trace_analyzed_at', 'trace_content_hash'];
    const hasLegacyColumns = legacyColumns.some((column) => columns.has(column));
    if (!columns.has('information_warnings_json')) db.exec("ALTER TABLE prompts ADD COLUMN information_warnings_json TEXT NOT NULL DEFAULT '[]'");
    if (!columns.has('information_review_status')) db.exec("ALTER TABLE prompts ADD COLUMN information_review_status TEXT NOT NULL DEFAULT 'not_analyzed'");
    if (!columns.has('information_reviewed_at')) db.exec('ALTER TABLE prompts ADD COLUMN information_reviewed_at TEXT');
    if (!columns.has('information_review_content_hash')) db.exec('ALTER TABLE prompts ADD COLUMN information_review_content_hash TEXT');

    if (hasLegacyColumns) {
      const migrateWarnings = db.prepare('UPDATE prompts SET information_warnings_json = ? WHERE id = ?');
      for (const row of db.prepare('SELECT id, context_trace_json FROM prompts').all()) {
        let warnings = [];
        try {
          const legacy = row.context_trace_json ? JSON.parse(row.context_trace_json) : null;
          warnings = Array.isArray(legacy?.informationWarnings) ? legacy.informationWarnings : [];
        } catch { /* Ignore malformed legacy trace data. */ }
        migrateWarnings.run(JSON.stringify(warnings), row.id);
      }
      rebuildPromptsWithoutLegacyColumns(db);
    }
  })();
}

function rebuildPromptsWithoutLegacyColumns(db) {
  db.exec(`
      CREATE TABLE prompts_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        summary TEXT NOT NULL,
        input_description TEXT NOT NULL DEFAULT '',
        output_description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        information_warnings_json TEXT NOT NULL DEFAULT '[]',
        information_review_status TEXT NOT NULL DEFAULT 'not_analyzed',
        information_reviewed_at TEXT,
        information_review_content_hash TEXT
      );
      INSERT INTO prompts_new (id, name, summary, input_description, output_description, content, created_at, updated_at, information_warnings_json, information_review_status, information_reviewed_at, information_review_content_hash)
        SELECT id, name, summary, input_description, output_description, content, created_at, updated_at, information_warnings_json, information_review_status, information_reviewed_at, information_review_content_hash FROM prompts;
      CREATE TABLE prompt_categories_new (
        prompt_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        PRIMARY KEY (prompt_id, category_id),
        FOREIGN KEY (prompt_id) REFERENCES prompts_new(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
      INSERT INTO prompt_categories_new SELECT prompt_id, category_id FROM prompt_categories;
      DROP TABLE prompt_categories;
      DROP TABLE prompts;
      ALTER TABLE prompts_new RENAME TO prompts;
      ALTER TABLE prompt_categories_new RENAME TO prompt_categories;
  `);
}

function runPromptInputOutputMigration(db) {
  const columns = db.prepare('PRAGMA table_info(prompts)').all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('input_description')) {
    db.exec("ALTER TABLE prompts ADD COLUMN input_description TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has('output_description')) {
    db.exec("ALTER TABLE prompts ADD COLUMN output_description TEXT NOT NULL DEFAULT ''");
  }
}

function seedIfEmpty(db) {
  const hasPrompts = db.prepare('SELECT 1 FROM prompts LIMIT 1').get();
  const hasCategories = db.prepare('SELECT 1 FROM categories LIMIT 1').get();
  if (hasPrompts || hasCategories) return;

  const insertCategory = db.prepare(
    'INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertPrompt = db.prepare(
    'INSERT INTO prompts (id, name, summary, input_description, output_description, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
      insertPrompt.run(prompt.id, prompt.name, prompt.summary, prompt.input, prompt.output, prompt.content, prompt.createdAt, prompt.updatedAt);
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
