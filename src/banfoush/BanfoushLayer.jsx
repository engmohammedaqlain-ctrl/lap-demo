/**
 * BanfoushLayer.jsx — طبقة بنفوش فوق التطبيق كله:
 *  - "يراقب" سلوك الطالب: الخمول، التردد بين البطاقات، التحديق في بطاقة،
 *    التحديد بدون بدء، حركة الفأرة العصبية، محاولة المغادرة، الإعادة
 *    المتكررة داخل التجربة، والعودة بعد إنهاء تجربة لوحده.
 *  - يتكلم بفقاعة بجانب الوحش (أو بجانب بنفوش الصغير داخل التجارب).
 *  - نافذة محادثة: ردود محفوظة فورية، وما لا يعرفه يسأل عنه Grok ببث حي.
 *  - صوت (قراءة الرسائل) وميكروفون، واحتفال بالقصاصات الملوّنة.
 *  - مفاتيح العرض: Alt+Shift+رقم لتشغيل أي سيناريو، Alt+Shift+R لمسح الذاكرة.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./banfoush.css";
import monsterImg from "../assets/home/monster.webp";
import BanfoushEyes from "./BanfoushEyes.jsx";
import { get, set, useBf, onEvent, addMsg, updateMsg, remember, resetMemory } from "./store.js";
import { scenario, reply, offline, defaultChips, ORDER, suggest, nextAfter } from "./brain.js";
import { checkAi, streamReply } from "./ai.js";
import { speak, prepare, hush, canSpeak, canListen, listen, stripTashkeel } from "./voice.js";
import { play } from "../audio/sfx.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const ctx = () => {
  const s = get();
  return { screen: s.screen, selected: s.selected, name: s.name, visited: s.visited, awaiting: s.awaiting };
};

/* ---------------- الأفعال المشتركة ---------------- */
let openExp = () => {};
let hideTimer = 0;
let moodTimer = 0;
const obs = {
  last: now(),
  idleFired: false,
  sleepy: false,
  lastBubbleAt: -1e9,
  cool: {},
  hovers: [],
  hoverKey: null,
  dwellTimer: 0,
  selTimer: 0,
  lastSelectAt: -1e9,
  monsterClicks: [],
  moves: [],
  lastMove: null,
  keyboard: false,
  prevView: undefined,
  viewTimer: 0,
  welcomed: false,
  allDone: false,
  started: new Set(),
  exp: { key: null, start: 0, clicks: 0, usedHelp: false, idleFired: false, activeFired: false, resets: [] },
};

function moodSoon(ms = 2600) {
  clearTimeout(moodTimer);
  moodTimer = setTimeout(() => {
    if (!obs.sleepy) set({ mood: "idle" });
  }, ms);
}

function celebrate() {
  set((s) => ({ burst: s.burst + 1 }));
  play("success", { volume: 0.55 });
  setTimeout(() => play("sparkle", { volume: 0.5 }), 180);
}

/* مزاج الجملة ← نبرة الصوت (الاحتفال بضحكة) */
const voiceMood = (line) => (line.burst ? "hero" : line.mood || "talk");

/*
 * طابور الكلام: بنفوش لا يقطع جملته أبداً. كل جملة تنتظر انتهاء نطق
 * السابقة ووقتاً كافياً لقراءتها، ثم تأتي التالية. فقط رسالة من الطالب
 * (أو الانتقال لشاشة أخرى) توقفه.
 */
const sayQueue = [];
let saying = false;
let cancelSaying = null;
let sayGen = 0; // يزيد عند الإلغاء حتى لا تظهر جملة كانت قيد التجهيز

function showLine(line) {
  if (line.awaitName) set({ awaiting: "name" });
  // داخل المحادثة لا معنى لزر "افتح المحادثة"
  const chips = get().open ? line.chips?.filter((c) => !c.chat) : line.chips;
  const id = addMsg("bf", line.text, { chips: chips?.length ? chips : undefined });
  clearTimeout(hideTimer);
  if (!get().open) {
    set({ bubble: { id, text: line.text, chips: line.chips } });
    const ms = line.chips ? 16000 : Math.min(12000, 5000 + line.text.length * 60);
    hideTimer = setTimeout(() => set({ bubble: null }), ms);
  }
  set((s) => ({ mood: line.mood || "talk", talk: s.talk + 1 }));
  if (line.burst) celebrate();
  else play("pop", { volume: 0.4 });
}

