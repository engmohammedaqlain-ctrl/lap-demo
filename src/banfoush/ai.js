/**
 * ai.js — الاتصال بوسيط /api/banfoush (المفتاح على الخادم فقط).
 * الرد يصل كبثّ حي (SSE) فيظهر حرفاً حرفاً كأن بنفوش يكتب الآن.
 */
let status = null;
let pending = null;

/** حالة الخادم: { ai, tts } — كلاهما false على الاستضافة الثابتة أو عند نفاد الميزانية. */
export function getStatus() {
  if (status) return Promise.resolve(status);
  if (!pending) {
    pending = fetch("/api/banfoush", { cache: "no-store", signal: AbortSignal.timeout(4000) })
      .then(async (r) => {
        const ok = r.ok && (r.headers.get("content-type") || "").includes("json");
        const j = ok ? await r.json() : {};
        status = { ai: !!j.ai, tts: !!j.tts };
        return status;
      })
      .catch(() => (status = { ai: false, tts: false }));
  }
  return pending;
}

/** هل الذكاء الاصطناعي متاح؟ (يعمل مع npm run dev / preview حين يوجد المفتاح) */
export async function checkAi() {
  return (await getStatus()).ai;
}

/** يُستدعى عند رفض الخادم لنفاد الميزانية: نوقف الطلبات المدفوعة لبقية الجلسة. */
export function markBudgetOut(kind) {
  if (status) status = { ...status, [kind]: false };
}

/**
 * يرسل المحادثة ويستدعي onDelta مع كل جزء جديد من النص.
 * يُرجع النص الكامل أو null عند الفشل.
 */
export async function streamReply(messages, context, onDelta) {
  try {
    const r = await fetch("/api/banfoush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.status === 429) markBudgetOut("ai");
    if (!r.ok || !r.body) return null;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const data = s.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          /* سطر ناقص */
        }
      }
    }
    return full.trim() || null;
  } catch {
    return null;
  }
}
