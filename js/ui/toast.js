import { createIcon } from './icons.js';

const region = document.querySelector('#toast-region');

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.append(createIcon(type === 'success' ? 'check' : 'alert'));
  const label = document.createElement('span');
  label.textContent = message;
  toast.append(label);
  region.append(toast);

  window.setTimeout(() => {
    toast.classList.add('toast--leaving');
    window.setTimeout(() => toast.remove(), 180);
  }, 2200);
}
