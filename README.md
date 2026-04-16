# Adgar Chat

Keyword search over the Adgar company procedures handbook (חוברת נהלים אדגר 12.2024),
built for new employees who need to find the right procedure fast.

## How it works (MVP — phase 1)

- **Pure static site** — HTML/CSS/JS, deployed on GitHub Pages. No backend, no API keys.
- **Knowledge source** — `handbook.txt`, extracted once from the PDF.
- **Search** — on each query, the page tokenizes the question, scores each paragraph
  of the handbook by keyword overlap, and shows the top 5 matches with highlighted terms
  and the source procedure name.
- **No login** — open access.

## Local development

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080>.

## Updating the handbook

Re-extract with poppler:

```bash
pdftotext -enc UTF-8 -layout "חוברת נהלים אדגר  12.2024.pdf" handbook.txt
```

Commit and push — GitHub Pages redeploys automatically.

## Phase 2 ideas

- Upgrade from keyword search to LLM-backed Q&A (requires a serverless proxy for the API
  key — Vercel / Cloudflare Workers — since keys committed to a public repo are
  auto-revoked by Anthropic within minutes).
- Add login + per-user usage.
- Multiple source documents.
