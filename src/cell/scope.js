/**
 * scope.js — مجهر ضوئي مدرسي كامل يُرسم إجرائياً على Canvas 2D (بلا صور):
 * قاعدة بمصباح، ذراع منحنٍ، رأس، أنبوب وعدسة عينية، برج عدسات يدور بأربع
 * عدسات بأطوال وألوان مختلفة، منصّة ميكانيكية بمشبكين وشريحة زجاجية عليها
 * عيّنة، مكثّف، مقبضا تركيز (خشن/دقيق) يدوران، قرص إضاءة، ولوحة نحاسية
 * للتكبير. كل جزء متحرّك يُرسم كل إطار، والباقي في طبقة ثابتة.
 *
 * الإحداثيات المحلية للمجهر: الأصل أسفل منتصف القاعدة، y للأعلى سالبة، الوحدة u.
 */
import { OBJECTIVES, formatMag } from "./layout.js";
import { rr } from "./bench.js";

const FONT = "'IBM Plex Sans Arabic', sans-serif";
export const AX = -50; // محور الإبصار (x)
export const MIC_H = 600; // الارتفاع الكلي للمجهر (u)

export const K_COARSE = 0.09;
export const K_FINE = 0.026;

const ENAMEL = [
  [0, "#8f9ba3"],
  [0.16, "#cdd6db"],
  [0.38, "#f6f9fa"],
  [0.7, "#cbd4d9"],
  [1, "#7f8c95"],
];
const CHROME = [
  [0, "#5f686f"],
  [0.14, "#e8edf0"],
  [0.3, "#ffffff"],
  [0.5, "#a7b1b8"],
  [0.74, "#dce3e7"],
  [1, "#576068"],
];
const BLACK = [
  [0, "#08090a"],
  [0.22, "#363c42"],
  [0.42, "#59616a"],
  [0.74, "#22272b"],
  [1, "#08090a"],
];

