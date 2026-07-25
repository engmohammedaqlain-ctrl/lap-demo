/**
 * colorData.js — ثوابت ومعادلات متقدمة لتجربة رؤية الألوان ومزجها وعمى الألوان والأطوال الموجية.
 */

export const SCENE_W = 1000;
export const SCENE_H = 540;

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
    wavelength: 700, // nm
  },
  {
    id: "green",
    name: "أخضر",
    nameEn: "Green",
    color: "#00FF00",
    rgb: [0, 255, 0],
    glow: "rgba(0, 255, 0, 0.4)",
    particleColor: "#44FF44",
    y: 260,
    wavelength: 530, // nm
  },
  {
    id: "blue",
    name: "أزرق",
    nameEn: "Blue",
    color: "#0000FF",
    rgb: [0, 0, 255],
    glow: "rgba(0, 100, 255, 0.4)",
    particleColor: "#4488FF",
    y: 410,
    wavelength: 470, // nm
  },
];

// موقع العين والرأس في اللوحة
export const HEAD_CENTER = { x: 330, y: 270 };
export const EYE_CENTER = { x: 460, y: 275 };

export const CLAMP = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * أنماط رؤية عمى الألوان (Color Blindness Simulation Profiles)
 */
export const VISION_MODES = [
  { id: "normal", name: "رؤية طبيعية (Tri-chromatic)", desc: "جميع الخلايا المخروطية (L, M, S) تعمل بكفاءة كاملة." },
  { id: "protanopia", name: "عمى الأحمر (Protanopia)", desc: "غياب أو خلل مخاريط L الحساسة للأحمر." },
  { id: "deuteranopia", name: "عمى الأخضر (Deuteranopia)", desc: "غياب أو خلل مخاريط M الحساسة للأخضر." },
  { id: "tritanopia", name: "عمى الأزرق (Tritanopia)", desc: "غياب أو خلل مخاريط S الحساسة للأزرق." },
];

/**
 * حساب الاستجابة واللون المدرَك مع مراعاة نمط عمى الألوان والأطوال الموجية
 */
export function calculatePerceivedColor(rPercent, gPercent, bPercent, visionMode = "normal") {
  let r = CLAMP(rPercent, 0, 100) * 2.55;
  let g = CLAMP(gPercent, 0, 100) * 2.55;
  let b = CLAMP(bPercent, 0, 100) * 2.55;

  // استجابة المخاريط الأصلية بالشبكية
  let lCone = Math.min(100, (r * 0.85 + g * 0.15) / 2.55);
  let mCone = Math.min(100, (g * 0.85 + r * 0.1 + b * 0.05) / 2.55);
  let sCone = Math.min(100, (b * 0.95 + g * 0.05) / 2.55);

  // تطبيق التأثير الحسي لعمى الألوان على الدماغ (Brain Perception Matrix)
  if (visionMode === "protanopia") {
    // غياب L (استبدال الأحمر بمساهمة الأخضر)
    r = g * 0.9 + b * 0.1;
    lCone = lCone * 0.1;
  } else if (visionMode === "deuteranopia") {
    // غياب M (استبدال الأخضر بمساهمة الأحمر)
    g = r * 0.8 + b * 0.2;
    mCone = mCone * 0.1;
  } else if (visionMode === "tritanopia") {
    // غياب S (استبدال الأزرق بمساهمة الأخضر)
    b = g * 0.7;
    sCone = sCone * 0.1;
  }

  r = Math.round(CLAMP(r, 0, 255));
  g = Math.round(CLAMP(g, 0, 255));
  b = Math.round(CLAMP(b, 0, 255));

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  // حساب HSL (Hue, Saturation, Lightness)
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      case bN: h = (rN - gN) / d + 4; break;
    }
    h /= 6;
  }

  const hueDegrees = Math.round(h * 360);
  const satPercent = Math.round(s * 100);
  const lightPercent = Math.round(l * 100);

  // حساب الطول الموجي المهيمن التقريبي (Dominant Wavelength in nm)
  let wavelengthNm = 700 - (hueDegrees / 360) * 300;
  if (hueDegrees > 300) wavelengthNm = 380 + (360 - hueDegrees) * 2;
  wavelengthNm = Math.round(CLAMP(wavelengthNm, 380, 750));

  // اسم اللون العربي
  let arabicName = "أسود (لا ضوء)";
  const total = r + g + b;

  if (total < 15) {
    arabicName = "أسود (ظلام)";
  } else if (r > 200 && g > 200 && b > 200) {
    arabicName = "أبيض ناصع";
  } else if (r > 160 && g > 160 && b < 80) {
    arabicName = r > g + 40 ? "برتقالي" : "أصفر ذهبي";
  } else if (r > 160 && b > 160 && g < 80) {
    arabicName = "أرجواني (Magenta)";
  } else if (g > 160 && b > 160 && r < 80) {
    arabicName = "سماوي (Cyan)";
  } else if (r > g + 50 && r > b + 50) {
    arabicName = r > 180 ? "أحمر صافي" : "أحمر خافت";
  } else if (g > r + 50 && g > b + 50) {
    arabicName = g > 180 ? "أخضر صافي" : "أخضر خافت";
  } else if (b > r + 50 && b > g + 50) {
    arabicName = b > 180 ? "أزرق صافي" : "أزرق خافت";
  } else if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40) {
    arabicName = "رمادي (متعادل)";
  } else {
    arabicName = "لون مركب";
  }

  if (visionMode !== "normal" && total > 15) {
    arabicName += ` (${VISION_MODES.find((v) => v.id === visionMode)?.name.split(" ")[0]})`;
  }

  return {
    r,
    g,
    b,
    hex,
    arabicName,
    total,
    lCone,
    mCone,
    sCone,
    hueDegrees,
    satPercent,
    lightPercent,
    wavelengthNm,
  };
}