async function pumpSay() {
  if (saying) return;
  const line = sayQueue.shift();
  if (!line) return;
  saying = true;
  const gen = sayGen;
  // الصوت مفعّل؟ بنفوش "يفكّر" حتى يجهز صوته، ثم يظهر النص والصوت معاً
  let voice = null;
  if (get().voice) {
    set({ mood: "think" });
    voice = await prepare(line.text, voiceMood(line));
    if (gen !== sayGen) {
      saying = false;
      pumpSay();
      return;
    }
  }
  showLine(line);
  const readMs = Math.min(9000, 1800 + line.text.length * 38);
  await Promise.race([
    Promise.all([voice ? voice.play() : null, wait(readMs)]),
    new Promise((r) => (cancelSaying = r)),
  ]);
  cancelSaying = null;
  moodSoon(line.mood === "sleepy" ? 1e9 : 1200);
  saying = false;
  pumpSay();
}

/** يقول بنفوش جملة (بالدور): فقاعة إذا كانت المحادثة مغلقة، ورسالة إذا كانت مفتوحة. */
function bfSay(line) {
  if (!line) return;
  sayQueue.push(line);
  pumpSay();
}
function clearSay() {
  sayQueue.length = 0;
  sayGen++;
  cancelSaying?.();
  hush();
}

/** مبادرة بنفوش مع فترات تهدئة حتى لا يزعج، ولا يقاطع نفسه. */
function proactive(id, data = {}, { force = false, cooldown = 30000 } = {}) {
  const t = now();
  if (!force) {
    if (get().open) return false;
    if (saying || sayQueue.length) return false;
    if (t - obs.lastBubbleAt < 8000) return false;
    if (obs.cool[id] && t - obs.cool[id] < cooldown) return false;
  }
  obs.cool[id] = t;
  obs.lastBubbleAt = t;
  bfSay(scenario(id, { ...ctx(), ...data }));
  return true;
}

function openChat() {
  clearTimeout(hideTimer);
  set({ open: true, bubble: null });
  if (get().screen !== "home") obs.exp.usedHelp = true;
  if (!get().messages.length) {
    const n = get().name;
    addMsg("bf", `أهلين${n ? ` يا ${n}` : ""}! أنا بنفوش. اسألني أي إشي عن العلوم، أو اختار من الاقتراحات تحت.`);
  }
  checkAi().then((ai) => set({ ai }));
}
function closeChat() {
  set({ open: false });
  hush();
  play("back", { volume: 0.5 });
}

function applyReply(r, voice = null) {
  if (r.setName) remember({ name: r.setName });
  if (r.setName || r.clearQuiz) set({ awaiting: null });
  if (r.quiz) set({ awaiting: { quiz: r.quiz } });
  if (r.awaitName) set({ awaiting: "name" });
  if (r.voice !== undefined) {
    remember({ voice: r.voice });
    if (!r.voice) hush();
  }
  addMsg("bf", r.text, { chips: r.chips });
  set((s) => ({ mood: r.mood || "talk", talk: s.talk + 1 }));
  if (r.burst) celebrate();
  else play("bubble", { volume: 0.35 });
  const spoken = voice ? voice.play() : Promise.resolve();
  if (r.open) {
    // يكمل جملته ("يلا! بفتحلك…") قبل ما يفتح التجربة
    const key = r.open;
    Promise.race([Promise.all([spoken, wait(1300)]), wait(6000)]).then(() => {
      set({ open: false });
      openExp(key);
    });
  }
  moodSoon();
}

