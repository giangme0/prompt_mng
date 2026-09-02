# prompt_mng — PromptVault

A polished prompt management workspace built with plain HTML, CSS and Vanilla JavaScript. No framework, build step or third-party package is required.

## Features

- Browse prompt summaries and full content
- Search by name, summary, content or category
- Filter by one or several categories using `OR` matching
- Add, edit and delete prompts
- Assign multiple categories to one prompt
- Create a category directly inside the prompt form
- Copy prompt content to the clipboard
- Persist data in browser `localStorage`
- Responsive desktop, tablet and mobile layouts

## Run

Node.js 18 or newer is recommended.

```bash
npm start
```

Then open <http://localhost:4173>.

No `npm install` is needed because the project has no dependencies.

## Test

```bash
npm test
```

## Data and reset

The application stores data under these browser keys:

- `promptvault.prompts`
- `promptvault.categories`
- `promptvault.settings`

To restore the sample data, clear this site's local storage in browser developer tools and reload the page.
