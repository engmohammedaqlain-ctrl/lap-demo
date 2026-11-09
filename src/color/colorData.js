/**
 * colorData.js — ثوابت ومعادلات رؤية الألوان (نمط فاتح بدون إيموجي)
 */

export const SCENE_W = 1000;
export const SCENE_H = 540;

export const FLASHLIGHTS = [
  {
    id: "red",
    name: "أحمر",
    nameEn: "Red",
    color: "#E23B3B",
    rgb: [226, 59, 59],
    glow: "rgba(226, 59, 59, 0.3)",
    particleColor: "#F05252",
    y: 96,
    wavelength: 700,
  },
  {
    id: "green",
    name: "أخضر",
    nameEn: "Green",
    color: "#22B04B",
    rgb: [34, 176, 75],
    glow: "rgba(34, 176, 75, 0.3)",
    particleColor: "#2ECC5B",
    y: 235,
    wavelength: 530,
  },
  {
    id: "blue",
    name: "أزرق",
    nameEn: "Blue",
    color: "#2F6FE0",
    rgb: [47, 111, 224],
    glow: "rgba(47, 111, 224, 0.3)",
    particleColor: "#4A86F0",
    y: 360,
    wavelength: 470,
  },
];

/* هندسة المشهد: صورة الشخص التشريحية تُرسم في اليسار، وكشّافات مائلة على
   اليمين تتجمّع أشعّتها في العين. الإحداثيات بمقياس اللوحة (1000×540).
   PERSON: تحويل رسم الصورة (مقياس وإزاحة). EYE/CORTEX: مواضع بؤبؤ العين
   والقشرة البصرية داخل المشهد بعد التحويل. */
/* تحويل رسم كل شخصية (مقياس وإزاحة) بحيث تقع عينها على EYE_CENTER الثابت،
   فلا تتغيّر الأشعّة/الكشّافات عند التبديل بين الولد والبنت. */
export const CHARACTERS = {
  boy: { scale: 0.6, dx: -66, dy: 29 },
  girl: { scale: 0.757, dx: -83, dy: 16 },
};
export const DEFAULT_CHARACTER = "boy";
export const EYE_CENTER = { x: 535, y: 231 };
export const CORTEX_CENTER = { x: 332, y: 214 };
export const BULB_LENS_X = 848; // مقدّمة عدسة الكشّاف (منها تنطلق الفوتونات)
export const BUBBLE_CENTER = { x: 150, y: 110 };

export const CLAMP = (v, min, max) => Math.max(min, Math.min(max, v));

export const VISION_MODES = [
  { id: "normal", name: "رؤية طبيعية" },
  { id: "protanopia", name: "عمى الأحمر" },
  { id: "deuteranopia", name: "عمى الأخضر" },
  { id: "tritanopia", name: "عمى الأزرق" },
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