const hgrad = (g, x0, x1, stops) => {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const vgrad = (g, y0, y1, stops) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

/* ======================= التخطيط ======================= */
export function scopeLayout(W, H) {
  const portrait = H > W * 1.02;
  const s = portrait ? Math.max(0.3, Math.min(W / 430, H / 900)) : Math.max(0.3, Math.min(W / 1240, H / 700));
  const dW = W / s;
  const dH = H / s;
  let benchY;
  let y0;
  let ks;
  let ox;
  if (portrait) {
    y0 = dH * 0.74;
    benchY = y0 - 40;
    ks = Math.min((y0 - 96) / (MIC_H + 12), (dW * 0.9) / 400);
    ox = dW / 2 - 18 * ks;
  } else {
    benchY = dH * 0.77;
    y0 = benchY + dH * 0.115;
    ks = Math.min((y0 - 74) / (MIC_H + 12), (dW * 0.44) / 400);
    ox = dW / 2 - 18 * ks;
  }
  const eye = { x: ox + AX * ks, y: y0 - 586 * ks, r: 26 * ks };
  // صندوق الشرائح
  const rack = portrait
    ? { x: dW / 2 - 108, y: y0 + 30, w: 216, h: 64 }
    : { x: Math.max(24, ox - 392 * ks - 150), y: y0 - 70, w: 190, h: 78 };
  return { orient: portrait ? "portrait" : "landscape", s, dW, dH, benchY, y0, ks, ox, eye, rack };
}

/* ======================= طبقة ثابتة ======================= */
function wallAndBench(g, L, wood) {
  const { dW, dH, benchY } = L;
  const grad = g.createLinearGradient(0, 0, 0, benchY);
  grad.addColorStop(0, "#e3eeea");
  grad.addColorStop(0.7, "#d2e2dc");
  grad.addColorStop(1, "#bfd3cb");
  g.fillStyle = grad;
  g.fillRect(0, 0, dW, dH);
  // بلاط خافت
  g.strokeStyle = "rgba(70,110,100,0.1)";
  g.lineWidth = 2;
  for (let x = 0; x < dW; x += 110) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, benchY);
    g.stroke();
  }
  for (let y = 0; y < benchY; y += 55) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(dW, y);
    g.stroke();
  }
  // شعاع ضوء من الأعلى يسار
  const beam = g.createLinearGradient(dW * 0.1, 0, dW * 0.55, benchY);
  beam.addColorStop(0, "rgba(255,255,238,0.5)");
  beam.addColorStop(1, "rgba(255,255,238,0)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(dW * 0.04, 0);
  g.lineTo(dW * 0.3, 0);
  g.lineTo(dW * 0.76, benchY);
  g.lineTo(dW * 0.4, benchY);
  g.closePath();
  g.fill();

  // ملصق خلية على الجدار (أفقي فقط)
  if (L.orient === "landscape" && L.ox - 230 * L.ks > 250) {
    const px = Math.max(40, L.rack.x + 6);
    const py = 90;
    const pw = 150;
    const ph = 196;
    g.fillStyle = "rgba(20,10,0,0.18)";
    g.fillRect(px + 6, py + 8, pw, ph);
    const fr = g.createLinearGradient(px, py, px + pw, py + ph);
    fr.addColorStop(0, "#a5733f");
    fr.addColorStop(1, "#6f4824");
    g.fillStyle = fr;
    g.fillRect(px, py, pw, ph);
    g.fillStyle = "#f8f1de";
    g.fillRect(px + 9, py + 9, pw - 18, ph - 18);
    const cx = px + pw / 2;
    const cy = py + ph * 0.46;
    const mem = g.createRadialGradient(cx - 14, cy - 18, 8, cx, cy, 52);
    mem.addColorStop(0, "#f6c7cf");
    mem.addColorStop(1, "#e09aa8");
    g.fillStyle = mem;
    g.beginPath();
    g.arc(cx, cy, 52, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#b5586b";
    g.lineWidth = 3;
    g.stroke();
    const nuc = g.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 20);
    nuc.addColorStop(0, "#9b6fd6");
    nuc.addColorStop(1, "#5a2fa0");
    g.fillStyle = nuc;
    g.beginPath();
    g.arc(cx - 6, cy - 2, 19, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ef8a3c";
    g.beginPath();
    g.ellipse(cx + 24, cy + 16, 11, 6, 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3aa6a0";
    g.beginPath();
    g.ellipse(cx - 24, cy + 22, 10, 5, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(60,40,20,0.7)";
    g.fillRect(px + 30, py + ph - 38, pw - 60, 4);
    g.fillRect(px + 44, py + ph - 28, pw - 88, 3);
  }

  // سطح الطاولة (منظور) + واجهتها
  const top = g.createLinearGradient(0, benchY, 0, benchY + 130);
  top.addColorStop(0, "#e0b27a");
  top.addColorStop(1, "#bb8a52");
  g.fillStyle = top;
  g.fillRect(0, benchY, dW, dH - benchY);
  g.save();
  g.globalAlpha = 0.34;
  g.fillStyle = g.createPattern(wood.front, "repeat");
  g.fillRect(0, benchY, dW, dH - benchY);
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillRect(0, benchY, dW, 2.5);
  // حافة أمامية
  const edgeY = L.y0 + (L.orient === "landscape" ? 70 : 120);
  const front = g.createLinearGradient(0, edgeY, 0, edgeY + 24);
  front.addColorStop(0, "#ecc48c");
  front.addColorStop(1, "#a8793f");
  g.fillStyle = front;
  g.fillRect(0, edgeY, dW, 24);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(0, edgeY + 22, dW, 3);
  const cab = g.createLinearGradient(0, edgeY + 24, 0, dH);
  cab.addColorStop(0, "#8d5e33");
  cab.addColorStop(1, "#5e3c1e");
  g.fillStyle = cab;
  g.fillRect(0, edgeY + 24, dW, dH - edgeY);
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = g.createPattern(wood.front, "repeat");
  g.fillRect(0, edgeY + 24, dW, dH - edgeY);
  g.restore();
  for (let x = 12; x < dW; x += 230) {
    g.strokeStyle = "rgba(30,16,6,0.4)";
    g.lineWidth = 2;
    g.strokeRect(x + 6, edgeY + 40, 218, dH - edgeY - 52);
    g.fillStyle = "#cfd5d8";
    g.beginPath();
    g.roundRect(x + 196, edgeY + 54, 8, 34, 4);
    g.fill();
  }
}

function benchProps(g, L) {
  // طبق بتري وزجاجة قطّارة على اليمين (إن وُجد مكان)
  const x = L.ox + 300 * L.ks;
  if (x + 130 > L.dW - 14) return;
  const y = L.y0 + (L.orient === "landscape" ? 26 : 56);
  g.fillStyle = "rgba(10,6,2,0.3)";
  g.beginPath();
  g.ellipse(x + 40, y + 20, 62, 10, 0, 0, Math.PI * 2);
  g.fill();
  const dish = g.createLinearGradient(x - 16, 0, x + 96, 0);
  dish.addColorStop(0, "rgba(225,240,244,0.85)");
  dish.addColorStop(0.5, "rgba(250,254,255,0.55)");
  dish.addColorStop(1, "rgba(190,214,222,0.85)");
  g.fillStyle = dish;
  g.beginPath();
  g.ellipse(x + 40, y + 6, 56, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 2;
  g.stroke();
  const gel = g.createRadialGradient(x + 30, y + 3, 4, x + 40, y + 6, 46);
  gel.addColorStop(0, "rgba(246,178,190,0.92)");
  gel.addColorStop(1, "rgba(212,128,148,0.75)");
  g.fillStyle = gel;
  g.beginPath();
  g.ellipse(x + 40, y + 6, 44, 11, 0, 0, Math.PI * 2);
  g.fill();
  // قارورة قطّارة كهرمانية
  const bx = x + 116;
  g.fillStyle = "rgba(10,6,2,0.3)";
  g.beginPath();
  g.ellipse(bx, y + 22, 20, 5, 0, 0, Math.PI * 2);
  g.fill();
  const bg = hgrad(g, bx - 17, bx + 17, [
    [0, "#5a3208"],
    [0.3, "#b8731c"],
    [0.55, "#d9953a"],
    [1, "#4a2a06"],
  ]);
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(bx - 17, y - 44, 34, 66, 7);
  g.fill();
  g.fillStyle = "#f4eddc";
  g.fillRect(bx - 14, y - 26, 28, 22);
  g.fillStyle = "#21262a";
  g.beginPath();
  g.roundRect(bx - 8, y - 66, 16, 24, 5);
  g.fill();
  g.beginPath();
  g.ellipse(bx, y - 66, 8, 12, 0, 0, Math.PI * 2);
  g.fillStyle = "#111417";
  g.fill();
}

function microscopeStatic(g, L) {
  g.save();
  g.translate(L.ox, L.y0);
  g.scale(L.ks, L.ks);

  // ظل على الطاولة
  const sh = g.createRadialGradient(-6, 8, 20, -6, 8, 230);
  sh.addColorStop(0, "rgba(14,8,2,0.5)");
  sh.addColorStop(1, "rgba(14,8,2,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(-4, 8, 230, 20, 0, 0, Math.PI * 2);
  g.fill();

  // الذراع (بمرّات متراكبة لإيحاء الحجم الأسطواني)
  const arm = () => {
    g.beginPath();
    g.moveTo(125, -58);
    g.bezierCurveTo(205, -70, 224, -250, 172, -345);
    g.bezierCurveTo(140, -404, 84, -432, 22, -438);
  };
  g.lineCap = "round";
  g.lineJoin = "round";
  const pass = (w, col, dx = 0, dy = 0) => {
    g.save();
    g.translate(dx, dy);
    arm();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
    g.restore();
  };
  pass(74, "#7f8c95");
  pass(66, "#b5c0c7");
  pass(54, "#d8dfe3", -3);
  pass(34, "#eff3f5", -9, -2);
  pass(10, "rgba(255,255,255,0.95)", -15, -3);
  // خط أزرق على الحافة الداخلية
  g.save();
  g.translate(25, 3);
  arm();
  g.strokeStyle = "rgba(43,110,163,0.75)";
  g.lineWidth = 4;
  g.stroke();
  g.restore();

  // القاعدة: الوجه الأمامي + السطح العلوي
  g.fillStyle = vgrad(g, -56, 0, [
    [0, "#4a535a"],
    [0.5, "#2f363b"],
    [1, "#1a1f23"],
  ]);
  rr(g, -174, -56, 348, 56, 15);
  g.fill();
  g.save();
  rr(g, -174, -56, 348, 56, 15);
  g.clip();
  g.fillStyle = hgrad(g, -174, 174, [
    [0, "rgba(0,0,0,0.38)"],
    [0.12, "rgba(255,255,255,0.06)"],
    [0.4, "rgba(255,255,255,0.0)"],
    [0.85, "rgba(0,0,0,0.12)"],
    [1, "rgba(0,0,0,0.4)"],
  ]);
  g.fillRect(-174, -56, 348, 56);
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(-174, -55, 348, 2);
  g.restore();
  // السطح العلوي
  g.fillStyle = vgrad(g, -76, -54, [
    [0, "#59636a"],
    [1, "#3a4349"],
  ]);
  g.beginPath();
  g.moveTo(-150, -54);
  g.lineTo(150, -54);
  g.lineTo(118, -76);
  g.lineTo(-118, -76);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 1.5;
  g.stroke();
  // نافذة المصباح
  g.fillStyle = "#0e1215";
  g.beginPath();
  g.ellipse(AX, -66, 48, 7, 0, 0, Math.PI * 2);
  g.fill();
  // أقدام مطاطية
  g.fillStyle = "#0e1113";
  rr(g, -162, -2, 46, 9, 3);
  g.fill();
  rr(g, 116, -2, 46, 9, 3);
  g.fill();
  // شريط أزرق على القاعدة
  g.fillStyle = "#2b6ea3";
  g.fillRect(-60, -18, 150, 4);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(-60, -18, 150, 1);

  // الرأس
  g.fillStyle = vgrad(g, -474, -380, [
    [0, "#f9fbfc"],
    [0.55, "#d8e0e4"],
    [1, "#aab6bd"],
  ]);
  rr(g, -135, -474, 220, 94, 26);
  g.fill();
  g.save();
  rr(g, -135, -474, 220, 94, 26);
  g.clip();
  g.fillStyle = hgrad(g, -135, 85, [
    [0, "rgba(0,0,0,0.28)"],
    [0.1, "rgba(0,0,0,0.04)"],
    [0.35, "rgba(255,255,255,0.28)"],
    [0.7, "rgba(0,0,0,0.0)"],
    [1, "rgba(0,0,0,0.3)"],
  ]);
  g.fillRect(-135, -474, 220, 94);
  g.fillStyle = "#2b6ea3";
  g.fillRect(-135, -401, 220, 5);
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(-135, -401, 220, 1.2);
  g.restore();
  g.strokeStyle = "rgba(60,78,90,0.45)";
  g.lineWidth = 1.2;
  rr(g, -135, -474, 220, 94, 26);
  g.stroke();
  // فتحات تهوية صغيرة
  g.fillStyle = "rgba(60,78,90,0.35)";
  for (let i = 0; i < 4; i++) rr(g, 20 + i * 12, -452, 6, 22, 2), g.fill();

  // الأنبوب (أسود) + حلقة كروم + العينية
  g.fillStyle = hgrad(g, AX - 29, AX + 29, BLACK);
  g.fillRect(AX - 29, -526, 58, 58);
  g.fillStyle = hgrad(g, AX - 31, AX + 31, CHROME);
  g.fillRect(AX - 31, -532, 62, 9);
  g.fillStyle = hgrad(g, AX - 21, AX + 21, BLACK);
  g.fillRect(AX - 21, -572, 42, 42);
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 6; i++) g.fillRect(AX - 21, -566 + i * 6.5, 42, 1.2);
  g.fillStyle = hgrad(g, AX - 25, AX + 25, CHROME);
  g.fillRect(AX - 25, -578, 50, 8);
  // كأس العين المطاطي
  g.fillStyle = hgrad(g, AX - 27, AX + 27, BLACK);
  rr(g, AX - 27, -596, 54, 20, 8);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    g.beginPath();
    g.moveTo(AX - 27 + i * 6.7, -595);
    g.lineTo(AX - 27 + i * 6.7, -577);
    g.stroke();
  }
  // العدسة الزجاجية
  const lens = g.createRadialGradient(AX - 6, -595, 1, AX, -594, 22);
  lens.addColorStop(0, "#9ec3d8");
  lens.addColorStop(0.5, "#27475a");
  lens.addColorStop(1, "#0a141a");
  g.fillStyle = lens;
  g.beginPath();
  g.ellipse(AX, -595, 21, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.45)";
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.ellipse(AX - 8, -596, 5, 1.6, 0, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

export function buildScopeStatic(L, dpr, wood) {
  const c = document.createElement("canvas");
  c.width = Math.round(L.dW * L.s * dpr);
  c.height = Math.round(L.dH * L.s * dpr);
  const g = c.getContext("2d");
  g.setTransform(dpr * L.s, 0, 0, dpr * L.s, 0, 0);
  wallAndBench(g, L, wood);
  benchProps(g, L);
  microscopeStatic(g, L);
  return c;
}

/* ======================= أجزاء ديناميكية ======================= */
function objective(g, i, theta, active, glow) {
  const o = OBJECTIVES[i];
  const R = 40;
  const x = AX + R * Math.sin(theta);
  const depth = Math.cos(theta);
  if (depth < -0.35) return;
  const lens = [40, 52, 66, 80][i];
  const wTop = [22, 24, 27, 31][i];
  const tilt = Math.sin(theta) * 0.42;
  const sc = 0.9 + 0.1 * depth;
  g.save();
  g.translate(x, -352);
  g.rotate(tilt);
  g.scale(sc, sc);
  if (glow) {
    g.shadowColor = "rgba(255,232,150,0.95)";
    g.shadowBlur = 18;
  }
  // جسم العدسة (مخروط مقطوع)
  const wBot = wTop * 0.6;
  g.fillStyle = hgrad(g, -wTop / 2, wTop / 2, CHROME);
  g.beginPath();
  g.moveTo(-wTop / 2, 0);
  g.lineTo(wTop / 2, 0);
  g.lineTo(wBot / 2, lens);
  g.lineTo(-wBot / 2, lens);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  // حلقة ملوّنة
  const bandY = lens * 0.18;
  const bandH = 10;
  g.fillStyle = o.band;
  g.beginPath();
  g.moveTo(-(wTop - (wTop - wBot) * (bandY / lens)) / 2, bandY);
  g.lineTo((wTop - (wTop - wBot) * (bandY / lens)) / 2, bandY);
  g.lineTo((wTop - (wTop - wBot) * ((bandY + bandH) / lens)) / 2, bandY + bandH);
  g.lineTo(-(wTop - (wTop - wBot) * ((bandY + bandH) / lens)) / 2, bandY + bandH);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(-wTop / 2 + 2, bandY, 3, bandH);
  // تخريش
  g.strokeStyle = "rgba(40,48,56,0.35)";
  g.lineWidth = 0.9;
  for (let k = 0; k < 5; k++) {
    const yy = lens * 0.42 + k * (lens * 0.1);
    const ww = (wTop - (wTop - wBot) * (yy / lens)) / 2;
    g.beginPath();
    g.moveTo(-ww, yy);
    g.lineTo(ww, yy);
    g.stroke();
  }
  // الطرف
  g.fillStyle = "#14191d";
  g.beginPath();
  g.ellipse(0, lens, wBot / 2, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(140,200,235,0.9)";
  g.beginPath();
  g.ellipse(0, lens, wBot / 2 - 3, 1.5, 0, 0, Math.PI * 2);
  g.fill();
  // تظليل العمق للعدسات الخلفية
  if (!active) {
    g.fillStyle = `rgba(10,14,18,${0.3 - 0.3 * Math.max(0, depth)})`;
    g.fillRect(-wTop / 2 - 1, 0, wTop + 2, lens);
  }
  g.restore();
  return { x, lens, tilt };
}

function nosepiece(g, st) {
  // القرص
  g.fillStyle = hgrad(g, AX - 66, AX + 66, [
    [0, "#10151a"],
    [0.2, "#434b53"],
    [0.4, "#6a737b"],
    [0.72, "#2b3238"],
    [1, "#0a0d10"],
  ]);
  g.beginPath();
  g.moveTo(AX - 66, -384);
  g.lineTo(AX + 66, -384);
  g.lineTo(AX + 54, -349);
  g.lineTo(AX - 54, -349);
  g.closePath();
  g.fill();
  // تخريش يتحرك مع الدوران
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 1.5;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + st.turretAngle;
    if (Math.cos(a) <= 0) continue;
    const x = AX + 60 * Math.sin(a);
    g.beginPath();
    g.moveTo(x, -382);
    g.lineTo(x * 0.98 + AX * 0.02, -351);
    g.stroke();
  }
  g.fillStyle = hgrad(g, AX - 60, AX + 60, CHROME);
  g.fillRect(AX - 62, -388, 124, 5);
}

function stageGroup(g, st, geo) {
  const { sy, C } = geo;
  // الدعامة نحو الذراع
  g.fillStyle = vgrad(g, sy, sy + 120, [
    [0, "#e4eaed"],
    [1, "#b4c0c7"],
  ]);
  rr(g, 40, sy - 4, 84, 124, 14);
  g.fill();
  g.save();
  rr(g, 40, sy - 4, 84, 124, 14);
  g.clip();
  g.fillStyle = hgrad(g, 40, 124, [
    [0, "rgba(0,0,0,0.18)"],
    [0.4, "rgba(255,255,255,0.3)"],
    [1, "rgba(0,0,0,0.25)"],
  ]);
  g.fillRect(40, sy - 4, 84, 124);
  g.restore();
  g.strokeStyle = "rgba(60,78,90,0.35)";
  g.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.moveTo(52, sy + 24 + k * 22);
    g.lineTo(112, sy + 24 + k * 22);
    g.stroke();
  }

  // رقبة المكثّف
  g.fillStyle = hgrad(g, AX, 60, ENAMEL);
  g.fillRect(AX + 18, sy + 22, 60, 14);
  // المكثّف
  g.fillStyle = hgrad(g, AX - 26, AX + 26, BLACK);
  rr(g, AX - 26, sy + 14, 52, 34, 5);
  g.fill();
  g.fillStyle = hgrad(g, AX - 24, AX + 24, CHROME);
  g.fillRect(AX - 24, sy + 26, 48, 5);
  g.strokeStyle = "#c9d2d8";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(AX - 26, sy + 38);
  g.lineTo(AX - 50, sy + 44);
  g.stroke();

  // وجه المنصّة الأمامي والجانبي
  g.fillStyle = vgrad(g, sy, sy + 15, [
    [0, "#434b52"],
    [1, "#1d2226"],
  ]);
  g.fillRect(-175, sy, 240, 15);
  g.fillStyle = "#2b3238";
  g.beginPath();
  g.moveTo(65, sy);
  g.lineTo(95, sy - 26);
  g.lineTo(95, sy - 11);
  g.lineTo(65, sy + 15);
  g.closePath();
  g.fill();
  // سطح المنصّة
  g.fillStyle = vgrad(g, sy - 26, sy, [
    [0, "#8f9aa2"],
    [1, "#b8c2c8"],
  ]);
  g.beginPath();
  g.moveTo(-175, sy);
  g.lineTo(65, sy);
  g.lineTo(95, sy - 26);
  g.lineTo(-145, sy - 26);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-175, sy);
  g.lineTo(65, sy);
  g.stroke();
  // الفتحة
  g.fillStyle = "#0b0f12";
  g.beginPath();
  g.ellipse(AX, sy - 13, 21, 5.6, 0, 0, Math.PI * 2);
  g.fill();
  const glow = st.light;
  if (glow > 0.02) {
    const gl = g.createRadialGradient(AX, sy - 13, 1, AX, sy - 13, 22);
    gl.addColorStop(0, `rgba(255,248,215,${0.95 * glow})`);
    gl.addColorStop(1, "rgba(255,248,215,0)");
    g.fillStyle = gl;
    g.beginPath();
    g.ellipse(AX, sy - 13, 21, 5.6, 0, 0, Math.PI * 2);
    g.fill();
  }

  // الشريحة (تتبدّل بحركة)
  const sa = st.slide;
  if (sa.t < 1 && sa.prev) slide(g, C, sa.prev, -52 * sa.t, 1 - sa.t, sy);
  slide(g, C, sa.type, sa.t < 1 ? 52 * (1 - sa.t) : 0, sa.t < 1 ? sa.t : 1, sy);

  // مشبكا الشريحة
  g.strokeStyle = "#252b30";
  g.lineWidth = 3.2;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(C.x + 86, sy - 22);
  g.lineTo(C.x + 74, sy - 17);
  g.lineTo(C.x + 63, sy - 14);
  g.stroke();
  g.beginPath();
  g.moveTo(C.x - 68, sy - 23);
  g.lineTo(C.x - 62, sy - 17);
  g.stroke();
  g.fillStyle = "#c9d2d8";
  g.beginPath();
  g.arc(C.x + 86, sy - 22, 3.4, 0, Math.PI * 2);
  g.fill();
}

function slide(g, C, type, dx, alpha, sy) {
  if (alpha <= 0.01) return;
  const cx = C.x + dx;
  const cy = C.y;
  const hl = 60;
  const sk = 12.6;
  const hd = 11;
  const FL = [cx - hl - sk, cy + hd];
  const FR = [cx + hl - sk, cy + hd];
  const BR = [cx + hl + sk, cy - hd];
  const BL = [cx - hl + sk, cy - hd];
  g.save();
  g.globalAlpha = alpha;
  // سُمك الزجاج
  g.fillStyle = "rgba(120,150,165,0.8)";
  g.beginPath();
  g.moveTo(FL[0], FL[1]);
  g.lineTo(FR[0], FR[1]);
  g.lineTo(FR[0], FR[1] + 3);
  g.lineTo(FL[0], FL[1] + 3);
  g.closePath();
  g.fill();
  // الوجه العلوي الزجاجي
  const gl = g.createLinearGradient(FL[0], FL[1], BR[0], BR[1]);
  gl.addColorStop(0, "rgba(232,246,252,0.82)");
  gl.addColorStop(1, "rgba(196,222,234,0.68)");
  g.fillStyle = gl;
  g.beginPath();
  g.moveTo(...FL);
  g.lineTo(...FR);
  g.lineTo(...BR);
  g.lineTo(...BL);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 1.2;
  g.stroke();
  // طرف مثلّج للملصق
  const lw = 26;
  g.fillStyle = "rgba(250,252,255,0.9)";
  g.beginPath();
  g.moveTo(FL[0], FL[1]);
  g.lineTo(FL[0] + lw, FL[1]);
  g.lineTo(BL[0] + lw, BL[1]);
  g.lineTo(BL[0], BL[1]);
  g.closePath();
  g.fill();
  g.strokeStyle = type === "plant" ? "#3f9a52" : "#c2517a";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(FL[0] + 5, FL[1] - 4);
  g.lineTo(BL[0] + 5, BL[1] + 4);
  g.stroke();
  // العيّنة
  const ex = cx;
  const ey = cy;
  if (type === "plant") {
    g.fillStyle = "rgba(96,178,104,0.9)";
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.roundRect(ex - 15 + k * 8, ey - 5 + (k % 2) * 2, 8, 9, 2);
      g.fill();
    }
    g.strokeStyle = "rgba(36,110,52,0.9)";
    g.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.roundRect(ex - 15 + k * 8, ey - 5 + (k % 2) * 2, 8, 9, 2);
      g.stroke();
    }
  } else {
    g.fillStyle = "rgba(236,132,170,0.92)";
    g.beginPath();
    g.ellipse(ex, ey, 17, 6.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(112,56,170,0.95)";
    g.beginPath();
    g.ellipse(ex - 3, ey, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  // الساترة
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 1;
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.moveTo(ex - 28, ey + 7);
  g.lineTo(ex + 22, ey + 7);
  g.lineTo(ex + 33, ey - 7);
  g.lineTo(ex - 17, ey - 7);
  g.closePath();
  g.fill();
  g.stroke();
  // لمعة
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath();
  g.moveTo(FL[0] + 34, FL[1]);
  g.lineTo(FL[0] + 44, FL[1]);
  g.lineTo(BL[0] + 44, BL[1]);
  g.lineTo(BL[0] + 34, BL[1]);
  g.closePath();
  g.fill();
  void sy;
  g.restore();
}

/** مقبض مخرّش يدور */
function wheel(g, cx, cy, r, tau, hot, fine) {
  // ظل
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.arc(cx + 3, cy + 4, r, 0, Math.PI * 2);
  g.fill();
  const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  body.addColorStop(0, fine ? "#6b747c" : "#59626a");
  body.addColorStop(0.65, fine ? "#2b3238" : "#262b30");
  body.addColorStop(1, "#0b0d0f");
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // تخريش
  const n = fine ? 28 : 36;
  g.lineCap = "round";
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + tau;
    const lit = 0.5 + 0.5 * Math.cos(a + 2.3);
    g.strokeStyle = `rgba(255,255,255,${0.05 + 0.2 * lit})`;
    g.lineWidth = fine ? 2 : 3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r - (fine ? 7 : 10)), cy + Math.sin(a) * (r - (fine ? 7 : 10)));
    g.lineTo(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5));
    g.stroke();
  }
  // حلقة كروم داخلية
  g.strokeStyle = "rgba(220,228,234,0.55)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, r - (fine ? 8 : 12), 0, Math.PI * 2);
  g.stroke();
  if (hot) {
    g.strokeStyle = "rgba(255,230,140,0.95)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r + 2, 0, Math.PI * 2);
    g.stroke();
  }
}

