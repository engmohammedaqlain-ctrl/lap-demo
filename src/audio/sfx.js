/**
 * sfx.js — مؤثرات صوتية احترافية (مكتبة SFX مقصوصة ومضغوطة ~١٠٠ كيلوبايت).
 * Web Audio: تُفكّ مرة واحدة وتُشغَّل بتغيير طفيف في الطبقة والارتفاع حتى لا
 * يتكرر الصوت بشكل آلي، مع خنق زمني لكل مؤثر وحدّ للأصوات المتزامنة.
 */
const found = import.meta.glob("../assets/sfx/*.mp3", { query: "?url", import: "default", eager: true });
const urls = {};
for (const [path, url] of Object.entries(found)) urls[path.split("/").pop().replace(".mp3", "")] = url;

let ctx = null;
let master = null;
let muted = false;
let voices = 0;
const buffers = {};
const loading = {};
const lastAt = {};

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function load(name) {
  if (buffers[name]) return Promise.resolve(buffers[name]);
  if (!urls[name]) return Promise.resolve(null);
  if (!loading[name]) {
    loading[name] = fetch(urls[name])
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => (buffers[name] = buf))
      .catch(() => null);
  }
  return loading[name];
}

/** يجهّز السياق ويفكّ كل الأصوات (يُستدعى عند أول لمسة). */
export function preload() {
  if (!ensure()) return;
  Object.keys(urls).forEach(load);
}

const activeLoops = new Set();

export function setMuted(m) {
  muted = !!m;
  if (muted) [...activeLoops].forEach((l) => l.stop());
}

/**
 * حلقة صوتية مستمرة (صبّ ماء، فرك…) بتداخل ناعم بين التكرارات.
 * تُعيد كائناً فيه stop() و setVolume(v).
 */
export function loop(name, { volume = 1, rate = 1 } = {}) {
  const dead = { stop() {}, setVolume() {} };
  if (muted || !ensure()) return dead;
  const buf = buffers[name];
  if (!buf) {
    load(name);
    return dead;
  }
  const XF = 0.15;
  const dur = buf.duration / rate;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(volume, ctx.currentTime, 0.04);
  bus.connect(master);
  let alive = true;
  let next = ctx.currentTime + 0.01;
  const startOne = (t) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + XF);
    g.gain.setValueAtTime(1, Math.max(t + XF, t + dur - XF));
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g).connect(bus);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  };
  const pump = () => {
    if (!alive) return;
    while (next < ctx.currentTime + 0.35) {
      startOne(next);
      next += dur - XF;
    }
  };
  pump();
  const timer = setInterval(pump, 100);
  const handle = {
    stop() {
      if (!alive) return;
      alive = false;
      clearInterval(timer);
      activeLoops.delete(handle);
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => bus.disconnect(), 500);
    },
    setVolume(v) {
      if (alive) bus.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
  };
  activeLoops.add(handle);
  return handle;
}

/**
 * @param {string} name اسم المؤثر
 * @param {{volume?:number, rate?:number, jitter?:number, throttle?:number, delay?:number}} o
 */
export function play(name, o = {}) {
  if (muted) return;
  const { volume = 1, rate = 1, jitter = 0.05, throttle = 45, delay = 0 } = o;
  if (!ensure()) return;
  const now = performance.now();
  if (now - (lastAt[name] || 0) < throttle) return;
  lastAt[name] = now;
  const buf = buffers[name];
  if (!buf) {
    load(name);
    return;
  }
  if (voices >= 14) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.5, volume));
  src.connect(g).connect(master);
  voices++;
  src.onended = () => {
    voices--;
    src.disconnect();
    g.disconnect();
  };
  src.start(ctx.currentTime + delay);
}

/** فتح السياق عند أول تفاعل (سياسات المتصفحات) */
let armed = false;
export function armOnFirstGesture() {
  if (armed) return;
  armed = true;
  const go = () => {
    preload();
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}
