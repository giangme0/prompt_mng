import { getCategoryCount } from '../modules/categories.js';
import { createIcon } from './icons.js';

export function renderSidebar(state, onToggleCategory, onClear) {
  const container = document.querySelector('#category-nav');
  const allButton = document.querySelector('#all-prompts-button');
  document.querySelector('#all-prompts-count').textContent = state.prompts.length;
  allButton.classList.toggle('nav-item--active', state.filters.categoryIds.length === 0);
  container.replaceChildren();

  [...state.categories].sort((a, b) => a.name.localeCompare(b.name)).forEach((category) => {
    const button = document.createElement('button');
    button.className = 'category-nav__item';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.filters.categoryIds.includes(category.id)));
    button.style.setProperty('--category-color', category.color);
    const label = document.createElement('span');
    label.className = 'category-nav__label';
    const dot = document.createElement('span');
    dot.className = 'category-dot';
    dot.style.setProperty('--dot-color', category.color);
    const name = document.createElement('span');
    name.className = 'category-nav__name';
    name.textContent = category.name;
    label.append(dot, name);
    const count = document.createElement('span');
    count.className = 'count-badge';
    count.textContent = getCategoryCount(category.id, state.prompts);
    button.append(label, count);
    button.addEventListener('click', () => onToggleCategory(category.id));
    container.append(button);
  });
  allButton.onclick = onClear;
}


export function renderActiveFilters(state, onRemove) {
  const container = document.querySelector('#active-filters');
  container.replaceChildren();
  state.filters.categoryIds.forEach((id) => {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    const button = document.createElement('button');
    button.className = 'filter-chip';
    button.type = 'button';
    button.setAttribute('aria-label', `Remove ${category.name} filter`);
    button.style.setProperty('--category-color', category.color);
    const dot = document.createElement('span');
    dot.className = 'category-dot';
    dot.style.setProperty('--dot-color', category.color);
    button.append(dot, document.createTextNode(category.name), createIcon('close'));
    button.addEventListener('click', () => onRemove(id));
    container.append(button);
  });
}