function plate(g, mag) {
  const x = 126;
  const y = -366;
  const w = 76;
  const h = 32;
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#f1d98d");
  gr.addColorStop(0.5, "#c7a043");
  gr.addColorStop(1, "#8c6a1f");
  g.fillStyle = gr;
  rr(g, x, y, w, h, 6);
  g.fill();
  g.strokeStyle = "rgba(60,40,8,0.7)";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(x + 4, y + 2, w - 8, 2);
  g.fillStyle = "#2f2208";
  g.font = `700 17px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.direction = "ltr";
  g.fillText(mag, x + w / 2, y + h / 2 + 1, w - 10);
  g.direction = "inherit";
  g.textBaseline = "alphabetic";
}

function dial(g, light, hot) {
  const cx = -130;
  const cy = -26;
  const r = 14;
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.arc(cx + 1.5, cy + 2, r + 2, 0, Math.PI * 2);
  g.fill();
  // تدريج
  g.strokeStyle = "rgba(235,240,243,0.7)";
  g.lineWidth = 1.5;
  for (let k = 0; k <= 8; k++) {
    const a = ((-225 + (k / 8) * 270) * Math.PI) / 180;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    g.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
    g.stroke();
  }
  const b = g.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, r);
  b.addColorStop(0, "#9aa5ad");
  b.addColorStop(0.7, "#3a4248");
  b.addColorStop(1, "#14181b");
  g.fillStyle = b;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  const a = ((-225 + light * 270) * Math.PI) / 180;
  g.strokeStyle = "#fbe7a0";
  g.lineWidth = 2.6;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4);
  g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  g.stroke();
  if (hot) {
    g.strokeStyle = "rgba(255,230,140,0.95)";
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(cx, cy, r + 3, 0, Math.PI * 2);
    g.stroke();
  }
  // مؤشّر LED
  g.fillStyle = light > 0.05 ? "#ffd868" : "#4a4330";
  g.shadowColor = light > 0.05 ? "rgba(255,210,90,0.9)" : "transparent";
  g.shadowBlur = light > 0.05 ? 8 : 0;
  g.beginPath();
  g.arc(cx - 36, cy, 3, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
}

/* ======================= الرسم الديناميكي ======================= */
export function stageGeo(st) {
  const sy = -246 - st.p * 16; // المنصّة ترتفع مع التكبير (التركيز)
  return { sy, C: { x: AX, y: sy - 13 } };
}

export function drawScopeDynamic(g, L, st) {
  g.save();
  g.translate(L.ox, L.y0);
  g.scale(L.ks, L.ks);
  const geo = stageGeo(st);
  const { sy } = geo;

  // مخروط الضوء من المصباح إلى الفتحة
  if (st.light > 0.02) {
    g.save();
    g.globalCompositeOperation = "lighter";
    const cone = g.createLinearGradient(0, -66, 0, sy - 13);
    cone.addColorStop(0, `rgba(255,236,170,${0.5 * st.light})`);
    cone.addColorStop(1, `rgba(255,236,170,${0.1 * st.light})`);
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(AX - 46, -66);
    g.lineTo(AX + 46, -66);
    g.lineTo(AX + 20, sy - 13);
    g.lineTo(AX - 20, sy - 13);
    g.closePath();
    g.fill();
    const lamp = g.createRadialGradient(AX, -66, 2, AX, -66, 56);
    lamp.addColorStop(0, `rgba(255,244,200,${0.95 * st.light})`);
    lamp.addColorStop(1, "rgba(255,244,200,0)");
    g.fillStyle = lamp;
    g.beginPath();
    g.ellipse(AX, -66, 54, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  stageGroup(g, st, geo);

  // برج العدسات
  const order = [];
  for (let i = 0; i < OBJECTIVES.length; i++) {
    const th = st.turretAngle + (i * Math.PI) / 2;
    order.push({ i, th, d: Math.cos(th) });
  }
  order.sort((a, b) => a.d - b.d);
  st.objHits = [];
  for (const o of order) {
    const r = objective(g, o.i, o.th, o.i === st.activeObj, st.hover === `obj:${o.i}` || (o.i === st.activeObj && st.press === "turret"));
    if (r && o.d > 0.05) st.objHits.push({ i: o.i, x: r.x, lens: r.lens, tilt: r.tilt, d: o.d });
  }
  nosepiece(g, st);

  // مقبضا التركيز
  const K = { x: 160, y: -172 };
  wheel(g, K.x, K.y, 52, st.coarseTau, st.hover === "knob:coarse" || st.press === "knob:coarse", false);
  wheel(g, K.x, K.y, 31, st.fineTau, st.hover === "knob:fine" || st.press === "knob:fine", true);
  const cap = g.createRadialGradient(K.x - 3, K.y - 3, 1, K.x, K.y, 10);
  cap.addColorStop(0, "#f7fafc");
  cap.addColorStop(1, "#7c868e");
  g.fillStyle = cap;
  g.beginPath();
  g.arc(K.x, K.y, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#3c444a";
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(K.x - 5, K.y);
  g.lineTo(K.x + 5, K.y);
  g.stroke();

  plate(g, formatMag(st.p));
  dial(g, st.light, st.hover === "dial" || st.press === "dial");

  // حلقة نابضة على العينية
  const pulse = 0.5 + 0.5 * Math.sin(st.time * 3.2);
  const hotEye = st.hover === "eye";
  if (hotEye || !st.looked) {
    g.strokeStyle = `rgba(255,225,120,${hotEye ? 0.95 : 0.35 + 0.45 * pulse})`;
    g.lineWidth = hotEye ? 3.2 : 2.4;
    g.beginPath();
    g.ellipse(AX, -595, 30 + pulse * (hotEye ? 3 : 8), 11 + pulse * (hotEye ? 1 : 3), 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/* ======================= صندوق الشرائح (بإحداثيات التصميم) ======================= */
export function rackSlots(L) {
  const { x, y, w, h } = L.rack;
  return [
    { key: "animal", x: x + w * 0.3, y, w: 64, h: h + 4 },
    { key: "plant", x: x + w * 0.7, y, w: 64, h: h + 4 },
  ];
}

export function drawRack(g, L, st) {
  const { x, y, w, h } = L.rack;
  const slots = rackSlots(L);
  // الشرائح الواقفة
  for (const sl of slots) {
    const on = st.type === sl.key;
    const hot = st.hover === `slide:${sl.key}`;
    const lift = on ? -h * 0.2 : hot ? -6 : 0;
    const cx = sl.x;
    const top = y - 18 + lift;
    g.save();
    g.translate(cx, top);
    g.rotate(sl.key === "animal" ? -0.08 : 0.08);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(-24, 4, 52, h + 6);
    const gl = g.createLinearGradient(-26, 0, 26, 0);
    gl.addColorStop(0, "rgba(236,248,254,0.9)");
    gl.addColorStop(1, "rgba(196,222,234,0.82)");
    g.fillStyle = gl;
    g.fillRect(-26, 0, 52, h);
    g.strokeStyle = hot || on ? "#ffe27a" : "rgba(255,255,255,0.95)";
    g.lineWidth = hot || on ? 3 : 1.5;
    g.strokeRect(-26, 0, 52, h);
    g.fillStyle = "rgba(250,252,255,0.95)";
    g.fillRect(-26, 0, 52, 18);
    // عيّنة
    if (sl.key === "plant") {
      g.fillStyle = "rgba(96,178,104,0.95)";
      for (let k = 0; k < 3; k++) g.fillRect(-14 + k * 10, 30 + (k % 2) * 4, 9, 11);
    } else {
      g.fillStyle = "rgba(236,132,170,0.95)";
      g.beginPath();
      g.ellipse(0, 36, 15, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(112,56,170,0.95)";
      g.beginPath();
      g.ellipse(-2, 35, 5, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // الصندوق الخشبي (واجهة فقط)
  const front = g.createLinearGradient(0, y + h * 0.42, 0, y + h + 10);
  front.addColorStop(0, "#c08a50");
  front.addColorStop(1, "#8a5a2b");
  g.fillStyle = front;
  rr(g, x, y + h * 0.42, w, h * 0.58 + 6, 6);
  g.fill();
  g.strokeStyle = "rgba(40,22,8,0.55)";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "rgba(255,230,180,0.35)";
  g.fillRect(x + 4, y + h * 0.42 + 2, w - 8, 2);
  // بطاقات الأسماء
  g.font = `700 12px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const sl of slots) {
    g.fillStyle = "#fbf4e2";
    rr(g, sl.x - 28, y + h * 0.6, 56, 18, 3);
    g.fill();
    g.strokeStyle = "rgba(70,50,20,0.5)";
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = "#3b2a14";
    g.fillText(sl.key === "plant" ? "نباتية" : "حيوانية", sl.x, y + h * 0.6 + 9.5);
  }
  g.textBaseline = "alphabetic";
}

