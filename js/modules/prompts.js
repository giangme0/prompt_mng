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
    contextTrace: data.contextTrace || {},
    informationWarnings: data.informationWarnings || [],
    traceStatus: data.traceStatus || 'not_analyzed',
    traceAnalyzedAt: data.traceAnalyzedAt || null,
    traceContentHash: data.traceContentHash || null,
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
    contextTrace: data.contextTrace || prompt.contextTrace || {},
    informationWarnings: data.informationWarnings || prompt.informationWarnings || [],
    traceStatus: data.traceStatus || prompt.traceStatus || 'not_analyzed',
    traceAnalyzedAt: data.traceAnalyzedAt || prompt.traceAnalyzedAt || null,
    traceContentHash: data.traceContentHash || prompt.traceContentHash || null,
    updatedAt: new Date().toISOString()
  };
}
