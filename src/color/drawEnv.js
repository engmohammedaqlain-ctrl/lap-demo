/**
 * drawEnv.js — بيئة الغرفة (هادئة ونظيفة): جدار فحمي-مخضرّ ببقعة ضوء، طاولة بسيطة،
 * إطارا الشخصيتين، لوحة النظّارات، ملصق فِن لمزج الأضواء (يتفاعل مع الفيدرات ويُلمس
 * لتجربة الأمزجة)، لوحة التحدّي، رفّ الشفّافات، ومنضدة التحكّم بشاشتها.
 * كل عنصر تفاعلي يسجّل نفسه في S.hot ويُرسم بنفس لغة المواد: لوحات معتمة بحواف نحاسية.
 */
import { DW, TABLE_Y, LIGHTS, FILTERS, VISION_MODES, SUBJECTS, calculatePerceivedColor } from "./colorData.js";
import { getArt, rr, rgba, mix, drawGlow, shadowed } from "./sceneArt.js";

export function txt(S, s, x, y, o = {}) {
  const { size = 12, weight = 600, color = "#fff", align = "center", mono = false, min = 9, dir } = o;
  const g = S.g;
  g.font = `${weight} ${S.fs(size, min)}px ${mono ? "ui-monospace, 'Courier New', monospace" : "'IBM Plex Sans Arabic', sans-serif"}`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.direction = dir || (mono ? "ltr" : "rtl");
  g.fillText(s, x, y);
  g.direction = "rtl";
}

const hot = (S, h) => S.hot.push(h);
const isHover = (S, id) => S.hover === id;

/** لوحة معتمة بحافة نحاسية رقيقة (لغة المواد الموحّدة) */
function panel(S, x, y, w, h, r = 12, fill = "#16222b") {
  const g = S.g;
  shadowed(
    g,
    () => {
      rr(g, x, y, w, h, r);
      g.fillStyle = fill;
      g.fill();
    },
    16,
    6,
    0.5
  );
  rr(g, x, y, w, h, r);
  const gl = g.createLinearGradient(0, y, 0, y + h);
  gl.addColorStop(0, "rgba(255,255,255,0.07)");
  gl.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = gl;
  g.fill();
  g.strokeStyle = "rgba(205,170,100,0.55)";
  g.lineWidth = 1.6;
  g.stroke();
}

/* ======================= الجدار ======================= */
export function drawBackdrop(S) {
  const g = S.g;
  const { x0, x1, y0 } = S.ext;
  const art = getArt();
  const wall = g.createLinearGradient(0, y0, 0, TABLE_Y);
  wall.addColorStop(0, "#0a161d");
  wall.addColorStop(0.55, "#12303a");
  wall.addColorStop(1, "#1a4450");
  g.fillStyle = wall;
  g.fillRect(x0, y0, x1 - x0, TABLE_Y - y0 + 4);
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = g.createPattern(art.plaster, "repeat");
  g.fillRect(x0, y0, x1 - x0, TABLE_Y - y0);
  g.restore();
  // بقعة ضوء ناعمة خلف الرأس
  let rg = g.createRadialGradient(560, 320, 0, 560, 320, 520);
  rg.addColorStop(0, "rgba(130,210,220,0.26)");
  rg.addColorStop(0.6, "rgba(80,150,165,0.08)");
  rg.addColorStop(1, "rgba(80,150,165,0)");
  g.fillStyle = rg;
  g.fillRect(x0, y0, x1 - x0, TABLE_Y - y0);
  // تظليل الحواف
  rg = g.createRadialGradient(DW / 2, 340, 380, DW / 2, 340, 900);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = rg;
  g.fillRect(x0, y0, x1 - x0, TABLE_Y - y0);
}

