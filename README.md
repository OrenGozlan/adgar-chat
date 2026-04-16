# Adgar Chat

Smart Q&A chat for new Adgar Investments & Development employees.
Answers are grounded in the company procedures handbook (חוברת נהלים אדגר 12.2024).

## Architecture (MVP — phase 1)

- **Frontend** — static HTML/CSS/JS (dark-theme RTL Hebrew).
- **Backend** — one Vercel serverless function at `api/chat.js` that forwards
  requests to the Anthropic API. The API key lives in Vercel environment
  variables — never in the repo or the browser.
- **Knowledge source** — `handbook.txt`, extracted once from the PDF and
  injected as the system prompt on every call (with Anthropic prompt caching
  so follow-up questions are cheap).
- **LLM** — Claude Haiku 4.5.

## Deploying to Vercel

1. Sign in at <https://vercel.com> with GitHub.
2. Click **Add New → Project**, import `OrenGozlan/adgar-chat`.
3. Leave framework preset as "Other". Click **Deploy**.
4. After deploy, open **Project → Settings → Environment Variables** and add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Anthropic key (get one at <https://console.anthropic.com/>)
5. Go back to **Deployments** and click **Redeploy** on the latest deploy
   so the function picks up the env var.

Site will be live at `https://adgar-chat.vercel.app` (or whatever Vercel assigns).

## Local development

```bash
npm i -g vercel
vercel dev
```

## Updating the handbook

Re-extract with poppler:

```bash
pdftotext -enc UTF-8 -layout "חוברת נהלים אדגר  12.2024.pdf" handbook.txt
```

Commit and push — Vercel redeploys automatically on every push to `main`.

## Phase 2 ideas

- Add login (per-user rate limiting, usage metrics)
- Multiple source documents + vector search instead of single-document context
- Admin UI for uploading new documents
- Conversation history persisted per user
