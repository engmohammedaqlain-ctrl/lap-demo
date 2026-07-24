/**
 * staticData.js — ثوابت التخطيط والألوان ومولّدات الشحنات لتجربة
 * "البالونات والكهرباء الساكنة". الأبعاد بإحداثيات منطقية داخل اللوحة
 * (canvas) ثم تُقاس بصرياً عبر CSS، فيبقى المشهد حاداً على كل الشاشات.
 */

export const SCENE_W = 940;
export const SCENE_H = 560;

/* منطقة السترة (يمين المشهد في RTL بصرياً، لكن الإحداثيات يسار اللوحة) */
export const SWEATER = { x: 60, y: 96, w: 300, h: 380 };
/* شبكة الشحنات داخل السترة */
export const SWEATER_GRID = { cols: 5, rows: 6, padX: 46, padY: 60 };

/* الجدار: شريط رأسي على أقصى اليمين */
export const WALL = { x: 872, y: 40, w: 48, h: 480 };
export const WALL_ROWS = 11;

/* البالونات: ألوان زاهية بلمعان زجاجي */
export const BALLOON_SPECS = [
  { color: "#E8433F", dark: "#B02722", light: "#FF8A7A", start: { x: 560, y: 350 } },
  { color: "#F2A93B", dark: "#C97F16", light: "#FFD98A", start: { x: 690, y: 250 } },
];
export const BALLOON_R = 62;

/* ألوان الشحنات (موحّدة مع بقيّة الموقع: أحمر علم/أزرق هادئ) */
export const CHARGE = {
  plus: "#D93B3B",
  plusDark: "#9e2020",
  minus: "#2F6FB0",
  minusDark: "#1c4a7d",
  r: 11,
};

/**
 * يبني أزواج شحنات السترة: لكل موقع شحنة موجبة ثابتة (+) وإلكترون سالب (−)
 * متحرّك يمكن للبالون سحبه. مُقترنان بالفهرس نفسه ليُحسب "الفرق" (net +).
 */
export function buildSweaterCharges() {
  const plus = [];
  const minus = [];
  const { x, y, w, h } = SWEATER;
  const { cols, rows, padX, padY } = SWEATER_GRID;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + padX + (cols === 1 ? innerW / 2 : (c / (cols - 1)) * innerW);
      const cy = y + padY + (rows === 1 ? innerH / 2 : (r / (rows - 1)) * innerH);
      plus.push({ x: cx - 9, y: cy });
      minus.push({
        id: id++,
        homeX: cx + 9,
        homeY: cy,
        x: cx + 9,
        y: cy,
        vx: 0,
        vy: 0,
        owner: null, // null على السترة، أو فهرس البالون الذي التقطه
        ox: 0,
        oy: 0,
      });
    }
  }
  return { plus, minus };
}

/**
 * يبني شحنات الجدار: عمود من الأزواج (+ ثابت، − قابل للإزاحة عند الاستقطاب).
 * الجدار متعادل كلياً؛ يقترب سطحه الموجب من البالون السالب فيجذبه.
 */
export function buildWallCharges() {
  const rows = [];
  const { x, y, w, h } = WALL;
  const cx = x + w / 2;
  for (let i = 0; i < WALL_ROWS; i++) {
    const cy = y + 34 + (i / (WALL_ROWS - 1)) * (h - 68);
    rows.push({
      plus: { x: cx - 10, y: cy },
      minusHome: { x: cx + 10, y: cy },
      minus: { x: cx + 10, y: cy }, // تُزاح لحظياً عند اقتراب بالون مشحون
    });
  }
  return rows;
}

export const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