/* ======================= الطاولة ======================= */
export function drawTable(S) {
  const g = S.g;
  const { x0, x1, y1 } = S.ext;
  const w = x1 - x0;
  const top = g.createLinearGradient(0, TABLE_Y, 0, TABLE_Y + 46);
  top.addColorStop(0, "#5d4430");
  top.addColorStop(1, "#3b2a1c");
  g.fillStyle = top;
  g.fillRect(x0, TABLE_Y, w, 46);
  const front = g.createLinearGradient(0, TABLE_Y + 46, 0, y1);
  front.addColorStop(0, "#241911");
  front.addColorStop(1, "#150f09");
  g.fillStyle = front;
  g.fillRect(x0, TABLE_Y + 46, w, y1 - TABLE_Y - 46 + 2);
  g.fillStyle = "rgba(255,225,190,0.32)";
  g.fillRect(x0, TABLE_Y, w, 1.5);
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.fillRect(x0, TABLE_Y + 46, w, 2);
}

/* ======================= إطارا الشخصيتين ======================= */
export function drawPortraits(S) {
  const g = S.g;
  [
    ["boy", 36, "ولد"],
    ["girl", 148, "بنت"],
  ].forEach(([id, x, label]) => {
    const y = 44;
    const w = 100;
    const h = 126;
    const active = S.p.character === id;
    const hov = isHover(S, `char:${id}`);
    shadowed(
      g,
      () => {
        rr(g, x, y, w, h, 6);
        const fr = g.createLinearGradient(x, y, x + w, y + h);
        fr.addColorStop(0, "#cfa24a");
        fr.addColorStop(0.5, "#8a6322");
        fr.addColorStop(1, "#bf9238");
        g.fillStyle = fr;
        g.fill();
      },
      12,
      6,
      0.5
    );
    rr(g, x + 7, y + 7, w - 14, h - 14, 3);
    g.fillStyle = "#e6dfcd";
    g.fill();
    const sub = SUBJECTS[id];
    const img = S.imgs[id];
    g.save();
    rr(g, x + 11, y + 11, w - 22, h - 22, 2);
    g.clip();
    g.fillStyle = "#24424e";
    g.fillRect(x, y, w, h);
    if (img) {
      const [sx, sy, sw, sh] = sub.head;
      g.drawImage(img, sx, sy, sw, sh, x + 11, y + 11, w - 22, h - 22);
    }
    if (!active) {
      g.fillStyle = "rgba(6,14,20,0.5)";
      g.fillRect(x, y, w, h);
    }
    g.restore();
    if (active || hov) {
      rr(g, x - 3, y - 3, w + 6, h + 6, 8);
      g.strokeStyle = active ? "rgba(255,226,150,0.95)" : "rgba(255,240,190,0.7)";
      g.lineWidth = active ? 2.6 : 2;
      g.stroke();
    }
    rr(g, x + 18, y + h + 8, w - 36, 17, 4);
    g.fillStyle = active ? "#e0bb62" : "#9a8250";
    g.fill();
    txt(S, label, x + w / 2, y + h + 17, { size: 12, color: "#241804", weight: 800, min: 9 });
    hot(S, { id: `char:${id}`, cx: x + w / 2, cy: y + h / 2 + 8, hw: w / 2 + 4, hh: h / 2 + 18, tip: id === "boy" ? "ولد" : "بنت", cursor: "pointer" });
  });
}

/* ======================= لوحة النظّارات ======================= */
function drawGlassesFront(S, cx, cy, tint, scale = 1) {
  const g = S.g;
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  const lens = (x) => {
    g.beginPath();
    g.ellipse(x, 0, 17, 14, 0, 0, Math.PI * 2);
    const f = g.createLinearGradient(x - 14, -12, x + 14, 12);
    if (tint) {
      f.addColorStop(0, rgba(mix(tint, [255, 255, 255], 0.35), 0.85));
      f.addColorStop(1, rgba(tint, 0.7));
    } else {
      f.addColorStop(0, "rgba(220,240,255,0.5)");
      f.addColorStop(1, "rgba(180,210,240,0.22)");
    }
    g.fillStyle = f;
    g.fill();
    g.strokeStyle = "#0b1117";
    g.lineWidth = 3.4;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x - 3, -2, 10, Math.PI * 1.05, Math.PI * 1.55);
    g.stroke();
  };
  lens(-22);
  lens(22);
  g.strokeStyle = "#0b1117";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-5, -3);
  g.quadraticCurveTo(0, -8, 5, -3);
  g.stroke();
  g.beginPath();
  g.moveTo(-39, -4);
  g.lineTo(-47, 2);
  g.moveTo(39, -4);
  g.lineTo(47, 2);
  g.stroke();
  g.restore();
}

