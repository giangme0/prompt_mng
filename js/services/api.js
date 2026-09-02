async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Request failed');
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
