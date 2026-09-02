const CATEGORY_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#db2777', '#4f46e5'];

export function createCategory(name, id, existingCount = 0) {
  return {
    id,
    name: name.trim(),
    color: CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length]
  };
}

export function getCategoryCount(categoryId, prompts) {
  return prompts.filter((prompt) => prompt.categoryIds.includes(categoryId)).length;
}