export function drawGlassBoard(S) {
  const g = S.g;
  const X = 28;
  const Y = 226;
  const W = 224;
  const H = 148;
  panel(S, X, Y, W, H, 12);
  VISION_MODES.forEach((v, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = X + 60 + col * 104;
    const cy = Y + 34 + row * 66;
    const id = `vision:${v.id}`;
    const selected = S.p.visionMode === v.id;
    const worn = selected && !!v.tint;
    g.fillStyle = "#6a5a3a";
    g.beginPath();
    g.arc(cx, cy - 20, 3, 0, Math.PI * 2);
    g.fill();
    if (worn) {
      g.save();
      g.setLineDash([5, 4]);
      g.strokeStyle = "rgba(255,240,200,0.5)";
      g.lineWidth = 1.6;
      rr(g, cx - 48, cy - 17, 96, 34, 14);
      g.stroke();
      g.restore();
    } else {
      drawGlassesFront(S, cx, cy, v.tint, 0.95);
    }
    if (selected && !worn) {
      rr(g, cx - 52, cy - 21, 104, 42, 14);
      g.strokeStyle = "rgba(255,222,140,0.9)";
      g.lineWidth = 2.2;
      g.stroke();
    } else if (isHover(S, id)) {
      rr(g, cx - 52, cy - 21, 104, 42, 14);
      g.strokeStyle = "rgba(255,240,190,0.75)";
      g.lineWidth = 2;
      g.stroke();
    }
    rr(g, cx - 38, cy + 22, 76, 14, 4);
    g.fillStyle = selected ? "#dcb95c" : "#8e7a4b";
    g.fill();
    txt(S, v.short, cx, cy + 29, { size: 9.5, color: "#241804", weight: 800, min: 8.5 });
    hot(S, { id, cx, cy: cy + 8, hw: 52, hh: 30, tip: v.name, cursor: "pointer" });
  });
}

/* ======================= ملصق فِن: مزج الأضواء (حيّ + تفاعلي) ======================= */
export const VENN = { x: 28, y: 398, w: 224, h: 228 };
function vennCircles() {
  const cx = VENN.x + VENN.w / 2;
  const cy = VENN.y + 118;
  return [
    { id: "red", x: cx - 31, y: cy - 24, r: 56 },
    { id: "green", x: cx + 31, y: cy - 24, r: 56 },
    { id: "blue", x: cx, y: cy + 30, r: 56 },
  ];
}
export function vennRegion(X, Y) {
  const c = vennCircles();
  const m = c.map((q) => Math.hypot(X - q.x, Y - q.y) <= q.r);
  return m;
}
const REGION_NAMES = {
  "100": "أحمر",
  "010": "أخضر",
  "001": "أزرق",
  "110": "أصفر = أحمر + أخضر",
  "011": "سماوي = أخضر + أزرق",
  "101": "أرجواني = أحمر + أزرق",
  "111": "أبيض = الثلاثة",
  "000": "بلا ضوء = أسود",
};
export const vennKey = (m) => m.map((b) => (b ? 1 : 0)).join("");
export const vennName = (m) => REGION_NAMES[vennKey(m)];

