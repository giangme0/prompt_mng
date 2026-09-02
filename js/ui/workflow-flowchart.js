export function renderWorkflowFlowchart(container, workflow, categories, onPrompt) {
  const chart = document.createElement('div'); chart.className = 'workflow-flowchart';
  const addNode = (label, className) => { const node = document.createElement('div'); node.className = `workflow-node ${className}`; node.textContent = label; chart.append(node); };
  const addConnector = () => { const arrow = document.createElement('span'); arrow.className = 'workflow-arrow'; arrow.setAttribute('aria-hidden', 'true'); chart.append(arrow); };
  const orderedSteps = [...(workflow.steps || [])].sort((a, b) => Number(a.order ?? a.position ?? 0) - Number(b.order ?? b.position ?? 0));
  const flowItems = [{ type: 'start' }, ...orderedSteps.map((step) => ({ type: 'step', step })), { type: 'end' }];

  flowItems.forEach((item, index) => {
    if (index) addConnector();
    if (item.type === 'start') { addNode('START', 'workflow-node--start'); return; }
    if (item.type === 'end') { addNode('END', 'workflow-node--end'); return; }
    const { step } = item;
    const node = document.createElement('button'); node.type = 'button'; node.className = 'workflow-node workflow-node--step';
    const number = document.createElement('strong'); number.textContent = `STEP ${orderedSteps.indexOf(step) + 1}`;
    const name = document.createElement('span'); name.textContent = step.prompt?.name || 'Prompt';
    const tags = document.createElement('span'); tags.className = 'workflow-node__tags';
    (step.prompt?.categoryIds || []).forEach((id) => { const category = categories.find((item) => item.id === id); if (category) { const chip = document.createElement('span'); chip.className = 'category-chip'; chip.style.setProperty('--chip-color', category.color); chip.textContent = category.name; tags.append(chip); } });
    node.append(number, name, tags); node.addEventListener('click', () => onPrompt?.(step.promptId)); chart.append(node);
  });
  container.replaceChildren(chart);
}
