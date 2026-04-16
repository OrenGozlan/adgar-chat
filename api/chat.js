import fs from "node:fs";
import path from "node:path";

const MODEL = "claude-haiku-4-5-20251001";

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

let handbookCache = null;
function loadHandbook() {
  if (handbookCache) return handbookCache;
  const p = path.join(process.cwd(), "handbook.txt");
  handbookCache = fs.readFileSync(p, "utf8");
  return handbookCache;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  let handbook;
  try {
    handbook = loadHandbook();
  } catch (err) {
    res.status(500).json({ error: `Failed to load handbook: ${err.message}` });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_INSTRUCTIONS.replace("{{HANDBOOK}}", handbook),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      }),
    });

    const text = await anthropicRes.text();
    if (!anthropicRes.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || text;
      } catch {}
      res.status(anthropicRes.status).json({ error: msg });
      return;
    }

    const data = JSON.parse(text);
    const reply = (data.content || [])
      .map((b) => b.text)
      .filter(Boolean)
      .join("\n");
    res.status(200).json({ reply });
  } catch (err) {
    res.status(502).json({ error: `Upstream error: ${err.message}` });
  }
}
