import { createCategory } from '../modules/categories.js';
import { createId } from '../utils/id.js';
import { createCategorySelect } from './category-select.js';
import { createIcon } from './icons.js';
import { openModal } from './modal.js';

function createField({ label, name, value = '', type = 'input', required = false, maxLength = null, hint = '' }) {
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

export function openPromptForm({ prompt = null, categories, onSave }) {
  const isEdit = Boolean(prompt);
  const workingCategories = categories.map((category) => ({ ...category }));
  let selectedIds = [...(prompt?.categoryIds || [])];
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
      categoryError.hidden = selectedIds.length > 0;
    },
    onCreate: (name) => {
      const existing = workingCategories.find((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        if (!selectedIds.includes(existing.id)) selectedIds = [...selectedIds, existing.id];
      } else {
        const category = createCategory(name, createId('cat'), workingCategories.length);
        workingCategories.push(category);
        selectedIds = [...selectedIds, category.id];
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
  const contentField = createField({
    label: 'Prompt content', name: 'content', value: prompt?.content || '', type: 'textarea', required: true,
    hint: 'Use {{variable}} placeholders where needed.'
  });
  form.append(nameField.wrapper, categoryField, summaryField.wrapper, contentField.wrapper);

  const cancelButton = document.createElement('button');
  cancelButton.className = 'button button--secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  const saveButton = document.createElement('button');
  saveButton.className = 'button button--primary';
  saveButton.type = 'submit';
  saveButton.setAttribute('form', form.id);
  saveButton.append(createIcon(isEdit ? 'save' : 'plus'), document.createTextNode(isEdit ? 'Save changes' : 'Create prompt'));

  const close = openModal({
    title: isEdit ? 'Edit prompt' : 'Create a new prompt',
    subtitle: isEdit ? 'Update the prompt details and save your changes.' : 'Add a reusable prompt to your personal library.',
    content: form,
    footer: [cancelButton, saveButton]
  });
  cancelButton.addEventListener('click', close);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!selectedIds.length) {
      categoryError.hidden = false;
      categorySelect.focus();
      return;
    }
    onSave({
      data: {
        name: nameField.input.value,
        categoryIds: selectedIds,
        summary: summaryField.input.value,
        content: contentField.input.value
      },
      categories: workingCategories
    });
    close();
  });
}
