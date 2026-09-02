import { seedCategories, seedPrompts } from '../data/seed.js';

const KEYS = {
  prompts: 'promptvault.prompts',
  categories: 'promptvault.categories',
  settings: 'promptvault.settings'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function read(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : clone(fallback);
  } catch (error) {
    console.warn(`Could not read ${key} from local storage.`, error);
    return clone(fallback);
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not write ${key} to local storage.`, error);
    return false;
  }
}

export function loadData() {
  const prompts = read(KEYS.prompts, seedPrompts);
  const categories = read(KEYS.categories, seedCategories);
  const settings = read(KEYS.settings, {});

  if (!localStorage.getItem(KEYS.prompts)) write(KEYS.prompts, prompts);
  if (!localStorage.getItem(KEYS.categories)) write(KEYS.categories, categories);

  return { prompts, categories, settings };
}

export function savePrompts(prompts) {
  return write(KEYS.prompts, prompts);
}

export function saveCategories(categories) {
  return write(KEYS.categories, categories);
}

export function saveSettings(settings) {
  return write(KEYS.settings, settings);
}
