/**
 * textures.js — خامات إجرائية (procedural) واقعية للأجسام: خشب بعروق،
 * جليد شفاف بفقاعات وشقوق، طوب خشن، فلّين منقّط، تفاحة، كرة فولاذ معدنية،
 * وصندوق كرتون للجسم الغامض. تُرسم مرة واحدة على Canvas مخفي وتُعاد استعمالها.
 */
import { OBJECTS } from "./catalog.js";

export const PPM = 1400; // بكسل لكل متر في الخامات (دقة عالية للشاشات الكثيفة)

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

/* ---------- خشب ---------- */
function woodFace(w, h, seed, grainScale = 1) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#d2a06a");
  base.addColorStop(0.5, "#bd8650");
  base.addColorStop(1, "#a9733f");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  // عروق الخشب: خطوط متموّجة طويلة
  for (let i = 0; i < h / (2.6 * grainScale); i++) {
    const y0 = i * 2.6 * grainScale + r() * 2;
    const a = 0.05 + r() * 0.2;
    g.strokeStyle = `rgba(${70 + r() * 30}, ${38 + r() * 20}, 14, ${a})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    const ph = r() * 6;
    const amp = 1 + r() * 3;
    for (let x = 0; x <= w; x += 5) {
      const y = y0 + Math.sin(x * 0.018 + ph) * amp + Math.sin(x * 0.006 + i * 0.4) * 5 * (0.3 + 0.7 * Math.sin(i * 0.11) ** 2);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // عقدة
  const kx = w * (0.25 + r() * 0.5);
  const ky = h * (0.3 + r() * 0.4);
  for (let k = 7; k >= 1; k--) {
    g.strokeStyle = `rgba(70,36,12,${0.08 + k * 0.025})`;
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(kx, ky, k * 5.5, k * 3.4, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "rgba(60,30,10,0.5)";
  g.beginPath();
  g.ellipse(kx, ky, 6, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  // ألياف دقيقة
  for (let i = 0; i < w * h * 0.004; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,230,190,0.10)" : "rgba(60,30,10,0.10)";
    g.fillRect(r() * w, r() * h, 6 + r() * 14, 1);
  }
  return c;
}

/* ---------- جليد ---------- */
function iceFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "rgba(226,246,255,0.92)");
  base.addColorStop(0.55, "rgba(176,224,246,0.82)");
  base.addColorStop(1, "rgba(140,205,238,0.86)");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // شقوق داخلية
  g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    let x = r() * w;
    let y = r() * h;
    g.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.35})`;
    g.lineWidth = 0.8 + r() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (r() - 0.5) * w * 0.35;
      y += (r() - 0.3) * h * 0.3;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // فقاعات هواء محبوسة
  for (let i = 0; i < 16; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 1.5 + r() * 5;
    const rg = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    rg.addColorStop(0, "rgba(255,255,255,0.9)");
    rg.addColorStop(1, "rgba(180,225,245,0.25)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  // لمعة قطرية
  const sh = g.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0.15, "rgba(255,255,255,0)");
  sh.addColorStop(0.28, "rgba(255,255,255,0.55)");
  sh.addColorStop(0.36, "rgba(255,255,255,0)");
  g.fillStyle = sh;
  g.fillRect(0, 0, w, h);
  // صقيع على الحواف
  for (let i = 0; i < w * h * 0.0025; i++) {
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
  return c;
}

/* ---------- طوب ---------- */
function brickFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#c0644a");
  base.addColorStop(1, "#a3472f");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const cols = ["#8e3a25", "#cf7b5a", "#6c2a1c", "#d98f6c", "#a0422b"];
  for (let i = 0; i < w * h * 0.05; i++) {
    g.globalAlpha = 0.12 + r() * 0.35;
    g.fillStyle = cols[(r() * cols.length) | 0];
    const s = 1 + r() * 3;
    g.fillRect(r() * w, r() * h, s, s * (0.6 + r()));
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = "rgba(50,20,12,0.35)";
    g.beginPath();
    g.ellipse(r() * w, r() * h, 1 + r() * 3, 0.8 + r() * 1.8, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* ---------- فلّين ---------- */
function corkFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  g.fillStyle = "#d4aa6e";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.03; i++) {
    const dark = r() < 0.6;
    g.fillStyle = dark ? `rgba(110,70,30,${0.25 + r() * 0.45})` : `rgba(236,208,150,${0.3 + r() * 0.4})`;
    g.beginPath();
    g.ellipse(r() * w, r() * h, 0.8 + r() * 2.8, 0.6 + r() * 1.8, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* ---------- تفاحة ---------- */
function appleImg(size, seed) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const r = rng(seed);
  const R = size / 2;
  g.save();
  g.beginPath();
  g.arc(R, R, R - 1, 0, Math.PI * 2);
  g.clip();
  const rg = g.createRadialGradient(R * 0.7, R * 0.6, R * 0.1, R, R, R);
  rg.addColorStop(0, "#ff6a55");
  rg.addColorStop(0.45, "#d9262d");
  rg.addColorStop(0.85, "#9c1020");
  rg.addColorStop(1, "#650a14");
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  // تدرّج أصفر مخضرّ قرب العنق
  for (let i = 0; i < 46; i++) {
    const x = R + (r() - 0.5) * R * 1.4;
    g.strokeStyle = `rgba(236,196,70,${0.05 + r() * 0.12})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(x, R * 0.12);
    g.quadraticCurveTo(x + (r() - 0.5) * R * 0.5, R * 0.8, x + (r() - 0.5) * R * 0.4, R * (1 + r() * 0.8));
    g.stroke();
  }
  // نقاط العدسات
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,224,170,${0.25 + r() * 0.35})`;
    g.beginPath();
    g.arc(r() * size, r() * size, 0.6 + r() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  // نقرة العنق
  const dim = g.createRadialGradient(R, R * 0.2, 0, R, R * 0.2, R * 0.28);
  dim.addColorStop(0, "rgba(50,10,10,0.7)");
  dim.addColorStop(1, "rgba(50,10,10,0)");
  g.fillStyle = dim;
  g.fillRect(0, 0, size, size);
  // لمعة
  const sp = g.createRadialGradient(R * 0.62, R * 0.55, 0, R * 0.62, R * 0.55, R * 0.34);
  sp.addColorStop(0, "rgba(255,255,255,0.85)");
  sp.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sp;
  g.fillRect(0, 0, size, size);
  g.restore();
  return c;
}

/* ---------- كرة فولاذ ---------- */
function steelImg(size) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const R = size / 2;
  g.save();
  g.beginPath();
  g.arc(R, R, R - 1, 0, Math.PI * 2);
  g.clip();
  const rg = g.createRadialGradient(R * 0.7, R * 0.62, R * 0.05, R, R, R);
  rg.addColorStop(0, "#ffffff");
  rg.addColorStop(0.18, "#e6ebf0");
  rg.addColorStop(0.55, "#a3adb8");
  rg.addColorStop(0.88, "#505a66");
  rg.addColorStop(1, "#272d34");
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  // انعكاس البيئة: سماء/أفق/أرض
  const env = g.createLinearGradient(0, 0, 0, size);
  env.addColorStop(0, "rgba(190,215,240,0.45)");
  env.addColorStop(0.5, "rgba(40,48,58,0.35)");
  env.addColorStop(0.52, "rgba(20,24,30,0.4)");
  env.addColorStop(1, "rgba(120,96,70,0.4)");
  g.fillStyle = env;
  g.fillRect(0, 0, size, size);
  const sp = g.createRadialGradient(R * 0.58, R * 0.5, 0, R * 0.58, R * 0.5, R * 0.3);
  sp.addColorStop(0, "rgba(255,255,255,0.95)");
  sp.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sp;
  g.fillRect(0, 0, size, size);
  g.restore();
  return c;
}

/* ---------- صندوق غامض (كرتون) ---------- */
function mysteryFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#d3b080");
  base.addColorStop(1, "#bf9a68");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) {
    g.fillStyle = `rgba(90,60,25,${0.04 + r() * 0.05})`;
    g.fillRect(x, 0, 1.5, h);
  }
  for (let i = 0; i < w * h * 0.01; i++) {
    g.fillStyle = "rgba(80,50,20,0.08)";
    g.fillRect(r() * w, r() * h, 2, 1);
  }
  // شريط لاصق
  g.fillStyle = "rgba(236,222,176,0.9)";
  g.fillRect(w * 0.42, 0, w * 0.16, h);
  g.fillStyle = "rgba(160,130,70,0.35)";
  g.fillRect(w * 0.42, 0, 1.5, h);
  g.fillRect(w * 0.58, 0, 1.5, h);
  // علامة استفهام
  g.fillStyle = "rgba(70,42,16,0.85)";
  g.font = `700 ${Math.round(h * 0.62)}px 'IBM Plex Sans Arabic', sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("؟", w * 0.5, h * 0.54);
  return c;
}

/* ---------- بلاستيك لامع ---------- */
function plasticFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#5fc4d2");
  base.addColorStop(1, "#2a8fa6");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const sh = g.createLinearGradient(0, 0, w, h * 0.6);
  sh.addColorStop(0.1, "rgba(255,255,255,0)");
  sh.addColorStop(0.22, "rgba(255,255,255,0.45)");
  sh.addColorStop(0.32, "rgba(255,255,255,0)");
  g.fillStyle = sh;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.002; i++) {
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  return c;
}

/* ---------- فولاذ مصقول (كتلة) ---------- */
function steelFace(w, h, seed) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, "#c9d1d9");
  base.addColorStop(0.3, "#eef1f4");
  base.addColorStop(0.6, "#a9b3be");
  base.addColorStop(1, "#8892a0");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "60,70,85"},${0.03 + r() * 0.08})`;
    g.fillRect(0, y, w, 1);
  }
  return c;
}

/* ---------- تجميع ---------- */
let cache = null;

export function getTextures() {
  if (cache) return cache;
  const t = {};
  const box = (key, faceFn, seed, topTint, dims) => {
    const o = dims || OBJECTS[key];
    const fw = o.w * PPM;
    const fh = o.h * PPM;
    const dw = o.d * PPM;
    t[key] = {
      type: "box",
      front: faceFn(fw, fh, seed),
      top: faceFn(fw, dw, seed + 7),
      side: faceFn(dw, fh, seed + 13),
      topTint,
    };
  };
  box("wood", woodFace, 11, "rgba(255,240,210,0.18)");
  box("ice", iceFace, 23, "rgba(255,255,255,0.35)");
  box("brick", brickFace, 37, "rgba(255,225,200,0.16)");
  const cube = { w: 0.17, h: 0.17, d: 0.17 };
  box("mystery", mysteryFace, 5, "rgba(255,245,220,0.16)", cube);
  box("m_cork", corkFace, 81, "rgba(255,235,190,0.2)", cube);
  box("m_wood", woodFace, 91, "rgba(255,240,210,0.18)", cube);
  box("m_ice", iceFace, 101, "rgba(255,255,255,0.35)", cube);
  box("m_plastic", plasticFace, 111, "rgba(255,255,255,0.25)", cube);
  box("m_brick", brickFace, 121, "rgba(255,225,200,0.16)", cube);
  box("m_steel", steelFace, 131, "rgba(255,255,255,0.3)", cube);

  const cork = OBJECTS.cork;
  t.cork = {
    type: "cyl",
    body: corkFace(cork.r * 2 * PPM, cork.h * PPM, 51),
    top: corkFace(cork.r * 2 * PPM, cork.r * 2 * PPM, 59),
  };
  t.apple = { type: "sphere", img: appleImg(Math.round(OBJECTS.apple.r * 2 * PPM), 71) };
  t.steel = { type: "sphere", img: steelImg(Math.round(OBJECTS.steel.r * 2 * PPM)) };
  cache = t;
  return t;
}

/** أيقونة صغيرة (data URL) لأزرار الاختيار */
const iconCache = {};
export function iconFor(key, size = 56) {
  if (iconCache[key]) return iconCache[key];
  const tex = getTextures()[key];
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const pad = 4;
  const fit = (img) => {
    const k = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
    const w = img.width * k;
    const h = img.height * k;
    g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  };
  if (tex.type === "box") fit(tex.front);
  else if (tex.type === "cyl") fit(tex.body);
  else fit(tex.img);
  iconCache[key] = c.toDataURL();
  return iconCache[key];
}