let busy = false;
async function sendText(raw) {
  const text = (raw || "").trim();
  if (!text || busy) return;
  busy = true;
  clearSay(); // رسالة الطالب فقط هي اللي بتوقف كلام بنفوش
  addMsg("me", text);
  play("click", { volume: 0.45 });
  const c = ctx();
  const r = reply(text, c);
  if (c.awaiting === "name" && !r?.setName) set({ awaiting: null });
  set({ typing: true, mood: "think" });
  try {
    const voiceOn = get().voice;
    if (r) {
      const ready = voiceOn ? prepare(r.text, voiceMood(r)) : null;
      await Promise.all([wait(450 + Math.min(900, r.text.length * 7)), ready]);
      set({ typing: false });
      applyReply(r, ready ? await ready : null);
      return;
    }
    const ai = get().ai ?? (await checkAi());
    set({ ai });
    if (!ai) {
      const off = offline(c);
      const ready = voiceOn ? prepare(off.text, "talk") : null;
      await Promise.all([wait(600), ready]);
      set({ typing: false });
      applyReply(off, ready ? await ready : null);
      return;
    }
    const history = get()
      .messages.filter((m) => m.text && !m.streaming)
      .slice(-10)
      .map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }));
    let id = null;
    const full = await streamReply(history, { screen: c.screen, selected: c.selected, name: c.name, visited: c.visited }, (delta) => {
      if (voiceOn) return; // مع الصوت: الرد يظهر كاملاً مع صوته لاحقاً
      if (id === null) {
        set({ typing: false, mood: "talk" });
        id = addMsg("bf", "", { streaming: true });
      }
      updateMsg(id, (m) => ({ text: m.text + delta }));
    });
    if (voiceOn) {
      const text = full || offline(c).text;
      const voice = await prepare(text, "talk");
      set({ typing: false });
      if (full) {
        addMsg("bf", full);
        set((s) => ({ mood: "talk", talk: s.talk + 1 }));
        play("bubble", { volume: 0.35 });
        voice.play();
        moodSoon();
      } else applyReply(offline(c), voice);
      return;
    }
    set({ typing: false });
    if (id === null) {
      applyReply(offline(c));
      return;
    }
    updateMsg(id, () => ({ streaming: false }));
    set((s) => ({ talk: s.talk + 1 }));
    play("bubble", { volume: 0.35 });
    if (get().voice && full) speak(full, "talk");
    moodSoon();
  } finally {
    busy = false;
  }
}

function onChip(chip) {
  if (chip.dismiss) {
    set({ bubble: null });
    return;
  }
  if (chip.open) {
    set({ bubble: null, open: false });
    play("click", { volume: 0.6 });
    openExp(chip.open);
    return;
  }
  if (!get().open) openChat();
  if (chip.send) sendText(chip.send);
}

/* ---------------- تموضع الفقاعة والنافذة ---------------- */
// رفع إضافي للفقاعة (نسبة من ارتفاع الشاشة) في التجارب التي فيها أدوات قرب الزاوية
const BUBBLE_LIFT = { cell: 0.08 };

function bubbleBox(r, home, screen) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!r) return { style: { left: 16, bottom: 16, width: Math.min(320, vw - 32) }, tail: "none" };
  if (!home) {
    const lift = (BUBBLE_LIFT[screen] || 0) * vh;
    return {
      style: { left: Math.max(8, r.left + r.width * 0.45), bottom: Math.max(8, vh - r.top - 10 + lift), width: Math.min(320, vw - r.left - r.width * 0.45 - 12) },
      tail: "down",
    };
  }
  const ax = r.left + r.width * 0.2;
  if (ax - 12 >= 220) {
    return { style: { right: vw - ax, top: Math.max(8, r.top + r.height * 0.04), width: Math.min(330, ax - 12) }, tail: "side" };
  }
  const width = Math.min(320, vw - 24);
  const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), vw - width - 12);
  return { style: { left, top: r.bottom - r.height * 0.15, width }, tail: "up", tailX: r.left + r.width / 2 - left };
}

function panelBox(r, home) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 640) return { style: { left: 8, right: 8, bottom: 8, height: Math.min(vh * 0.74, 560) }, sheet: true };
  if (!home) {
    // بجانب بنفوش الصغير (عرضه يتغيّر حسب ارتفاع الشاشة)
    const left = (r ? r.right : 200) + 8;
    const width = Math.min(390, vw - left - 12);
    return { style: { left, bottom: 10, width, height: Math.min(540, vh - 20) } };
  }
  const width = 400;
  if (!r) return { style: { right: 16, bottom: 16, width, height: Math.min(580, vh - 32) } };
  if (vh < 560) {
    const left = Math.min(Math.max(8, r.left - width + r.width * 0.2), vw - width - 8);
    return { style: { left, top: 8, width, height: vh - 16 } };
  }
  const height = Math.min(580, vh - 32);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), vw - width - 16);
  const top = Math.min(Math.max(16, r.top + r.height * 0.74), vh - height - 16);
  return { style: { left, top, width, height }, tailX: Math.min(width - 30, Math.max(30, r.left + r.width / 2 - left)) };
}

