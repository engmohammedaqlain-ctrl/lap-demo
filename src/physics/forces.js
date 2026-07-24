/**
 * forces.js
 * رسم أسهم القوى (الوزن وقوة الطفو) بحساب هندسي دقيق
 * كل سهم: خط + رأس مثلث محسوب بالزاوية الحقيقية (ليس شكل ثابت)
 * تُستقبل نسخة p5 (instance mode) كأول معامل لكل دالة رسم.
 */

/**
 * يرسم سهماً من نقطة لنقطة بحساب الزاوية ورأس السهم رياضياً
 * @param {object} p - نسخة p5 (instance mode)
 * @param {number} x1,y1 - نقطة البداية
 * @param {number} x2,y2 - نقطة النهاية (رأس السهم)
 * @param {object} opts - { color: [r,g,b], weight: number, headSize: number }
 */
export function drawArrow(p, x1, y1, x2, y2, opts = {}) {
  const color = opts.color || [40, 40, 40];
  const weight = opts.weight || 3;
  const headSize = opts.headSize || 10;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 4) return;

  p.push();
  p.stroke(color[0], color[1], color[2]);
  p.strokeWeight(weight);
  p.fill(color[0], color[1], color[2]);

  const shaftEndX = x2 - headSize * 0.6 * Math.cos(angle);
  const shaftEndY = y2 - headSize * 0.6 * Math.sin(angle);
  p.line(x1, y1, shaftEndX, shaftEndY);

  p.translate(x2, y2);
  p.rotate(angle);
  p.noStroke();
  p.triangle(0, 0, -headSize, -headSize * 0.45, -headSize, headSize * 0.45);
  p.pop();
}

/**
 * يحسب طول السهم البصري (بكسل) من قيمة قوة فعلية (نيوتن)
 * باستخدام scale لوغاريتمي خفيف بدل خطي مباشر
 */
export function forceToArrowLength(forceNewtons, maxPixels = 90) {
  if (forceNewtons <= 0) return 0;
  const scaled = Math.log1p(forceNewtons) * 14;
  return Math.min(scaled, maxPixels);
}
