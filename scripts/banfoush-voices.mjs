/**
 * banfoush-voices.mjs — يولّد صوت كل جمل بنفوش الثابتة مرة واحدة ويحفظها،
 * حتى تصير مجانية وفورية وقت العرض.
 *
 *   npm run banfoush:voices            ← التوليد (يعرض التكلفة قبل وبعد)
 *   npm run banfoush:voices -- --dry   ← حساب التكلفة المتوقعة فقط
 *
 * يحترم السقف الأسبوعي نفسه (XAI_WEEKLY_USD، الافتراضي ١٫٩$).
 */
import { loadEnv } from "vite";
import { createBudget, PRICE } from "../server/budget.js";
import { createVoice } from "../server/voice.js";
import { fixedLines } from "../src/banfoush/brain.js";

const root = process.cwd();
const env = loadEnv("development", root, "XAI_");
const dry = process.argv.includes("--dry");
const lines = fixedLines();
const chars = lines.reduce((a, l) => a + l.text.length, 0);
console.log(`جمل بنفوش الثابتة: ${lines.length} جملة، ${chars} حرف`);
console.log(`التكلفة المتوقعة (مع التشكيل والمشاعر): ≈ $${(chars * 1.8 * PRICE.ttsPerChar + 0.03).toFixed(2)} — مرة واحدة فقط`);
if (dry) process.exit(0);
if (!env.XAI_API_KEY) {
  console.error("لا يوجد XAI_API_KEY في .env.local");
  process.exit(1);
}

const weekly = Number(env.XAI_WEEKLY_USD) || 1.9;
// التوليد المسبق خطوة مقصودة لمرة واحدة: يُحسب من السقف الأسبوعي فقط
const budget = createBudget(root, { weeklyUsd: weekly, dailyUsd: weekly });
const voice = createVoice(
  { key: env.XAI_API_KEY, model: env.XAI_MODEL || "grok-4.20-0309-non-reasoning", voice: env.XAI_TTS_VOICE || "ara", lang: env.XAI_TTS_LANG || "ar-SA", speed: Number(env.XAI_TTS_SPEED) || 1.05 },
  budget,
  root
);
const before = budget.status().weekUsd;
console.log(`الصوت: ${voice.voice} · اللغة: ${voice.lang} · المصروف هذا الأسبوع قبل البدء: $${before}`);

const ready = await voice.prepare(lines.map((l) => l.text));
console.log(`التشكيل: ${ready} جملة جديدة مشكّلة (محفوظة في server/tashkeel.json)`);

let made = 0;
let cached = 0;
let failed = 0;
for (const [i, l] of lines.entries()) {
  try {
    const r = await voice.speech(l.text, l.mood);
    if (r.cached) cached++;
    else made++;
  } catch (e) {
    failed++;
    if (e.code === "budget") {
      console.log("وصلنا السقف الأسبوعي — توقفنا هنا.");
      break;
    }
  }
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${lines.length}`);
}
const after = budget.status().weekUsd;
console.log(`تم: ${made} جديدة، ${cached} كانت محفوظة، ${failed} فشلت. التكلفة: $${(after - before).toFixed(3)} · المصروف هذا الأسبوع: $${after} من $${weekly}`);
