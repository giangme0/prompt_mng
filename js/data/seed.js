export const seedCategories = [
  { id: 'cat-coding', name: 'Coding', color: '#15803d' },
  { id: 'cat-testing', name: 'Testing', color: '#059669' },
  { id: 'cat-api', name: 'API', color: '#0f766e' },
  { id: 'cat-analysis', name: 'Analysis', color: '#16a34a' },
  { id: 'cat-design', name: 'Design', color: '#4d7c0f' },
  { id: 'cat-documentation', name: 'Documentation', color: '#647c6c' }
];

export const seedPrompts = [
  {
    id: 'prm-api-test-generator',
    name: 'API Test Case Generator',
    categoryIds: ['cat-testing', 'cat-api'],
    summary: 'Creates positive, negative, boundary and security-focused test scenarios from API requirements.',
    input: 'API requirements, OpenAPI specification and relevant business rules.',
    output: 'A structured list of positive, negative, boundary and security test cases with expected results.',
    content: `You are a senior API testing specialist.

Analyze the following API requirements:

{{requirements}}

Generate a complete set of test cases covering:
- Positive flows
- Validation and negative scenarios
- Boundary values
- Authentication and authorization
- Error responses

For each test case, return: ID, objective, preconditions, input, steps and expected result.`,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-09-01T13:15:00.000Z'
  },
  {
    id: 'prm-requirement-analyzer',
    name: 'Requirement Quality Analyzer',
    categoryIds: ['cat-analysis', 'cat-documentation'],
    summary: 'Reviews software requirements for ambiguity, missing rules, contradictions and testability gaps.',
    input: 'Software requirement specifications, business rules and acceptance criteria.',
    output: 'An issue report identifying ambiguity, contradictions, missing rules and concrete corrections.',
    content: `Act as a senior business analyst and requirement reviewer.

Review the following requirement specification:

{{requirement}}

Identify:
1. Ambiguous or subjective language
2. Missing inputs, outputs and business rules
3. Contradictions
4. Missing error handling
5. Statements that cannot be tested

For every issue, cite the exact requirement and propose a concrete correction.`,
    createdAt: '2026-08-12T07:40:00.000Z',
    updatedAt: '2026-08-30T10:25:00.000Z'
  },
  {
    id: 'prm-code-review',
    name: 'Production Code Review',
    categoryIds: ['cat-coding', 'cat-testing'],
    summary: 'Performs an evidence-based code review focused on correctness, security and maintainability.',
    input: 'Production code and the relevant technical context or requirements.',
    output: 'Prioritized actionable findings with severity, evidence, impact and minimal fixes.',
    content: `You are reviewing production code.

Code:
{{code}}

Context:
{{context}}

Report only actionable findings. Prioritize correctness, security, data loss, race conditions and broken contracts. For each finding, include severity, location, evidence, impact and a minimal fix. If no material issue exists, state that clearly.`,
    createdAt: '2026-08-20T15:20:00.000Z',
    updatedAt: '2026-08-28T08:00:00.000Z'
  },
  {
    id: 'prm-mermaid-sequence',
    name: 'Mermaid Sequence Diagram',
    categoryIds: ['cat-design', 'cat-documentation'],
    summary: 'Transforms a system interaction description into a readable Mermaid sequence diagram.',
    input: 'A description of system interactions, participants, messages and error branches.',
    output: 'Valid Mermaid sequence diagram syntax followed by a concise explanation.',
    content: `Convert the interaction below into a Mermaid sequence diagram.

{{interaction}}

Rules:
- Use short, specific participant names
- Show validation and error branches with alt/else
- Use notes only for rules that are not visible from messages
- Keep the diagram readable and technically accurate
- Return valid Mermaid syntax followed by a short explanation`,
    createdAt: '2026-08-08T11:00:00.000Z',
    updatedAt: '2026-08-25T16:45:00.000Z'
  },
  {
    id: 'prm-sql-generator',
    name: 'Safe SQL Query Builder',
    categoryIds: ['cat-coding', 'cat-analysis'],
    summary: 'Builds a parameterized SQL query and explains assumptions, indexes and edge cases.',
    input: 'Database schema, query request and target SQL dialect.',
    output: 'A safe parameterized SQL query with assumptions, explanation and relevant index suggestions.',
    content: `You are a database engineer.

Schema:
{{schema}}

Request:
{{request}}

Write a parameterized SQL query for the requested database dialect. Do not concatenate untrusted values. State assumptions, explain the query briefly, and suggest indexes only when they materially improve this access pattern.`,
    createdAt: '2026-08-16T05:30:00.000Z',
    updatedAt: '2026-08-23T04:10:00.000Z'
  },
  {
    id: 'prm-release-notes',
    name: 'Release Notes Writer',
    categoryIds: ['cat-documentation'],
    summary: 'Turns technical changes into concise release notes organized around user-visible impact.',
    input: 'Technical changes, fixes, improvements and target audience information.',
    output: 'Clear user-focused release notes grouped into Added, Improved and Fixed sections.',
    content: `Write clear release notes from the changes below:

{{changes}}

Audience: {{audience}}

Group the notes into Added, Improved and Fixed only when those sections contain content. Lead with user impact, avoid internal implementation details, and mention migration or compatibility actions explicitly.`,
    createdAt: '2026-08-10T03:00:00.000Z',
    updatedAt: '2026-08-21T14:30:00.000Z'
  }
];
