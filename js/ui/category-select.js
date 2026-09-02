import { createIcon } from './icons.js';

export function createCategorySelect({ categories, getSelectedIds, onChange, onCreate }) {
  const root = document.createElement('div');
  root.className = 'category-select';
  const control = document.createElement('div');
  control.className = 'category-select__control';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search or create a category...';
  input.setAttribute('aria-label', 'Search or create a category');
  input.setAttribute('autocomplete', 'off');
  const menu = document.createElement('div');
  menu.className = 'category-select__menu';
  root.append(control, menu);

  function render() {
    const selectedIds = getSelectedIds();
    control.replaceChildren();
    selectedIds.forEach((id) => {
      const category = categories.find((item) => item.id === id);
      if (!category) return;
      const chip = document.createElement('span');
      chip.className = 'selected-category';
      chip.style.setProperty('--chip-color', category.color);
      chip.append(document.createTextNode(category.name));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${category.name}`);
      remove.append(createIcon('close'));
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        onChange(getSelectedIds().filter((selectedId) => selectedId !== id));
        render();
      });
      chip.append(remove);
      control.append(chip);
    });
    control.append(input);
    renderMenu();
  }

  function renderMenu() {
    const selectedIds = getSelectedIds();
    const query = input.value.trim().toLocaleLowerCase();
    const visible = categories.filter((category) => category.name.toLocaleLowerCase().includes(query));
    menu.replaceChildren();

    visible.forEach((category) => {
      const option = document.createElement('button');
      option.className = 'category-option';
      option.type = 'button';
      const label = document.createElement('span');
      label.className = 'category-option__label';
      const dot = document.createElement('span');
      dot.className = 'category-dot';
      dot.style.setProperty('--dot-color', category.color);
      label.append(dot, document.createTextNode(category.name));
      option.append(label);
      if (selectedIds.includes(category.id)) {
        const check = createIcon('check');
        check.classList.add('category-option__check');
        option.append(check);
      }
      option.addEventListener('click', () => {
        const current = getSelectedIds();
        onChange(current.includes(category.id)
          ? current.filter((id) => id !== category.id)
          : [...current, category.id]);
        input.value = '';
        render();
        input.focus();
      });
      menu.append(option);
    });

    const exactMatch = categories.some((category) => category.name.toLocaleLowerCase() === query);
    if (query && !exactMatch) {
      const createButton = document.createElement('button');
      createButton.className = 'category-option category-option--create';
      createButton.type = 'button';
      createButton.append(createIcon('plus'), document.createTextNode(`Create “${input.value.trim()}”`));
      createButton.addEventListener('click', createFromInput);
      menu.append(createButton);
    }
    if (!visible.length && (!query || exactMatch)) {
      const empty = document.createElement('div');
      empty.className = 'category-option category-option--empty';
      empty.textContent = query ? 'No category found' : 'No categories available';
      menu.append(empty);
    }
  }

  async function createFromInput() {
    const name = input.value.trim();
    if (!name) return;
    await onCreate(name);
    input.value = '';
    render();
    input.focus();
  }

  control.addEventListener('click', () => {
    root.classList.add('category-select--open');
    input.focus();
  });
  input.addEventListener('focus', () => root.classList.add('category-select--open'));
  input.addEventListener('input', renderMenu);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && input.value.trim()) {
      event.preventDefault();
      const exact = categories.find((category) => category.name.toLocaleLowerCase() === input.value.trim().toLocaleLowerCase());
      if (exact && !getSelectedIds().includes(exact.id)) {
        onChange([...getSelectedIds(), exact.id]);
        input.value = '';
        render();
      } else if (!exact) {
        createFromInput();
      }
    }
    if (event.key === 'Escape') root.classList.remove('category-select--open');
  });
  root.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!root.contains(document.activeElement)) root.classList.remove('category-select--open');
    });
  });
  render();
  return { element: root, refresh: render, focus: () => input.focus() };
}
