import { getVisiblePrompts } from './modules/filters.js';
import { createPrompt, updatePrompt } from './modules/prompts.js';
import { createCategory, createPrompt as apiCreatePrompt, deletePrompt, getCategories, getPrompts, updatePrompt as apiUpdatePrompt } from './services/api.js';
import { createStore } from './state/store.js';
import { createId } from './utils/id.js';
import { hydrateIcons, createIcon } from './ui/icons.js';
import { openConfirmation } from './ui/modal.js';
import { openPromptForm } from './ui/prompt-form.js';
import { renderPromptDetail } from './ui/prompt-detail.js';
import { renderPromptList } from './ui/prompt-list.js';
import { renderActiveFilters, renderSidebar } from './ui/sidebar.js';
import { showToast } from './ui/toast.js';

const store = createStore({
  prompts: [],
  categories: [],
  selectedPromptId: null,
  filters: {
    categoryIds: [],
    search: '',
    sortBy: 'updated-desc'
  }
});

const searchInput = document.querySelector('#prompt-search');
const sortSelect = document.querySelector('#sort-select');
const resultCount = document.querySelector('#result-count');
const clearFiltersButton = document.querySelector('#clear-category-filters');
const detailPane = document.querySelector('#detail-pane');

hydrateIcons();
sortSelect.value = store.getState().filters.sortBy;

function selectBestVisible(nextState, preferredId = nextState.selectedPromptId) {
  const visible = getVisiblePrompts(nextState);
  return visible.some((prompt) => prompt.id === preferredId) ? preferredId : visible[0]?.id || null;
}

function updateFilters(patch) {
  const state = store.getState();
  const nextState = { ...state, filters: { ...state.filters, ...patch } };
  store.setState({
    filters: nextState.filters,
    selectedPromptId: selectBestVisible(nextState)
  });
}

function toggleCategory(categoryId) {
  const selected = store.getState().filters.categoryIds;
  updateFilters({
    categoryIds: selected.includes(categoryId)
      ? selected.filter((id) => id !== categoryId)
      : [...selected, categoryId]
  });
  closeSidebar();
}

function clearCategoryFilters() {
  updateFilters({ categoryIds: [] });
  closeSidebar();
}

function selectPrompt(promptId) {
  store.setState({ selectedPromptId: promptId });
  detailPane.scrollTop = 0;
  if (window.matchMedia('(max-width: 720px)').matches) {
    document.body.classList.add('detail-open');
  }
}

async function createCategoryForStore(name) {
  const colors = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#db2777', '#4f46e5'];
  const category = await createCategory({ name, color: colors[store.getState().categories.length % colors.length] });
  store.setState({ categories: [...store.getState().categories, category] });
  return category;
}

async function copyPrompt(prompt, button) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt.content);
    } else {
      const fallback = document.createElement('textarea');
      fallback.value = prompt.content;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.append(fallback);
      fallback.select();
      document.execCommand('copy');
      fallback.remove();
    }
    showToast('Prompt copied to clipboard');
    if (button?.isConnected) {
      const original = [...button.childNodes].map((node) => node.cloneNode(true));
      button.replaceChildren(createIcon('check'), document.createTextNode('Copied'));
      window.setTimeout(() => {
        if (button.isConnected) button.replaceChildren(...original);
      }, 1400);
    }
  } catch {
    showToast('Could not copy the prompt', 'error');
  }
}

function openCreatePrompt() {
  const state = store.getState();
  openPromptForm({
    categories: state.categories,
    onCreateCategory: createCategoryForStore,
    onSave: async ({ data: promptData }) => {
      const prompt = createPrompt(promptData, createId('prm'));
      const saved = await apiCreatePrompt(prompt);
      store.setState({ prompts: [saved, ...store.getState().prompts], selectedPromptId: saved.id });
      showToast('Prompt created');
      return true;
    }
  });
}

function openEditPrompt(prompt) {
  openPromptForm({
    prompt,
    categories: store.getState().categories,
    onCreateCategory: createCategoryForStore,
    onSave: async ({ data: promptData }) => {
      const saved = await apiUpdatePrompt(prompt.id, promptData);
      store.setState({ prompts: store.getState().prompts.map((item) => item.id === prompt.id ? saved : item), selectedPromptId: prompt.id });
      showToast('Changes saved');
      return true;
    }
  });
}

function requestDeletePrompt(prompt) {
  openConfirmation({
    promptName: prompt.name,
    onConfirm: async () => {
      const state = store.getState();
      await deletePrompt(prompt.id);
      const prompts = state.prompts.filter((item) => item.id !== prompt.id);
      const selectedPromptId = selectBestVisible({ ...state, prompts }, null);
      store.setState({ prompts, selectedPromptId });
      document.body.classList.remove('detail-open');
      showToast('Prompt deleted');
    }
  });
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

function render(state) {
  const visiblePrompts = getVisiblePrompts(state);
  const selectedPrompt = state.prompts.find((prompt) => prompt.id === state.selectedPromptId) || null;
  resultCount.textContent = `${visiblePrompts.length} ${visiblePrompts.length === 1 ? 'prompt' : 'prompts'}`;
  clearFiltersButton.style.visibility = state.filters.categoryIds.length ? 'visible' : 'hidden';

  renderSidebar(state, toggleCategory, clearCategoryFilters);
  renderActiveFilters(state, toggleCategory);
  renderPromptList({
    prompts: visiblePrompts,
    categories: state.categories,
    selectedPromptId: state.selectedPromptId,
    onSelect: selectPrompt,
    onCopy: copyPrompt,
    onNew: openCreatePrompt
  });
  renderPromptDetail({
    prompt: selectedPrompt,
    categories: state.categories,
    onCopy: copyPrompt,
    onEdit: openEditPrompt,
    onDelete: requestDeletePrompt,
    onBack: () => document.body.classList.remove('detail-open')
  });
}

document.querySelector('#new-prompt-button').addEventListener('click', openCreatePrompt);
document.querySelector('#mobile-menu-button').addEventListener('click', openSidebar);
document.querySelector('#sidebar-scrim').addEventListener('click', closeSidebar);
clearFiltersButton.addEventListener('click', clearCategoryFilters);

searchInput.addEventListener('input', () => updateFilters({ search: searchInput.value }));
sortSelect.addEventListener('change', () => {
  updateFilters({ sortBy: sortSelect.value });
});

document.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (event.key === '/' && !typing) {
    event.preventDefault();
    searchInput.focus();
  }
});

window.addEventListener('resize', () => {
  if (!window.matchMedia('(max-width: 900px)').matches) closeSidebar();
  if (!window.matchMedia('(max-width: 720px)').matches) document.body.classList.remove('detail-open');
});

store.subscribe(render);
render(store.getState());

Promise.all([getPrompts(), getCategories()])
  .then(([prompts, categories]) => store.setState({ prompts, categories, selectedPromptId: prompts[0]?.id || null }))
  .catch((error) => showToast(error.message, 'error'));
