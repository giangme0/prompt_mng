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
  const informationReviewState = {
    warnings: prompt?.informationWarnings || [],
    status: prompt?.informationReviewStatus || 'not_analyzed',
    reviewedContentHash: prompt?.informationReviewContentHash || null,
    reviewedAt: prompt?.informationReviewedAt || null,
    isReviewing: false,
    error: null
  };
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
  const informationSection = document.createElement('section');
  informationSection.className = 'information-review';
  const informationTitle = document.createElement('h3'); informationTitle.textContent = 'Information to review';
  const informationCards = document.createElement('div'); informationCards.className = 'information-review__cards';
  informationSection.append(informationTitle, informationCards);
  function renderInformationReview() {
    informationCards.replaceChildren();
    const groups = { credential: 'Possible credential', personal: 'Personal identifiers', organization: 'Organization references', project: 'Project references' };
    const descriptions = { credential: 'Authentication or secret information', personal: 'Name, employee ID and email', organization: 'Company reference', project: 'Private project identifier' };
    const icons = { credential: '🔑', personal: '👤', organization: '🏢', project: '📁' };
    for (const type of ['credential', 'personal', 'organization', 'project']) {
      const warnings = informationReviewState.warnings.filter((warning) => warning.type === type);
      if (!warnings.length) continue;
      const card = document.createElement('article'); card.className = 'information-review__card';
      const heading = document.createElement('div'); heading.className = 'information-review__heading';
      const label = document.createElement('strong'); label.textContent = `${icons[type]} ${warnings[0].title || groups[type]}`;
      const review = document.createElement('span'); review.textContent = 'Review'; review.className = 'information-review__badge';
      heading.append(label, review);
      const description = document.createElement('p'); description.textContent = descriptions[type];
      card.append(heading, description);
      warnings.slice(0, 3).forEach((warning) => { const evidence = document.createElement('p'); evidence.className = 'information-review__evidence'; evidence.textContent = `Detected: ${(warning.detectedValues || [warning.evidence]).join(' · ') || '[REDACTED]'}`; card.append(evidence); });
      if (warnings.length > 3) { const more = document.createElement('p'); more.className = 'information-review__more'; more.textContent = `+ ${warnings.length - 3} more references`; card.append(more); }
      informationCards.append(card);
    }
    informationSection.hidden = !informationReviewState.warnings.length;
  }
  renderInformationReview();
  form.append(nameField.wrapper, categoryField, contentField.wrapper, analysisControls, informationSection, summaryField.wrapper, inputField.wrapper, outputField.wrapper);

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
    if (loading) {
      analysisStatus.hidden = false;
      analysisStatus.replaceChildren();
      const spinner = document.createElement('span'); spinner.className = 'spinner'; spinner.setAttribute('aria-hidden', 'true');
      analysisStatus.append(spinner, document.createTextNode('Analyzing prompt and reviewing private information...'));
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
    informationReviewState.isReviewing = true;
    setLoading(true);
    try {
      const result = await analyzePrompt(content, { signal: analysisController.signal });
      if (requestId !== currentAnalysisRequestId || content !== contentField.input.value.trim()) return;
      if (!aiFieldState.promptNameDirty) nameField.input.value = result.name;
      if (!aiFieldState.categoriesDirty) {
        const validIds = new Set(workingCategories.map((category) => category.id));
        selectedIds = (result.suggestedCategoryIds || []).filter((id) => validIds.has(id));
        categoryError.hidden = selectedIds.length > 0;
        categorySelect.refresh();
      }
      if (!aiFieldState.summaryDirty) summaryField.input.value = result.summary;
      if (!aiFieldState.inputDirty) inputField.input.value = result.input;
      if (!aiFieldState.outputDirty) outputField.input.value = result.output;
      informationReviewState.warnings = result.informationWarnings || [];
      informationReviewState.status = informationReviewState.warnings.length ? 'warning' : 'clear';
      informationReviewState.reviewedContentHash = await contentHash(content);
      informationReviewState.reviewedAt = new Date().toISOString();
      informationReviewState.error = null;
      renderInformationReview();
      analysisStatus.hidden = false;
      analysisStatus.replaceChildren(document.createTextNode('✓ Prompt details generated — review and edit before saving.'));
      window.setTimeout(() => { if (analysisStatus.isConnected) analysisStatus.hidden = true; }, 2000);
    } catch (error) {
      if (error.name !== 'AbortError' && requestId === currentAnalysisRequestId) {
        informationReviewState.status = 'unavailable';
        informationReviewState.error = error.message;
        analysisStatus.hidden = false;
        analysisStatus.replaceChildren(document.createTextNode('Could not generate prompt details. You can retry or enter them manually.'));
        showToast(error.message.includes('not configured') ? 'AI analysis is not configured. Enter the details manually.' : 'Could not analyze this prompt. You can retry or enter the details manually.', 'error');
      }
    } finally {
      if (requestId === currentAnalysisRequestId) { informationReviewState.isReviewing = false; setLoading(false); analysisController = null; }
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
    if (informationReviewState.status !== 'not_analyzed' && contentField.input.value.trim() !== prompt?.content?.trim()) {
      analysisStatus.hidden = false;
      informationReviewState.status = 'stale';
      analysisStatus.textContent = 'Prompt content changed — information review is out of date.';
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
    if (informationReviewState.status === 'stale') {
      informationReviewState.warnings = [];
      renderInformationReview();
      await runAnalysis({ force: false });
      if (informationReviewState.status === 'stale') { informationReviewState.status = 'unavailable'; informationReviewState.error = 'Review unavailable'; }
    }
    const save = () => onSave({
      data: {
        name: nameField.input.value, categoryIds: selectedIds, summary: summaryField.input.value,
        input: inputField.input.value, output: outputField.input.value, content: contentField.input.value,
        informationWarnings: informationReviewState.warnings,
        informationReviewStatus: informationReviewState.status,
        informationReviewContentHash: informationReviewState.reviewedContentHash,
        informationReviewedAt: informationReviewState.reviewedAt
      }, categories: workingCategories
    });
    saveButton.disabled = true;
    try {
      let saved;
      if (informationReviewState.warnings.length) {
        openPrivacyConfirmation({ warnings: informationReviewState.warnings, actionLabel: isEdit ? 'Save anyway' : 'Create anyway', onCancel: () => { saveButton.disabled = false; }, onConfirm: async () => { try { saved = await save(); if (saved !== false) close(); } catch (error) { showToast(error.message, 'error'); saveButton.disabled = false; } } });
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
