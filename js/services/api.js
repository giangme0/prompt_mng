async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error?.message || 'Request failed'); error.status = response.status; error.workflowCount = body.error?.workflowCount; throw error; }
  return body;
}

export const getPrompts = () => request('/api/prompts');
export const getCategories = () => request('/api/categories');
export const createPrompt = (data) => request('/api/prompts', { method: 'POST', body: JSON.stringify(data) });
export const updatePrompt = (id, data) => request(`/api/prompts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePrompt = (id) => request(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const createCategory = (data) => request('/api/categories', { method: 'POST', body: JSON.stringify(data) });
export const updateCategory = (id, data) => request(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCategory = (id) => request(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const analyzePrompt = (content, options = {}) => request('/api/llm/analyze-prompt', { method: 'POST', body: JSON.stringify({ content }), ...options });
export const getWorkflows = () => request('/api/workflows');
export const getWorkflow = (id) => request(`/api/workflows/${encodeURIComponent(id)}`);
export const createWorkflow = (data) => request('/api/workflows', { method: 'POST', body: JSON.stringify(data) });
export const updateWorkflow = (id, data) => request(`/api/workflows/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteWorkflow = (id) => request(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });
