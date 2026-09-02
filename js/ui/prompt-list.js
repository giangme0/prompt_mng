import { formatRelativeDate } from '../utils/date.js';
import { createIcon } from './icons.js';

function createCategoryChip(category) {
  const chip = document.createElement('span');
  chip.className = 'category-chip';
  chip.style.setProperty('--chip-color', category.color);
  chip.textContent = category.name;
  return chip;
}

export function renderPromptList({ prompts, categories, selectedPromptId, onSelect, onCopy, onNew }) {
  const container = document.querySelector('#prompt-list');
  container.replaceChildren();
  if (!prompts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    const content = document.createElement('div');
    const icon = document.createElement('div');
    icon.className = 'empty-list__icon';
    icon.append(createIcon('inbox'));
    const heading = document.createElement('h2');
    heading.textContent = 'No prompts found';
    const copy = document.createElement('p');
    copy.textContent = 'Try changing your search or category filters, or create a new prompt.';
    const button = document.createElement('button');
    button.className = 'button button--primary';
    button.type = 'button';
    button.style.marginTop = '18px';
    button.append(createIcon('plus'), document.createTextNode('New prompt'));
    button.addEventListener('click', onNew);
    content.append(icon, heading, copy, button);
    empty.append(content);
    container.append(empty);
    return;
  }

  prompts.forEach((prompt) => {
    const card = document.createElement('article');
    card.className = `prompt-card${selectedPromptId === prompt.id ? ' prompt-card--selected' : ''}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View ${prompt.name}`);
    const header = document.createElement('div');
    header.className = 'prompt-card__header';
    const title = document.createElement('h2');
    title.textContent = prompt.name;
    header.append(title);
    const summary = document.createElement('p');
    summary.className = 'prompt-card__summary';
    summary.textContent = prompt.summary;

    const tags = document.createElement('div');
    tags.className = 'prompt-card__tags';
    const promptCategories = prompt.categoryIds.map((id) => categories.find((category) => category.id === id)).filter(Boolean);
    promptCategories.slice(0, 3).forEach((category) => tags.append(createCategoryChip(category)));
    if (promptCategories.length > 3) {
      const more = document.createElement('span');
      more.className = 'category-chip category-chip--more';
      more.textContent = `+${promptCategories.length - 3}`;
      more.title = promptCategories.slice(3).map((category) => category.name).join(', ');
      tags.append(more);
    }

    const footer = document.createElement('div');
    footer.className = 'prompt-card__footer';
    const updated = document.createElement('span');
    updated.textContent = `Updated ${formatRelativeDate(prompt.updatedAt)}`;
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-quick-action';
    copyButton.type = 'button';
    copyButton.append(createIcon('copy'), document.createTextNode('Copy'));
    copyButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onCopy(prompt, copyButton);
    });
    footer.append(updated, copyButton);
    card.append(header, summary, tags, footer);
    card.addEventListener('click', () => onSelect(prompt.id));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(prompt.id);
      }
    });
    container.append(card);
  });
}
