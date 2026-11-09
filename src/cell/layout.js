/**
 * layout.js — تخطيط "مجهر على طاولة المختبر" بإحداثيات تصميم (design px) تُكبَّر
 * لتناسب الشاشة. أفقي: العدسة العينية (مجال الرؤية) بالوسط، مقبضا التركيز
 * على جانبيها، برج العدسات وطاولة العيّنة أسفلها، رفّ الشرائح يساراً، ودفتر
 * الملاحظات/بطاقة الاختبار يميناً. عمودي: نفس العناصر مرتّبة رأسياً.
 */

/** مراحل برج العدسات: التكبير المطبوع ومقدار الزووم (p) الذي يقفز إليه المشهد */
/* التكبير الكلي = العدسة × ١٠ (العينية). المراسي تتطابق مع مراحل المشهد:
   ×٤→×٤٠ (نسيج) ، ×١٠→×١٠٠ ، ×٤٠→×٤٠٠ (خلية واحدة) ، ×١٠٠→×١٠٠٠ وهو
   حدّ المجهر المدرسي (MICRO_LIMIT_P ≈ 0.61). ما بعده يتطلّب المقبض فقط. */
export const OBJECTIVES = [
  { label: "×4", p: 0.3, band: "#d8453c" },
  { label: "×10", p: 0.4035, band: "#e5b82e" },
  { label: "×40", p: 0.56, band: "#2f7fd1" },
  { label: "×100", p: 0.603, band: "#e9edf0" },
];

const MAG_ANCHORS = [
  [0, 1],
  [0.3, 40],
  [0.56, 400],
  [0.82, 100000],
  [1, 1000000],
];

/** التكبير الكلي المقدّر عند تقدّم الزووم p (استيفاء لوغاريتمي بين المراسي) */
export function totalMag(p) {
  const x = Math.max(0, Math.min(1, p));
  for (let i = 1; i < MAG_ANCHORS.length; i++) {
    const [p1, m1] = MAG_ANCHORS[i];
    const [p0, m0] = MAG_ANCHORS[i - 1];
    if (x <= p1) {
      const t = (x - p0) / (p1 - p0);
      return Math.exp(Math.log(m0) + t * (Math.log(m1) - Math.log(m0)));
    }
  }
  return 1e6;
}

export function formatMag(p) {
  const m = totalMag(p);
  const digits = Math.max(0, Math.floor(Math.log10(m)) - 1);
  const f = Math.pow(10, digits);
  const r = Math.round(m / f) * f;
  return "×" + r.toLocaleString("en-US");
}

export function computeLayout(W, H) {
  const portrait = H > W * 1.02;
  return portrait ? portraitLayout(W, H) : landscapeLayout(W, H);
}

function landscapeLayout(W, H) {
  const s = Math.max(0.3, Math.min(W / 1240, H / 700));
  const dW = W / s;
  const dH = H / s;
  const FR = Math.min(dH * 0.285, dW * 0.172);
  const cx = dW / 2;
  const cy = dH / 2 - 22;
  const HW = FR + 48; // نصف عرض رأس المجهر
  const rim = 36;

  const fineW = 40;
  const coarseW = 58;
  const axle = 16;
  const knobs = [];
  const axles = [];
  for (const sx of [-1, 1]) {
    const x0 = cx + sx * HW;
    axles.push({ x: sx > 0 ? x0 : x0 - axle, y: cy - 13, w: axle, h: 26 });
    knobs.push({ kind: "fine", side: sx, cx: x0 + sx * (axle + fineW / 2), cy, w: fineW, h: 104 });
    knobs.push({ kind: "coarse", side: sx, cx: x0 + sx * (axle + fineW + coarseW / 2), cy, w: coarseW, h: 158 });
  }
  const rightEdge = cx + HW + axle + fineW + coarseW;
  const leftEdge = cx - HW - axle - fineW - coarseW;

  const benchY = cy + FR + 30;
  const turret = { cx, cy: cy + FR + 44, R: 88, ring: 57, objR: 23 };
  const plate = { x: cx - 158, y: cy - FR - rim - 62, w: 316, h: 54 };

  const trayW = Math.max(150, Math.min(214, leftEdge - 40));
  const tray = { x: Math.max(18, leftEdge - 16 - trayW), y: cy - 112, w: trayW, h: 232 };
  const stage = { x: cx - 330 - 32, y: benchY + 2, w: 270, h: 70 };
  const lever = { x: cx + 168, y: benchY + 4, w: 150, h: 66 };

  const cardW = Math.min(268, Math.max(210, dW - rightEdge - 44));
  const card = { x: Math.min(dW - cardW - 22, rightEdge + 26), y: cy - 168, w: cardW, h: 336 };

  return {
    orient: "landscape",
    s,
    dW,
    dH,
    fov: { cx, cy, r: FR, rim },
    head: { x: cx - HW, y: cy - FR - 52, w: HW * 2, h: FR * 2 + 100, r: 76 },
    knobs,
    axles,
    turret,
    plate,
    tray,
    stage,
    lever,
    card,
    benchY,
  };
}

function portraitLayout(W, H) {
  const s = Math.max(0.3, Math.min(W / 430, H / 900));
  const dW = W / s;
  const dH = H / s;
  const FR = Math.min(dW * 0.37, dH * 0.2);
  const cx = dW / 2;
  const rim = 30;
  const cy = 134 + rim + FR;
  const HW = FR + 40;
  const turret = { cx, cy: cy + FR + 34, R: 66, ring: 44, objR: 17 };
  const kY = turret.cy + 6;
  const knobs = [
    { kind: "coarse", side: -1, cx: cx - 148, cy: kY, w: 50, h: 118 },
    { kind: "fine", side: 1, cx: cx + 148, cy: kY, w: 38, h: 96 },
  ];
  const plate = { x: cx - 128, y: 66, w: 256, h: 46 };
  const row2 = turret.cy + turret.R + 18;
  const stage = { x: 18, y: row2, w: dW * 0.5 - 24, h: 56 };
  const lever = { x: dW * 0.5 + 6, y: row2, w: dW * 0.5 - 24, h: 56 };
  const row3 = row2 + 76;
  const tray = { x: 18, y: row3, w: dW * 0.5 - 24, h: 128 };
  const card = { x: dW * 0.5 + 6, y: row3, w: dW * 0.5 - 24, h: Math.max(170, dH - row3 - 14) };
  return {
    orient: "portrait",
    s,
    dW,
    dH,
    fov: { cx, cy, r: FR, rim },
    head: { x: cx - HW, y: cy - FR - 40, w: HW * 2, h: FR * 2 + 80, r: 56 },
    knobs,
    axles: [],
    turret,
    plate,
    tray,
    stage,
    lever,
    card,
    benchY: row2 - 12,
  };
}