export function drawVenn(S) {
  const g = S.g;
  const { x, y, w, h } = VENN;
  panel(S, x, y, w, h, 12, "#0f1a22");
  txt(S, "مزج الأضواء", x + w / 2, y + 18, { size: 11, color: "#d9c28a", weight: 700, min: 9 });
  const vals = [S.p.rVal, S.p.gVal, S.p.bVal];
  const c = vennCircles();
  g.save();
  rr(g, x + 5, y + 30, w - 10, h - 36, 8);
  g.clip();
  g.fillStyle = "#04080c";
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = "lighter";
  LIGHTS.forEach((L, i) => {
    const a = 0.07 + (vals[i] / 100) * 0.83;
    const rg = g.createRadialGradient(c[i].x, c[i].y, 6, c[i].x, c[i].y, c[i].r);
    rg.addColorStop(0, rgba(L.rgb, a));
    rg.addColorStop(0.85, rgba(L.rgb, a * 0.92));
    rg.addColorStop(1, rgba(L.rgb, a * 0.55));
    g.beginPath();
    g.arc(c[i].x, c[i].y, c[i].r, 0, Math.PI * 2);
    g.fillStyle = rg;
    g.fill();
  });
  g.restore();
  LIGHTS.forEach((L, i) => {
    g.beginPath();
    g.arc(c[i].x, c[i].y, c[i].r, 0, Math.PI * 2);
    g.strokeStyle = rgba(L.rgb, 0.65);
    g.lineWidth = 1.4;
    g.stroke();
  });
  // تمييز المنطقة تحت المؤشّر
  if (S.vennHover) {
    g.save();
    rr(g, x + 5, y + 30, w - 10, h - 36, 8);
    g.clip();
    g.globalCompositeOperation = "lighter";
    const m = S.vennHover;
    c.forEach((q, i) => {
      if (m[i]) {
        g.beginPath();
        g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255,0.06)";
        g.fill();
      }
    });
    g.restore();
  }
  hot(S, {
    id: "venn",
    cx: x + w / 2,
    cy: y + h / 2 + 8,
    hw: w / 2,
    hh: h / 2 - 8,
    tip: "المس منطقة لتجربة المزج",
    tipAt: (X, Y2) => vennName(vennRegion(X, Y2)),
    cursor: "pointer",
    kind: "venn",
  });
}

/* ======================= لوحة التحدّي ======================= */
export const CHALLENGE = { x: 504, y: 20, w: 166, h: 112 };
export function drawChallenge(S) {
  const g = S.g;
  const { x, y, w, h } = CHALLENGE;
  const ch = S.ch;
  panel(S, x, y, w, h, 12, "#0f1a22");
  txt(S, "تحدّي اللون", x + w - 14, y + 18, { size: 11, color: "#d9c28a", weight: 700, align: "right", min: 9 });
  // مصباح الحالة
  g.beginPath();
  g.arc(x + 16, y + 18, 4.5, 0, Math.PI * 2);
  g.fillStyle = ch.on ? "#4cf08a" : "#34403c";
  g.fill();
  if (ch.on) {
    g.save();
    g.globalCompositeOperation = "lighter";
    drawGlow(g, [76, 240, 138], x + 16, y + 18, 12, 0.7);
    g.restore();
  }
  if (ch.on && ch.target) {
    const [tr, tg, tb] = ch.target;
    const t = calculatePerceivedColor(tr, tg, tb, "normal");
    // عيّنة الهدف
    g.save();
    g.shadowColor = t.hex;
    g.shadowBlur = 16;
    g.beginPath();
    g.arc(x + 40, y + 62, 24, 0, Math.PI * 2);
    g.fillStyle = t.hex;
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x + 40, y + 62, 24, 0, Math.PI * 2);
    g.stroke();
    txt(S, "الهدف", x + 40, y + 98, { size: 9, color: "#9fb6bd", min: 8.5 });
    // مقياس الاقتراب
    const bx = x + 78;
    const bw = w - 94;
    rr(g, bx, y + 54, bw, 10, 5);
    g.fillStyle = "#05090d";
    g.fill();
    const f = Math.max(0.03, ch.closeness);
    const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "#d64545");
    grad.addColorStop(0.6, "#e8b923");
    grad.addColorStop(1, "#3ddc84");
    rr(g, bx, y + 54, bw * f, 10, 5);
    g.fillStyle = grad;
    g.fill();
    txt(S, "اقترب من الهدف", bx + bw / 2, y + 78, { size: 9, color: "#9fb6bd", min: 8.5 });
    txt(S, `✓ ${ch.score}`, bx + bw / 2, y + 98, { size: 12, color: "#e8d28a", weight: 800, mono: true, min: 9 });
    if (ch.flash > 0) {
      rr(g, x, y, w, h, 12);
      g.fillStyle = `rgba(80,240,140,${0.3 * ch.flash})`;
      g.fill();
      txt(S, "أحسنت", x + w / 2, y + 62, { size: 22, color: `rgba(255,255,255,${Math.min(1, ch.flash * 1.4)})`, weight: 800, min: 12 });
    }
  } else {
    txt(S, "طابِق لوناً بالأضواء", x + w / 2, y + 56, { size: 10.5, color: "#7f9ba3", weight: 600, min: 9 });
  }
  // مفتاح تبديل (Rocker)
  const sx = x + w - 34;
  const sy = y + h - 20;
  rr(g, sx - 17, sy - 8, 34, 16, 8);
  g.fillStyle = ch.on ? "#1f6b45" : "#0b1014";
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.3)";
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.arc(ch.on ? sx + 9 : sx - 9, sy, 6.5, 0, Math.PI * 2);
  g.fillStyle = "#e9eef2";
  g.fill();
  if (isHover(S, "challenge")) {
    rr(g, sx - 21, sy - 12, 42, 24, 12);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2;
    g.stroke();
  }
  hot(S, { id: "challenge", cx: sx, cy: sy, hw: 26, hh: 20, tip: ch.on ? "إيقاف التحدّي" : "تشغيل التحدّي", cursor: "pointer" });
}

