export function matchesCategoryFilters(prompt, selectedCategoryIds) {
  if (!selectedCategoryIds.length) return true;
  return selectedCategoryIds.some((categoryId) => prompt.categoryIds.includes(categoryId));
}

export function matchesSearch(prompt, categories, rawQuery) {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;

  const categoryNames = prompt.categoryIds
    .map((id) => categories.find((category) => category.id === id)?.name || '')
    .join(' ');

  return [prompt.name, prompt.summary, prompt.input || '', prompt.output || '', prompt.content, categoryNames]
    .some((value) => String(value || '').toLocaleLowerCase().includes(query));
}

export function sortPrompts(prompts, sortBy) {
  const sorted = [...prompts];

  switch (sortBy) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'created-desc':
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'created-asc':
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'updated-desc':
    default:
      return sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
}

export function getVisiblePrompts(state) {
  return sortPrompts(
    state.prompts.filter((prompt) =>
      matchesCategoryFilters(prompt, state.filters.categoryIds)
      && matchesSearch(prompt, state.categories, state.filters.search)
    ),
    state.filters.sortBy
  );
}
