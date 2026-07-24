/**
 * phData.js — قائمة السوائل اليومية بأسماء عربية وقيمة الأس الهيدروجيني (pH)
 * التقريبية، إضافةً إلى اللون الحقيقي التقريبي لكل سائل (كما يبدو في الواقع)
 * ونفاذيّته (alpha) — فالسائل داخل الكأس يأخذ لون مادته الفعلي (حليب أبيض،
 * قهوة بنية، عصير برتقال برتقالي...) لا لوناً رمزياً. مرتّبة من الأكثر
 * حمضية إلى الأكثر قاعدية.
 */

export const SOLUTIONS = {
  lemon: { nameAr: "عصير ليمون", emoji: "🍋", pH: 2.4, color: [235, 224, 120], alpha: 0.9, fact: "طعمه لاذع بسبب حمض الستريك — من أشهر الأحماض في مطبخك!" },
  soda: { nameAr: "مشروب غازي", emoji: "🥤", pH: 2.5, color: [123, 74, 18], alpha: 0.88, fact: "حمضي بسبب حمض الكربونيك الناتج عن الغاز المذاب فيه." },
  vinegar: { nameAr: "خل", emoji: "🍶", pH: 2.9, color: [232, 226, 180], alpha: 0.82, fact: "حمضيته من حمض الأسيتيك، ويُستخدم لتنظيف الترسبات." },
  orange: { nameAr: "عصير برتقال", emoji: "🍊", pH: 3.5, color: [245, 160, 35], alpha: 0.95, fact: "حمضي وغني بفيتامين C المفيد لمناعة الجسم." },
  coffee: { nameAr: "قهوة", emoji: "☕", pH: 5.0, color: [74, 44, 23], alpha: 0.96, fact: "حمضية قليلاً، وحموضتها جزء أساسي من نكهتها." },
  milk: { nameAr: "حليب", emoji: "🥛", pH: 6.5, color: [246, 243, 235], alpha: 0.97, fact: "قريب من التعادل — حمضي قليلاً، ويتحوّل أكثر حموضة عند فساده." },
  water: { nameAr: "ماء نقي", emoji: "💧", pH: 7.0, color: [200, 228, 240], alpha: 0.5, fact: "متعادل تماماً: لا حمضي ولا قاعدي — نقطة الوسط في المقياس." },
  blood: { nameAr: "دم", emoji: "🩸", pH: 7.4, color: [160, 23, 34], alpha: 0.95, fact: "جسمك يحافظ على pH الدم قرب 7.4 بدقة عالية جداً!" },
  seawater: { nameAr: "ماء البحر", emoji: "🌊", pH: 8.0, color: [58, 143, 166], alpha: 0.78, fact: "قاعدي قليلاً بسبب الأملاح الذائبة فيه." },
  toothpaste: { nameAr: "معجون أسنان", emoji: "🪥", pH: 9.0, color: [220, 238, 230], alpha: 0.95, fact: "قاعدي ليعادل الأحماض في فمك ويحمي مينا الأسنان." },
  soap: { nameAr: "صابون يد", emoji: "🧼", pH: 10.0, color: [228, 214, 236], alpha: 0.82, fact: "قاعدي، ولهذا يذيب الدهون وينظّف يديك." },
  bleach: { nameAr: "مبيّض (كلور)", emoji: "🧴", pH: 12.6, color: [236, 244, 222], alpha: 0.62, fact: "قاعدي قوي جداً ومادة خطرة — لا تلمسه أبداً بيدك!" },
};

// ترتيب العرض (حمضي → قاعدي)
export const SOLUTION_ORDER = [
  "lemon",
  "soda",
  "vinegar",
  "orange",
  "coffee",
  "milk",
  "water",
  "blood",
  "seawater",
  "toothpaste",
  "soap",
  "bleach",
];

export const DEFAULT_SOLUTION = "water";

/** لون السائل الحقيقي (rgba) لمادة معيّنة */
export function solutionColorCSS(key) {
  const s = SOLUTIONS[key];
  if (!s) return "rgba(200, 228, 240, 0.5)";
  const [r, g, b] = s.color;
  return `rgba(${r}, ${g}, ${b}, ${s.alpha})`;
}

/** نسخة معتمة (بلا شفافية) — للمعاينة في القطّارة/القائمة */
export function solutionColorSolid(key) {
  const s = SOLUTIONS[key];
  if (!s) return "rgb(200, 228, 240)";
  const [r, g, b] = s.color;
  return `rgb(${r}, ${g}, ${b})`;
}
