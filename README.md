# prompt_mng — PromptVault

A polished prompt management workspace built with plain HTML, CSS and Vanilla JavaScript, with a Node.js REST API backed by SQLite.

## Features

- Browse prompt summaries and full content
- Search by name, summary, content or category
- Filter by one or several categories using `OR` matching
- Add, edit and delete prompts
- Assign multiple categories to one prompt
- Create a category directly inside the prompt form
- Copy prompt content to the clipboard
- Persist prompts and categories in SQLite
- Responsive desktop, tablet and mobile layouts

## Run

Node.js 18 or newer is recommended.

```bash
npm start
```

Then open <http://localhost:4173>.

## AI prompt analysis

Copy `.env.example` to `.env` and configure `LLM_API_URL`, `LLM_API_KEY`,
`LLM_MODEL`, and optionally `LLM_TIMEOUT_MS`. The browser calls the local
`/api/llm/analyze-prompt` endpoint; the provider key is used only by the
Node.js backend. Configure these values in Render's service Environment
settings when deploying, and never commit `.env`.

Run `npm install` once to install `better-sqlite3`. The database is created automatically at `data/prompt_mng.sqlite` when the server starts.

## Test

```bash
npm test
```

## Data and reset

The application stores data in `data/prompt_mng.sqlite`. Sample data is inserted only when the database is empty. To reset the sample data, stop the server, delete the database file, and start the server again.
