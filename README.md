# Adgar Chat

Smart Q&A chat for new Adgar Investments & Development employees.
Answers are grounded in the company procedures handbook (חוברת נהלים אדגר 12.2024).

## How it works (MVP — phase 1)

- **Static site** — pure HTML/CSS/JS, deployed on GitHub Pages. No backend.
- **Knowledge source** — `handbook.txt`, extracted once from the PDF.
- **LLM** — Claude Haiku 4.5 via the Anthropic API.
- **API key** — hardcoded in `app.js` (constant `ANTHROPIC_API_KEY`). MVP only.
  ⚠️ Set a monthly spend cap in console.anthropic.com before going live, and rotate the key if abused.
- **No login** — MVP is open-access; add auth in phase 2 if needed.

## Local development

Serve the folder with any static server. For example:

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080>.

## Deploying to GitHub Pages

Push to `main`, then in repo **Settings → Pages**, set source to `main` / root.
Site will be live at `https://<user>.github.io/adgar-chat/`.

## Updating the handbook

Re-extract with poppler:

```bash
pdftotext -enc UTF-8 -layout "חוברת נהלים אדגר  12.2024.pdf" handbook.txt
```

Commit and push — Pages will redeploy automatically.

## Phase 2 ideas

- Proxy the API key via Cloudflare Workers so employees don't need their own keys
- Add real login (Auth0 / Supabase)
- Multiple source documents + vector search instead of single-document context
- Admin UI for uploading new documents
