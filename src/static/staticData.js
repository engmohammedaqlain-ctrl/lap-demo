/**
 * staticData.js — التخطيط والثوابت لتجربة الكهرباء الساكنة في غرفة جلوس.
 * كل الإحداثيات "تصميمية" (design px) تُكبَّر لتناسب الشاشة، تماماً كتجربة الطفو.
 * لا لوحات واجهة: كل الأدوات داخل الغرفة (سلّة البالونات، لوح الجدار المنزلق، العدسة).
 */

export const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** عدد أزواج الشحنات على السترة (إلكترون سالب + شحنة موجبة ثابتة) */
export const SWEATER_COLS = 5;
export const SWEATER_ROWS = 6;
export const MAX_Q = 14; // أقصى عدد إلكترونات يلتقطها بالون واحد

export const BALLOON_R = 62;
export const BALLOONS = [
  { name: "red", base: "#e0303f", light: "#ff8b86", dark: "#8f1226", rim: "#ffb3a8" },
  { name: "teal", base: "#12a9b2", light: "#8ff0ea", dark: "#066a74", rim: "#b8fff7" },
];

export const CHARGE = { plus: "#e0443f", minus: "#2f7fe0" };

export const LENS_R = 96;
export const LENS_ZOOM = 1.55;

/**
 * يحسب مقاس المشهد وأماكن العناصر نسبةً إلى الأرضية والعرض، فيبقى التكوين
 * متوازناً على الحاسوب والجوال (عرضي) وكذلك الاحتياطي الطولي.
 */
export function computeLayout(W, H) {
  const portrait = H > W * 1.05;
  const s = portrait ? Math.max(0.28, W / 820) : Math.max(0.3, Math.min(W / 1280, H / 700));
  const dW = W / s;
  const dH = H / s;
  const floorY = dH - (portrait ? 230 : 150);
  const pillarW = portrait ? 150 : 210;
  const pillarX = dW - pillarW;
  const x0 = 30;
  const free = pillarX - x0;

  const sweaterCx = portrait ? 250 : x0 + free * 0.24;
  const sweaterCy = floorY - (portrait ? 250 : 270);
  const windowCx = portrait ? dW * 0.5 : x0 + free * 0.55;
  const windowW = portrait ? 230 : 250;
  const windowH = 250;
  const windowBottom = floorY - 240;
  const tableCx = portrait ? dW * 0.62 : x0 + free * 0.86;
  const tableTop = floorY - 150;
  const basketCx = portrait ? dW * 0.5 : sweaterCx + 250;

  return {
    s,
    dW,
    dH,
    portrait,
    floorY,
    baseY: floorY + 62,
    pillarW,
    pillarX,
    sweater: { cx: sweaterCx, cy: sweaterCy },
    window: { cx: windowCx, w: windowW, h: windowH, bottom: windowBottom, top: windowBottom - windowH },
    table: { cx: tableCx, top: tableTop, w: 170 },
    basket: { cx: basketCx, base: floorY + 64, w: 150, h: 96 },
    lensRest: { x: tableCx - 36, y: tableTop - 70 },
    handle: { y: floorY - 150 },
  };
}

/** مواضع الأزواج على السترة (إحداثيات محلية، مركز الجسم = 0,0) */
export function sweaterPairSlots() {
  const slots = [];
  for (let r = 0; r < SWEATER_ROWS; r++) {
    for (let c = 0; c < SWEATER_COLS; c++) {
      const x = -70 + (c / (SWEATER_COLS - 1)) * 140;
      const y = -78 + (r / (SWEATER_ROWS - 1)) * 176;
      slots.push({ x, y });
    }
  }
  return slots;
}

/** هل النقطة المحلية (بالنسبة لمركز السترة) داخل السترة (جسم + كمّان)؟ */
export function insideSweater(lx, ly, pad = 0) {
  const body = lx > -104 - pad && lx < 104 + pad && ly > -136 - pad && ly < 152 + pad;
  const sl = lx > -168 - pad && lx < -102 + pad && ly > -118 - pad && ly < 132 + pad;
  const sr = lx > 102 - pad && lx < 168 + pad && ly > -118 - pad && ly < 132 + pad;
  return body || sl || sr;
}
