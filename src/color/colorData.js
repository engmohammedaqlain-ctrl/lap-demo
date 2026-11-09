/**
 * colorData.js — ثوابت ومعادلات رؤية الألوان (نمط فاتح بدون إيموجي)
 */

/* ===== مشهد "غرفة البصريات": إحداثيات التصميم 1280×720 ===== */
export const DW = 1280;
export const DH = 720;
export const TABLE_Y = 660; // سطح الطاولة
export const EYE = { x: 640, y: 330 };
export const CORTEX = { x: 430, y: 312 };
export const LENS_X = 955; // مقدّمة عدسات الكشّافات
export const GEL_X = 850; // موضع إطار الشفّاف الملوّن بين الكشّافات والعين
export const GEL_TOP = 132;
export const GEL_BOT = 560;

export const LIGHTS = [
  { id: "red", name: "أحمر", nameEn: "Red", color: "#E23B3B", rgb: [226, 59, 59], particleColor: "#FF5C5C", y: 158, wavelength: 700 },
  { id: "green", name: "أخضر", nameEn: "Green", color: "#22B04B", rgb: [34, 176, 75], particleColor: "#3CE070", y: 314, wavelength: 530 },
  { id: "blue", name: "أزرق", nameEn: "Blue", color: "#2F6FE0", rgb: [47, 111, 224], particleColor: "#5C98FF", y: 466, wavelength: 470 },
];

/* الشخصيتان: صور مقصوصة؛ نقطتا العين والقشرة بالبكسل داخل الصورة، و k تحوّلها
   لوحدات التصميم بحيث تقع العين على EYE دائماً (فلا تتغيّر الأشعّة بالتبديل). */
export const SUBJECTS = {
  boy: { w: 697, h: 898, k: 0.619, eye: [583, 308], head: [277, 0, 420, 560] },
  girl: { w: 558, h: 746, k: 0.781, eye: [451, 262], head: [138, 0, 420, 560] },
};
export const DEFAULT_CHARACTER = "boy";

export const FILTERS = [
  { id: "red", name: "أحمر", color: "#E23B3B", rgb: [226, 59, 59], pass: [1, 0.08, 0.08] },
  { id: "green", name: "أخضر", color: "#22B04B", rgb: [34, 176, 75], pass: [0.08, 1, 0.08] },
  { id: "blue", name: "أزرق", color: "#2F6FE0", rgb: [47, 111, 224], pass: [0.08, 0.08, 1] },
  { id: "yellow", name: "أصفر", color: "#EAB308", rgb: [234, 179, 8], pass: [1, 1, 0.08] },
];

/* أهداف التحدّي: ألوان يمكن بلوغها بشدّات الأضواء الثلاثة */
export const TARGETS = [
  [100, 100, 0], [0, 100, 100], [100, 0, 100], [100, 50, 0], [50, 0, 100], [0, 100, 50],
  [100, 0, 50], [50, 100, 0], [0, 50, 100], [50, 50, 50], [100, 100, 100], [100, 50, 50],
];

export const MIXES = [
  { id: "yellow", name: "أحمر + أخضر = أصفر", rgb: [100, 100, 0], color: "#F2D21B" },
  { id: "cyan", name: "أخضر + أزرق = سماوي", rgb: [0, 100, 100], color: "#16BFD0" },
  { id: "magenta", name: "أحمر + أزرق = أرجواني", rgb: [100, 0, 100], color: "#C43AA3" },
  { id: "white", name: "الثلاثة = أبيض", rgb: [100, 100, 100], color: "#F4F4F0" },
  { id: "black", name: "بلا ضوء = أسود", rgb: [0, 0, 0], color: "#262B30" },
];

export const CLAMP = (v, min, max) => Math.max(min, Math.min(max, v));

export const VISION_MODES = [
  { id: "normal", name: "رؤية طبيعية", short: "طبيعية", tint: null },
  { id: "protanopia", name: "عمى الأحمر", short: "عمى الأحمر", tint: [230, 90, 70] },
  { id: "deuteranopia", name: "عمى الأخضر", short: "عمى الأخضر", tint: [60, 190, 90] },
  { id: "tritanopia", name: "عمى الأزرق", short: "عمى الأزرق", tint: [70, 120, 230] },
];

/* تحويل تقريبي من تدرّج اللون (hue) إلى الطول الموجي المهيمن بالنانومتر */
const HUE_NM = [
  [0, 700],
  [0.083, 620],
  [0.166, 580],
  [0.333, 530],
  [0.5, 490],
  [0.666, 465],
  [0.78, 430],
];
function hueToNm(h) {
  for (let i = 1; i < HUE_NM.length; i++) {
    const [h1, n1] = HUE_NM[i];
    const [h0, n0] = HUE_NM[i - 1];
    if (h <= h1) return Math.round(n0 + ((h - h0) / (h1 - h0)) * (n1 - n0));
  }
  return 430;
}

/* اسم اللون من (التدرّج بالدرجات، التشبّع، السطوع) — يغطي كل الألوان بلا "لون مركب" */
function nameColor(hue, sat, val) {
  if (val < 0.07) return "أسود";
  if (sat < 0.12) return val > 0.85 ? "أبيض" : val > 0.45 ? "رمادي" : "رمادي داكن";
  let base;
  if (hue < 15 || hue >= 345) base = "أحمر";
  else if (hue < 40) base = "برتقالي";
  else if (hue < 70) base = "أصفر";
  else if (hue < 95) base = "أخضر ليموني";
  else if (hue < 165) base = "أخضر";
  else if (hue < 195) base = "سماوي (سايان)";
  else if (hue < 255) base = "أزرق";
  else if (hue < 285) base = "بنفسجي";
  else base = "أرجواني (ماجنتا)";
  if (val < 0.55) return `${base} داكن`;
  if (sat < 0.5) return `${base} فاتح`;
  return base;
}

export function calculatePerceivedColor(rPercent, gPercent, bPercent, visionMode = "normal") {
  let r = CLAMP(rPercent, 0, 100) * 2.55;
  let g = CLAMP(gPercent, 0, 100) * 2.55;
  let b = CLAMP(bPercent, 0, 100) * 2.55;

  let lCone = Math.min(100, (r * 0.85 + g * 0.15) / 2.55);
  let mCone = Math.min(100, (g * 0.85 + r * 0.1 + b * 0.05) / 2.55);
  let sCone = Math.min(100, (b * 0.95 + g * 0.05) / 2.55);

  if (visionMode === "protanopia") {
    r = g * 0.9 + b * 0.1;
    lCone = lCone * 0.1;
  } else if (visionMode === "deuteranopia") {
    g = r * 0.8 + b * 0.2;
    mCone = mCone * 0.1;
  } else if (visionMode === "tritanopia") {
    b = g * 0.7;
    sCone = sCone * 0.1;
  }

  r = Math.round(CLAMP(r, 0, 255));
  g = Math.round(CLAMP(g, 0, 255));
  b = Math.round(CLAMP(b, 0, 255));

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  const total = r + g + b;

  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      case bN: h = (rN - gN) / d + 4; break;
    }
    h /= 6;
  }
  // الألوان المحايدة (أبيض/رمادي/أسود) والأرجوانيات لا طول موجي واحد لها (غير طيفية)
  const wavelengthNm = max - min < 0.04 || h > 0.78 ? null : hueToNm(h);

  const arabicName = nameColor(h * 360, max === 0 ? 0 : (max - min) / max, max);

  return { r, g, b, hex, arabicName, total, lCone, mCone, sCone, wavelengthNm };
}
