import { createIcon } from './icons.js';
import { openModal, openCategoryConfirmation } from './modal.js';
import { openCategoryForm } from './category-form.js';

export function openCategoryManager({ categories, onCreate, onUpdate, onDelete }) {
  const content = document.createElement('div'); content.className = 'category-manager';
  const list = document.createElement('div'); list.className = 'category-manager__list';
  const header = document.createElement('div'); header.className = 'category-manager__row category-manager__header';
  ['Category name', 'Prompts', 'Actions'].forEach((text) => { const cell = document.createElement('span'); cell.textContent = text; header.append(cell); });
  list.append(header);
  const newButton = document.createElement('button'); newButton.className = 'button button--ghost category-manager__new'; newButton.type = 'button'; newButton.append(createIcon('plus'), document.createTextNode('New category'));
  content.append(list, newButton);
  const close = openModal({ title: 'Manage categories', content });
  const render = () => { list.replaceChildren(header); [...categories].sort((a, b) => a.name.localeCompare(b.name)).forEach((category) => {
    const row = document.createElement('div'); row.className = 'category-manager__row';
    const identity = document.createElement('div'); identity.className = 'category-manager__identity';
    const dot = document.createElement('span'); dot.className = 'category-dot'; dot.style.setProperty('--dot-color', category.color);
    const name = document.createElement('strong'); name.textContent = category.name; identity.append(dot, name);
    const count = document.createElement('span'); count.className = 'category-manager__count'; count.textContent = category.promptCount ?? 0;
    const actions = document.createElement('div'); actions.className = 'category-manager__actions';
    const edit = document.createElement('button'); edit.className = 'text-button'; edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => openCategoryForm({ category, onSave: (data) => onUpdate(category.id, data) }));
    const del = document.createElement('button'); del.className = 'text-button text-button--danger'; del.type = 'button'; del.textContent = 'Delete';
    del.addEventListener('click', () => openCategoryConfirmation({ category, onConfirm: () => onDelete(category.id) }));
    actions.append(edit, del); row.append(identity, count, actions); list.append(row);
  }); };
  newButton.addEventListener('click', () => openCategoryForm({ onSave: onCreate }));
  render(); return close;
}