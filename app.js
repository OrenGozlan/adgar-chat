const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const STORAGE_KEY = "adgar-chat:anthropic-key";

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chatForm"),
  input: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  faqList: document.getElementById("faqList"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveKeyBtn: document.getElementById("saveKeyBtn"),
  clearKeyBtn: document.getElementById("clearKeyBtn"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  keyStatus: document.getElementById("keyStatus"),
};

const state = {
  handbook: null,
  history: [],
  apiKey: localStorage.getItem(STORAGE_KEY) || "",
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

function updateKeyStatus() {
  if (state.apiKey) {
    els.keyStatus.textContent = "מפתח API מוגדר";
    els.keyStatus.className = "ok";
  } else {
    els.keyStatus.textContent = "אין מפתח API — לחץ על ⚙ להגדרה";
    els.keyStatus.className = "missing";
  }
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
  if (!state.apiKey) {
    openSettings();
    appendMessage("assistant", "כדי להתחיל, הוסף מפתח Anthropic API בהגדרות (⚙).", { error: true });
    return;
  }
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
        "x-api-key": state.apiKey,
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

function openSettings() {
  els.apiKeyInput.value = state.apiKey;
  els.settingsModal.classList.remove("hidden");
}

function closeSettings() {
  els.settingsModal.classList.add("hidden");
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

els.settingsBtn.addEventListener("click", openSettings);
els.closeModalBtn.addEventListener("click", closeSettings);
els.settingsModal.addEventListener("click", (e) => {
  if (e.target === els.settingsModal) closeSettings();
});

els.saveKeyBtn.addEventListener("click", () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem(STORAGE_KEY, key);
  state.apiKey = key;
  updateKeyStatus();
  closeSettings();
});

els.clearKeyBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state.apiKey = "";
  els.apiKeyInput.value = "";
  updateKeyStatus();
});

(async function init() {
  updateKeyStatus();
  try {
    state.handbook = await loadHandbook();
  } catch (err) {
    appendMessage("assistant", `שגיאה בטעינת חוברת הנהלים: ${err.message}`, { error: true });
  }
  if (!state.apiKey) openSettings();
})();
