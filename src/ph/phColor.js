/**
 * phColor.js — تحويل قيمة pH إلى لون حسب "الكاشف الشامل" (Universal Indicator)
 * وهو التدرّج المعروف علمياً: أحمر (حمضي قوي) → برتقالي → أصفر → أخضر
 * (متعادل) → أزرق → بنفسجي (قاعدي قوي). أجمل وأوضح من لون واحد ثابت،
 * ويجعل تغيّر السائل محسوساً بصرياً فوراً.
 */

const STOPS = [
  { pH: 0, c: [214, 40, 40] },
  { pH: 2, c: [229, 57, 53] },
  { pH: 3, c: [245, 124, 0] },
  { pH: 4, c: [251, 192, 45] },
  { pH: 5, c: [253, 216, 53] },
  { pH: 6, c: [192, 202, 51] },
  { pH: 7, c: [67, 160, 71] },
  { pH: 8, c: [38, 166, 154] },
  { pH: 9, c: [41, 182, 246] },
  { pH: 10, c: [30, 136, 229] },
  { pH: 11, c: [57, 73, 171] },
  { pH: 12, c: [94, 53, 177] },
  { pH: 14, c: [74, 20, 140] },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** يُرجع [r,g,b] للون عند قيمة pH معيّنة بالاستيفاء الخطي بين المحطات */
export function phColorRGB(pH) {
  const clamped = Math.max(0, Math.min(14, pH));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const lo = STOPS[i];
    const hi = STOPS[i + 1];
    if (clamped >= lo.pH && clamped <= hi.pH) {
      const t = (clamped - lo.pH) / (hi.pH - lo.pH);
      return [
        Math.round(lerp(lo.c[0], hi.c[0], t)),
        Math.round(lerp(lo.c[1], hi.c[1], t)),
        Math.round(lerp(lo.c[2], hi.c[2], t)),
      ];
    }
  }
  return STOPS[STOPS.length - 1].c;
}

export function phColorCSS(pH, alpha = 1) {
  const [r, g, b] = phColorRGB(pH);
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** لون أغمق قليلاً (لعمق السائل/الحواف) */
export function phColorDeepCSS(pH, alpha = 1) {
  const [r, g, b] = phColorRGB(pH);
  const d = (v) => Math.max(0, Math.round(v * 0.72));
  return alpha >= 1 ? `rgb(${d(r)}, ${d(g)}, ${d(b)})` : `rgba(${d(r)}, ${d(g)}, ${d(b)}, ${alpha})`;
}

/** تدرّج CSS كامل للكاشف الشامل (يُستخدم في شريط مقياس pH العمودي) */
export function universalGradientCSS(direction = "to top") {
  const parts = STOPS.map((s) => `rgb(${s.c[0]}, ${s.c[1]}, ${s.c[2]}) ${(s.pH / 14) * 100}%`);
  return `linear-gradient(${direction}, ${parts.join(", ")})`;
}
