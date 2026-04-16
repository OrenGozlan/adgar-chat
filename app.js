const MAX_RESULTS = 5;
const MIN_TOKEN_LEN = 2;
const CHUNK_PREVIEW = 400;

const STOPWORDS = new Set([
  "של","את","עם","או","גם","כי","אם","כל","לא","כן","הוא","היא","הם","הן","זה","זו","אלה",
  "על","אל","מן","מה","מי","איך","כמה","איפה","מתי","אך","אבל","רק","יש","אין","להיות",
  "וכן","כמו","בין","בתוך","לפני","אחרי","לפי","אודות","בגין","יכול","ניתן",
]);

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chatForm"),
  input: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  faqList: document.getElementById("faqList"),
};

const state = {
  chunks: [],
};

async function loadHandbook() {
  const res = await fetch("handbook.txt");
  if (!res.ok) throw new Error("Failed to load handbook");
  return await res.text();
}

function stripRtlMarks(s) {
  return s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

function normalizeForSearch(s) {
  return stripRtlMarks(s)
    .replace(/[\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4]/g, " ")
    .replace(/["'׳״,.;:!?()\[\]{}<>\/\\|`~@#$%^&*_+=\-]/g, " ")
    .toLowerCase();
}

function tokenize(text) {
  return normalizeForSearch(text)
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN && !STOPWORDS.has(t));
}

const PAGE_HEADER_RE = /נוהל\s+([\u0590-\u05FF"'׳״\s]{3,50}?)\s+חברת\s+אדגר/;
const PROCEDURE_NAME_RE = /נוהל\s+([\u0590-\u05FF"'׳״\s]{3,50})/;

function extractProcedure(cleanText) {
  const page = cleanText.match(PAGE_HEADER_RE);
  if (page) return "נוהל " + page[1].replace(/\s+/g, " ").trim();
  return null;
}

function stripPageHeaders(clean) {
  return clean
    .replace(/אושר\s+ע"י\s+המנכ"ל\s+ביום:?[^\n]*/g, "")
    .replace(/נוהל\s+[\u0590-\u05FF"'׳״\s]{3,50}?\s+חברת\s+אדגר[^\n]*/g, "")
    .replace(/מנהל\s+כללי\s*-\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseChunks(raw) {
  const blocks = raw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const chunks = [];
  let currentProcedure = "";
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join("\n");
    const rawClean = stripRtlMarks(text).trim();
    const clean = stripPageHeaders(rawClean);
    if (clean.length >= 40) {
      chunks.push({
        procedure: currentProcedure,
        clean,
        normalized: normalizeForSearch(clean),
      });
    }
    buffer = [];
  };

  for (const block of blocks) {
    const clean = stripRtlMarks(block).trim();

    const pageProc = extractProcedure(clean);
    if (pageProc) currentProcedure = pageProc;

    const isShort = clean.length < 80;
    if (isShort) {
      const nameMatch = clean.match(PROCEDURE_NAME_RE);
      if (nameMatch && !clean.includes("נוהל זה")) {
        flush();
        currentProcedure = "נוהל " + nameMatch[1].replace(/\s+/g, " ").trim();
        continue;
      }
    }

    buffer.push(block);
    const bufLen = buffer.join("\n").length;
    if (bufLen > 600) flush();
  }
  flush();
  return chunks;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreChunk(chunk, queryTokens) {
  let score = 0;
  const hits = new Set();
  for (const tok of queryTokens) {
    const re = new RegExp(escapeRegex(tok), "g");
    const matches = chunk.normalized.match(re);
    if (matches) {
      score += matches.length;
      hits.add(tok);
    }
  }
  if (hits.size > 1) score += hits.size * 3;
  return { score, hitCount: hits.size };
}

function highlight(text, tokens) {
  let html = escapeHtml(text);
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const tok of sorted) {
    const re = new RegExp(`(${escapeRegex(tok)})`, "gi");
    html = html.replace(re, "<mark>$1</mark>");
  }
  return html;
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function search(query) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  return state.chunks
    .map((c) => ({ chunk: c, ...scoreChunk(c, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.hitCount - a.hitCount)
    .slice(0, MAX_RESULTS);
}

function appendUser(text) {
  const wrap = document.createElement("div");
  wrap.className = "msg user";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function appendResults(query, results) {
  const wrap = document.createElement("div");
  wrap.className = "msg assistant";
  const bubble = document.createElement("div");
  bubble.className = "bubble results";

  if (!results.length) {
    bubble.innerHTML = `<p class="muted">לא נמצאו קטעים רלוונטיים בחוברת הנהלים. נסה לנסח מחדש או להשתמש במילים אחרות.</p>`;
  } else {
    const tokens = tokenize(query);
    const header = `<p class="muted">נמצאו ${results.length} קטעים רלוונטיים מתוך חוברת הנהלים:</p>`;
    const cards = results
      .map((r) => {
        const proc = r.chunk.procedure ? escapeHtml(r.chunk.procedure) : "חוברת הנהלים";
        const preview = truncate(r.chunk.clean, CHUNK_PREVIEW);
        const highlighted = highlight(preview, tokens);
        return `<div class="result-card">
          <div class="result-head">${proc}</div>
          <div class="result-body">${highlighted}</div>
        </div>`;
      })
      .join("");
    bubble.innerHTML = header + cards;
  }

  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function appendError(text) {
  const wrap = document.createElement("div");
  wrap.className = "msg assistant error";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function handleQuery(q) {
  if (!state.chunks.length) {
    appendError("החוברת עדיין נטענת, נסה שוב בעוד רגע.");
    return;
  }
  appendUser(q);
  els.input.value = "";
  const results = search(q);
  appendResults(q, results);
  els.input.focus();
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = els.input.value.trim();
  if (q) handleQuery(q);
});

els.faqList.addEventListener("click", (e) => {
  const btn = e.target.closest(".faq-item");
  if (!btn) return;
  const q = btn.dataset.q;
  if (q) handleQuery(q);
});

(async function init() {
  try {
    const raw = await loadHandbook();
    state.chunks = parseChunks(raw);
    console.log(`Loaded ${state.chunks.length} chunks from handbook`);
  } catch (err) {
    appendError(`שגיאה בטעינת חוברת הנהלים: ${err.message}`);
  }
})();
