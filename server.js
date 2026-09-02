import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeDatabase } from './server/database.js';
import { createCategoryRepository } from './server/category-repository.js';
import { createPromptRepository } from './server/prompt-repository.js';
import { createWorkflowRepository } from './server/workflow-repository.js';
import { analyzePrompt, mapSuggestedCategories } from './server/services/llm-service.js';
import { detectInformationWarnings } from './server/services/information-review.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: join(ROOT, '.env') });
const PORT = Number(process.env.PORT || 4173);
const databasePath = process.env.DATABASE_PATH || join('data', 'prompt_mng.sqlite');
const db = initializeDatabase(resolve(ROOT, databasePath));
const categories = createCategoryRepository(db);
const prompts = createPromptRepository(db);
const workflows = createWorkflowRepository(db);

console.log(`[server] Database: ${resolve(ROOT, databasePath)}`);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
  return true;
}

function errorResponse(response, status, message) {
  return sendJson(response, status, { error: { message } });
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

function validateText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error(`${field} is required`), { status: 400 });
  return value.trim();
}

function validatePromptText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error(`Prompt ${field} is required`), { status: 400 });
  }
  const text = value.trim();
  if (text.length > 2000) {
    throw Object.assign(new Error(`Prompt ${field} must be 2,000 characters or fewer`), { status: 400 });
  }
  return text;
}

