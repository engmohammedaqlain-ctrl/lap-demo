/**
 * voice.js — صوت بنفوش من Grok (xAI TTS) بأقل تكلفة ممكنة:
 *
 *  ١) كل جملة تُولَّد مرة واحدة فقط وتُحفظ mp3 في .banfoush-cache/tts
 *     (مفتاحها: الصوت + اللغة + المزاج + النص بلا تشكيل). الجمل المحفوظة
 *     لبنفوش تتكرر كثيراً فتصير مجانية بعد أول مرة.
 *  ٢) التشكيل: النص يُشكَّل بالكامل قبل النطق حتى تكون الحركات صحيحة.
 *     الجمل المحفوظة يشكّلها Grok مرة واحدة وتُخزَّن في server/tashkeel.json
 *     (ملف قابل للتعديل يدوياً لو أردت تصحيح حركة). ردود Grok تصل مشكّلة أصلاً.
 *  ٣) المشاعر: وسوم xAI الصوتية حسب مزاج بنفوش (ضحكة، همس، تنهيدة...).
 *  ٤) كل حرف مدفوع يُسجَّل في سقف الميزانية (budget.js).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRICE } from "./budget.js";

const XAI = "https://api.x.ai/v1";
const MARKS = /[ً-ْٰ]/g;
export const stripTashkeel = (s) => String(s).replace(MARKS, "");
const lettersOnly = (s) => stripTashkeel(s).replace(/[^\p{L}\p{N}]/gu, "");
function hasTashkeel(s) {
  const letters = (s.match(/[ء-ي]/g) || []).length;
  const marks = (s.match(MARKS) || []).length;
  return letters > 0 && marks / letters > 0.35;
}

/* مشاعر بنفوش ← وسوم الصوت */
const MOOD = {
  happy: (t) => `[giggle] ${t}`,
  wow: (t) => `[inhale] ${t}`,
  sleepy: (t) => `[sigh] <whisper><slow>${t}</slow></whisper>`,
  think: (t) => `[pause] ${t}`,
  hero: (t) => `[laugh] ${t}`,
};
const tag = (mood, t) => (MOOD[mood] ? MOOD[mood](t) : t);

/* كلمات لاتينية داخل الجمل تُنطق بالعربي */
const REPLACE = { pH: "بي إتش", DNA: "دي إن إيه", RGB: "آر جي بي" }; // المطابقة لا تفرّق بين الحروف الكبيرة والصغيرة

const TASHKEEL_PROMPT =
  "أنت مُشكِّل نصوص عربية دقيق. أضف التشكيل الكامل (فتحة، ضمة، كسرة، سكون، شدة، تنوين) على كل كلمة عربية في النص الذي يرسله المستخدم. " +
  "النص بلهجة فلسطينية محكية لطفل، فشكّله كما يُنطق بالعامية الفلسطينية لا بالفصحى (مثلاً: بِدِّي، كْتير، هَلَّق، مْنيح). " +
  "لا تغيّر أي حرف أو كلمة أو علامة ترقيم أو رقم، ولا تضف ولا تحذف أي شيء. أعد النص المشكّل فقط بدون أي شرح.";

