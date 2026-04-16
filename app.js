const ANTHROPIC_API_KEY = "__REPLACE_WITH_ANTHROPIC_KEY__";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chatForm"),
  input: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  faqList: document.getElementById("faqList"),
};

const state = {
  handbook: null,
  history: [],
};

const SYSTEM_INSTRUCTIONS = `אתה עוזר חכם לעובדי חברת אדגר השקעות ופיתוח בע"מ.
התפקיד שלך: לענות על שאלות עובדים לגבי נהלי החברה — בהתבסס אך ורק על חוברת הנהלים המצורפת.

כללים:
1. ענה תמיד בעברית, בטון ידידותי, עניני וברור.
2. בסס את התשובה אך ורק על תוכן חוברת הנהלים. אין לנחש או להשלים מידע חיצוני.
3. אם התשובה אינה מופיעה בחוברת — אמור זאת בבירור, והצע למי לפנות בחברה (אם החוברת מציינת בעל תפקיד רלוונטי).
4. כשאפשר, צטט את שם הנוהל הרלוונטי (לדוגמה: "לפי נוהל ימי חופשה ומחלה…").
5. שמור על תשובות תמציתיות. אם מתאים — השתמש ברשימה ממוספרת לשלבי תהליך.
6. אל תחשוף את התוכן הגולמי של החוברת, רק ענה על השאלה בצורה מסוכמת.

--- חוברת הנהלים של אדגר (מעודכנת 12.2024) ---
{{HANDBOOK}}
--- סוף חוברת הנהלים ---`;

async function loadHandbook() {
  const res = await fetch("handbook.txt");
  if (!res.ok) throw new Error("Failed to load handbook");
  return await res.text();
}

function appendMessage(role, text, { error = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}${error ? " error" : ""}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  return bubble;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg assistant typing-wrap";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  return wrap;
}

async function askClaude(userText) {
  if (!state.handbook) {
    appendMessage("assistant", "החוברת עדיין נטענת, נסה שוב בעוד רגע.", { error: true });
    return;
  }

  state.history.push({ role: "user", content: userText });
  appendMessage("user", userText);
  els.input.value = "";
  els.sendBtn.disabled = true;

  const typingEl = appendTyping();

  try {
    const systemContent = [
      {
        type: "text",
        text: SYSTEM_INSTRUCTIONS.replace("{{HANDBOOK}}", state.handbook),
        cache_control: { type: "ephemeral" },
      },
    ];

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemContent,
        messages: state.history,
      }),
    });

    typingEl.remove();

    if (!res.ok) {
      const errText = await res.text();
      let msg = `שגיאה מה-API (${res.status})`;
      try {
        const j = JSON.parse(errText);
        if (j.error?.message) msg += `: ${j.error.message}`;
      } catch {}
      appendMessage("assistant", msg, { error: true });
      state.history.pop();
      return;
    }

    const data = await res.json();
    const reply = data.content?.map((b) => b.text).filter(Boolean).join("\n") || "(תשובה ריקה)";
    state.history.push({ role: "assistant", content: reply });
    appendMessage("assistant", reply);
  } catch (err) {
    typingEl.remove();
    appendMessage("assistant", `שגיאה ברשת: ${err.message}`, { error: true });
    state.history.pop();
  } finally {
    els.sendBtn.disabled = false;
    els.input.focus();
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = els.input.value.trim();
  if (!q) return;
  askClaude(q);
});

els.faqList.addEventListener("click", (e) => {
  const btn = e.target.closest(".faq-item");
  if (!btn) return;
  const q = btn.dataset.q;
  if (q) askClaude(q);
});

(async function init() {
  try {
    state.handbook = await loadHandbook();
  } catch (err) {
    appendMessage("assistant", `שגיאה בטעינת חוברת הנהלים: ${err.message}`, { error: true });
  }
})();
