import { getVisiblePrompts } from './modules/filters.js';
import { createPrompt, updatePrompt } from './modules/prompts.js';
import { createCategory, createPrompt as apiCreatePrompt, deleteCategory, deletePrompt, getCategories, getPrompts, updateCategory, updatePrompt as apiUpdatePrompt, getWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow } from './services/api.js';
import { createStore } from './state/store.js';
import { createId } from './utils/id.js';
import { hydrateIcons, createIcon } from './ui/icons.js';
import { openConfirmation } from './ui/modal.js';
import { openPromptForm } from './ui/prompt-form.js';
import { renderPromptDetail } from './ui/prompt-detail.js';
import { renderPromptList } from './ui/prompt-list.js';
import { renderActiveFilters, renderSidebar } from './ui/sidebar.js';
import { showToast } from './ui/toast.js';
import { openCategoryManager } from './ui/category-manager.js';
import { CATEGORY_COLORS } from './modules/categories.js';
import { renderWorkflowList } from './ui/workflow-list.js';
import { renderWorkflowDetail } from './ui/workflow-detail.js';
import { openWorkflowBuilder } from './ui/workflow-builder.js';

const store = createStore({
  prompts: [],
  categories: [],
  workflows: [],
  workflowStatus: 'loading',
  activeView: 'prompts',
  selectedWorkflowId: null,
  workflowSearch: '',
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
  const category = await createCategory({ name, color: CATEGORY_COLORS[store.getState().categories.length % CATEGORY_COLORS.length] });
  store.setState({ categories: [...store.getState().categories, category] });
  return category;
}

async function refreshLibrary() {
  const [prompts, categories] = await Promise.all([getPrompts(), getCategories()]);
  const state = store.getState();
  const categoryIds = state.filters.categoryIds.filter((id) => categories.some((category) => category.id === id));
  const nextState = { ...state, prompts, categories, filters: { ...state.filters, categoryIds } };
  store.setState({ prompts, categories, filters: nextState.filters, selectedPromptId: selectBestVisible(nextState) });
}

function openManageCategories() {
  openCategoryManager({
    categories: store.getState().categories,
    onCreate: async (data) => { await createCategory(data); await refreshLibrary(); showToast('Category created'); openManageCategories(); },
    onUpdate: async (id, data) => { await updateCategory(id, data); await refreshLibrary(); showToast('Category updated'); openManageCategories(); },
    onDelete: async (id) => {
      try {
        await deleteCategory(id);
        await refreshLibrary();
        showToast('Category deleted');
        openManageCategories();
      } catch (error) {
        showToast(error.message, 'error');
        openManageCategories();
      }
    }
  });
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

function openCreatePrompt(afterCreate) {
  const onCreated = typeof afterCreate === 'function' ? afterCreate : null;
  const state = store.getState();
  openPromptForm({
    categories: state.categories,
    onCreateCategory: createCategoryForStore,
    onSave: async ({ data: promptData }) => {
      const prompt = createPrompt(promptData, createId('prm'));
      const saved = await apiCreatePrompt(prompt);
      store.setState({ prompts: [saved, ...store.getState().prompts], selectedPromptId: saved.id });
      showToast('Prompt created');
      onCreated?.(saved);
      return true;
    }
  });
}

async function refreshWorkflows(selectFirst = false) {
  store.setState({ workflowStatus: 'loading' });
  try {
    const workflows = await getWorkflows();
    const state = store.getState();
    const selectedWorkflowId = workflows.some((workflow) => workflow.id === state.selectedWorkflowId)
      ? state.selectedWorkflowId : (selectFirst ? workflows[0]?.id || null : null);
    store.setState({ workflows, workflowStatus: 'ready', selectedWorkflowId, selectedWorkflow: null });
    if (selectedWorkflowId && (selectFirst || state.activeView === 'workflow-detail')) await viewWorkflow(selectedWorkflowId);
  } catch (error) {
    store.setState({ workflows: [], selectedWorkflowId: null, selectedWorkflow: null, workflowStatus: 'error' });
    throw error;
  }
}
function showPrompts() { store.setState({ activeView: 'prompts' }); }
function showWorkflows() { store.setState({ activeView: 'workflows', selectedWorkflowId: null, selectedWorkflow: null }); refreshWorkflows(true).catch(() => {}); }
async function viewWorkflow(id) {
  try {
    const workflow = await getWorkflow(id);
    store.setState({ activeView: 'workflow-detail', selectedWorkflowId: id, selectedWorkflow: workflow });
  } catch (error) {
    if (error.status === 404) { showWorkflows(); return; }
    showToast(error.message, 'error');
  }
}
function openCreateWorkflow() { store.setState({ activeView: 'workflow-builder' }); openWorkflowBuilder({ prompts: store.getState().prompts, workflow: null, onCancel: showWorkflows, onCreatePrompt: (done) => openCreatePrompt(done), onSave: async (data) => { await createWorkflow(data); await refreshWorkflows(); showToast('Workflow created'); showWorkflows(); } }); }
async function openEditWorkflow(id) { const workflow = await getWorkflow(id); store.setState({ activeView: 'workflow-builder' }); openWorkflowBuilder({ prompts: store.getState().prompts, workflow, onCancel: () => viewWorkflow(id), onCreatePrompt: (done) => openCreatePrompt(done), onSave: async (data) => { await updateWorkflow(id, data); await refreshWorkflows(); showToast('Workflow updated'); viewWorkflow(id); } }); }
async function removeWorkflow(workflow) { const confirmation = window.prompt(`Type exactly "${workflow.name}" to delete this workflow:`); if (confirmation?.trim() !== workflow.name) return; await deleteWorkflow(workflow.id); showToast('Workflow deleted'); showWorkflows(); }

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
  const workflowMode = state.activeView !== 'prompts';
  document.querySelector('.list-header').hidden = workflowMode;
  document.querySelector('.workflow-list').hidden = !workflowMode || state.activeView === 'workflow-builder';
  document.querySelector('#prompt-list').hidden = workflowMode;
  document.querySelector('#prompt-detail').hidden = workflowMode;
  document.querySelector('#workflow-detail').hidden = state.activeView !== 'workflow-detail';
  document.querySelector('#workflow-builder').hidden = state.activeView !== 'workflow-builder';
  document.querySelector('#all-prompts-button').classList.toggle('nav-item--active', !workflowMode);
  document.querySelector('#workflows-button').classList.toggle('nav-item--active', workflowMode);
  document.querySelector('#workflows-count').textContent = state.workflows.length;
  if (workflowMode) {
    renderWorkflowList({ workflows: state.workflows, search: state.workflowSearch, selectedWorkflowId: state.selectedWorkflowId, status: state.workflowStatus, onNew: openCreateWorkflow, onView: viewWorkflow, onEdit: openEditWorkflow, onDelete: removeWorkflow });
    renderWorkflowDetail({ workflow: state.selectedWorkflow, categories: state.categories, onEdit: () => openEditWorkflow(state.selectedWorkflowId), onDelete: () => removeWorkflow(state.selectedWorkflow), onPrompt: (promptId) => { showPrompts(); selectPrompt(promptId); } });
    return;
  }
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
document.querySelector('#workflows-button').addEventListener('click', showWorkflows);
document.querySelector('#all-prompts-button').addEventListener('click', showPrompts);
document.querySelector('#mobile-menu-button').addEventListener('click', openSidebar);
document.querySelector('#sidebar-scrim').addEventListener('click', closeSidebar);
clearFiltersButton.addEventListener('click', clearCategoryFilters);
document.querySelector('#manage-categories-button').addEventListener('click', openManageCategories);

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
  .then(async ([prompts, categories]) => { store.setState({ prompts, categories, selectedPromptId: prompts[0]?.id || null }); await refreshWorkflows(); })
  .catch((error) => showToast(error.message, 'error'));
