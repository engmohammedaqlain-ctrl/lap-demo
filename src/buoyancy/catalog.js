/**
 * catalog.js — مصدر الحقيقة لأجسام وسوائل تجربة الطفو (وحدات SI).
 * الأجسام: صندوق (box) أو أسطوانة قائمة (cyl) أو كرة (sphere)، بأبعاد حقيقية.
 */
export const G = 9.81;

/** مقطع الخزان: العرض الداخلي والعمق (داخل الشاشة) بالمتر */
export const TANK_W = 1.0;
export const TANK_D = 0.25;
export const TANK_AREA = TANK_W * TANK_D;
export const WATER_START = 0.42; // ارتفاع الماء الابتدائي (م)

export const LIQUIDS = {
  water: { nameAr: "ماء عذب", density: 1000, viscosity: 0.001, color: [52, 146, 214], deep: [14, 70, 140], alpha: 0.5 },
  seawater: { nameAr: "ماء البحر", density: 1025, viscosity: 0.0011, color: [36, 152, 170], deep: [8, 78, 108], alpha: 0.54 },
  oliveOil: { nameAr: "زيت زيتون", density: 910, viscosity: 0.081, color: [214, 176, 46], deep: [150, 106, 14], alpha: 0.62 },
  honey: { nameAr: "عسل", density: 1420, viscosity: 5, color: [218, 142, 28], deep: [140, 70, 8], alpha: 0.8 },
  glycerin: { nameAr: "جليسرين", density: 1260, viscosity: 1.41, color: [196, 222, 212], deep: [132, 172, 160], alpha: 0.4 },
  custom: { nameAr: "سائل مخصّص", density: 1000, viscosity: 0.002, color: [120, 190, 150], deep: [40, 110, 90], alpha: 0.55 },
};
export const LIQUID_ORDER = ["water", "seawater", "oliveOil", "honey", "glycerin", "custom"];

export const OBJECTS = {
  wood: { nameAr: "خشب", density: 600, shape: "box", w: 0.2, h: 0.2, d: 0.2, color: [180, 128, 80] },
  ice: { nameAr: "جليد", density: 919, shape: "box", w: 0.17, h: 0.17, d: 0.17, color: [190, 228, 244] },
  brick: { nameAr: "طوب", density: 1800, shape: "box", w: 0.24, h: 0.1, d: 0.11, color: [178, 84, 62] },
  cork: { nameAr: "فلّين", density: 240, shape: "cyl", r: 0.065, h: 0.13, color: [208, 168, 112] },
  apple: { nameAr: "تفاحة", density: 830, shape: "sphere", r: 0.06, color: [200, 40, 44] },
  steel: { nameAr: "فولاذ", density: 7800, shape: "sphere", r: 0.05, color: [150, 160, 172] },
};
export const OBJECT_ORDER = ["wood", "ice", "brick", "cork", "apple", "steel"];

/** الجسم الغامض: صندوق بنفس الحجم لكل المواد، فتختلف الكتلة فقط */
export const MYSTERY_SIZE = 0.17;
export const MYSTERY_MATERIALS = {
  cork: { nameAr: "فلّين", density: 240 },
  wood: { nameAr: "خشب", density: 600 },
  ice: { nameAr: "جليد", density: 919 },
  plastic: { nameAr: "بلاستيك", density: 1380 },
  brick: { nameAr: "طوب", density: 1800 },
  steel: { nameAr: "فولاذ", density: 7800 },
};
export const MYSTERY_ORDER = ["cork", "wood", "ice", "plastic", "brick", "steel"];

/* ---------- هندسة الأجسام ---------- */
export function halfH(o) {
  return o.shape === "sphere" ? o.r : o.h / 2;
}
export function halfW(o) {
  return o.shape === "box" ? o.w / 2 : o.r;
}
export function fullH(o) {
  return halfH(o) * 2;
}
export function volumeOf(o) {
  if (o.shape === "box") return o.w * o.h * o.d;
  if (o.shape === "cyl") return Math.PI * o.r * o.r * o.h;
  return (4 / 3) * Math.PI * o.r ** 3;
}

/** الحجم المغمور ومركز الطفو (y) لجسم مركزه y عندما يكون مستوى السائل L */
export function submergedOf(o, y, L) {
  const hh = halfH(o);
  const bottom = y - hh;
  const total = hh * 2;
  const hs = Math.max(0, Math.min(total, L - bottom));
  if (hs <= 0) return { v: 0, cy: bottom, hs: 0 };
  if (o.shape === "box") return { v: o.w * o.d * hs, cy: bottom + hs / 2, hs };
  if (o.shape === "cyl") return { v: Math.PI * o.r * o.r * hs, cy: bottom + hs / 2, hs };
  const r = o.r;
  const v = (Math.PI * hs * hs * (3 * r - hs)) / 3;
  const cy = y - (3 * (2 * r - hs) ** 2) / (4 * (3 * r - hs));
  return { v, cy, hs };
}
