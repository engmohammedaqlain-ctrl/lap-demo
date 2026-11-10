/**
 * store.js — ذاكرة بنفوش: حالة عامة صغيرة (بدون مكتبات) تعيش طوال الجلسة
 * وتنتقل بين الشاشة الرئيسية والتجارب، مع حفظ الاسم والتجارب المُنجزة
 * وتفضيل الصوت في localStorage (إن توفّر).
 */
import { useSyncExternalStore } from "react";

const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* وضع خاص أو تخزين محظور */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

let state = {
  open: false, // نافذة المحادثة
  bubble: null, // فقاعة كلام مبادِرة { id, text, chips }
  messages: [], // { id, from: "bf" | "me", text, chips?, streaming? }
  typing: false,
  mood: "idle", // idle | talk | think | happy | wow | sleepy
  talk: 0, // يزيد مع كل جملة جديدة (هزّة كلام)
  burst: 0, // يزيد عند الاحتفال (قصاصات ملوّنة)
  name: LS.get("bf_name", ""),
  visited: LS.get("bf_visited", []),
  voice: LS.get("bf_voice", false),
  seen: LS.get("bf_seen", false),
  awaiting: null, // "name" | { quiz }
  ai: null, // null: لم يُفحص بعد، true/false
  screen: "home",
  selected: "buoyancy",
};

const subs = new Set();
const evSubs = new Set();

export const get = () => state;

export function set(patch) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

function subscribe(f) {
  subs.add(f);
  return () => subs.delete(f);
}

/** اشتراك React بمحدِّد يُرجع قيمة موجودة في الحالة (لا تُنشئ كائنات جديدة). */
export function useBf(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* أحداث من الشاشات (مرور على بطاقة، تحديد، ضغط الوحش...) */
export function emit(type, data) {
  evSubs.forEach((f) => f(type, data));
}
export function onEvent(f) {
  evSubs.add(f);
  return () => evSubs.delete(f);
}

let uid = 0;
export const nextId = () => ++uid;

export function addMsg(from, text, extra = {}) {
  const id = nextId();
  set((s) => ({ messages: [...s.messages, { id, from, text, ...extra }].slice(-60) }));
  return id;
}
export function updateMsg(id, fn) {
  set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...fn(m) } : m)) }));
}

export function remember(patch) {
  set(patch);
  if ("name" in patch) LS.set("bf_name", patch.name);
  if ("visited" in patch) LS.set("bf_visited", patch.visited);
  if ("voice" in patch) LS.set("bf_voice", patch.voice);
  if ("seen" in patch) LS.set("bf_seen", patch.seen);
}

/** مسح ذاكرة بنفوش (لإعادة سيناريو الترحيب في العرض). */
export function resetMemory() {
  ["bf_name", "bf_visited", "bf_seen"].forEach(LS.del);
  set({ name: "", visited: [], seen: false, messages: [], bubble: null, awaiting: null, open: false, mood: "idle" });
}
