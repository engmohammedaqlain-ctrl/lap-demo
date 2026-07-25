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
export const PERSON = { scale: 0.6, dx: -66, dy: 29 };
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
  let arabicName = "أسود";

  if (total < 15) {
    arabicName = "أسود";
  } else if (r > 200 && g > 200 && b > 200) {
    arabicName = "أبيض";
  } else if (r > 160 && g > 160 && b < 80) {
    arabicName = r > g + 40 ? "برتقالي" : "أصفر";
  } else if (r > 160 && b > 160 && g < 80) {
    arabicName = "أرجواني (ماجنتا)";
  } else if (g > 160 && b > 160 && r < 80) {
    arabicName = "سماوي (سايان)";
  } else if (r > g + 50 && r > b + 50) {
    arabicName = "أحمر";
  } else if (g > r + 50 && g > b + 50) {
    arabicName = "أخضر";
  } else if (b > r + 50 && b > g + 50) {
    arabicName = "أزرق";
  } else if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40) {
    arabicName = "رمادي";
  } else {
    arabicName = "لون مركب";
  }

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
  let wavelengthNm = Math.round(CLAMP(700 - h * 300, 380, 750));

  return { r, g, b, hex, arabicName, total, lCone, mCone, sCone, wavelengthNm };
}
