import { createIcon } from './icons.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { CATEGORY_COLORS } from '../modules/categories.js';

export function openCategoryForm({ category = null, onSave }) {
  const form = document.createElement('form');
  form.className = 'form-grid category-form';
  form.id = category ? 'edit-category-form' : 'new-category-form';
  const nameField = document.createElement('div');
  nameField.className = 'form-field';
  const label = document.createElement('label');
  label.htmlFor = 'category-name'; label.textContent = 'Category name';
  const input = document.createElement('input');
  input.id = 'category-name'; input.name = 'name'; input.required = true; input.maxLength = 50; input.value = category?.name || '';
  nameField.append(label, input);
  const colorField = document.createElement('div'); colorField.className = 'form-field';
  const colorLabel = document.createElement('span'); colorLabel.className = 'field-label'; colorLabel.textContent = 'Color';
  const colors = document.createElement('div'); colors.className = 'color-picker';
  let selectedColor = category?.color || '#16a34a';
  CATEGORY_COLORS.forEach((color) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'color-option';
    button.style.setProperty('--option-color', color); button.setAttribute('aria-label', color); button.setAttribute('aria-pressed', String(color === selectedColor));
    button.addEventListener('click', () => { selectedColor = color; colors.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); });
    colors.append(button);
  });
  colorField.append(colorLabel, colors); form.append(nameField, colorField);
  const cancel = document.createElement('button'); cancel.className = 'button button--secondary'; cancel.type = 'button'; cancel.textContent = 'Cancel';
  const save = document.createElement('button'); save.className = 'button button--primary'; save.type = 'submit'; save.append(createIcon(category ? 'save' : 'plus'), document.createTextNode(category ? 'Save changes' : 'Create category'));
  save.setAttribute('form', form.id);
  const close = openModal({ title: category ? 'Edit category' : 'New category', content: form, footer: [cancel, save], size: 'small' });
  cancel.addEventListener('click', close);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    save.disabled = true;
    try { await onSave({ name: input.value.trim(), color: selectedColor }); close(); }
    catch (error) { showToast(error.message, 'error'); save.disabled = false; }
  });
}