export function createVoice({ key, model, voice = "ara", lang = "ar-SA", speed = 1.05 }, budget, root) {
  const cacheDir = join(root, ".banfoush-cache", "tts");
  mkdirSync(cacheDir, { recursive: true });
  const tashkeelFile = join(root, "server", "tashkeel.json");
  let tashkeel = {};
  try {
    tashkeel = JSON.parse(readFileSync(tashkeelFile, "utf8"));
  } catch {
    /* لا يوجد بعد */
  }
  const inflight = new Map();

  async function diacritize(text) {
    const plain = stripTashkeel(text);
    if (tashkeel[plain]) return tashkeel[plain];
    if (!budget.canSpend(0.002)) return text;
    try {
      const r = await fetch(`${XAI}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 900,
          messages: [
            { role: "system", content: TASHKEEL_PROMPT },
            { role: "user", content: plain },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json();
      const u = j.usage || {};
      budget.spend((u.prompt_tokens || 400) * PRICE.inPerToken + (u.completion_tokens || 300) * PRICE.outPerToken);
      const out = j.choices?.[0]?.message?.content?.trim();
      // أمان: نقبل التشكيل فقط إذا بقيت الحروف نفسها تماماً
      if (out && lettersOnly(out) === lettersOnly(plain)) {
        tashkeel[plain] = out;
        try {
          writeFileSync(tashkeelFile, JSON.stringify(tashkeel, null, 1));
        } catch {
          /* ignore */
        }
        return out;
      }
    } catch {
      /* نكمل بدون تشكيل */
    }
    return text;
  }

  /**
   * تشكيل جمل كثيرة دفعة واحدة (أرخص بكثير من جملة جملة): ١٥ جملة في الطلب،
   * والنتيجة تُحفظ في tashkeel.json. يُستعمل في التوليد المسبق.
   */
  async function prepare(texts) {
    const todo = [...new Set(texts.map(stripTashkeel))].filter((t) => !tashkeel[t] && /[ء-ي]/.test(t));
    for (let i = 0; i < todo.length; i += 15) {
      const batch = todo.slice(i, i + 15);
      if (!budget.canSpend(0.01)) break;
      try {
        const r = await fetch(`${XAI}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 6000,
            messages: [
              { role: "system", content: `${TASHKEEL_PROMPT}\nستصلك مصفوفة JSON من الجمل؛ أعد مصفوفة JSON بنفس الترتيب ونفس العدد، كل عنصر هو الجملة نفسها مشكّلة. لا تكتب أي شيء خارج المصفوفة.` },
              { role: "user", content: JSON.stringify(batch) },
            ],
          }),
          signal: AbortSignal.timeout(90000),
        });
        const j = await r.json();
        const u = j.usage || {};
        budget.spend((u.prompt_tokens || 1500) * PRICE.inPerToken + (u.completion_tokens || 3000) * PRICE.outPerToken);
        const raw = j.choices?.[0]?.message?.content || "";
        const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
        batch.forEach((plain, k) => {
          if (typeof arr[k] === "string" && lettersOnly(arr[k]) === lettersOnly(plain)) tashkeel[plain] = arr[k].trim();
        });
      } catch {
        /* الدفعة الفاشلة تُشكَّل لاحقاً جملة جملة */
      }
    }
    try {
      writeFileSync(tashkeelFile, JSON.stringify(tashkeel, null, 1));
    } catch {
      /* ignore */
    }
    return todo.filter((t) => tashkeel[t]).length;
  }

  /** يُرجع { audio: Buffer, cached, usd } أو يرمي خطأ code="budget". */
  async function speech(rawText, mood = "talk") {
    const text = String(rawText || "").replace(/\s+/g, " ").trim().slice(0, 700);
    if (!text) throw new Error("empty");
    const id = createHash("sha1").update([voice, lang, speed, mood, stripTashkeel(text)].join("|")).digest("hex");
    const file = join(cacheDir, `${id}.mp3`);
    if (existsSync(file)) return { audio: readFileSync(file), cached: true, usd: 0 };
    if (inflight.has(id)) return inflight.get(id);

    const job = (async () => {
      const voiced = hasTashkeel(text) ? text : await diacritize(text);
      const spoken = tag(mood, voiced);
      const usd = spoken.length * PRICE.ttsPerChar;
      if (!budget.canSpend(usd)) throw Object.assign(new Error("budget"), { code: "budget" });
      const r = await fetch(`${XAI}/tts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: spoken,
          voice_id: voice,
          language: lang,
          speed,
          replace: REPLACE,
          output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 64000 },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const audio = Buffer.from(await r.arrayBuffer());
      budget.spend(usd);
      writeFileSync(file, audio);
      return { audio, cached: false, usd };
    })().finally(() => inflight.delete(id));
    inflight.set(id, job);
    return job;
  }

  return { speech, prepare, voice, lang };
}
