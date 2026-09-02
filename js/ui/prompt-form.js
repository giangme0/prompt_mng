import { createCategorySelect } from './category-select.js';
import { createIcon } from './icons.js';
import { openAnalysisConfirmation, openPrivacyConfirmation, openModal } from './modal.js';
import { showToast } from './toast.js';
import { analyzePrompt } from '../services/api.js';

function createField({ label, name, value = '', type = 'input', required = false, maxLength = null, hint = '', placeholder = '' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';
  const labelElement = document.createElement('label');
  labelElement.htmlFor = `prompt-${name}`;
  labelElement.append(document.createTextNode(label));
  if (required) {
    const mark = document.createElement('span');
    mark.className = 'required-mark';
    mark.textContent = ' *';
    labelElement.append(mark);
  }
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  input.id = `prompt-${name}`;
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  input.required = required;
  if (maxLength) input.maxLength = maxLength;
  if (name === 'content') input.className = 'prompt-input';
  wrapper.append(labelElement, input);
  if (hint || maxLength) {
    const meta = document.createElement('div');
    meta.className = 'form-field__meta';
    const hintElement = document.createElement('span');
    hintElement.textContent = hint;
    const count = document.createElement('span');
    if (maxLength) {
      const updateCount = () => { count.textContent = `${input.value.length}/${maxLength}`; };
      input.addEventListener('input', updateCount);
      updateCount();
    }
    meta.append(hintElement, count);
    wrapper.append(meta);
  }
  return { wrapper, input };
}

export function openPromptForm({ prompt = null, categories, onSave, onCreateCategory }) {
  const isEdit = Boolean(prompt);
  const workingCategories = categories.map((category) => ({ ...category }));
  let selectedIds = [...(prompt?.categoryIds || [])];
  const aiFieldState = { promptNameDirty: false, categoriesDirty: false, summaryDirty: false, inputDirty: false, outputDirty: false };
  let analysisTimer = null;
  let analysisController = null;
  let currentAnalysisRequestId = 0;
  let contextTrace = prompt?.contextTrace || null;
  let informationWarnings = prompt?.informationWarnings || prompt?.contextTrace?.informationWarnings || [];
  let traceContentHash = prompt?.traceContentHash || null;
  async function contentHash(value) {
    if (!globalThis.crypto?.subtle) return value;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  const form = document.createElement('form');
  form.id = 'prompt-form';
  form.className = 'form-grid';

  const nameField = createField({ label: 'Prompt name', name: 'name', value: prompt?.name || '', required: true, maxLength: 80 });

  const categoryField = document.createElement('div');
  categoryField.className = 'form-field';
  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'field-label';
  categoryLabel.append(document.createTextNode('Categories '));
  const requiredMark = document.createElement('span');
  requiredMark.className = 'required-mark';
  requiredMark.textContent = '*';
  categoryLabel.append(requiredMark);
  const categoryError = document.createElement('span');
  categoryError.className = 'field-error';
  categoryError.hidden = true;
  categoryError.textContent = 'Choose or create at least one category.';
  const categorySelect = createCategorySelect({
    categories: workingCategories,
    getSelectedIds: () => selectedIds,
    onChange: (ids) => {
      selectedIds = ids;
      aiFieldState.categoriesDirty = true;
      categoryError.hidden = selectedIds.length > 0;
    },
    onCreate: async (name) => {
      const existing = workingCategories.find((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        if (!selectedIds.includes(existing.id)) selectedIds = [...selectedIds, existing.id];
        aiFieldState.categoriesDirty = true;
      } else {
        let category;
        try {
          category = await onCreateCategory(name);
        } catch (error) {
          showToast(error.message, 'error');
          return;
        }
        workingCategories.push(category);
        selectedIds = [...selectedIds, category.id];
        aiFieldState.categoriesDirty = true;
      }
      categoryError.hidden = true;
      categorySelect.refresh();
    }
  });
  categoryField.append(categoryLabel, categorySelect.element, categoryError);
  const summaryField = createField({
    label: 'Summary', name: 'summary', value: prompt?.summary || '', type: 'textarea', required: true,
    maxLength: 240, hint: 'Explain when this prompt is useful.'
  });
  const inputField = createField({
    label: 'Input', name: 'input', value: prompt?.input || '', type: 'textarea', required: true,
    maxLength: 2000, hint: 'Describe the information, document or variables this prompt requires.',
    placeholder: 'Example: API requirements, OpenAPI specification and business rules.'
  });
  const outputField = createField({
    label: 'Output', name: 'output', value: prompt?.output || '', type: 'textarea', required: true,
    maxLength: 2000, hint: 'Describe the expected result, structure or format produced by this prompt.',
    placeholder: 'Example: A structured list of test cases with steps and expected results.'
  });
  const contentField = createField({
    label: 'Prompt content', name: 'content', value: prompt?.content || '', type: 'textarea', required: true,
    hint: 'Use {{variable}} placeholders where needed.'
  });
  const analysisControls = document.createElement('div');
  analysisControls.className = 'ai-analysis-controls';
  const analyzeButton = document.createElement('button');
  analyzeButton.className = 'button button--secondary'; analyzeButton.type = 'button';
  analyzeButton.append(createIcon('sparkle'), document.createTextNode(isEdit ? 'Re-analyze with AI' : 'Analyze with AI'));
  const analysisStatus = document.createElement('div');
  analysisStatus.className = 'ai-analysis-status'; analysisStatus.setAttribute('aria-live', 'polite'); analysisStatus.hidden = true;
  analysisControls.append(analyzeButton, analysisStatus);
  const traceSection = document.createElement('section');
  traceSection.className = 'context-trace';
  const traceTitle = document.createElement('h3'); traceTitle.textContent = 'Context Trace';
  const traceCards = document.createElement('div'); traceCards.className = 'context-trace__cards';
  traceSection.append(traceTitle, traceCards);
  function renderTrace() {
    traceCards.replaceChildren();
    if (!contextTrace) { traceSection.hidden = true; return; }
    traceSection.hidden = false;
    for (const type of ['project', 'organization', 'personal']) {
      const item = contextTrace[type] || { status: 'not_required', missingItems: [] };
      const card = document.createElement('article'); card.className = `context-trace__card context-trace__card--${item.status}`;
      const heading = document.createElement('strong'); heading.textContent = `${type} context`;
      const status = document.createElement('span'); status.textContent = item.status.replace('_', ' ');
      card.append(heading, status);
      (item.missingItems || []).forEach((missing) => { const row = document.createElement('div'); row.textContent = `• ${missing}`; card.append(row); });
      traceCards.append(card);
    }
  }
  renderTrace();
  form.append(nameField.wrapper, categoryField, contentField.wrapper, analysisControls, traceSection, summaryField.wrapper, inputField.wrapper, outputField.wrapper);

  const cancelButton = document.createElement('button');
  cancelButton.className = 'button button--secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  const saveButton = document.createElement('button');
  saveButton.className = 'button button--primary';
  saveButton.type = 'submit';
  saveButton.setAttribute('form', form.id);
  saveButton.append(createIcon(isEdit ? 'save' : 'plus'), document.createTextNode(isEdit ? 'Save changes' : 'Create prompt'));

  const fields = [summaryField, inputField, outputField];
  fields.forEach(({ input }, index) => input.addEventListener('input', () => {
    aiFieldState[['summaryDirty', 'inputDirty', 'outputDirty'][index]] = true;
  }));
  nameField.input.addEventListener('input', () => { aiFieldState.promptNameDirty = true; });

  function setLoading(loading) {
    analyzeButton.disabled = loading;
    saveButton.disabled = loading;
    if (loading) {
      analysisStatus.hidden = false;
      analysisStatus.replaceChildren();
      const spinner = document.createElement('span'); spinner.className = 'spinner'; spinner.setAttribute('aria-hidden', 'true');
      analysisStatus.append(spinner, document.createTextNode('Analyzing prompt and tracing required context...'));
      analyzeButton.replaceChildren(createIcon('sparkle'), document.createTextNode('Analyzing...'));
      [nameField, ...fields].forEach(({ input }) => input.classList.toggle('is-loading', true));
      categorySelect.element.classList.add('is-loading');
    } else {
      analyzeButton.replaceChildren(createIcon('sparkle'), document.createTextNode(isEdit ? 'Re-analyze with AI' : 'Analyze with AI'));
      [nameField, ...fields].forEach(({ input }) => input.classList.toggle('is-loading', false));
      categorySelect.element.classList.remove('is-loading');
    }
  }

  async function runAnalysis({ force = false, confirmed = false } = {}) {
    const content = contentField.input.value.trim();
    if (content.length < 50) {
      if (force) showToast('Prompt content must be at least 50 characters', 'error');
      return;
    }
    if (force && !confirmed && (isEdit || Object.values(aiFieldState).some(Boolean))) {
      openAnalysisConfirmation({ onConfirm: () => {
        aiFieldState.summaryDirty = false;
        aiFieldState.inputDirty = false;
        aiFieldState.outputDirty = false;
        runAnalysis({ force: true, confirmed: true });
      } });
      return;
    }
    analysisController?.abort();
    const requestId = ++currentAnalysisRequestId;
    analysisController = new AbortController();
    setLoading(true);
    try {
      const result = await analyzePrompt(content, { signal: analysisController.signal });
      if (requestId !== currentAnalysisRequestId || content !== contentField.input.value.trim()) return;
      if (!aiFieldState.promptNameDirty) nameField.input.value = result.promptName;
      if (!aiFieldState.categoriesDirty) {
        const validIds = new Set(workingCategories.map((category) => category.id));
        selectedIds = (result.categoryIds || []).filter((id) => validIds.has(id));
        categoryError.hidden = selectedIds.length > 0;
        categorySelect.refresh();
      }
      if (!aiFieldState.summaryDirty) summaryField.input.value = result.summary;
      if (!aiFieldState.inputDirty) inputField.input.value = result.input;
      if (!aiFieldState.outputDirty) outputField.input.value = result.output;
      contextTrace = result.contextTrace || null;
      informationWarnings = result.informationWarnings || [];
      traceContentHash = await contentHash(content);
      renderTrace();
      analysisStatus.hidden = false;
      analysisStatus.replaceChildren(document.createTextNode('✓ Prompt details generated — review and edit before saving.'));
      window.setTimeout(() => { if (analysisStatus.isConnected) analysisStatus.hidden = true; }, 2000);
    } catch (error) {
      if (error.name !== 'AbortError' && requestId === currentAnalysisRequestId) {
        analysisStatus.hidden = false;
        analysisStatus.replaceChildren(document.createTextNode('Could not generate prompt details. You can retry or enter them manually.'));
        showToast(error.message.includes('not configured') ? 'AI analysis is not configured. Enter the details manually.' : 'Could not analyze this prompt. You can retry or enter the details manually.', 'error');
      }
    } finally {
      if (requestId === currentAnalysisRequestId) { setLoading(false); analysisController = null; }
    }
  }

  analyzeButton.addEventListener('click', () => runAnalysis({ force: true }));
  contentField.input.addEventListener('paste', () => {
    if (isEdit) return;
    window.clearTimeout(analysisTimer);
    analysisController?.abort();
    analysisTimer = window.setTimeout(() => runAnalysis(), 700);
  });
  contentField.input.addEventListener('input', () => {
    if (contextTrace && contentField.input.value.trim() !== prompt?.content?.trim()) {
      analysisStatus.hidden = false;
      analysisStatus.textContent = 'Prompt content changed — context trace is out of date.';
    }
  });

  const close = openModal({
    title: isEdit ? 'Edit prompt' : 'Create a new prompt',
    subtitle: isEdit ? 'Update the prompt details and save your changes.' : 'Add a reusable prompt to your personal library.',
    content: form,
    footer: [cancelButton, saveButton],
    onClose: () => {
      window.clearTimeout(analysisTimer);
      analysisController?.abort();
      currentAnalysisRequestId += 1;
    }
  });
  cancelButton.addEventListener('click', close);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!selectedIds.length) {
      categoryError.hidden = false;
      categorySelect.focus();
      return;
    }
    const currentContent = contentField.input.value.trim();
    if (contextTrace && traceContentHash !== await contentHash(currentContent)) {
      contextTrace = null; informationWarnings = []; traceContentHash = null; renderTrace();
      await runAnalysis({ force: false });
      if (!contextTrace) { showToast('Context review is unavailable. You can create without review.', 'error'); }
    }
    const save = () => onSave({
      data: {
        name: nameField.input.value, categoryIds: selectedIds, summary: summaryField.input.value,
        input: inputField.input.value, output: outputField.input.value, content: contentField.input.value,
        contextTrace: contextTrace || {}, informationWarnings, traceStatus: contextTrace ? (informationWarnings.length ? 'warning' : 'completed') : 'unavailable',
        traceContentHash, traceAnalyzedAt: contextTrace ? new Date().toISOString() : null
      }, categories: workingCategories
    });
    saveButton.disabled = true;
    try {
      let saved;
      if (informationWarnings.length) {
        openPrivacyConfirmation({ warnings: informationWarnings, onCancel: () => { saveButton.disabled = false; }, onConfirm: async () => { try { saved = await save(); if (saved !== false) close(); } catch (error) { showToast(error.message, 'error'); saveButton.disabled = false; } } });
        return;
      }
      saved = await save();
      if (saved !== false) close();
    } catch (error) {
      showToast(error.message, 'error');
      saveButton.disabled = false;
    }
  });
}
