/**
 * bench.js — رسم بيئة المجهر على Canvas 2D بإجراءات (procedural):
 * جدار وطاولة خشب، رأس المجهر المعدني، مقبضا التركيز المخرّشان (يدوران فعلاً)،
 * برج العدسات، طاولة العيّنة والشرائح الزجاجية، رافعة الغوص، ولوحة النحاس
 * المنقوشة. الجزء الثابت يُرسم مرة واحدة على طبقة خارج الشاشة، والمتحرّك كل إطار.
 */
import { OBJECTIVES } from "./layout.js";

const FONT = "'IBM Plex Sans Arabic', sans-serif";

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

export function rr(g, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

/* ======================= الطبقة الثابتة ======================= */
function wall(g, L) {
  const { dW, dH, benchY } = L;
  const grad = g.createLinearGradient(0, 0, 0, benchY);
  grad.addColorStop(0, "#e9f0ec");
  grad.addColorStop(0.6, "#d5e3de");
  grad.addColorStop(1, "#c2d4cd");
  g.fillStyle = grad;
  g.fillRect(0, 0, dW, dH);
  // بلاط الجدار
  g.strokeStyle = "rgba(60,100,90,0.08)";
  g.lineWidth = 2;
  for (let x = 0; x < dW; x += 96) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, benchY);
    g.stroke();
  }
  for (let y = 40; y < benchY; y += 96) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(dW, y);
    g.stroke();
  }
  // شعاع ضوء النافذة
  const beam = g.createLinearGradient(dW * 0.78, 0, dW * 0.35, benchY);
  beam.addColorStop(0, "rgba(255,255,236,0.5)");
  beam.addColorStop(1, "rgba(255,255,236,0)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(dW * 0.7, 0);
  g.lineTo(dW * 0.96, 0);
  g.lineTo(dW * 0.46, benchY);
  g.lineTo(dW * 0.16, benchY);
  g.closePath();
  g.fill();
  // تعتيم أطراف
  const vg = g.createRadialGradient(dW / 2, benchY * 0.5, benchY * 0.3, dW / 2, benchY * 0.5, dW * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(20,40,40,0.28)");
  g.fillStyle = vg;
  g.fillRect(0, 0, dW, benchY + 20);
}

function bench(g, L) {
  const { dW, dH, benchY } = L;
  const top = benchY;
  const base = g.createLinearGradient(0, top, 0, dH);
  base.addColorStop(0, "#c28a52");
  base.addColorStop(0.08, "#a9743f");
  base.addColorStop(1, "#6e4626");
  g.fillStyle = base;
  g.fillRect(0, top, dW, dH - top);
  const r = rng(77);
  for (let i = 0; i < 160; i++) {
    const y = top + 14 + r() * (dH - top);
    g.strokeStyle = `rgba(${60 + r() * 40},${30 + r() * 20},10,${0.06 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    const ph = r() * 6;
    for (let x = 0; x <= dW; x += 40) {
      const yy = y + Math.sin(x * 0.012 + ph) * 2.2;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // حافة الطاولة المضيئة
  const edge = g.createLinearGradient(0, top - 3, 0, top + 16);
  edge.addColorStop(0, "#efc794");
  edge.addColorStop(1, "#b98550");
  g.fillStyle = edge;
  g.fillRect(0, top - 3, dW, 18);
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fillRect(0, top + 14, dW, 3);
  // انعكاس ناعم على السطح
  const refl = g.createLinearGradient(0, top, 0, top + 70);
  refl.addColorStop(0, "rgba(255,255,255,0.14)");
  refl.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = refl;
  g.fillRect(0, top + 16, dW, 60);
}

function screw(g, x, y, r) {
  const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  sg.addColorStop(0, "#f2f4f5");
  sg.addColorStop(1, "#6d767d");
  g.fillStyle = sg;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x - r * 0.7, y - r * 0.2);
  g.lineTo(x + r * 0.7, y + r * 0.2);
  g.stroke();
}

function head(g, L) {
  const { head: h, fov } = L;
  // ظل الرأس على الجدار
  g.save();
  g.shadowColor = "rgba(10,25,25,0.45)";
  g.shadowBlur = 40;
  g.shadowOffsetY = 18;
  g.fillStyle = "#222";
  rr(g, h.x, h.y, h.w, h.h, h.r);
  g.fill();
  g.restore();

  // طلاء المعدن الداكن
  const body = g.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
  body.addColorStop(0, "#4a545e");
  body.addColorStop(0.45, "#2c343c");
  body.addColorStop(1, "#1d2329");
  g.fillStyle = body;
  rr(g, h.x, h.y, h.w, h.h, h.r);
  g.fill();
  // لمعة عمودية على الجانب
  const sheen = g.createLinearGradient(h.x, 0, h.x + h.w, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.1, "rgba(255,255,255,0.12)");
  sheen.addColorStop(0.2, "rgba(255,255,255,0)");
  sheen.addColorStop(0.82, "rgba(255,255,255,0)");
  sheen.addColorStop(0.9, "rgba(255,255,255,0.07)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sheen;
  rr(g, h.x, h.y, h.w, h.h, h.r);
  g.fill();
  // حبيبات المينا
  const r = rng(9);
  g.save();
  rr(g, h.x, h.y, h.w, h.h, h.r);
  g.clip();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.07)";
    g.fillRect(h.x + r() * h.w, h.y + r() * h.h, 1.6, 1.6);
  }
  g.restore();
  // حواف مشطوفة
  g.lineWidth = 3;
  g.strokeStyle = "rgba(255,255,255,0.22)";
  rr(g, h.x + 2, h.y + 2, h.w - 4, h.h - 4, h.r - 2);
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = "rgba(0,0,0,0.55)";
  rr(g, h.x, h.y, h.w, h.h, h.r);
  g.stroke();

  // تجويف العدسة العينية
  const rr0 = fov.r + fov.rim + 14;
  const rec = g.createRadialGradient(fov.cx, fov.cy, fov.r, fov.cx, fov.cy, rr0);
  rec.addColorStop(0, "#050607");
  rec.addColorStop(1, "#14181c");
  g.fillStyle = rec;
  g.beginPath();
  g.arc(fov.cx, fov.cy, rr0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(fov.cx, fov.cy, rr0, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();

  // براغي الزوايا
  const m = L.orient === "landscape" ? 26 : 20;
  [
    [h.x + m, h.y + m],
    [h.x + h.w - m, h.y + m],
    [h.x + m, h.y + h.h - m],
    [h.x + h.w - m, h.y + h.h - m],
  ].forEach(([x, y]) => screw(g, x, y, L.orient === "landscape" ? 8 : 6));
}

function axles(g, L) {
  for (const a of L.axles) {
    const gr = g.createLinearGradient(0, a.y, 0, a.y + a.h);
    gr.addColorStop(0, "#f3f6f8");
    gr.addColorStop(0.5, "#aab3ba");
    gr.addColorStop(1, "#4d555c");
    g.fillStyle = gr;
    rr(g, a.x, a.y, a.w, a.h, 4);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1;
    g.stroke();
  }
}

function tray(g, L) {
  const t = L.tray;
  g.save();
  g.shadowColor = "rgba(30,15,5,0.4)";
  g.shadowBlur = 18;
  g.shadowOffsetY = 8;
  const wood = g.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
  wood.addColorStop(0, "#d9a76a");
  wood.addColorStop(1, "#a9763f");
  g.fillStyle = wood;
  rr(g, t.x, t.y, t.w, t.h, 16);
  g.fill();
  g.restore();
  // خشب: عروق
  const r = rng(31);
  g.save();
  rr(g, t.x, t.y, t.w, t.h, 16);
  g.clip();
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(90,50,20,${0.06 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath();
    const y = t.y + r() * t.h;
    g.moveTo(t.x, y);
    g.bezierCurveTo(t.x + t.w * 0.3, y + (r() - 0.5) * 8, t.x + t.w * 0.7, y + (r() - 0.5) * 8, t.x + t.w, y + (r() - 0.5) * 6);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 2;
  rr(g, t.x + 1, t.y + 1, t.w - 2, t.h - 2, 15);
  g.stroke();
  // تجويف داخلي مخمل
  const ix = t.x + 12;
  const iy = t.y + 12;
  const iw = t.w - 24;
  const ih = t.h - 24;
  g.fillStyle = "#3b2a30";
  rr(g, ix, iy, iw, ih, 10);
  g.fill();
  const inner = g.createLinearGradient(0, iy, 0, iy + ih);
  inner.addColorStop(0, "rgba(0,0,0,0.5)");
  inner.addColorStop(0.25, "rgba(0,0,0,0)");
  g.fillStyle = inner;
  rr(g, ix, iy, iw, ih, 10);
  g.fill();
}

function stagePlate(g, L) {
  const s = L.stage;
  g.save();
  g.shadowColor = "rgba(20,10,0,0.45)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 7;
  const m = g.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  m.addColorStop(0, "#dfe5e9");
  m.addColorStop(0.45, "#9ea8b0");
  m.addColorStop(1, "#5b646b");
  g.fillStyle = m;
  rr(g, s.x, s.y, s.w, s.h, 12);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.65)";
  g.lineWidth = 1.6;
  rr(g, s.x + 1, s.y + 1, s.w - 2, s.h - 2, 11);
  g.stroke();
  // فتحة الإضاءة
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const ap = Math.min(s.h * 0.34, 24);
  g.fillStyle = "#0e1114";
  g.beginPath();
  g.arc(cx, cy, ap + 5, 0, Math.PI * 2);
  g.fill();
  const lamp = g.createRadialGradient(cx, cy, 0, cx, cy, ap);
  lamp.addColorStop(0, "#fff7d1");
  lamp.addColorStop(0.7, "#ffd777");
  lamp.addColorStop(1, "#d99a22");
  g.fillStyle = lamp;
  g.beginPath();
  g.arc(cx, cy, ap, 0, Math.PI * 2);
  g.fill();
  // مشبكا الشريحة
  for (const sx of [-1, 1]) {
    const x = cx + sx * (s.w * 0.36);
    g.fillStyle = "#31383e";
    rr(g, x - 16, s.y + 8, 32, 7, 3);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 1;
    g.stroke();
  }
}

function leverBase(g, L) {
  const b = L.lever;
  g.save();
  g.shadowColor = "rgba(20,10,0,0.45)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 7;
  const m = g.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  m.addColorStop(0, "#4a545e");
  m.addColorStop(1, "#242b31");
  g.fillStyle = m;
  rr(g, b.x, b.y, b.w, b.h, 14);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 2;
  rr(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 13);
  g.stroke();
  // مجرى الرافعة
  const px = b.x + b.w * 0.3;
  const py = b.y + b.h / 2;
  g.fillStyle = "#0b0d0f";
  rr(g, px - 6, b.y + 8, 12, b.h - 16, 6);
  g.fill();
  void py;
  screw(g, b.x + b.w - 14, b.y + 14, 5);
  screw(g, b.x + b.w - 14, b.y + b.h - 14, 5);
}

/** يبني الطبقة الثابتة (تُستدعى عند تغيّر الحجم). */
export function buildStatic(L, dpr) {
  const c = document.createElement("canvas");
  c.width = Math.round(L.dW * L.s * dpr);
  c.height = Math.round(L.dH * L.s * dpr);
  const g = c.getContext("2d");
  g.setTransform(L.s * dpr, 0, 0, L.s * dpr, 0, 0);
  wall(g, L);
  bench(g, L);
  head(g, L);
  axles(g, L);
  tray(g, L);
  stagePlate(g, L);
  leverBase(g, L);
  return c;
}

/* ======================= الطبقة المتحرّكة ======================= */
const fsz = (n, s) => Math.max(n, 11 / s);

/** مقبض مخرّش أسطواني: tau = زاوية الدوران بالراديان */
function knob(g, k, tau, hot) {
  const { cx, cy, w, h } = k;
  const R = h / 2;
  const x = cx - w / 2;
  const y = cy - R;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 12;
  g.shadowOffsetX = k.side * 4;
  g.shadowOffsetY = 6;
  g.fillStyle = "#16191c";
  rr(g, x, y, w, h, Math.min(14, w / 2));
  g.fill();
  g.restore();

  g.save();
  rr(g, x, y, w, h, Math.min(14, w / 2));
  g.clip();
  // جسم مطّاطي: تظليل أسطواني رأسي
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, "#0e1012");
  body.addColorStop(0.22, "#3a4148");
  body.addColorStop(0.36, "#59626b");
  body.addColorStop(0.5, "#2a3036");
  body.addColorStop(1, "#0a0b0d");
  g.fillStyle = body;
  g.fillRect(x, y, w, h);
  // تخريش: خطوط تدور حول الأسطوانة
  const step = k.kind === "coarse" ? 0.2 : 0.24;
  for (let a = 0; a < Math.PI * 2; a += step) {
    const th = a + tau;
    const c = Math.cos(th);
    if (c <= 0) continue;
    const yy = cy + R * 0.96 * Math.sin(th);
    g.strokeStyle = `rgba(0,0,0,${0.55 * c})`;
    g.lineWidth = 2.4 * c + 0.4;
    g.beginPath();
    g.moveTo(x, yy);
    g.lineTo(x + w, yy);
    g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.12 * c})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, yy + 2.2 * c);
    g.lineTo(x + w, yy + 2.2 * c);
    g.stroke();
  }
  // غطاء كروم خارجي
  const capW = k.kind === "coarse" ? 9 : 7;
  const capX = k.side > 0 ? x + w - capW : x;
  const cap = g.createLinearGradient(0, y, 0, y + h);
  cap.addColorStop(0, "#5b646b");
  cap.addColorStop(0.3, "#f4f7f9");
  cap.addColorStop(0.55, "#9aa4ac");
  cap.addColorStop(1, "#3b4349");
  g.fillStyle = cap;
  g.fillRect(capX, y, capW, h);
  if (hot) {
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(x, y, w, h);
  }
  g.restore();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 1.5;
  rr(g, x, y, w, h, Math.min(14, w / 2));
  g.stroke();
}

function engrave(g, text, x, y, size, color = "#2b2316", align = "center") {
  g.textAlign = align;
  g.direction = "rtl";
  g.font = `700 ${size}px ${FONT}`;
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillText(text, x, y + 1.2);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

function plate(g, L, st) {
  const p = L.plate;
  g.save();
  g.shadowColor = "rgba(20,12,0,0.5)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 6;
  const brass = g.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
  brass.addColorStop(0, "#f2dc9b");
  brass.addColorStop(0.3, "#cda24e");
  brass.addColorStop(0.55, "#f0d894");
  brass.addColorStop(1, "#a97d2e");
  g.fillStyle = brass;
  rr(g, p.x, p.y, p.w, p.h, 9);
  g.fill();
  g.restore();
  // تفريش المعدن
  const r = rng(5);
  g.save();
  rr(g, p.x, p.y, p.w, p.h, 9);
  g.clip();
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? "255,250,220" : "90,60,10"},0.07)`;
    g.lineWidth = 1;
    const y = p.y + r() * p.h;
    g.beginPath();
    g.moveTo(p.x, y);
    g.lineTo(p.x + p.w, y);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 1.6;
  rr(g, p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3, 8);
  g.stroke();
  screw(g, p.x + 11, p.y + p.h / 2, 4.5);
  screw(g, p.x + p.w - 11, p.y + p.h / 2, 4.5);

  // النص المنقوش: المرحلة (يمين) + التكبير (يسار) + مسطرة صغيرة
  const z = st.zoom;
  const fs = fsz(15, L.s);
  engrave(g, z.stage, p.x + p.w - 28, p.y + 23, fs, "#2b2316", "right");
  g.direction = "ltr";
  g.textAlign = "left";
  g.font = `700 ${fsz(14, L.s)}px ${FONT}`;
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillText(z.mag, p.x + 28, p.y + 24.2);
  g.fillStyle = "#2b2316";
  g.fillText(z.mag, p.x + 28, p.y + 23);
  // مسطرة تقدّم الزووم
  const rx = p.x + 28;
  const rw = p.w - 56;
  const ry = p.y + p.h - 12;
  g.strokeStyle = "rgba(43,35,22,0.75)";
  g.lineWidth = 1.2;
  for (let i = 0; i <= 20; i++) {
    const x = rx + (rw * i) / 20;
    g.beginPath();
    g.moveTo(x, ry);
    g.lineTo(x, ry - (i % 5 === 0 ? 7 : 4));
    g.stroke();
  }
  const nx = rx + rw * st.pShown;
  g.fillStyle = "#b3261e";
  g.beginPath();
  g.moveTo(nx, ry + 1);
  g.lineTo(nx - 4, ry + 8);
  g.lineTo(nx + 4, ry + 8);
  g.closePath();
  g.fill();
}

function objective(g, x, y, R, o, active, ang) {
  // قاعدة الهدفية (مسحوبة نحو المشاهد)
  g.save();
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  const cg = g.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
  cg.addColorStop(0, "#f5f8fa");
  cg.addColorStop(0.55, "#a5afb7");
  cg.addColorStop(1, "#4d555c");
  g.fillStyle = cg;
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // شريط اللون المعتمد دولياً
  g.strokeStyle = o.band;
  g.lineWidth = R * 0.24;
  g.beginPath();
  g.arc(x, y, R * 0.74, 0, Math.PI * 2);
  g.stroke();
  // العدسة
  const lg = g.createRadialGradient(x - R * 0.2, y - R * 0.25, 0, x, y, R * 0.55);
  lg.addColorStop(0, "#5f88a6");
  lg.addColorStop(0.5, "#14202b");
  lg.addColorStop(1, "#05080b");
  g.fillStyle = lg;
  g.beginPath();
  g.arc(x, y, R * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.ellipse(x - R * 0.2, y - R * 0.22, R * 0.16, R * 0.08, -0.6, 0, Math.PI * 2);
  g.fill();
  if (active) {
    g.strokeStyle = "rgba(255,226,130,0.95)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, R + 3, 0, Math.PI * 2);
    g.stroke();
  }
  void ang;
}

function turretDraw(g, L, st) {
  const t = L.turret;
  // القرص المعدني
  g.save();
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 20;
  g.shadowOffsetY = 10;
  const disc = g.createRadialGradient(t.cx - t.R * 0.3, t.cy - t.R * 0.35, 0, t.cx, t.cy, t.R);
  disc.addColorStop(0, "#f2f5f7");
  disc.addColorStop(0.5, "#9aa4ac");
  disc.addColorStop(0.85, "#4f585f");
  disc.addColorStop(1, "#262c31");
  g.fillStyle = disc;
  g.beginPath();
  g.arc(t.cx, t.cy, t.R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // حزّات الحافة (تدور مع البرج)
  g.strokeStyle = "rgba(0,0,0,0.28)";
  g.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + st.turretAngle;
    g.beginPath();
    g.moveTo(t.cx + Math.cos(a) * (t.R - 9), t.cy + Math.sin(a) * (t.R - 9));
    g.lineTo(t.cx + Math.cos(a) * (t.R - 1), t.cy + Math.sin(a) * (t.R - 1));
    g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.45)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(t.cx, t.cy, t.R - 10, 0, Math.PI * 2);
  g.stroke();
  // العدسات: الفعّالة عند الأسفل
  const n = OBJECTIVES.length;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i - st.turretIndexF) * (Math.PI * 2 / n);
    const x = t.cx + Math.cos(a) * t.ring;
    const y = t.cy + Math.sin(a) * t.ring;
    const active = i === st.activeObj;
    objective(g, x, y, t.objR, OBJECTIVES[i], active, a);
    // التسمية المنقوشة على القرص
    const lx = t.cx + Math.cos(a) * (t.ring + t.objR + 11);
    const ly = t.cy + Math.sin(a) * (t.ring + t.objR + 11);
    if (Math.hypot(lx - t.cx, ly - t.cy) < t.R + 8) {
      g.save();
      g.font = `700 ${fsz(12, L.s)}px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.direction = "ltr";
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.fillText(OBJECTIVES[i].label, lx, ly + 0.8);
      g.fillStyle = active ? "#1d2329" : "#4a535a";
      g.fillText(OBJECTIVES[i].label, lx, ly);
      g.restore();
    }
  }
  // برغي مركزي
  screw(g, t.cx, t.cy, 8);
}

/** يرسم شريحة زجاجية ثم عيّنتها المصغّرة */
function slide(g, L, key, sl, hot) {
  const w = sl.w;
  const h = sl.h;
  const x = sl.x - w / 2;
  const y = sl.y - h / 2;
  g.save();
  g.translate(sl.x, sl.y);
  g.rotate(sl.rot || 0);
  g.translate(-sl.x, -sl.y);
  g.save();
  g.shadowColor = `rgba(10,5,0,${0.25 + 0.2 * (sl.lift || 0)})`;
  g.shadowBlur = 8 + 14 * (sl.lift || 0);
  g.shadowOffsetY = 3 + 9 * (sl.lift || 0);
  g.fillStyle = "rgba(225,240,248,0.7)";
  rr(g, x, y, w, h, 4);
  g.fill();
  g.restore();
  // عمق الزجاج
  const gl = g.createLinearGradient(x, y, x + w, y + h);
  gl.addColorStop(0, "rgba(255,255,255,0.65)");
  gl.addColorStop(0.5, "rgba(200,225,238,0.35)");
  gl.addColorStop(1, "rgba(255,255,255,0.5)");
  g.fillStyle = gl;
  rr(g, x, y, w, h, 4);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 1.4;
  rr(g, x + 0.7, y + 0.7, w - 1.4, h - 1.4, 3.5);
  g.stroke();
  g.strokeStyle = "rgba(60,100,120,0.55)";
  g.lineWidth = 1;
  rr(g, x, y, w, h, 4);
  g.stroke();
  // مسطّح الملصق (مصقول)
  const lw = w * 0.26;
  g.fillStyle = "rgba(250,248,240,0.96)";
  rr(g, x + w - lw, y + 1, lw - 1, h - 2, 3);
  g.fill();
  g.fillStyle = key === "plant" ? "#2e7d32" : "#ad1457";
  g.fillRect(x + w - lw, y + 1, 3, h - 2);
  g.save();
  g.font = `700 ${fsz(11, L.s)}px ${FONT}`;
  g.direction = "rtl";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#3d3329";
  g.fillText(key === "plant" ? "نباتية" : "حيوانية", x + w - lw / 2 + 1, y + h / 2 + 1);
  g.restore();
  // العيّنة
  const sx = x + (w - lw) / 2;
  const sy = y + h / 2;
  if (key === "plant") {
    g.fillStyle = "rgba(120,190,110,0.9)";
    g.strokeStyle = "rgba(40,110,50,0.95)";
    g.lineWidth = 2;
    rr(g, sx - 16, sy - 10, 32, 20, 4);
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(30,120,60,0.9)";
    for (const [dx, dy] of [[-8, -3], [4, 4], [8, -4]]) {
      g.beginPath();
      g.ellipse(sx + dx, sy + dy, 3.4, 2.2, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = "rgba(240,150,185,0.92)";
    g.strokeStyle = "rgba(194,24,91,0.95)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(sx, sy, 17, 11.5, 0.15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(94,53,177,0.9)";
    g.beginPath();
    g.arc(sx - 2, sy, 5.2, 0, Math.PI * 2);
    g.fill();
  }
  if (hot) {
    g.strokeStyle = "rgba(255,240,150,0.95)";
    g.lineWidth = 2.5;
    rr(g, x - 2, y - 2, w + 4, h + 4, 6);
    g.stroke();
  }
  g.restore();
}

function lever(g, L, st) {
  const b = L.lever;
  const px = b.x + b.w * 0.3;
  const py = b.y + b.h / 2;
  const len = Math.min(48, b.h * 0.78);
  const ang = -Math.PI / 2 + (0.5 - st.lever.pos) * 1.7 + 0; // أعلى = خارج، أسفل = غوص
  const tipX = px + Math.cos(ang) * 0;
  void tipX;
  // الذراع تتحرك رأسياً داخل المجرى: نمثّلها بخط مائل خفيف
  const dy = (st.lever.pos - 0.5) * (b.h - 34);
  const ky = py + dy;
  // ذراع كروم
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  const arm = g.createLinearGradient(px, 0, px + len, 0);
  arm.addColorStop(0, "#9aa4ac");
  arm.addColorStop(0.4, "#f6f9fb");
  arm.addColorStop(1, "#6b747b");
  g.fillStyle = arm;
  rr(g, px, ky - 5, len, 10, 5);
  g.fill();
  g.restore();
  // كرة الإمساك الحمراء
  const kx = px + len;
  const kg = g.createRadialGradient(kx - 5, ky - 6, 1, kx, ky, 13);
  kg.addColorStop(0, "#ff9a8f");
  kg.addColorStop(0.5, "#d64134");
  kg.addColorStop(1, "#7d150e");
  g.fillStyle = kg;
  g.beginPath();
  g.arc(kx, ky, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(kx - 4, ky - 5, 4, 2.4, -0.5, 0, Math.PI * 2);
  g.fill();
  // مؤشّر LED
  const ledOn = st.lever.enabled || st.lever.pos > 0.5;
  const ledC = st.lever.pos > 0.5 ? "#4cd37a" : st.lever.enabled ? "#ffb02e" : "#4b5359";
  const pulse = st.lever.enabled && st.lever.pos <= 0.5 ? 0.6 + 0.4 * Math.sin(st.time * 5) : 1;
  const lx = b.x + b.w - 14;
  const ly = b.y + b.h / 2;
  if (ledOn) {
    const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 16);
    lg.addColorStop(0, ledC);
    lg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.55 * pulse;
    g.fillStyle = lg;
    g.beginPath();
    g.arc(lx, ly, 16, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = ledC;
  g.beginPath();
  g.arc(lx, ly, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 1.2;
  g.stroke();
  // نقش "غوص" أسفل الكرة
  engrave(g, "غوص", b.x + b.w * 0.62, b.y + b.h - 10, fsz(12, L.s), "#c9d1d7");
}

function pill(g, L, text, x, y) {
  const size = fsz(13, L.s);
  g.save();
  g.font = `600 ${size}px ${FONT}`;
  g.direction = "rtl";
  const w = g.measureText(text).width + 22;
  const h = size + 12;
  const px = Math.max(8, Math.min(L.dW - w - 8, x - w / 2));
  const py = Math.max(8, y - h / 2);
  g.fillStyle = "rgba(24,28,32,0.9)";
  rr(g, px, py, w, h, h / 2);
  g.fill();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, px + w / 2, py + h / 2 + 1);
  g.restore();
}

/** الرسم المتحرّك كل إطار فوق الطبقة الثابتة */
export function drawDynamic(g, L, st) {
  // وهج الإضاءة تحت العيّنة
  const s = L.stage;
  const sg = g.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, 0, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.55);
  sg.addColorStop(0, "rgba(255,225,140,0.35)");
  sg.addColorStop(1, "rgba(255,225,140,0)");
  g.fillStyle = sg;
  g.fillRect(s.x - 40, s.y - 40, s.w + 80, s.h + 80);

  // الشرائح (الخاملة أولاً ثم المرفوعة/المسحوبة)
  const order = ["animal", "plant"].sort((a, b) => st.slides[a].lift - st.slides[b].lift);
  for (const key of order) slide(g, L, key, st.slides[key], st.hover === `slide:${key}` && st.type !== key);

  // المقابض
  for (const k of L.knobs) {
    const tau = k.kind === "coarse" ? st.coarseTau : st.fineTau;
    knob(g, k, tau, st.hover === `knob:${k.kind}` || st.press === `knob:${k.kind}`);
  }
  turretDraw(g, L, st);
  lever(g, L, st);
  plate(g, L, st);

  // تلميح صغير عند التمرير/الضغط
  if (st.tip) pill(g, L, st.tip.text, st.tip.x, st.tip.y);
}

export const SLIDE_SIZE = (L) => ({ w: Math.min(176, L.tray.w - 28), h: 48 });
