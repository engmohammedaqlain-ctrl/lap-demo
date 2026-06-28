/**
 * forces.js
 * رسم أسهم القوى (الوزن وقوة الطفو) بحساب هندسي دقيق
 * كل سهم: خط + رأس مثلث محسوب بالزاوية الحقيقية (ليس شكل ثابت)
 * هذا يسمح للسهم أن يدور أو يتغيّر طوله بسلاسة حسب قيمة القوة الفعلية
 */

/**
 * يرسم سهماً من نقطة لنقطة بحساب الزاوية ورأس السهم رياضياً
 * يستخدم دوال p5 العامة مباشرة (push/stroke/line/...) لأن الرسم يعمل بوضع
 * "global mode" حيث p5 يُلحق كل دواله بـ window تلقائياً - لا حاجة لتمرير مرجع instance
 * @param {number} x1,y1 - نقطة البداية
 * @param {number} x2,y2 - نقطة النهاية (رأس السهم)
 * @param {object} opts - { color: [r,g,b], weight: number, headSize: number }
 */
function drawArrow(x1, y1, x2, y2, opts = {}) {
  const color = opts.color || [40, 40, 40];
  const weight = opts.weight || 3;
  const headSize = opts.headSize || 10;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  // لا نرسم سهماً بطول مهمل (يمنع "ارتجاف" بصري عندما القوة قريبة من صفر)
  if (length < 4) return;

  push();
  stroke(color[0], color[1], color[2]);
  strokeWeight(weight);
  fill(color[0], color[1], color[2]);

  // الخط الأساسي (نوقفه قبل الرأس بمقدار طول الرأس لتجنّب تراكب بصري)
  const shaftEndX = x2 - headSize * 0.6 * Math.cos(angle);
  const shaftEndY = y2 - headSize * 0.6 * Math.sin(angle);
  line(x1, y1, shaftEndX, shaftEndY);

  // رأس السهم: مثلث محسوب بدوران حول زاوية الاتجاه
  translate(x2, y2);
  rotate(angle);
  noStroke();
  triangle(0, 0, -headSize, -headSize * 0.45, -headSize, headSize * 0.45);
  pop();
}

/**
 * يحسب طول السهم البصري (بكسل) من قيمة قوة فعلية (نيوتن)
 * باستخدام scale لوغاريتمي خفيف بدل خطي مباشر
 * السبب: القوى قد تتفاوت كثيراً (من نيوتن واحد إلى مئات)، والمقياس الخطي
 * المباشر يجعل الأسهم الصغيرة غير مرئية أو الكبيرة تخرج عن الشاشة.
 * @param {number} forceNewtons
 * @param {number} maxPixels - أقصى طول بصري مسموح
 */
function forceToArrowLength(forceNewtons, maxPixels = 90) {
  if (forceNewtons <= 0) return 0;
  // log1p يعطي نمواً متدرجاً معقولاً بصرياً، ثم نقيّد بحد أعلى
  const scaled = Math.log1p(forceNewtons) * 14;
  return Math.min(scaled, maxPixels);
}
