function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    promptCount: Number(row.prompt_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createCategoryRepository(db) {
  const list = db.prepare(`
    SELECT c.id, c.name, c.color, c.created_at, c.updated_at,
           COUNT(pc.prompt_id) AS prompt_count
    FROM categories c
    LEFT JOIN prompt_categories pc ON pc.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `);
  const find = db.prepare(`
    SELECT c.id, c.name, c.color, c.created_at, c.updated_at,
           COUNT(pc.prompt_id) AS prompt_count
    FROM categories c
    LEFT JOIN prompt_categories pc ON pc.category_id = c.id
    WHERE c.id = ? GROUP BY c.id
  `);
  const insert = db.prepare('INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const update = db.prepare('UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?');
  const countPrompts = db.prepare('SELECT COUNT(*) AS count FROM prompt_categories WHERE category_id = ?');
  const deleteCategory = db.prepare('DELETE FROM categories WHERE id = ?');

  return {
    list: () => list.all().map(toCategory),
    create: ({ id, name, color }) => {
      const createdAt = new Date().toISOString();
      insert.run(id, name.trim(), color, createdAt, createdAt);
      return toCategory({ id, name: name.trim(), color, created_at: createdAt, updated_at: createdAt, prompt_count: 0 });
    },
    update: (id, { name, color }) => {
      const existing = find.get(id);
      if (!existing) return null;
      const updatedAt = new Date().toISOString();
      update.run(name.trim(), color, updatedAt, id);
      return toCategory({ ...existing, name: name.trim(), color, updated_at: updatedAt });
    },
    delete: (id) => {
      const result = db.transaction(() => {
        const affectedPromptCount = countPrompts.get(id)?.count || 0;
        const deleted = deleteCategory.run(id).changes > 0;
        return { deleted, affectedPromptCount: Number(affectedPromptCount) };
      })();
      return result.deleted ? { id, deleted: true, affectedPromptCount: result.affectedPromptCount } : null;
    }
  };
}