/* ======================= رفّ الشفّافات (الجِل) ======================= */
export function drawGelRack(S) {
  const g = S.g;
  const rail = g.createLinearGradient(0, 24, 0, 35);
  rail.addColorStop(0, "#8c99a6");
  rail.addColorStop(1, "#303b46");
  rr(g, 672, 24, 256, 10, 5);
  g.fillStyle = rail;
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(676, 25, 248, 1.4);
  FILTERS.forEach((f, i) => {
    const x = 682 + i * 60;
    const y = 40;
    const w = 52;
    const h = 78;
    const rgb = f.rgb;
    const id = `gel:${f.id}`;
    const active = S.p.filter === f.id;
    g.fillStyle = "#2a343e";
    rr(g, x + w / 2 - 9, 33, 18, 12, 3);
    g.fill();
    if (active) {
      g.save();
      g.setLineDash([5, 4]);
      g.strokeStyle = rgba(rgb, 0.7);
      g.lineWidth = 1.6;
      rr(g, x, y + 8, w, h - 8, 6);
      g.stroke();
      g.restore();
    } else {
      shadowed(
        g,
        () => {
          rr(g, x, y + 8, w, h - 8, 6);
          const gg = g.createLinearGradient(x, y, x + w, y + h);
          gg.addColorStop(0, rgba(mix(rgb, [255, 255, 255], 0.3), 0.85));
          gg.addColorStop(1, rgba(rgb, 0.74));
          g.fillStyle = gg;
          g.fill();
        },
        10,
        5,
        0.4
      );
      rr(g, x, y + 8, w, h - 8, 6);
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1.4;
      g.stroke();
      const gl = g.createLinearGradient(x, y, x + w, y + h);
      gl.addColorStop(0.12, "rgba(255,255,255,0)");
      gl.addColorStop(0.24, "rgba(255,255,255,0.3)");
      gl.addColorStop(0.36, "rgba(255,255,255,0)");
      g.fillStyle = gl;
      rr(g, x, y + 8, w, h - 8, 6);
      g.fill();
    }
    if (isHover(S, id)) {
      rr(g, x - 3, y + 5, w + 6, h - 2, 8);
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 2;
      g.stroke();
    }
    hot(S, { id, cx: x + w / 2, cy: y + h / 2 + 6, hw: w / 2 + 6, hh: h / 2 + 8, tip: `مرشّح ${f.name}`, cursor: "pointer" });
  });
}

/* ======================= منضدة التحكّم ======================= */
export const DESK = { x: 918, y: 546, w: 346, h: 118 };
export const FADER = { xs: [966, 1032, 1098], top: 606, bottom: 650 };
export const KNOB = { x: 1166, y: 624, r: 19 };
export const BTN = { x: 1230, y: 622, r: 16 };
export const KNOB_ANGLES = { particles: -0.95, waves: 0, solid: 0.95 };

