/**
 * phModel.js — نموذج حسابي خالص للأس الهيدروجيني والتخفيف.
 *
 * يتبع نموذج PhET الرسمي (ph-scale): نتتبّع حجم "المادة الأصلية" (soluteVolume)
 * وحجم "الماء المضاف" (waterVolume). عند خلطهما نحسب مولات أيونات
 * الهيدرونيوم H3O⁺ من كلا المصدرين، نقسمها على الحجم الكلي لنحصل على تركيز
 * جديد، ثم pH = -log₁₀(التركيز). إضافة الماء (pH ٧) تُخفّف التركيز فيقترب
 * الـ pH من التعادل تدريجياً وبشكل لوغاريتمي واقعي — لا خطي مبسّط.
 */

export const MAX_VOLUME = 1.2; // لتر — سعة الكأس القصوى
export const MIN_VOLUME = 0; // لتر
export const DEFAULT_SOLUTE_VOLUME = 0.5; // لتر — كمية المادة عند اختيار سائل جديد
export const NEUTRAL_PH = 7;

/** تركيز أيونات الهيدرونيوم H3O⁺ (مول/لتر) عند pH معيّن */
export function concentrationH3O(pH) {
  return Math.pow(10, -pH);
}

/** تركيز أيونات الهيدروكسيد OH⁻ (مول/لتر) عند pH معيّن */
export function concentrationOH(pH) {
  return Math.pow(10, -(14 - pH));
}

/**
 * يحسب الأس الهيدروجيني الناتج عن خلط حجم من مادة (بـ pH معيّن) مع حجم من
 * الماء النقي. يُرجع قيمة مقيّدة بين ٠ و ١٤.
 *
 * يستخدم نموذج "الأيون المهيمن" (PhET ph-scale):
 *  - للأحماض (pH ≤ 7): نتتبّع H3O⁺ لأنه الأيون ذو التركيز الأعلى.
 *  - للقواعد (pH > 7): نتتبّع OH⁻ ثم نحوّل عبر pH = 14 − pOH.
 * هذا يضمن أن التخفيف يكون تدريجياً وواقعياً لكلا الجانبين.
 */
export function computePH({ soluteVolume, waterVolume, solutePH }) {
  const totalVolume = soluteVolume + waterVolume;
  if (totalVolume <= 0) return NEUTRAL_PH;

  if (solutePH <= NEUTRAL_PH) {
    // حمض أو متعادل: حساب H3O⁺
    const molesH3O =
      concentrationH3O(solutePH) * soluteVolume + concentrationH3O(NEUTRAL_PH) * waterVolume;
    const concentration = molesH3O / totalVolume;
    const pH = -Math.log10(concentration);
    return Math.max(0, Math.min(14, pH));
  } else {
    // قاعدة: حساب OH⁻ ثم تحويل إلى pH
    const molesOH =
      concentrationOH(solutePH) * soluteVolume + concentrationOH(NEUTRAL_PH) * waterVolume;
    const cOH = molesOH / totalVolume;
    const pOH = -Math.log10(cOH);
    return Math.max(0, Math.min(14, 14 - pOH));
  }
}

/**
 * يخلط أي عدد من المحاليل (كل جزء: { volume, pH }) وفق ميزان الشحنة العلمية:
 * excess H⁺ = Σ ([H⁺] − [OH⁻]) · V ، ثم يحلّ [H⁺]² − excess·[H⁺] − Kw = ٠.
 * يغطي خلط حمض+قاعدة (تعادل)، وتخفيف الأحماض/القواعد بدقّة لوغاريتمية.
 */
export function mixPH(parts) {
  const KW = 1e-14;
  let totalVolume = 0;
  let excessMoles = 0;
  for (const part of parts) {
    const v = part?.volume ?? 0;
    if (v <= 1e-9) continue;
    const pH = Math.max(0, Math.min(14, part.pH));
    const h = concentrationH3O(pH);
    const oh = concentrationOH(pH);
    excessMoles += (h - oh) * v;
    totalVolume += v;
  }
  if (totalVolume <= 1e-9) return NEUTRAL_PH;

  const excess = excessMoles / totalVolume;
  if (Math.abs(excess) < 1e-15) return NEUTRAL_PH;

  // جذر المعادلة التربيعية: [H+] = (excess + √(excess² + 4Kw)) / 2
  const hPlus = (excess + Math.sqrt(excess * excess + 4 * KW)) / 2;
  const pH = -Math.log10(Math.max(hPlus, 1e-15));
  return Math.max(0, Math.min(14, pH));
}

/** سعة أنبوب الاختبار الرفيع (لتر) */
export const TUBE_MAX_VOLUME = 0.25;

/** نسبة امتلاء الكأس (٠..١) من الحجم الكلي */
export function fillFraction(totalVolume) {
  return Math.max(0, Math.min(1, totalVolume / MAX_VOLUME));
}

/**
 * تصنيف الحالة (حمضي/متعادل/قاعدي) مع وجه تعبيري ووصف عربي مختصر — يُستخدم
 * في بطاقة التفاعل المرحة كي "يستمتع" الطالب بردّة الفعل حسب حموضة السائل.
 */
export function phStatus(pH) {
  if (pH < 3) return { label: "حمضي قوي", emoji: "😖", tone: "acid-strong" };
  if (pH < 6) return { label: "حمضي", emoji: "😬", tone: "acid" };
  if (pH <= 8) {
    if (Math.abs(pH - NEUTRAL_PH) < 0.3) return { label: "متعادل", emoji: "😊", tone: "neutral" };
    return { label: "قريب من التعادل", emoji: "🙂", tone: "neutral" };
  }
  if (pH < 11) return { label: "قاعدي", emoji: "🫧", tone: "base" };
  return { label: "قاعدي قوي", emoji: "😵", tone: "base-strong" };
}

/** تنسيق رقم عربي بعدد منازل عشرية محدّد */
export function formatAr(value, decimals = 1) {
  return value.toLocaleString("ar-EG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
