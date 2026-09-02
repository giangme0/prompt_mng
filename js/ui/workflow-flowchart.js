export function renderWorkflowFlowchart(container, workflow, categories, onPrompt) {
  const chart = document.createElement('div'); chart.className = `workflow-flowchart${workflow.steps.length > 5 ? ' workflow-flowchart--vertical' : ''}`;
  const addNode = (label, className) => { const node = document.createElement('div'); node.className = `workflow-node ${className}`; node.textContent = label; chart.append(node); };
  addNode('START', 'workflow-node--start');
  workflow.steps.forEach((step, index) => {
    const arrow = document.createElement('div'); arrow.className = 'workflow-arrow'; arrow.textContent = '↓'; chart.append(arrow);
    const node = document.createElement('button'); node.type = 'button'; node.className = 'workflow-node workflow-node--step';
    const number = document.createElement('strong'); number.textContent = `STEP ${index + 1}`;
    const name = document.createElement('span'); name.textContent = step.prompt?.name || 'Prompt';
    const tags = document.createElement('span'); tags.className = 'workflow-node__tags';
    (step.prompt?.categoryIds || []).forEach((id) => { const category = categories.find((item) => item.id === id); if (category) { const chip = document.createElement('span'); chip.className = 'category-chip'; chip.style.setProperty('--chip-color', category.color); chip.textContent = category.name; tags.append(chip); } });
    node.append(number, name, tags); node.addEventListener('click', () => onPrompt?.(step.promptId)); chart.append(node);
  });
  const arrow = document.createElement('div'); arrow.className = 'workflow-arrow'; arrow.textContent = '↓'; chart.append(arrow); addNode('END', 'workflow-node--end');
  container.replaceChildren(chart);
}
