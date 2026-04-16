const CHAT_ENDPOINT = "/api/chat";

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chatForm"),
  input: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  faqList: document.getElementById("faqList"),
};

const state = {
  history: [],
};

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

async function ask(userText) {
  state.history.push({ role: "user", content: userText });
  appendMessage("user", userText);
  els.input.value = "";
  els.sendBtn.disabled = true;

  const typingEl = appendTyping();

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: state.history }),
    });

    typingEl.remove();

    if (!res.ok) {
      const errText = await res.text();
      let msg = `שגיאה (${res.status})`;
      try {
        const j = JSON.parse(errText);
        if (j.error) msg += `: ${j.error}`;
      } catch {}
      appendMessage("assistant", msg, { error: true });
      state.history.pop();
      return;
    }

    const data = await res.json();
    const reply = data.reply || "(תשובה ריקה)";
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
  if (q) ask(q);
});

els.faqList.addEventListener("click", (e) => {
  const btn = e.target.closest(".faq-item");
  if (!btn) return;
  const q = btn.dataset.q;
  if (q) ask(q);
});
