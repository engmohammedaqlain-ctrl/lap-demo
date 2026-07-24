/**
 * simulationData.js
 * مصدر الحقيقة الوحيد لكثافات/ألوان المواد والسوائل — تُستخدم في محرك الفيزياء،
 * الرسم على الكانفس، شريط المواد، قائمة السائل، وجداول نافذة "عن التجربة"
 * حتى لا تتكرر الأرقام في أكثر من مكان قد يختلف لاحقاً.
 */

/**
 * viscosity بالباسكال·ثانية (Pa·s) — قيم حقيقية تقريبية عند 20°م.
 * تُستخدم لحساب تخميد الحركة (dampingFactor) بحيث يغطس الجسم في العسل
 * أبطأ بكثير وبدون تذبذب مقارنة بالماء، بدلاً من معاملة كل السوائل بنفس اللزوجة.
 */
export const LIQUIDS = {
  water: { nameAr: "ماء عذب", density: 1000, viscosity: 0.001, color: [45, 130, 195], colorDeep: [15, 65, 120], emoji: "💧" },
  seawater: { nameAr: "ماء البحر", density: 1025, viscosity: 0.0011, color: [35, 125, 165], colorDeep: [10, 70, 105], emoji: "🌊" },
  oliveOil: { nameAr: "زيت زيتون", density: 910, viscosity: 0.081, color: [160, 150, 55], colorDeep: [110, 100, 30], emoji: "🫒" },
  honey: { nameAr: "عسل", density: 1420, viscosity: 5, color: [175, 120, 35], colorDeep: [120, 75, 15], emoji: "🍯" },
  glycerin: { nameAr: "جليسرين", density: 1260, viscosity: 1.41, color: [180, 190, 175], colorDeep: [130, 145, 130], emoji: null },
};

export const BASE_DAMPING = 4.5;
export const WATER_VISCOSITY = LIQUIDS.water.viscosity;

/**
 * مقياس لوغاريتمي لتحويل اللزوجة الحقيقية إلى معامل تخميد بصري معقول.
 * مقياس خطي مباشر يجعل العسل (لزوجته 5000x الماء) يوقف الجسم فوراً
 * بشكل غير واقعي بصرياً؛ اللوغاريتم يحافظ على الترتيب الصحيح (عسل > جليسرين
 * > زيت > ماء البحر ≈ ماء) مع نمو متدرج محسوس.
 */
export function dampingFromViscosity(viscosity) {
  const ratio = Math.max(1, viscosity / WATER_VISCOSITY);
  return BASE_DAMPING * (1 + Math.log10(ratio) * 1.8);
}

/**
 * مرتّبة تصاعدياً بالكثافة (240 → 2700) لتغطي سلوكاً متنوعاً فعلياً:
 * فلّين/خشب يطفوان بوضوح، جليد يطفو بالكاد وقد يغرق بزيت الزيتون (كثافته
 * 910 أقل من الجليد 919 بقليل)، بلاستيك يغرق بالماء لكنه يطفو بالعسل
 * (1420 أكبر من 1380) - يوضّح أن الطفو يعتمد على السائل وليس الجسم فقط.
 */
export const MATERIALS = {
  cork: { nameAr: "فلّين", density: 240, color: [210, 185, 150], pattern: "cork", hint: "فلّين — يطفو" },
  wood: { nameAr: "خشب", density: 600, color: [165, 125, 90], pattern: "wood", hint: "خشب — يطفو" },
  ice: { nameAr: "جليد", density: 919, color: [205, 225, 235], pattern: "smooth", hint: "جليد — يطفو بالكاد" },
  plastic: { nameAr: "بلاستيك", density: 1380, color: [70, 175, 190], pattern: "smooth", hint: "بلاستيك — يغرق بالماء، يطفو بالعسل" },
  stone: { nameAr: "حجر", density: 2700, color: [175, 168, 155], pattern: "stone", hint: "حجر — يغرق" },
};

export const MATERIAL_ORDER = ["cork", "wood", "ice", "plastic", "stone"];
export const LIQUID_ORDER = ["water", "seawater", "oliveOil", "honey", "glycerin"];

export const MAX_BODIES = 3;
