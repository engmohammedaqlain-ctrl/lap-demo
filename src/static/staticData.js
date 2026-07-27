/**
 * staticData.js — ثوابت التخطيط والألوان ومولّدات الشحنات
 * بأبعاد متوافقة مع واجهة المرجع (ملء الشاشة).
 */

export const SCENE_W = 940;
export const SCENE_H = 560;

/* البلوزة — نسب قريبة من صورة المرجع */
export const SWEATER = { x: 40, y: 70, w: 340, h: 420 };
export const SWEATER_IMG_ASPECT = 985 / 1024;

/* شبكة مرتّبة تملأ الجسم والجوانب وأسفل البلوزة */
export const SWEATER_GRID = { cols: 5, rows: 7, padX: 70, padY: 78 };

/* الجدار: 10 صفوف كالمرجع */
export const WALL = { x: 876, y: 36, w: 48, h: 488 };
export const WALL_ROWS = 10;

export const BALLOON_SPECS = [
  { color: "#E8433F", dark: "#B02722", light: "#FF8A7A", start: { x: 560, y: 320 } },
  { color: "#F2A93B", dark: "#C97F16", light: "#FFD98A", start: { x: 700, y: 240 } },
];
export const BALLOON_R = 64;

export const CHARGE = {
  plus: "#D93B3B",
  plusDark: "#9e2020",
  minus: "#3B8FD9",
  minusDark: "#1a5a9a",
  r: 11,
};

export function getSweaterDrawRect(sprite) {
  const { x, y, w, h } = SWEATER;
  const aspect =
    sprite && sprite.width > 0 && sprite.height > 0
      ? sprite.width / sprite.height
      : SWEATER_IMG_ASPECT;
  const boxAspect = w / h;
  let dw;
  let dh;
  if (boxAspect > aspect) {
    dh = h;
    dw = dh * aspect;
  } else {
    dw = w;
    dh = dw / aspect;
  }
  return {
    x: x + (w - dw) / 2,
    y: y + (h - dh) / 2,
    w: dw,
    h: dh,
  };
}

/** ظلّ واسع للجسم يغطي الجوانب والأسفل فوق الحاشية */
const SWEATER_BODY = [
  [0.5, 0.12],
  [0.63, 0.14],
  [0.72, 0.2],
  [0.88, 0.26],
  [0.92, 0.48],
  [0.84, 0.56],
  [0.78, 0.68],
  [0.76, 0.84],
  [0.68, 0.9],
  [0.5, 0.93],
  [0.32, 0.9],
  [0.24, 0.84],
  [0.22, 0.68],
  [0.16, 0.56],
  [0.08, 0.48],
  [0.12, 0.26],
  [0.28, 0.2],
  [0.37, 0.14],
];

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * شبكة مرتّبة تغطي جسم البلوزة بالكامل بما فيها الجوانب والأسفل
 * (المناطق التي كانت فارغة سابقاً).
 */
export function buildSweaterCharges(sprite) {
  const rect = getSweaterDrawRect(sprite);
  const plus = [];
  const minus = [];
  // شبكة كثيفة على الجسم: 5 أعمدة × 7 صفوف
  const cols = 5;
  const rows = 7;
  // حدود نسبية داخل مستطيل الرسم — جسم البلوزة دون الياقة والأساور الخارجية
  const x0 = 0.24;
  const x1 = 0.76;
  const y0 = 0.2;
  const y1 = 0.88;
  let id = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = cols === 1 ? (x0 + x1) / 2 : x0 + (c / (cols - 1)) * (x1 - x0);
      const ny = rows === 1 ? (y0 + y1) / 2 : y0 + (r / (rows - 1)) * (y1 - y0);
      // تأكيد البقاء داخل ظلّ القماش
      if (!pointInPoly(nx, ny, SWEATER_BODY)) continue;

      const cx = rect.x + nx * rect.w;
      const cy = rect.y + ny * rect.h;
      plus.push({ x: cx - 9, y: cy });
      minus.push({
        id: id++,
        homeX: cx + 9,
        homeY: cy,
        x: cx + 9,
        y: cy,
        vx: 0,
        vy: 0,
        owner: null,
        ox: 0,
        oy: 0,
      });
    }
  }
  return { plus, minus };
}

export function buildWallCharges() {
  const rows = [];
  const { x, y, w, h } = WALL;
  const cx = x + w / 2;
  for (let i = 0; i < WALL_ROWS; i++) {
    const cy = y + 28 + (i / (WALL_ROWS - 1)) * (h - 56);
    rows.push({
      plus: { x: cx - 10, y: cy },
      minusHome: { x: cx + 10, y: cy },
      minus: { x: cx + 10, y: cy },
    });
  }
  return rows;
}

export const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
