import { formatDateTime } from '../utils/date.js';
import { renderWorkflowFlowchart } from './workflow-flowchart.js';

export function renderWorkflowDetail({ workflow, categories, onEdit, onDelete, onPrompt }) {
  const container = document.querySelector('#workflow-detail'); container.replaceChildren();
  if (!workflow) { container.textContent = 'Select a workflow to view its flow.'; return; }
  const heading = document.createElement('div'); heading.className = 'workflow-detail-heading';
  const title = document.createElement('h2'); title.className = 'detail-title'; title.textContent = workflow.name;
  const actions = document.createElement('div'); actions.className = 'detail-topbar__actions';
  [['Edit', onEdit, 'button--secondary'], ['Delete', onDelete, 'button--danger']].forEach(([label, fn, style]) => { const button = document.createElement('button'); button.className = `button ${style}`; button.type = 'button'; button.textContent = label; button.addEventListener('click', fn); actions.append(button); });
  heading.append(title, actions); const meta = document.createElement('p'); meta.className = 'detail-meta'; meta.textContent = `${workflow.steps.length} steps · Updated ${formatDateTime(workflow.updatedAt)}`;
  const label = document.createElement('h3'); label.textContent = 'Workflow Flow'; const chart = document.createElement('div'); renderWorkflowFlowchart(chart, workflow, categories, onPrompt); container.append(heading, meta, label, chart);
}
