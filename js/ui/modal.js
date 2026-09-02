import { createIcon } from './icons.js';

const root = document.querySelector('#modal-root');
let activeClose = null;

export function openModal({ title, subtitle = '', content, footer = [], size = 'default', onClose = null }) {
  if (activeClose) activeClose();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('section');
  modal.className = `modal${size === 'small' ? ' modal--small' : ''}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');

  const header = document.createElement('header');
  header.className = 'modal__header';
  const headingGroup = document.createElement('div');
  const heading = document.createElement('h2');
  heading.id = 'modal-title';
  heading.textContent = title;
  headingGroup.append(heading);
  if (subtitle) {
    const description = document.createElement('p');
    description.textContent = subtitle;
    headingGroup.append(description);
  }
  const closeButton = document.createElement('button');
  closeButton.className = 'icon-button';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close dialog');
  closeButton.append(createIcon('close'));
  header.append(headingGroup, closeButton);

  const body = document.createElement('div');
  body.className = 'modal__body';
  body.append(content);
  modal.append(header, body);
  if (footer.length) {
    const footerElement = document.createElement('footer');
    footerElement.className = 'modal__footer';
    footerElement.append(...footer);
    modal.append(footerElement);
  }
  overlay.append(modal);
  root.replaceChildren(overlay);
  document.body.classList.add('modal-open');
  const previousFocus = document.activeElement;

  function close() {
    if (!overlay.isConnected) return;
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    document.body.classList.remove('modal-open');
    activeClose = null;
    onClose?.();
    previousFocus?.focus?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') close();
  }

  closeButton.addEventListener('click', close);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', handleKeydown);
  activeClose = close;
  window.setTimeout(() => modal.querySelector('input, textarea, select, button')?.focus());
  return close;
}

export function openConfirmation({ promptName, onConfirm }) {
  const content = document.createElement('div');
  content.className = 'confirmation-layout';
  const icon = document.createElement('div');
  icon.className = 'confirmation-icon';
  icon.append(createIcon('alert'));
  const copy = document.createElement('div');
  copy.className = 'confirmation-copy';
  const heading = document.createElement('h3');
  heading.textContent = 'This action cannot be undone';
  const description = document.createElement('p');
  description.textContent = `“${promptName}” will be permanently removed from your prompt library.`;
  copy.append(heading, description);
  content.append(icon, copy);

  const cancelButton = document.createElement('button');
  cancelButton.className = 'button button--secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  const deleteButton = document.createElement('button');
  deleteButton.className = 'button button--danger';
  deleteButton.type = 'button';
  deleteButton.append(createIcon('trash'), document.createTextNode('Delete prompt'));
  const close = openModal({ title: 'Delete prompt?', content, footer: [cancelButton, deleteButton], size: 'small' });
  cancelButton.addEventListener('click', close);
  deleteButton.addEventListener('click', () => {
    close();
    onConfirm();
  });
}
