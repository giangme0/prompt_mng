import { formatDateTime } from '../utils/date.js';
import { createIcon } from './icons.js';

export function renderPromptDetail({ prompt, categories, onCopy, onEdit, onDelete, onBack }) {
  const container = document.querySelector('#prompt-detail');
  container.replaceChildren();
  if (!prompt) {
    const empty = document.createElement('div');
    empty.className = 'detail-empty';
    const content = document.createElement('div');
    const icon = document.createElement('div');
    icon.className = 'detail-empty__icon';
    icon.append(createIcon('sparkle'));
    const heading = document.createElement('h2');
    heading.textContent = 'Select a prompt';
    const copy = document.createElement('p');
    copy.textContent = 'Choose a prompt from the library to read its summary and content.';
    content.append(icon, heading, copy);
    empty.append(content);
    container.append(empty);
    return;
  }

  const detail = document.createElement('article');
  detail.className = 'detail-content';
  const mobileBar = document.createElement('div');
  mobileBar.className = 'detail-mobile-bar';
  const backButton = document.createElement('button');
  backButton.className = 'icon-button';
  backButton.type = 'button';
  backButton.setAttribute('aria-label', 'Back to prompt list');
  backButton.append(createIcon('arrowLeft'));
  backButton.addEventListener('click', onBack);
  mobileBar.append(backButton, document.createTextNode('Back to prompts'));

  const topbar = document.createElement('div');
  topbar.className = 'detail-topbar';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Prompt details';
  const actions = document.createElement('div');
  actions.className = 'detail-topbar__actions';
  const editButton = document.createElement('button');
  editButton.className = 'icon-button';
  editButton.type = 'button';
  editButton.title = 'Edit prompt';
  editButton.setAttribute('aria-label', 'Edit prompt');
  editButton.append(createIcon('edit'));
  editButton.addEventListener('click', () => onEdit(prompt));
  const deleteButton = document.createElement('button');
  deleteButton.className = 'icon-button icon-button--danger';
  deleteButton.type = 'button';
  deleteButton.title = 'Delete prompt';
  deleteButton.setAttribute('aria-label', 'Delete prompt');
  deleteButton.append(createIcon('trash'));
  deleteButton.addEventListener('click', () => onDelete(prompt));
  actions.append(editButton, deleteButton);
  topbar.append(eyebrow, actions);

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = prompt.name;
  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  prompt.categoryIds.forEach((id) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return;
    const chip = document.createElement('span');
    chip.className = 'category-chip';
    chip.style.setProperty('--chip-color', category.color);
    chip.textContent = category.name;
    tags.append(chip);
  });

  const summarySection = document.createElement('section');
  summarySection.className = 'detail-section';
  const summaryTitle = document.createElement('h3');
  summaryTitle.textContent = 'Summary';
  const summaryHeading = document.createElement('div');
  summaryHeading.className = 'detail-section__heading';
  summaryHeading.append(summaryTitle);
  const summary = document.createElement('p');
  summary.className = 'detail-summary';
  summary.textContent = prompt.summary;
  summarySection.append(summaryHeading, summary);

  const io = document.createElement('div');
  io.className = 'detail-io';
  for (const [label, value] of [['Input', prompt.input || ''], ['Output', prompt.output || '']]) {
    const card = document.createElement('section');
    card.className = `prompt-io-card${value ? '' : ' prompt-io-card--empty'}`;
    const cardTitle = document.createElement('h3');
    cardTitle.textContent = label;
    const cardText = document.createElement('p');
    cardText.textContent = value || 'Not specified';
    card.append(cardTitle, cardText);
    io.append(card);
  }

  const promptSection = document.createElement('section');
  promptSection.className = 'detail-section';
  const promptTitle = document.createElement('h3');
  promptTitle.textContent = 'Prompt';
  const promptHeading = document.createElement('div');
  promptHeading.className = 'detail-section__heading';
  promptHeading.append(promptTitle);
  const code = document.createElement('pre');
  code.className = 'prompt-code';
  code.textContent = prompt.content;
  promptSection.append(promptHeading, code);

  const warnings = prompt.informationWarnings || [];
  const informationSection = document.createElement('section');
  informationSection.className = 'detail-section information-review';
  informationSection.hidden = !warnings.length && prompt.informationReviewStatus !== 'stale';
  const informationHeading = document.createElement('h3'); informationHeading.textContent = 'Information to review';
  const informationCards = document.createElement('div'); informationCards.className = 'information-review__cards';
  const groups = { credential: 'Possible credential', personal: 'Personal identifiers', organization: 'Organization references', project: 'Project references' };
  const descriptions = { credential: 'Authentication or secret information', personal: 'Name, employee ID and email', organization: 'Company reference', project: 'Private project identifier' };
  const icons = { credential: '🔑', personal: '👤', organization: '🏢', project: '📁' };
  for (const type of ['credential', 'personal', 'organization', 'project']) {
    const grouped = warnings.filter((warning) => warning.type === type);
    if (!grouped.length) continue;
    const card = document.createElement('article'); card.className = 'information-review__card';
    const heading = document.createElement('div'); heading.className = 'information-review__heading';
    const label = document.createElement('strong'); label.textContent = `${icons[type]} ${grouped[0].title || groups[type]}`;
    const badge = document.createElement('span'); badge.className = 'information-review__badge'; badge.textContent = 'Review';
    heading.append(label, badge);
    const description = document.createElement('p'); description.textContent = descriptions[type];
    card.append(heading, description);
    grouped.slice(0, 3).forEach((warning) => { const evidence = document.createElement('p'); evidence.className = 'information-review__evidence'; evidence.textContent = `Detected: ${(warning.detectedValues || [warning.evidence]).join(' · ') || '[REDACTED]'}`; card.append(evidence); });
    if (grouped.length > 3) { const more = document.createElement('p'); more.className = 'information-review__more'; more.textContent = `+ ${grouped.length - 3} more references`; card.append(more); }
    informationCards.append(card);
  }
  informationSection.append(informationHeading, informationCards);
  if (prompt.informationReviewStatus === 'stale') {
    const stale = document.createElement('p'); stale.className = 'detail-meta'; stale.textContent = 'Information review is out of date.';
    const reviewButton = document.createElement('button'); reviewButton.className = 'button button--secondary'; reviewButton.type = 'button'; reviewButton.textContent = 'Re-analyze prompt'; reviewButton.addEventListener('click', () => onEdit(prompt));
    informationSection.append(stale, reviewButton);
  }

  const footer = document.createElement('footer');
  footer.className = 'detail-footer';
  const meta = document.createElement('p');
  meta.className = 'detail-meta';
  const metaLabel = document.createElement('strong');
  metaLabel.textContent = 'Last updated';
  meta.append(metaLabel, document.createElement('br'), document.createTextNode(formatDateTime(prompt.updatedAt)));
  const copyButton = document.createElement('button');
  copyButton.className = 'button button--primary';
  copyButton.type = 'button';
  copyButton.append(createIcon('copy'), document.createTextNode('Copy prompt'));
  copyButton.addEventListener('click', () => onCopy(prompt, copyButton));
  footer.append(meta, copyButton);
  detail.append(mobileBar, topbar, title, tags, summarySection, io, promptSection, informationSection, footer);
  container.append(detail);
}
