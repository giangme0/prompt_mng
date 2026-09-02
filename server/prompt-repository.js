function toPrompt(row) {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    content: row.content,
    categoryIds: row.category_ids ? row.category_ids.split(',') : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createPromptRepository(db) {
  const select = db.prepare(`
    SELECT p.id, p.name, p.summary, p.content, p.created_at, p.updated_at,
           GROUP_CONCAT(pc.category_id) AS category_ids
    FROM prompts p
    LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);
  const find = db.prepare(`
    SELECT p.id, p.name, p.summary, p.content, p.created_at, p.updated_at,
           GROUP_CONCAT(pc.category_id) AS category_ids
    FROM prompts p
    LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id
    WHERE p.id = ? GROUP BY p.id
  `);
  const insert = db.prepare(
    'INSERT INTO prompts (id, name, summary, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const update = db.prepare(
    'UPDATE prompts SET name = ?, summary = ?, content = ?, updated_at = ? WHERE id = ?'
  );
  const deletePrompt = db.prepare('DELETE FROM prompts WHERE id = ?');
  const deleteRelations = db.prepare('DELETE FROM prompt_categories WHERE prompt_id = ?');
  const insertRelation = db.prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
  const categoryExists = db.prepare('SELECT 1 FROM categories WHERE id = ?');

  function validateCategories(categoryIds) {
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.some((id) => !categoryExists.get(id))) {
      const error = new Error('One or more categories do not exist');
      error.status = 400;
      throw error;
    }
    return uniqueIds;
  }

  function saveRelations(promptId, categoryIds) {
    deleteRelations.run(promptId);
    for (const categoryId of categoryIds) insertRelation.run(promptId, categoryId);
  }

  return {
    list: () => select.all().map(toPrompt),
    get: (id) => {
      const row = find.get(id);
      return row ? toPrompt(row) : null;
    },
    create: (data) => {
      const categoryIds = validateCategories(data.categoryIds);
      const now = new Date().toISOString();
      db.transaction(() => {
        insert.run(data.id, data.name, data.summary, data.content, now, now);
        saveRelations(data.id, categoryIds);
      })();
      return { ...data, categoryIds, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const categoryIds = validateCategories(data.categoryIds);
      const existing = find.get(id);
      if (!existing) return null;
      const updatedAt = new Date().toISOString();
      db.transaction(() => {
        update.run(data.name, data.summary, data.content, updatedAt, id);
        saveRelations(id, categoryIds);
      })();
      return { ...data, id, categoryIds, createdAt: existing.created_at, updatedAt };
    },
    delete: (id) => deletePrompt.run(id).changes > 0
  };
}