/* ======================= اختبار اللمس ======================= */
export function toLocal(L, X, Y) {
  return { x: (X - L.ox) / L.ks, y: (Y - L.y0) / L.ks };
}

export function hitScope(L, st, X, Y) {
  const { x, y } = toLocal(L, X, Y);
  // صندوق الشرائح (تصميم)
  for (const sl of rackSlots(L)) {
    if (Math.abs(X - sl.x) < sl.w / 2 + 8 && Y > sl.y - 30 && Y < sl.y + sl.h + 14) return { kind: "slide", key: sl.key };
  }
  // العينية (أولوية)
  if (Math.abs(x - AX) < 38 && y > -612 && y < -520) return { kind: "eye" };
  // المقبضان
  const dK = Math.hypot(x - 160, y + 172);
  if (dK < 33) return { kind: "knob", sub: "fine" };
  if (dK < 56) return { kind: "knob", sub: "coarse" };
  // قرص الإضاءة
  if (Math.hypot(x + 130, y + 26) < 26) return { kind: "dial" };
  // العدسات
  const hits = st.objHits || [];
  let best = null;
  let bd = 1e9;
  for (const h of hits) {
    // مركز العدسة على قطعتها المائلة
    const cx = h.x + Math.sin(h.tilt) * h.lens * 0.5;
    const cy = -352 + Math.cos(h.tilt) * h.lens * 0.5;
    const d = Math.hypot(x - cx, (y - cy) * 0.7);
    if (d < 22 + h.lens * 0.12 && d < bd) {
      bd = d;
      best = h;
    }
  }
  if (best) return { kind: "obj", i: best.i };
  // القرص نفسه: سحب لتدوير البرج
  if (x > AX - 66 && x < AX + 66 && y > -388 && y < -346) return { kind: "turret" };
  return null;
}

export { clamp as _clamp, rng as _rng };
