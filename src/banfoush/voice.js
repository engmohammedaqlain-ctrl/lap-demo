/**
 * voice.js — صوت بنفوش وأذنه.
 *
 *  - الصوت الأساسي: صوت Grok من الخادم (/api/banfoush/tts) — مشكّل بالحركات
 *    وبمشاعر حسب المزاج، وكل جملة تُولَّد مرة واحدة ثم تُحفظ.
 *  - البديل المجاني: صوت المتصفح (Edge) إذا لم يتوفر الخادم أو نفدت الميزانية.
 *  - speak() تُرجع Promise ينتهي عند انتهاء النطق، حتى لا يقطع بنفوش كلامه.
 *  - الأذن: التعرّف على الكلام بالعربي (Chrome / Edge).
 */
import { getStatus, markBudgetOut } from "./ai.js";

const MARKS = /[ً-ْٰ]/g;
export const stripTashkeel = (s) => String(s || "").replace(MARKS, "");

/* ---------- صوت المتصفح (بديل مجاني) ---------- */
let browserVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const all = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("ar"));
  if (!all.length) return null;
  // الأفضلية: صوت طبيعي بلهجة شامية (أردني/فلسطيني/سوري/لبناني) لأن بنفوش يحكي فلسطيني
  const LANG = { "ar-ps": 6, "ar-jo": 6, "ar-sy": 5, "ar-lb": 5, "ar-sa": 2, "ar-eg": 1 };
  const score = (v) =>
    (LANG[v.lang.toLowerCase()] || 0) + (/natural|online/i.test(v.name) ? 3 : 0) + (/تيم|taim|ليث|laith|رامي|rami/i.test(v.name) ? 1 : 0);
  return all.sort((a, b) => score(b) - score(a))[0];
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  browserVoice = pickVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    browserVoice = pickVoice();
  });
}

export const canSpeak = () => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window);

function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    try {
      const u = new SpeechSynthesisUtterance(stripTashkeel(text).replace(/\s+/g, " "));
      u.lang = browserVoice?.lang || "ar-SA";
      if (browserVoice) u.voice = browserVoice;
      u.pitch = 1.35;
      u.rate = 1.02;
      u.volume = 1;
      u.onend = resolve;
      u.onerror = resolve;
      current = { stop: () => window.speechSynthesis.cancel(), done: resolve };
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

/* ---------- صوت Grok ---------- */
/*
 * التشغيل عبر Web Audio: تضخيم ×2.6 (+8dB تقريباً) ثم محدِّد يمنع التشويش،
 * فيطلع الصوت أعلى بوضوح من مشغّل الصوت العادي (الذي سقفه 100%).
 */
const VOLUME = 2.6;
let actx = null;
let input = null;
function audioCtx() {
  if (actx) return actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  input = actx.createGain();
  input.gain.value = VOLUME;
  const limiter = actx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  input.connect(limiter).connect(actx.destination);
  return actx;
}

const bufCache = new Map(); // نص+مزاج → AudioBuffer (لهذه الجلسة)
let current = null;

async function loadBuffer(text, mood) {
  const k = `${mood}|${stripTashkeel(text)}`;
  if (bufCache.has(k)) return bufCache.get(k);
  const ctx = audioCtx();
  if (!ctx) throw new Error("no-audio");
  const r = await fetch("/api/banfoush/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mood }),
    signal: AbortSignal.timeout(30000),
  });
  if (r.status === 429) markBudgetOut("tts");
  if (!r.ok) throw new Error(`tts ${r.status}`);
  const buf = await ctx.decodeAudioData(await r.arrayBuffer());
  bufCache.set(k, buf);
  return buf;
}

function playBuffer(buf) {
  return new Promise((resolve) => {
    const ctx = audioCtx();
    if (!ctx || ctx.state !== "running") return resolve(); // قبل أول لمسة: المتصفح يمنع الصوت
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1.04; // لمسة "وحش صغير" خفيفة
    src.connect(input);
    const done = () => {
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
      resolve();
    };
    src.onended = done;
    current = {
      stop: () => {
        try {
          src.stop();
        } catch {
          /* ignore */
        }
      },
      done,
    };
    src.start();
  });
}

const canPlayNow = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;

/**
 * يجهّز صوت الجملة ويُرجع { play } عندما يصير جاهزاً للنطق فوراً — حتى
 * يظهر النص والصوت في نفس اللحظة. إذا تعذّر صوت Grok (أو تأخر كثيراً)
 * يُرجع صوت المتصفح المجاني.
 */
export async function prepare(text, mood = "talk") {
  const fallback = { play: () => speakBrowser(text) };
  if (!text) return { play: async () => {} };
  if (!canPlayNow()) return { play: async () => {} };
  const { tts } = await getStatus();
  if (!tts) return fallback;
  try {
    const ctx = audioCtx();
    if (ctx?.state === "suspended") await ctx.resume().catch(() => {});
    const buf = await Promise.race([loadBuffer(text, mood), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 12000))]);
    return { play: () => playBuffer(buf) };
  } catch {
    return fallback;
  }
}

/** يقرأ النص بصوت بنفوش؛ ينتهي الـ Promise عند انتهاء الكلام (أو إيقافه). */
export async function speak(text, mood = "talk") {
  hush();
  const p = await prepare(text, mood);
  await p.play();
}

export function hush() {
  const c = current;
  current = null;
  try {
    c?.stop();
  } catch {
    /* ignore */
  }
  c?.done?.();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/* ---------- الأذن ---------- */
const Rec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canListen = () => !!Rec;

/** يبدأ الاستماع؛ onText(نص مؤقت أو نهائي) — يُرجع دالة الإيقاف. */
export function listen(onText, onEnd) {
  if (!Rec) return () => {};
  const r = new Rec();
  r.lang = "ar-PS";
  r.interimResults = true;
  r.maxAlternatives = 1;
  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }
    onText((finalText + interim).trim(), false);
  };
  r.onerror = () => {};
  r.onend = () => onEnd(finalText.trim());
  try {
    r.start();
  } catch {
    onEnd("");
  }
  return () => {
    try {
      r.stop();
    } catch {
      /* ignore */
    }
  };
}
