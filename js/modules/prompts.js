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
    informationWarnings: data.informationWarnings || [],
    informationReviewStatus: data.informationReviewStatus || 'not_analyzed',
    informationReviewedAt: data.informationReviewedAt || null,
    informationReviewContentHash: data.informationReviewContentHash || null,
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
    informationWarnings: data.informationWarnings || prompt.informationWarnings || [],
    informationReviewStatus: data.informationReviewStatus || prompt.informationReviewStatus || 'not_analyzed',
    informationReviewedAt: data.informationReviewedAt || prompt.informationReviewedAt || null,
    informationReviewContentHash: data.informationReviewContentHash || prompt.informationReviewContentHash || null,
    updatedAt: new Date().toISOString()
  };
}
