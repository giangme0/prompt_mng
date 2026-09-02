function promptFromRow(row) {
  if (!row) return null;
  return { id: row.prompt_id, name: row.prompt_name, summary: row.prompt_summary, input: row.input_description || '', output: row.output_description || '', content: row.content, categoryIds: row.category_ids ? row.category_ids.split(',') : [] };
}

function workflowFromRows(rows) {
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.workflow_id,
    name: first.workflow_name,
    steps: rows.filter((row) => row.step_id).map((row) => ({ id: row.step_id, order: row.step_order, promptId: row.prompt_id, prompt: promptFromRow(row) })),
    createdAt: first.created_at,
    updatedAt: first.updated_at
  };
}

export function createWorkflowRepository(db) {
  const listQuery = db.prepare(`SELECT w.id, w.name, w.created_at, w.updated_at, COUNT(ws.id) AS step_count, GROUP_CONCAT(DISTINCT p.name) AS prompt_names, GROUP_CONCAT(DISTINCT c.name) AS category_names FROM workflows w LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id LEFT JOIN prompts p ON p.id = ws.prompt_id LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id LEFT JOIN categories c ON c.id = pc.category_id GROUP BY w.id ORDER BY w.updated_at DESC`);
  const detailQuery = db.prepare(`SELECT w.id AS workflow_id, w.name AS workflow_name, w.created_at, w.updated_at, ws.id AS step_id, ws.step_order, ws.prompt_id, p.name AS prompt_name, p.summary AS prompt_summary, p.input_description, p.output_description, p.content, GROUP_CONCAT(pc.category_id) AS category_ids FROM workflows w LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id LEFT JOIN prompts p ON p.id = ws.prompt_id LEFT JOIN prompt_categories pc ON pc.prompt_id = p.id WHERE w.id = ? GROUP BY w.id, ws.id ORDER BY ws.step_order`);
  const promptExists = db.prepare('SELECT 1 FROM prompts WHERE id = ?');
  const insertWorkflow = db.prepare('INSERT INTO workflows (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
  const insertStep = db.prepare('INSERT INTO workflow_steps (id, workflow_id, prompt_id, step_order, created_at) VALUES (?, ?, ?, ?, ?)');
  const deleteSteps = db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?');
  const updateWorkflow = db.prepare('UPDATE workflows SET name = ?, updated_at = ? WHERE id = ?');

  function validateSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) throw Object.assign(new Error('Workflow must contain at least one step'), { status: 400 });
    const normalized = steps.map((step, index) => ({ promptId: typeof step?.promptId === 'string' ? step.promptId.trim() : '', order: Number(step?.order) || index + 1 }));
    if (normalized.some((step) => !step.promptId)) throw Object.assign(new Error(`Select a prompt for Step ${normalized.findIndex((step) => !step.promptId) + 1}.`), { status: 400 });
    if (normalized.some((step, index) => step.order !== index + 1)) throw Object.assign(new Error('Step order must be continuous starting at 1'), { status: 400 });
    if (normalized.some((step) => !promptExists.get(step.promptId))) throw Object.assign(new Error('One or more prompts do not exist'), { status: 404 });
    return normalized;
  }

  function saveSteps(workflowId, steps) {
    const now = new Date().toISOString();
    steps.forEach((step, index) => insertStep.run(`wfs-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, workflowId, step.promptId, index + 1, now));
  }

  return {
    list() { return listQuery.all().map((row) => ({ id: row.id, name: row.name, stepCount: row.step_count, promptNames: row.prompt_names || '', categoryNames: row.category_names || '', createdAt: row.created_at, updatedAt: row.updated_at })); },
    get(id) { return workflowFromRows(detailQuery.all(id)); },
    create(data) { const steps = validateSteps(data.steps); const now = new Date().toISOString(); db.transaction(() => { insertWorkflow.run(data.id, data.name, now, now); saveSteps(data.id, steps); })(); return this.get(data.id); },
    update(id, data) { if (!this.get(id)) return null; const steps = validateSteps(data.steps); const now = new Date().toISOString(); db.transaction(() => { updateWorkflow.run(data.name, now, id); deleteSteps.run(id); saveSteps(id, steps); })(); return this.get(id); },
    delete(id) { const existing = this.get(id); if (!existing) return null; const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id); return { id, deleted: result.changes > 0, deletedStepCount: existing.steps.length }; },
    countByPrompt(promptId) { return db.prepare('SELECT COUNT(DISTINCT workflow_id) AS count FROM workflow_steps WHERE prompt_id = ?').get(promptId).count; }
  };
}
