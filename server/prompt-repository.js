function toPrompt(row) {
  const contextTrace = safeJson(row.context_trace_json);
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    input: row.input_description || '',
    output: row.output_description || '',
    content: row.content,
    categoryIds: row.category_ids ? row.category_ids.split(',') : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contextTrace,
    informationWarnings: Array.isArray(contextTrace.informationWarnings) ? contextTrace.informationWarnings : [],
    traceStatus: row.trace_status || 'not_analyzed',
    traceAnalyzedAt: row.trace_analyzed_at || null,
    traceContentHash: row.trace_content_hash || null
  };
}

function safeJson(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

export function createPromptRepository(db) {
  const select = db.prepare(`
    SELECT p.id, p.name, p.summary, p.input_description, p.output_description, p.content, p.created_at, p.updated_at, p.context_trace_json, p.trace_status, p.trace_analyzed_at, p.trace_content_hash,
           GROUP_CONCAT(pc.category_id) AS category_ids
    FROM prompts p
    LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);
  const find = db.prepare(`
    SELECT p.id, p.name, p.summary, p.input_description, p.output_description, p.content, p.created_at, p.updated_at, p.context_trace_json, p.trace_status, p.trace_analyzed_at, p.trace_content_hash,
           GROUP_CONCAT(pc.category_id) AS category_ids
    FROM prompts p
    LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id
    WHERE p.id = ? GROUP BY p.id
  `);
  const insert = db.prepare(
    'INSERT INTO prompts (id, name, summary, input_description, output_description, content, context_trace_json, trace_status, trace_analyzed_at, trace_content_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const update = db.prepare(
    'UPDATE prompts SET name = ?, summary = ?, input_description = ?, output_description = ?, content = ?, context_trace_json = ?, trace_status = ?, trace_analyzed_at = ?, trace_content_hash = ?, updated_at = ? WHERE id = ?'
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
      const input = typeof data.input === 'string' ? data.input.trim() : '';
      const output = typeof data.output === 'string' ? data.output.trim() : '';
      const now = new Date().toISOString();
      db.transaction(() => {
        insert.run(data.id, data.name, data.summary, input, output, data.content, JSON.stringify(data.contextTrace || {}), data.traceStatus || 'not_analyzed', data.traceAnalyzedAt || null, data.traceContentHash || null, now, now);
        saveRelations(data.id, categoryIds);
      })();
      return { ...data, input, output, categoryIds, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const categoryIds = validateCategories(data.categoryIds);
      const existing = find.get(id);
      if (!existing) return null;
      const updatedAt = new Date().toISOString();
      db.transaction(() => {
        update.run(data.name, data.summary, (data.input || '').trim(), (data.output || '').trim(), data.content, JSON.stringify(data.contextTrace || {}), data.traceStatus || 'not_analyzed', data.traceAnalyzedAt || null, data.traceContentHash || null, updatedAt, id);
        saveRelations(id, categoryIds);
      })();
      return { ...data, input: (data.input || '').trim(), output: (data.output || '').trim(), id, categoryIds, createdAt: existing.createdAt, updatedAt, contextTrace: data.contextTrace || {}, traceStatus: data.traceStatus || 'not_analyzed', traceAnalyzedAt: data.traceAnalyzedAt || null, traceContentHash: data.traceContentHash || null };
    },
    delete: (id) => deletePrompt.run(id).changes > 0
  };
}
