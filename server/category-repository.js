function toCategory(row) {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at };
}

export function createCategoryRepository(db) {
  const list = db.prepare('SELECT id, name, color, created_at FROM categories ORDER BY name COLLATE NOCASE');
  const insert = db.prepare('INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)');

  return {
    list: () => list.all().map(toCategory),
    create: ({ id, name, color }) => {
      const createdAt = new Date().toISOString();
      insert.run(id, name.trim(), color, createdAt);
      return { id, name: name.trim(), color, createdAt };
    }
  };
}