function drawIcon(S, kind, x, y, active) {
  const g = S.g;
  g.save();
  g.translate(x, y);
  g.strokeStyle = active ? "#ffffff" : "rgba(210,222,235,0.5)";
  g.fillStyle = g.strokeStyle;
  g.lineWidth = 1.6;
  g.lineCap = "round";
  if (kind === "particles") {
    [[-5, -2], [0, 3], [5, -3]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(dx, dy, 1.7, 0, Math.PI * 2);
      g.fill();
    });
  } else if (kind === "waves") {
    g.beginPath();
    for (let i = -7; i <= 7; i++) g.lineTo(i, Math.sin(i * 0.9) * 3.2);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(-7, -3);
    g.lineTo(7, -5);
    g.lineTo(7, 5);
    g.lineTo(-7, 3);
    g.closePath();
    g.globalAlpha = active ? 0.9 : 0.5;
    g.fill();
  }
  g.restore();
}

export function drawDesk(S) {
  const g = S.g;
  const { x, y, w, h } = DESK;
  // جسم المنضدة: لوحة مائلة معتمة بحواف مشطوفة
  shadowed(
    g,
    () => {
      g.beginPath();
      g.moveTo(x + 8, y);
      g.lineTo(x + w - 8, y);
      g.lineTo(x + w, y + h);
      g.lineTo(x, y + h);
      g.closePath();
      g.fillStyle = "#1a252e";
      g.fill();
    },
    22,
    10,
    0.6
  );
  g.beginPath();
  g.moveTo(x + 8, y);
  g.lineTo(x + w - 8, y);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  const tone = g.createLinearGradient(0, y, 0, y + h);
  tone.addColorStop(0, "rgba(255,255,255,0.13)");
  tone.addColorStop(0.1, "rgba(255,255,255,0.02)");
  tone.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = tone;
  g.fill();
  g.strokeStyle = "rgba(205,170,100,0.5)";
  g.lineWidth = 1.5;
  g.stroke();

  // ---- الشاشة: اللون المُدرَك (طبيعي مقابل ما يراه صاحب النظّارة) ----
  const sx = x + 14;
  const sy = y + 8;
  const sw = w - 28;
  const sh = 40;
  rr(g, sx, sy, sw, sh, 7);
  const lcd = g.createLinearGradient(0, sy, 0, sy + sh);
  lcd.addColorStop(0, "#04161c");
  lcd.addColorStop(1, "#0a2a31");
  g.fillStyle = lcd;
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 1;
  g.stroke();
  const info = S.info;
  const normal = S.p.visionMode === "normal" ? info : S.infoNormal;
  const seesDiff = S.p.visionMode !== "normal";
  const chip = (cx, cy, hex, glow) => {
    g.save();
    if (glow) {
      g.shadowColor = hex;
      g.shadowBlur = 10;
    }
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.fillStyle = hex;
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.stroke();
  };
  let cx0 = sx + sw - 20;
  if (seesDiff) {
    chip(cx0, sy + 15, normal.hex, false);
    txt(S, "طبيعي", cx0, sy + 31, { size: 8, color: "#7fb8b0", min: 8 });
    chip(cx0 - 44, sy + 15, info.hex, true);
    txt(S, "يرى", cx0 - 44, sy + 31, { size: 8, color: "#7fb8b0", min: 8 });
    cx0 -= 80;
  } else {
    chip(cx0, sy + 15, info.hex, true);
    txt(S, "يرى", cx0, sy + 31, { size: 8, color: "#7fb8b0", min: 8 });
    cx0 -= 40;
  }
  txt(S, info.hex.toUpperCase(), sx + 12, sy + 14, { size: 14, color: "#a8fff0", mono: true, align: "left", weight: 700, min: 9 });
  txt(S, info.wavelengthNm ? `${info.wavelengthNm} nm` : "— nm", sx + 12, sy + 31, { size: 10, color: "#6fd0c4", mono: true, align: "left", weight: 700, min: 8.5 });
  // مقياس الطيف المصغّر مع مؤشّر الطول الموجي
  const bx = sx + 96;
  const bw = Math.max(40, cx0 - bx - 18);
  const spec = g.createLinearGradient(bx, 0, bx + bw, 0);
  [[0, "#7a1cff"], [0.12, "#1a4dff"], [0.3, "#12c4ff"], [0.42, "#35dc3c"], [0.55, "#ffe21a"], [0.7, "#ff8a12"], [0.88, "#ff2a1a"], [1, "#8a0d0d"]].forEach(([o, c]) => spec.addColorStop(o, c));
  rr(g, bx, sy + 16, bw, 8, 3);
  g.fillStyle = spec;
  g.fill();
  if (info.wavelengthNm) {
    const px = bx + ((info.wavelengthNm - 380) / 370) * bw;
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(px, sy + 14);
    g.lineTo(px - 4, sy + 7);
    g.lineTo(px + 4, sy + 7);
    g.closePath();
    g.fill();
  }

  // ---- الفيدرات ----
  LIGHTS.forEach((L, i) => {
    const fx = FADER.xs[i];
    const val = S.anim.fader[i];
    const t = val / 100;
    const cy = FADER.bottom - t * (FADER.bottom - FADER.top);
    const rgb = L.rgb;
    const id = `fader:${L.id}`;
    // علامات خفيفة 0/50/100
    g.strokeStyle = "rgba(230,238,246,0.35)";
    g.lineWidth = 1;
    [0, 0.5, 1].forEach((k) => {
      const ty = FADER.bottom - k * (FADER.bottom - FADER.top);
      g.beginPath();
      g.moveTo(fx + 11, ty);
      g.lineTo(fx + 18, ty);
      g.stroke();
    });
    // المجرى + التعبئة الملوّنة
    rr(g, fx - 3.5, FADER.top - 8, 7, FADER.bottom - FADER.top + 16, 3.5);
    g.fillStyle = "#05090d";
    g.fill();
    rr(g, fx - 2, cy, 4, FADER.bottom + 6 - cy, 2);
    g.fillStyle = rgba(rgb, 0.95);
    g.fill();
    g.save();
    g.globalCompositeOperation = "lighter";
    drawGlow(g, rgb, fx, (cy + FADER.bottom) / 2, 18, 0.28 * t);
    g.restore();
    // الغطاء مع القيمة
    const dragging = S.drag === id;
    shadowed(
      g,
      () => {
        rr(g, fx - 17, cy - 11, 34, 22, 6);
        const cg = g.createLinearGradient(0, cy - 11, 0, cy + 11);
        cg.addColorStop(0, rgba(mix(rgb, [255, 255, 255], 0.3), 1));
        cg.addColorStop(0.5, rgba(rgb, 1));
        cg.addColorStop(1, rgba(mix(rgb, [0, 0, 0], 0.4), 1));
        g.fillStyle = cg;
        g.fill();
      },
      dragging ? 14 : 8,
      dragging ? 2 : 4,
      0.55
    );
    rr(g, fx - 17, cy - 11, 34, 22, 6);
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.lineWidth = 1.2;
    g.stroke();
    txt(S, `${Math.round(val)}`, fx, cy + 0.5, { size: 11.5, color: "rgba(8,14,22,0.82)", mono: true, weight: 800, min: 8.5 });
    if (S.hint) {
      const pr = 22 + Math.sin(S.t * 5 + i) * 3;
      g.save();
      g.strokeStyle = rgba(rgb, 0.85);
      g.lineWidth = 2;
      g.globalAlpha = 0.7;
      rr(g, fx - pr, cy - pr * 0.62, pr * 2, pr * 1.24, 8);
      g.stroke();
      g.restore();
    }
    txt(S, L.name, fx, y + h - 6, { size: 11, color: rgba(mix(rgb, [255, 255, 255], 0.5), 1), weight: 800, min: 9 });
    hot(S, { id, cx: fx, cy: (FADER.top + FADER.bottom) / 2, hw: 26, hh: (FADER.bottom - FADER.top) / 2 + 18, tip: `${L.name} ${Math.round(val)}%`, cursor: "ns-resize", kind: "fader", index: i });
  });

  // ---- مفتاح نمط الضوء ----
  const mode = S.p.beamMode;
  const ang = S.anim.knob;
  const kx = KNOB.x;
  const ky = KNOB.y;
  ["particles", "waves", "solid"].forEach((m) => {
    const a = KNOB_ANGLES[m];
    drawIcon(S, m, kx + Math.sin(a) * 31, ky - Math.cos(a) * 31, mode === m);
  });
  g.beginPath();
  g.arc(kx, ky, KNOB.r + 4, 0, Math.PI * 2);
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fill();
  g.save();
  g.translate(kx, ky);
  g.rotate(ang);
  shadowed(
    g,
    () => {
      g.beginPath();
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const r = KNOB.r + (k % 2 ? 0 : 1.5);
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      const kg = g.createRadialGradient(-6, -8, 2, 0, 0, KNOB.r + 2);
      kg.addColorStop(0, "#5c6978");
      kg.addColorStop(0.7, "#232b34");
      kg.addColorStop(1, "#11171d");
      g.fillStyle = kg;
      g.fill();
    },
    8,
    4,
    0.6
  );
  g.strokeStyle = "#ffd66b";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, -4);
  g.lineTo(0, -KNOB.r + 4);
  g.stroke();
  g.restore();
  if (isHover(S, "knob")) {
    g.beginPath();
    g.arc(kx, ky, KNOB.r + 8, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2;
    g.stroke();
  }
  const modeName = { particles: "فوتونات", waves: "موجات", solid: "شعاع" }[mode];
  hot(S, { id: "knob", cx: kx, cy: ky, hw: 30, hh: 30, tip: `نمط الضوء: ${modeName}`, cursor: "pointer" });
  txt(S, "النمط", kx, y + h - 6, { size: 10, color: "rgba(220,230,240,0.55)", weight: 700, min: 8.5 });

  // ---- زرّ التشغيل/الإيقاف ----
  const bx2 = BTN.x;
  const by = BTN.y;
  const press = S.anim.btn;
  const running = S.p.isPlaying;
  const ledCol = running ? [70, 230, 120] : [255, 170, 40];
  const blink = running ? 1 : 0.6 + 0.4 * Math.sin(S.t * 6);
  g.beginPath();
  g.arc(bx2, by, BTN.r + 6, 0, Math.PI * 2);
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.fill();
  g.beginPath();
  g.arc(bx2, by, BTN.r + 3.5, 0, Math.PI * 2);
  g.strokeStyle = rgba(ledCol, 0.9 * blink);
  g.lineWidth = 2.6;
  g.stroke();
  g.save();
  g.globalCompositeOperation = "lighter";
  drawGlow(g, ledCol, bx2, by, BTN.r + 14, 0.32 * blink);
  g.restore();
  shadowed(
    g,
    () => {
      g.beginPath();
      g.arc(bx2, by + press * 3, BTN.r - 1, 0, Math.PI * 2);
      const bg2 = g.createRadialGradient(bx2 - 5, by - 6 + press * 3, 2, bx2, by + press * 3, BTN.r);
      bg2.addColorStop(0, "#f2f5f8");
      bg2.addColorStop(0.55, "#aab4be");
      bg2.addColorStop(1, "#5b6672");
      g.fillStyle = bg2;
      g.fill();
    },
    7 - press * 4,
    4 - press * 2,
    0.55
  );
  g.fillStyle = "#26303a";
  if (running) {
    g.fillRect(bx2 - 5, by - 6 + press * 3, 3.6, 12);
    g.fillRect(bx2 + 1.4, by - 6 + press * 3, 3.6, 12);
  } else {
    g.beginPath();
    g.moveTo(bx2 - 3.5, by - 7 + press * 3);
    g.lineTo(bx2 + 7, by + press * 3);
    g.lineTo(bx2 - 3.5, by + 7 + press * 3);
    g.closePath();
    g.fill();
  }
  if (isHover(S, "btn")) {
    g.beginPath();
    g.arc(bx2, by, BTN.r + 9, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2;
    g.stroke();
  }
  hot(S, { id: "btn", cx: bx2, cy: by, hw: 26, hh: 26, tip: running ? "إيقاف مؤقت" : "تشغيل", cursor: "pointer" });
  txt(S, running ? "تشغيل" : "متوقف", bx2, y + h - 6, { size: 10, color: "rgba(220,230,240,0.55)", weight: 700, min: 8.5 });
}
