import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDatabase } from '../server/database.js';
import { createWorkflowRepository } from '../server/workflow-repository.js';
import { createPromptRepository } from '../server/prompt-repository.js';

function setup() { const directory = mkdtempSync(join(tmpdir(), 'workflow-')); const db = initializeDatabase(join(directory, 'test.sqlite')); return { db, directory, workflows: createWorkflowRepository(db), prompts: createPromptRepository(db) }; }
function prompt(prompts, id) { return prompts.create({ id, name: id, summary: 'Summary', input: 'Input', output: 'Output', content: 'Content', categoryIds: ['cat-api'] }); }

test('workflow supports ordered steps and preserves prompts on delete', () => { const { db, directory, workflows, prompts } = setup(); try { prompt(prompts, 'p1'); prompt(prompts, 'p2'); const created = workflows.create({ id: 'wf1', name: 'Review', steps: [{ promptId: 'p1', order: 1 }, { promptId: 'p2', order: 2 }] }); assert.equal(created.steps.length, 2); assert.deepEqual(created.steps.map((step) => step.order), [1, 2]); assert.deepEqual(workflows.delete('wf1'), { id: 'wf1', deleted: true, deletedStepCount: 2 }); assert.equal(prompts.get('p1').id, 'p1'); } finally { db.close(); rmSync(directory, { recursive: true, force: true }); } });

test('workflow rejects missing prompts and rolls back update', () => { const { db, directory, workflows, prompts } = setup(); try { prompt(prompts, 'p1'); workflows.create({ id: 'wf1', name: 'Review', steps: [{ promptId: 'p1', order: 1 }] }); assert.throws(() => workflows.update('wf1', { name: 'Changed', steps: [{ promptId: 'missing', order: 1 }] }), (error) => error.status === 404); assert.equal(workflows.get('wf1').name, 'Review'); assert.equal(workflows.get('wf1').steps[0].promptId, 'p1'); } finally { db.close(); rmSync(directory, { recursive: true, force: true }); } });

test('prompt usage count prevents workflow prompt deletion', () => { const { db, directory, workflows, prompts } = setup(); try { prompt(prompts, 'p1'); workflows.create({ id: 'wf1', name: 'Review', steps: [{ promptId: 'p1', order: 1 }] }); assert.equal(workflows.countByPrompt('p1'), 1); } finally { db.close(); rmSync(directory, { recursive: true, force: true }); } });