const WARNING_TYPES = ['personal', 'organization', 'project', 'credential'];
function safeEvidence(value, type) {
  if (type === 'credential') return '[REDACTED]';
  return String(value || '').slice(0, 120)
    .replace(/(?:api[_ -]?key|access[_ -]?token|password|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, (email) => `${email[0]}***${email.slice(email.indexOf('@'))}`)
    .replace(/\b(?:\+?\d[\d ()-]{6,}\d)\b/g, (phone) => `******${phone.replace(/\D/g, '').slice(-4)}`);
}
function validateInformationWarnings(value) {
  return Array.isArray(value) ? value.filter((warning) => warning && WARNING_TYPES.includes(warning.type)).map((warning) => ({
    type: warning.type,
    title: String(warning.title || warning.label || '').slice(0, 160),
    description: String(warning.description || '').slice(0, 500),
    detectedValues: (Array.isArray(warning.detectedValues) ? warning.detectedValues : [warning.evidence]).filter(Boolean).slice(0, 10).map((value) => safeEvidence(value, warning.type))
  })) : [];
}

function validateCategoryBody(body) {
  if (typeof body.name !== 'string' || !body.name.trim()) throw Object.assign(new Error('name is required'), { status: 400 });
  const name = body.name.trim();
  const color = body.color == null || body.color === '' ? '#16a34a' : validateText(body.color, 'color');
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw Object.assign(new Error('Color must be a 6-digit HEX value'), { status: 400 });
  return { name, color };
}

function validateWorkflowBody(body) {
  const name = validateText(body.name, 'Workflow name');
  if (name.length > 100) throw Object.assign(new Error('Workflow name must be 100 characters or fewer'), { status: 400 });
  if (!Array.isArray(body.steps) || !body.steps.length) throw Object.assign(new Error('Workflow must contain at least one step'), { status: 400 });
  return { name, steps: body.steps };
}

async function handleApi(request, response, url) {
  const path = url.pathname;
  if (request.method === 'POST' && path === '/api/llm/analyze-prompt') {
    const body = await readJson(request);
    const availableCategories = categories.list();
    let analysis;
    try {
      analysis = await analyzePrompt(body?.content, availableCategories);
    } catch (error) {
      if (error.status === 400) throw error;
      console.log(`[llm] Analysis unavailable (${error.status || 500}); using rule-based information review`);
      analysis = { promptName: '', categories: [], summary: '', input: '', output: '', informationWarnings: detectInformationWarnings(body?.content) };
    }
    const matchedCategories = mapSuggestedCategories(analysis.categories, availableCategories);
    return sendJson(response, 200, { name: analysis.promptName || '', summary: analysis.summary || '', input: analysis.input || '', output: analysis.output || '', suggestedCategoryIds: matchedCategories.categoryIds, informationWarnings: analysis.informationWarnings || [] });
  }
  if (request.method === 'GET' && path === '/api/categories') return sendJson(response, 200, categories.list());
  if (request.method === 'GET' && path === '/api/prompts') return sendJson(response, 200, prompts.list());
  if (request.method === 'GET' && path === '/api/workflows') return sendJson(response, 200, workflows.list());

  const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
  if (request.method === 'GET' && workflowMatch) {
    const result = workflows.get(workflowMatch[1]);
    return result ? sendJson(response, 200, result) : errorResponse(response, 404, 'Workflow not found');
  }
  if (request.method === 'POST' && path === '/api/workflows' || request.method === 'PUT' && workflowMatch) {
    const data = validateWorkflowBody(await readJson(request));
    if (request.method === 'POST') data.id = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = request.method === 'POST' ? workflows.create(data) : workflows.update(workflowMatch[1], data);
    return result ? sendJson(response, request.method === 'POST' ? 201 : 200, result) : errorResponse(response, 404, 'Workflow not found');
  }
  if (request.method === 'DELETE' && workflowMatch) {
    const result = workflows.delete(workflowMatch[1]);
    return result ? sendJson(response, 200, result) : errorResponse(response, 404, 'Workflow not found');
  }

  if (request.method === 'POST' && path === '/api/categories') {
    const body = await readJson(request);
    const { name, color } = validateCategoryBody(body);
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return sendJson(response, 201, categories.create({ id, name, color }));
  }

  const categoryMatch = path.match(/^\/api\/categories\/([^/]+)$/);
  if (request.method === 'PUT' && categoryMatch) {
    const { name, color } = validateCategoryBody(await readJson(request));
    const result = categories.update(categoryMatch[1], { name, color });
    if (!result) return errorResponse(response, 404, 'Category not found');
    return sendJson(response, 200, result);
  }
  if (request.method === 'DELETE' && categoryMatch) {
    const result = categories.delete(categoryMatch[1]);
    if (!result) return errorResponse(response, 404, 'Category not found');
    return sendJson(response, 200, result);
  }

  const promptMatch = path.match(/^\/api\/prompts\/([^/]+)$/);
  if (request.method === 'DELETE' && promptMatch) {
    const workflowCount = workflows.countByPrompt(promptMatch[1]);
    if (workflowCount) return sendJson(response, 409, { error: { message: `This prompt is used by ${workflowCount} workflows and cannot be deleted`, workflowCount } });
    if (!prompts.delete(promptMatch[1])) return errorResponse(response, 404, 'Prompt not found');
    return sendJson(response, 200, { success: true });
  }
  if ((request.method === 'POST' && path === '/api/prompts') || (request.method === 'PUT' && promptMatch)) {
    const body = await readJson(request);
    const data = {
      name: validateText(body.name, 'name'),
      summary: validateText(body.summary, 'summary'),
      input: validatePromptText(body.input, 'input'),
      output: validatePromptText(body.output, 'output'),
      content: validateText(body.content, 'content'),
      categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : [],
      informationWarnings: validateInformationWarnings(body.informationWarnings),
      informationReviewStatus: typeof body.informationReviewStatus === 'string' && ['not_analyzed', 'clear', 'warning', 'stale', 'unavailable'].includes(body.informationReviewStatus) ? body.informationReviewStatus : 'not_analyzed',
      informationReviewedAt: typeof body.informationReviewedAt === 'string' ? body.informationReviewedAt : null,
      informationReviewContentHash: typeof body.informationReviewContentHash === 'string' ? body.informationReviewContentHash : null
    };
    if (!data.categoryIds.length) throw Object.assign(new Error('At least one category is required'), { status: 400 });
    if (request.method === 'POST') {
      data.id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `prm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return sendJson(response, 201, prompts.create(data));
    }
    const result = prompts.update(promptMatch[1], data);
    if (!result) return errorResponse(response, 404, 'Prompt not found');
    return sendJson(response, 200, result);
  }
  return false;
}

const server = http.createServer(async (request, response) => {
  const startedAt = Date.now();
  const requestUrl = request.url || '/';
  console.log(`[server] ${request.method} ${requestUrl}`);
  response.once('finish', () => {
    console.log(`[server] ${request.method} ${requestUrl} -> ${response.statusCode} (${Date.now() - startedAt}ms)`);
  });

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(request, response, url);
      if (!handled) errorResponse(response, 404, 'Endpoint not found');
      return;
    }
    const rawPath = decodeURIComponent(url.pathname);
    const requestedPath = rawPath === '/' ? '/index.html' : rawPath;
    const safePath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');

    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(content);
  } catch (error) {
    console.log(`[server] Request failed: ${request.method} ${request.url} - ${error.message}`);
    if (request.url.startsWith('/api/')) {
      if (request.url.split('?')[0] === '/api/llm/analyze-prompt') {
        const status = error.status || 500;
        const message = status === 400 ? error.message : status === 503 ? 'AI analysis is not configured' : status === 504 ? 'LLM request timed out' : status === 422 ? 'Unable to analyze the prompt' : status === 502 ? 'Unable to reach the LLM provider' : 'Unable to analyze the prompt';
        return errorResponse(response, status, message);
      }
      return errorResponse(response, error.status || (error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 500), error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? (request.url.includes('/workflows') ? 'Workflow name already exists' : 'Category name already exists') : error.message || 'Server error');
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`[server] Prompt Manager is running at http://localhost:${PORT}`);
});