/* ---------------- أيقونات صغيرة ---------------- */
const Ico = {
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12l-11.5 1.9z" transform="scale(-1 1) translate(-24 0)" /></svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
  ),
  sound: (on) => (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /> : <path d="m16 9.5 5 5m0-5-5 5" />}
    </svg>
  ),
};

/* ---------------- قصاصات الاحتفال ---------------- */
const COLORS = ["#1B7340", "#CE1126", "#C9A227", "#8b45ff", "#1565c0", "#ff8a00", "#14b8a6"];
function Burst({ x, y, seed }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const d = 80 + Math.random() * 110;
        return {
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d - 40,
          r: Math.random() * 540 - 270,
          c: COLORS[i % COLORS.length],
          s: 7 + Math.random() * 7,
          round: i % 3 === 0,
          delay: Math.random() * 80,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed]
  );
  return (
    <div className="bf-burst" style={{ left: x, top: y }} aria-hidden="true">
      {parts.map((p, i) => (
        <i
          key={i}
          style={{
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--r": `${p.r}deg`,
            background: p.c,
            width: p.s,
            height: p.round ? p.s : p.s * 0.55,
            borderRadius: p.round ? "50%" : 2,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- نافذة المحادثة ---------------- */
function ChatPanel({ box }) {
  const messages = useBf((s) => s.messages);
  const typing = useBf((s) => s.typing);
  const ai = useBf((s) => s.ai);
  const voice = useBf((s) => s.voice);
  const screen = useBf((s) => s.screen);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const stopRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);
  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) inputRef.current?.focus();
    return () => stopRef.current?.();
  }, []);

  const last = messages[messages.length - 1];
  const chips = !typing && last?.from === "bf" && last.chips?.length ? last.chips : defaultChips({ screen });

  function submit(e) {
    e.preventDefault();
    const t = text;
    setText("");
    sendText(t);
  }
  function toggleMic() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    hush();
    setListening(true);
    stopRef.current = listen(
      (t) => setText(t),
      (final) => {
        setListening(false);
        stopRef.current = null;
        if (final) {
          setText("");
          sendText(final);
        }
      }
    );
  }

  return (
    <div className={`bf-panel bf-root${box.sheet ? " is-sheet" : ""}`} style={box.style} role="dialog" aria-label="محادثة بنفوش">
      {box.tailX != null && <span className="bf-panel-tail" style={{ left: box.tailX }} aria-hidden="true" />}
      <header className="bf-head">
        <span className="bf-head-avatar" aria-hidden="true">
          <img src={monsterImg} alt="" draggable={false} />
        </span>
        <div className="bf-head-text">
          <b>بنفوش</b>
          <small>{typing ? "بيفكّر…" : ai ? "مساعد ذكي · متصل" : "مساعدك بالمختبر"}</small>
        </div>
        {canSpeak() && (
          <button
            type="button"
            className={`bf-icon${voice ? " is-on" : ""}`}
            aria-label={voice ? "إيقاف صوت بنفوش" : "تشغيل صوت بنفوش"}
            title={voice ? "إيقاف الصوت" : "خلّي بنفوش يحكي بصوت"}
            onClick={() => {
              remember({ voice: !voice });
              if (voice) hush();
              else speak("أهلين! هاد صوتي.", "happy");
            }}
          >
            {Ico.sound(voice)}
          </button>
        )}
        <button type="button" className="bf-icon" aria-label="إغلاق" onClick={closeChat}>
          {Ico.close}
        </button>
      </header>

      <div className="bf-log" ref={logRef}>
        {messages.map((m) => (
          <div key={m.id} className={`bf-msg ${m.from === "me" ? "me" : "bf"}${m.streaming ? " is-streaming" : ""}`}>
            {stripTashkeel(m.text)}
          </div>
        ))}
        {typing && (
          <div className="bf-msg bf bf-typing" aria-label="بنفوش بيكتب">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      <div className="bf-chips">
        {chips.map((c, i) => (
          <button key={`${c.label}-${i}`} type="button" className={`bf-chip${c.open ? " is-go" : ""}`} onClick={() => onChip(c)}>
            {c.label}
          </button>
        ))}
      </div>

      <form className="bf-input" onSubmit={submit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "عم بسمعك…" : "اكتب لبنفوش…"}
          maxLength={300}
          aria-label="رسالتك لبنفوش"
        />
        {canListen() && (
          <button type="button" className={`bf-mic${listening ? " is-on" : ""}`} aria-label={listening ? "إيقاف الاستماع" : "احكِ لبنفوش"} onClick={toggleMic}>
            {Ico.mic}
          </button>
        )}
        <button type="submit" className="bf-send" aria-label="إرسال" disabled={!text.trim()}>
          {Ico.send}
        </button>
      </form>
    </div>
  );
}

/* ---------------- الطبقة ---------------- */
export default function BanfoushLayer({ view, hidden, onOpenExp }) {
  openExp = onOpenExp;
  const open = useBf((s) => s.open);
  const bubble = useBf((s) => s.bubble);
  const burst = useBf((s) => s.burst);
  const home = view === "home";
  const miniRef = useRef(null);
  const [rect, setRect] = useState(null);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  // قياس موضع الوحش (أو بنفوش الصغير) لتثبيت الفقاعة والنافذة بجانبه
  useLayoutEffect(() => {
    if (hidden || (!bubble && !open && !burst)) return undefined;
    const measure = () => {
      const el = home ? document.querySelector(".hm-monster") : miniRef.current;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const t = setTimeout(measure, 450); // بعد انتهاء حركة الظهور
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [bubble?.id, open, burst, home, hidden]);

  // تغيّر الشاشة: دخول تجربة / عودة منها
  useEffect(() => {
    const prev = obs.prevView;
    obs.prevView = view;
    if (prev === view) return undefined;
    set({ screen: view });
    clearSay();
    clearTimeout(hideTimer);
    set({ bubble: null, open: false });
    obs.last = now();
    clearTimeout(obs.viewTimer);
    if (view !== "home") {
      obs.exp = { key: view, start: now(), clicks: 0, usedHelp: false, idleFired: false, activeFired: false, resets: [] };
      if (!obs.started.has(view)) {
        obs.started.add(view);
        obs.viewTimer = setTimeout(() => proactive("expStart", { key: view }, { force: true }), 2400);
      }
      return undefined;
    }
    if (prev && prev !== "home") {
      const e = obs.exp;
      const dur = now() - e.start;
      const visited = get().visited.includes(prev) ? get().visited : [...get().visited, prev];
      remember({ visited });
      obs.viewTimer = setTimeout(() => {
        if (dur >= 25000 && e.clicks >= 5) {
          proactive("hero", { key: prev, usedHelp: e.usedHelp, next: nextAfter(prev, visited) }, { force: true });
          if (!obs.allDone && ORDER.every((k) => visited.includes(k))) {
            obs.allDone = true;
            setTimeout(() => proactive("allDone", {}, { force: true }), 9000);
          }
        } else {
          proactive("quickReturn", { key: prev }, { force: true });
        }
      }, 1300);
    }
    return undefined;
  }, [view]);

  // ترحيب أول مرة / عودة
  useEffect(() => {
    if (hidden || view !== "home" || obs.welcomed) return undefined;
    const t = setTimeout(() => {
      if (obs.welcomed || get().screen !== "home") return;
      obs.welcomed = true;
      if (!get().seen) {
        remember({ seen: true });
        proactive("welcomeNew", {}, { force: true });
      } else proactive("welcomeBack", {}, { force: true });
    }, 1700);
    return () => clearTimeout(t);
  }, [hidden, view]);

  // المراقبة: الخمول، الحركة العصبية، المغادرة، النقرات داخل التجربة
  useEffect(() => {
    const activity = () => {
      obs.last = now();
      obs.idleFired = false;
      if (obs.sleepy) {
        obs.sleepy = false;
        set({ mood: "idle" });
        proactive("wake", {}, { force: true });
      }
    };
    const onMove = (e) => {
      activity();
      if (e.pointerType !== "mouse" || get().screen !== "home") return;
      const t = now();
      const p = obs.lastMove;
      obs.lastMove = { x: e.clientX, y: e.clientY, t };
      if (!p || t - p.t > 120 || t - p.t <= 0) return;
      const vx = (e.clientX - p.x) / (t - p.t);
      obs.moves.push({ t, s: Math.abs(vx) + Math.abs((e.clientY - p.y) / (t - p.t)), d: Math.sign(vx) });
      obs.moves = obs.moves.filter((m) => t - m.t < 900);
      if (obs.moves.length > 14) {
        const avg = obs.moves.reduce((a, m) => a + m.s, 0) / obs.moves.length;
        let flips = 0;
        for (let i = 1; i < obs.moves.length; i++) if (obs.moves[i].d && obs.moves[i].d !== obs.moves[i - 1].d) flips++;
        if (avg > 2.4 && flips >= 5) {
          obs.moves = [];
          proactive("fast", {}, { cooldown: 90000 });
        }
      }
    };
    const onDown = (e) => {
      activity();
      if (get().screen === "home" || e.target.closest?.(".bf-root, .bf-mini")) return;
      obs.exp.clicks++;
      if (obs.exp.clicks === 40 && !obs.exp.activeFired) {
        obs.exp.activeFired = true;
        proactive("expActive", {}, { cooldown: 120000 });
      }
      if (e.target.closest?.('[aria-label="إعادة الضبط"]')) {
        const t = now();
        obs.exp.resets = obs.exp.resets.filter((x) => t - x < 60000).concat(t);
        if (obs.exp.resets.length >= 2) proactive("struggle", { key: get().screen }, { cooldown: 90000 });
      }
    };
    const onOut = (e) => {
      if (!e.relatedTarget && e.clientY <= 2 && get().screen === "home") proactive("leaving", {}, { cooldown: 120000 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("keydown", activity);
    window.addEventListener("wheel", activity, { passive: true });
    document.addEventListener("mouseout", onOut);

    const iv = setInterval(() => {
      if (hiddenRef.current || get().open) return;
      const idle = now() - obs.last;
      if (get().screen === "home") {
        if (idle > 12000 && !obs.idleFired && proactive("idle", {}, { cooldown: 60000 })) obs.idleFired = true;
        if (idle > 38000 && !obs.sleepy) {
          obs.sleepy = true;
          proactive("sleepy", {}, { force: true });
        }
      } else if (idle > 15000 && !obs.exp.idleFired) {
        if (proactive("expIdle", { key: get().screen }, { cooldown: 60000 })) obs.exp.idleFired = true;
      }
    }, 1000);

    return () => {
      clearInterval(iv);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("wheel", activity);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  // أحداث الشاشة الرئيسية
  useEffect(
    () =>
      onEvent((type, data) => {
        const t = now();
        if (type === "hover") {
          obs.hovers = obs.hovers.filter((h) => t - h.t < 8000).concat({ key: data, t });
          const keys = [...new Set(obs.hovers.map((h) => h.key))];
          if (keys.length >= 3 && t - obs.lastSelectAt > 8000) {
            if (proactive("hesitate", { keys, suggestKey: suggest(get().visited, null) }, { cooldown: 45000 })) obs.hovers = [];
          }
          obs.hoverKey = data;
          clearTimeout(obs.dwellTimer);
          obs.dwellTimer = setTimeout(() => {
            if (obs.hoverKey === data) proactive("dwell", { key: data }, { cooldown: 40000 });
          }, 3200);
        } else if (type === "hoverEnd") {
          if (obs.hoverKey === data) obs.hoverKey = null;
          clearTimeout(obs.dwellTimer);
        } else if (type === "select") {
          obs.lastSelectAt = t;
          clearTimeout(obs.selTimer);
          obs.selTimer = setTimeout(() => {
            if (get().screen === "home") proactive("selectedNoStart", { key: data }, { cooldown: 40000 });
          }, 9000);
        } else if (type === "launch") {
          clearTimeout(obs.selTimer);
          clearTimeout(obs.dwellTimer);
          set({ bubble: null });
        } else if (type === "soon") {
          proactive("soon", { what: data }, { force: true });
        } else if (type === "nav") {
          if (!obs.keyboard) {
            obs.keyboard = true;
            proactive("keyboard", {}, { cooldown: 1e9 });
          }
        } else if (type === "monster") {
          obs.monsterClicks = obs.monsterClicks.filter((x) => t - x < 1500).concat(t);
          if (obs.monsterClicks.length >= 3) {
            obs.monsterClicks = [];
            proactive("tickle", {}, { force: true });
          } else if (!get().open) openChat();
        }
      }),
    []
  );

  // مفاتيح العرض: Alt+Shift+رقم
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || !e.shiftKey) return;
      const s = get();
      const homeNow = s.screen === "home";
      const sel = s.selected;
      const map = homeNow
        ? {
            Digit1: () => proactive("welcomeNew", {}, { force: true }),
            Digit2: () => proactive("idle", {}, { force: true }),
            Digit3: () => proactive("hesitate", { keys: ["buoyancy", "ph", "static"], suggestKey: "static" }, { force: true }),
            Digit4: () => proactive("dwell", { key: sel }, { force: true }),
            Digit5: () => proactive("selectedNoStart", { key: sel }, { force: true }),
            Digit6: () => proactive("fast", {}, { force: true }),
            Digit7: () => proactive("hero", { key: sel, usedHelp: false, next: nextAfter(sel, s.visited) }, { force: true }),
            Digit8: () => proactive("allDone", {}, { force: true }),
            Digit9: () => {
              obs.sleepy = true;
              proactive("sleepy", {}, { force: true });
            },
          }
        : {
            Digit1: () => proactive("expStart", { key: s.screen }, { force: true }),
            Digit2: () => proactive("expIdle", { key: s.screen }, { force: true }),
            Digit3: () => proactive("struggle", { key: s.screen }, { force: true }),
            Digit4: () => proactive("expActive", {}, { force: true }),
          };
      if (e.code === "Digit0") map.Digit0 = () => (s.open ? closeChat() : openChat());
      if (e.code === "KeyR")
        map.KeyR = () => {
          resetMemory();
          obs.welcomed = false;
          obs.allDone = false;
          obs.started.clear();
        };
      const fn = map[e.code];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Escape يغلق المحادثة
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  const bb = bubble && !open ? bubbleBox(rect, home, view) : null;
  const pb = open ? panelBox(rect, home) : null;
  const burstAt = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  return (
    <>
      {!home && (
        <button ref={miniRef} type="button" className={`bf-mini bf-root${open ? " is-open" : ""}`} aria-label="بنفوش — مساعدك" onClick={() => (get().open ? closeChat() : openChat())}>
          <span className="bf-mini-body">
            <img src={monsterImg} alt="" draggable={false} />
            <BanfoushEyes />
          </span>
        </button>
      )}

      {bb && (
        <div key={bubble.id} className={`bf-bubble bf-root tail-${bb.tail}`} style={bb.style} role="status">
          {bb.tail === "up" && <span className="bf-bubble-tail" style={{ left: bb.tailX }} aria-hidden="true" />}
          <button type="button" className="bf-bubble-x" aria-label="إخفاء" onClick={() => set({ bubble: null })}>
            {Ico.close}
          </button>
          <span className="bf-tag">بنفوش</span>
          <p className="bf-bubble-text" onClick={openChat}>
            {stripTashkeel(bubble.text)}
          </p>
          {bubble.chips?.length > 0 && (
            <div className="bf-bubble-chips">
              {bubble.chips.map((c, i) => (
                <button key={`${c.label}-${i}`} type="button" className={`bf-chip${c.open ? " is-go" : ""}`} onClick={() => onChip(c)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pb && <ChatPanel box={pb} />}

      {burst > 0 && <Burst key={burst} seed={burst} x={burstAt.x} y={burstAt.y} />}
    </>
  );
}
