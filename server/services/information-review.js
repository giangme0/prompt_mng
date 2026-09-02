const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const EMPLOYEE_ID_PATTERN = /\b[A-Z]{2,}(?:[-_]\d{2,})+\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d ()-]{7,}\d)/g;
const PERSON_AFTER_PATTERN = /(?:nhân viên|họ tên|tên)\s+([\p{L}]+(?:\s+[\p{L}]+){1,3})/giu;
const ORGANIZATION_PATTERN = /(?:công ty|tổ chức|doanh nghiệp|company|organization|corporation|corp)\s+([\p{L}][\p{L}\d]*(?:[\s-]+[\p{L}\d]+){0,4})/giu;
const PROJECT_PATTERN = /(?:dự án|project name|project code|project|mã dự án)\s+([\p{L}\d][\p{L}\d-]*(?:[\s-]+[\p{L}\d]+){0,3})/giu;

function maskName(name) {
  const words = name.trim().split(/\s+/);
  return words.map((word, index) => index === 0 ? word : `${word[0]}***`).join(' ');
}
function maskPrefix(value, length) { return `${value.slice(0, length)}***`; }
function maskEmail(email) { return `${email[0]}***${email.slice(email.indexOf('@'))}`; }
function maskId(id) { return `***${id.replace(/\s/g, '').slice(-4)}`; }
function maskPhone(phone) { return `******${phone.replace(/\D/g, '').slice(-4)}`; }

function unique(values) {
  return [...new Map(values.map((item) => [item.toLocaleLowerCase(), item])).values()];
}

export function detectInformationWarnings(content) {
  if (typeof content !== 'string') return [];
  const personal = [];
  for (const match of content.matchAll(PERSON_AFTER_PATTERN)) {
    const candidate = match[1].trim().replace(/[,.!?;:]+$/, '');
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.every((word) => /^\p{Lu}/u.test(word))) personal.push(maskName(candidate));
  }
  for (const match of content.matchAll(EMPLOYEE_ID_PATTERN)) personal.push(maskId(match[0]));
  for (const match of content.matchAll(EMAIL_PATTERN)) personal.push(maskEmail(match[0]));
  for (const match of content.matchAll(PHONE_PATTERN)) personal.push(maskPhone(match[0]));

  const organization = [];
  for (const match of content.matchAll(ORGANIZATION_PATTERN)) {
    const candidate = match[1].trim().replace(/[,.!?;:]+$/, '');
    if (candidate && candidate.split(/\s+/).length <= 5) organization.push(maskPrefix(candidate.split(/\s+/)[0], 5));
  }
  const project = [];
  for (const match of content.matchAll(PROJECT_PATTERN)) {
    const candidate = match[1].trim().replace(/[,.!?;:]+$/, '');
    if (candidate && !/^(?:một|a|an|the|phần mềm|software)$/iu.test(candidate)) project.push(`Project ${maskPrefix(candidate.split(/\s+/)[0], 4)}`);
  }
  const warnings = [];
  if (unique(personal).length) warnings.push({ type: 'personal', title: 'Personal identifiers', description: 'Name, employee ID and email', detectedValues: unique(personal) });
  if (unique(organization).length) warnings.push({ type: 'organization', title: 'Organization references', description: 'Company reference', detectedValues: unique(organization) });
  if (unique(project).length) warnings.push({ type: 'project', title: 'Project references', description: 'Private project identifier', detectedValues: unique(project) });
  return warnings;
}

export function mergeInformationWarnings(llmWarnings, ruleWarnings) {
  const merged = [];
  const seen = new Set();
  for (const warning of [...(Array.isArray(llmWarnings) ? llmWarnings : []), ...ruleWarnings]) {
    if (!warning || !warning.type) continue;
    const values = warning.detectedValues || (warning.evidence ? [warning.evidence] : []);
    for (const value of values) {
      const key = `${warning.type}:${String(value).toLocaleLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let target = merged.find((item) => item.type === warning.type);
      if (!target) {
        target = { type: warning.type, title: warning.title || `${warning.type[0].toUpperCase()}${warning.type.slice(1)} information detected`, description: warning.description || '', detectedValues: [] };
        merged.push(target);
      }
      target.detectedValues.push(String(value));
    }
  }
  return merged;
}
