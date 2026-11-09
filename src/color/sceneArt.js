/**
 * sceneArt.js — خامات إجرائية وأدوات رسم مشتركة لمشهد "غرفة البصريات":
 * جدار بلاستر، خشب الجوز للطاولة والإطارات، معدن مصقول، وأضواء ناعمة (sprites).
 * تُبنى مرّة واحدة على Canvas مخفي.
 */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

export const rr = (g, x, y, w, h, r) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);
export const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/* ---------- خشب ---------- */
function woodTex(w, h, base, dark, seed, flat = true) {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(base, 1));
  grad.addColorStop(1, rgba(flat ? base : mix(base, dark, 0.45), 1));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < h / 2.4; i++) {
    const y0 = i * 2.4 + r() * 2;
    g.strokeStyle = rgba(dark, 0.06 + r() * 0.2);
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    const ph = r() * 6;
    const amp = 1 + r() * 3;
    for (let x = 0; x <= w; x += 6) {
      const y = y0 + Math.sin(x * 0.014 + ph) * amp + Math.sin(x * 0.004 + i * 0.5) * 3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < w * h * 0.004; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,230,190,0.08)" : rgba(dark, 0.1);
    g.fillRect(r() * w, r() * h, 6 + r() * 16, 1);
  }
  return c;
}

/* ---------- معدن مصقول (خطوط أفقية) ---------- */
function brushedTex(w, h, light, dark, seed) {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  const r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(light, 1));
  grad.addColorStop(0.5, rgba(mix(light, dark, 0.5), 1));
  grad.addColorStop(1, rgba(dark, 1));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) {
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.02 + r() * 0.07})`;
    g.fillRect(0, y, w, 1);
  }
  return c;
}

/* ---------- جدار بلاستر ---------- */
function plasterTile(size, seed) {
  const c = makeCanvas(size, size);
  const g = c.getContext("2d");
  const r = rng(seed);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (r() - 0.5) * 60;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255 * (0.04 + r() * 0.06);
  }
  g.putImageData(img, 0, 0);
  return c;
}

let TEX = null;
export function getArt() {
  if (TEX) return TEX;
  TEX = {
    table: woodTex(640, 120, [128, 84, 50], [52, 30, 16], 7),
    frame: woodTex(220, 40, [150, 104, 56], [60, 36, 16], 17),
    palette: woodTex(260, 180, [186, 140, 86], [96, 62, 30], 27),
    peg: woodTex(260, 200, [112, 84, 58], [48, 32, 18], 37),
    metal: brushedTex(320, 160, [112, 124, 136], [38, 46, 56], 47),
    plaster: plasterTile(128, 57),
    glows: {},
  };
  return TEX;
}

/** نقطة ضوء ناعمة مسبقة الرسم (للمزج الجمعي lighter) */
export function glowSprite(color, size = 96) {
  const art = getArt();
  const key = color + size;
  if (art.glows[key]) return art.glows[key];
  const c = makeCanvas(size, size);
  const g = c.getContext("2d");
  const rgb = typeof color === "string" ? hexToRgb(color) : color;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgba(mix(rgb, [255, 255, 255], 0.55), 1));
  grad.addColorStop(0.25, rgba(rgb, 0.85));
  grad.addColorStop(0.6, rgba(rgb, 0.25));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  art.glows[key] = c;
  return c;
}

export function drawGlow(g, color, x, y, r, alpha = 1) {
  const sp = glowSprite(color);
  g.globalAlpha = alpha;
  g.drawImage(sp, x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}

/** معدن مرسوم بتدرّج: لوحة/جسم — يعيد دالة تعبئة */
export function metalFill(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}

export function shadowed(g, fn, blur = 12, oy = 4, a = 0.35) {
  g.save();
  g.shadowColor = `rgba(0,0,0,${a})`;
  g.shadowBlur = blur;
  g.shadowOffsetY = oy;
  fn();
  g.restore();
}
