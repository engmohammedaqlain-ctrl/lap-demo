/**
 * colorData.js — ثوابت ومعادلات تجربة رؤية الألوان ومزجها وتفاعل الشبكية.
 */

export const SCENE_W = 1000;
export const SCENE_H = 520;

export const FLASHLIGHTS = [
  {
    id: "red",
    name: "أحمر",
    nameEn: "Red",
    color: "#FF0000",
    rgb: [255, 0, 0],
    glow: "rgba(255, 0, 0, 0.4)",
    particleColor: "#FF4444",
    y: 110,
    wavelength: "700 nm",
  },
  {
    id: "green",
    name: "أخضر",
    nameEn: "Green",
    color: "#00FF00",
    rgb: [0, 255, 0],
    glow: "rgba(0, 255, 0, 0.4)",
    particleColor: "#44FF44",
    y: 250,
    wavelength: "530 nm",
  },
  {
    id: "blue",
    name: "أزرق",
    nameEn: "Blue",
    color: "#0000FF",
    rgb: [0, 0, 255],
    glow: "rgba(0, 100, 255, 0.4)",
    particleColor: "#4488FF",
    y: 390,
    wavelength: "470 nm",
  },
];

// موقع العين والرأس في اللوحة
export const HEAD_CENTER = { x: 340, y: 260 };
export const EYE_CENTER = { x: 470, y: 265 };
export const FLASHLIGHT_X = 820;

export const CLAMP = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * تحويل الشدة النسبة المؤية (0..100) لـ Red, Green, Blue إلى قيم (0..255) ولون Hex وشفرة RGB
 */
export function calculatePerceivedColor(rPercent, gPercent, bPercent) {
  const r = Math.round(CLAMP(rPercent, 0, 100) * 2.55);
  const g = Math.round(CLAMP(gPercent, 0, 100) * 2.55);
  const b = Math.round(CLAMP(bPercent, 0, 100) * 2.55);

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  // تحديد اسم اللون التقريبي باللغة العربية للوحة الشرح وسحابة التفكير
  let arabicName = "أسود (لا ضوء)";
  const total = r + g + b;

  if (total < 15) {
    arabicName = "أسود (لا يوجد ضوء)";
  } else if (r > 200 && g > 200 && b > 200) {
    arabicName = "أبيض (ضوء مركب كامل)";
  } else if (r > 150 && g > 150 && b < 80) {
    arabicName = r > g + 40 ? "برتقالي" : "أصفر";
  } else if (r > 150 && b > 150 && g < 80) {
    arabicName = "أرجواني (ماجنتا Magenta)";
  } else if (g > 150 && b > 150 && r < 80) {
    arabicName = "سماوي (سايان Cyan)";
  } else if (r > g + 50 && r > b + 50) {
    arabicName = r > 180 ? "أحمر صافي" : "أحمر خافت";
  } else if (g > r + 50 && g > b + 50) {
    arabicName = g > 180 ? "أخضر صافي" : "أخضر خافت";
  } else if (b > r + 50 && b > g + 50) {
    arabicName = b > 180 ? "أزرق صافي" : "أزرق خافت";
  } else if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40) {
    arabicName = "رمادي (متعادل)";
  } else if (r > g && g > b) {
    arabicName = "بني / برتقالي مصفر";
  } else if (r > b && b > g) {
    arabicName = "وردي / بنفسجي فاتح";
  } else if (g > b && b > r) {
    arabicName = "أخضر مزرق (تركواز)";
  } else {
    arabicName = "لون مركب";
  }

  // حساب الاستجابة المستحثّة في الخلايا المخروطية (L, M, S Cones)
  const lCone = Math.min(100, (r * 0.85 + g * 0.15) / 2.55);
  const mCone = Math.min(100, (g * 0.85 + r * 0.1 + b * 0.05) / 2.55);
  const sCone = Math.min(100, (b * 0.95 + g * 0.05) / 2.55);

  return { r, g, b, hex, arabicName, total, lCone, mCone, sCone };
}
