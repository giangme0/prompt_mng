import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from './server/database.js';
import { createCategoryRepository } from './server/category-repository.js';
import { createPromptRepository } from './server/prompt-repository.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const db = initializeDatabase(join(ROOT, 'data', 'prompt_mng.sqlite'));
const categories = createCategoryRepository(db);
const prompts = createPromptRepository(db);

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

async function handleApi(request, response, url) {
  const path = url.pathname;
  if (request.method === 'GET' && path === '/api/categories') return sendJson(response, 200, categories.list());
  if (request.method === 'GET' && path === '/api/prompts') return sendJson(response, 200, prompts.list());

  if (request.method === 'POST' && path === '/api/categories') {
    const body = await readJson(request);
    const name = validateText(body.name, 'name');
    const color = validateText(body.color, 'color');
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return sendJson(response, 201, categories.create({ id, name, color }));
  }

  const promptMatch = path.match(/^\/api\/prompts\/([^/]+)$/);
  if (request.method === 'DELETE' && promptMatch) {
    if (!prompts.delete(promptMatch[1])) return errorResponse(response, 404, 'Prompt not found');
    return sendJson(response, 200, { success: true });
  }
  if ((request.method === 'POST' && path === '/api/prompts') || (request.method === 'PUT' && promptMatch)) {
    const body = await readJson(request);
    const data = {
      name: validateText(body.name, 'name'),
      summary: validateText(body.summary, 'summary'),
      content: validateText(body.content, 'content'),
      categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : []
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
    if (request.url.startsWith('/api/')) return errorResponse(response, error.status || (error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 500), error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Category name already exists' : error.message || 'Server error');
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Prompt Manager is running at http://localhost:${PORT}`);
});
