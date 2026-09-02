export function createPrompt(data, id) {
  const now = new Date().toISOString();
  return {
    id,
    name: data.name.trim(),
    categoryIds: [...new Set(data.categoryIds)],
    summary: data.summary.trim(),
    input: (data.input || '').trim(),
    output: (data.output || '').trim(),
    content: data.content.trim(),
    createdAt: now,
    updatedAt: now
  };
}

export function updatePrompt(prompt, data) {
  return {
    ...prompt,
    name: data.name.trim(),
    categoryIds: [...new Set(data.categoryIds)],
    summary: data.summary.trim(),
    input: (data.input || '').trim(),
    output: (data.output || '').trim(),
    content: data.content.trim(),
    updatedAt: new Date().toISOString()
  };
}
