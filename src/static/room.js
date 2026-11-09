/**
 * room.js — غرفة الجلوس: ورق جدران بنسيج، لوحات خشبية سفلية (wainscoting)، نافذة
 * بستائر وشعاع ضوء، أرضية خشبية بمنظور، سجادة، نبتة، طاولة جانبية بمصباح، سلّة
 * بالونات من الخوص، ولوح الجدار المنزلق. تُرسم مرة واحدة على Canvas مخفي.
 */
import { makeCanvas, rng } from "./staticArt.js";

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/* ---------- نسيج الجدار ---------- */
function wallpaperTile() {
  const S = 220;
  const c = makeCanvas(S * 2, S * 2);
  const g = c.getContext("2d");
  g.scale(2, 2);
  const r = rng(21);
  g.fillStyle = "#d6dcc4";
  g.fillRect(0, 0, S, S);
  // خطوط رأسية ناعمة
  for (let x = 0; x < S; x += 22) {
    g.fillStyle = "rgba(255,255,240,0.28)";
    g.fillRect(x, 0, 11, S);
    g.fillStyle = "rgba(130,150,110,0.12)";
    g.fillRect(x + 11, 0, 1.2, S);
  }
  // زخارف معينية صغيرة (دمشقية مبسطة)
  for (let y = 0; y < S; y += 55) {
    for (let x = 0; x < S; x += 55) {
      const ox = ((y / 55) % 2) * 27.5;
      g.save();
      g.translate(x + ox, y);
      g.fillStyle = "rgba(255,255,245,0.35)";
      g.beginPath();
      g.moveTo(0, -11);
      g.quadraticCurveTo(5, -4, 11, 0);
      g.quadraticCurveTo(5, 4, 0, 11);
      g.quadraticCurveTo(-5, 4, -11, 0);
      g.quadraticCurveTo(-5, -4, 0, -11);
      g.fill();
      g.strokeStyle = "rgba(110,135,95,0.22)";
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
  }
  // حبيبات الورق
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.1)" : "rgba(90,100,70,0.08)";
    g.fillRect(r() * S, r() * S, 1.2, 1.2);
  }
  return c;
}

function woodTile() {
  const W = 640;
  const H = 96;
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  const r = rng(9);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#c48e55");
  base.addColorStop(1, "#a97640");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const y0 = r() * H;
    g.strokeStyle = `rgba(${70 + r() * 30},${38 + r() * 16},12,${0.05 + r() * 0.16})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin(x * 0.012 + i) * 2 + Math.sin(x * 0.004 + i * 0.5) * 4;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,225,180,0.09)" : "rgba(50,25,8,0.1)";
    g.fillRect(r() * W, r() * H, 5 + r() * 12, 1);
  }
  return c;
}

/* ---------- المكوّنات ---------- */
function drawWindow(g, L) {
  const { cx, w, h, top } = L.window;
  const x = cx - w / 2;
  // زجاج: سماء + شمس + أشجار
  g.save();
  rr(g, x, top, w, h, 4);
  g.clip();
  const sky = g.createLinearGradient(0, top, 0, top + h);
  sky.addColorStop(0, "#a8d6f0");
  sky.addColorStop(0.65, "#dff1f6");
  sky.addColorStop(1, "#f6f4dc");
  g.fillStyle = sky;
  g.fillRect(x, top, w, h);
  const sun = g.createRadialGradient(x + w * 0.74, top + h * 0.28, 4, x + w * 0.74, top + h * 0.28, w * 0.7);
  sun.addColorStop(0, "rgba(255,252,220,0.95)");
  sun.addColorStop(1, "rgba(255,252,220,0)");
  g.fillStyle = sun;
  g.fillRect(x, top, w, h);
  // أشجار بعيدة ضبابية
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const tx = x + (i / 8) * w + (r() - 0.5) * 20;
    const ty = top + h * 0.7 + r() * 24;
    const rad = 26 + r() * 22;
    const tg = g.createRadialGradient(tx, ty, 2, tx, ty, rad);
    tg.addColorStop(0, `rgba(${90 + r() * 30},${150 + r() * 30},${100 + r() * 30},0.75)`);
    tg.addColorStop(1, "rgba(120,170,120,0)");
    g.fillStyle = tg;
    g.fillRect(tx - rad, ty - rad, rad * 2, rad * 2);
  }
  g.fillStyle = "rgba(120,170,110,0.4)";
  g.fillRect(x, top + h * 0.86, w, h * 0.14);
  g.restore();
  // إطار أبيض وعوارض
  const frame = g.createLinearGradient(x, top, x + w, top + h);
  frame.addColorStop(0, "#fbf8ef");
  frame.addColorStop(1, "#d9d2bf");
  g.strokeStyle = "rgba(60,48,30,0.4)";
  g.lineWidth = 3;
  rr(g, x - 9, top - 9, w + 18, h + 18, 6);
  g.stroke();
  g.strokeStyle = frame;
  g.lineWidth = 14;
  rr(g, x - 6, top - 6, w + 12, h + 12, 5);
  g.stroke();
  g.fillStyle = "#f4efe1";
  g.fillRect(x + w / 2 - 5, top, 10, h);
  g.fillRect(x, top + h * 0.45 - 5, w, 10);
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(x + w / 2 + 5, top, 2, h);
  g.fillRect(x, top + h * 0.45 + 5, w, 2);
  // عتبة
  const sill = g.createLinearGradient(0, top + h + 4, 0, top + h + 24);
  sill.addColorStop(0, "#fffdf6");
  sill.addColorStop(1, "#d6cdb6");
  g.fillStyle = sill;
  rr(g, x - 22, top + h + 6, w + 44, 20, 4);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(x - 20, top + h + 24, w + 40, 4);
}

function curtainPanel(g, x, y, w, h, flip) {
  const fold = 26;
  const grad = g.createLinearGradient(x, 0, x + w, 0);
  const n = Math.max(3, Math.round(w / fold));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const l = 0.5 + 0.5 * Math.cos((i * Math.PI) / 1.0);
    grad.addColorStop(t, l > 0.5 ? "#c46a4a" : "#a1472c");
  }
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.bezierCurveTo(x + w + (flip ? 8 : -8), y + h * 0.5, x + w + (flip ? 12 : -12), y + h * 0.8, x + w + (flip ? 4 : -4), y + h);
  g.lineTo(x + (flip ? 6 : -6), y + h);
  g.bezierCurveTo(x + (flip ? -4 : 4), y + h * 0.7, x + (flip ? -2 : 2), y + h * 0.3, x, y);
  g.fill();
  // طيّات ناعمة
  for (let i = 0; i < n; i++) {
    const fx = x + (i + 0.5) * (w / n);
    const fg = g.createLinearGradient(fx - 7, 0, fx + 7, 0);
    fg.addColorStop(0, "rgba(255,230,200,0)");
    fg.addColorStop(0.5, "rgba(255,230,200,0.16)");
    fg.addColorStop(1, "rgba(255,230,200,0)");
    g.fillStyle = fg;
    g.fillRect(fx - 7, y, 14, h);
    g.fillStyle = "rgba(60,15,5,0.12)";
    g.fillRect(fx + 6, y, 3, h);
  }
  const shade = g.createLinearGradient(0, y, 0, y + h);
  shade.addColorStop(0, "rgba(40,10,0,0.22)");
  shade.addColorStop(0.25, "rgba(40,10,0,0)");
  shade.addColorStop(1, "rgba(40,10,0,0.18)");
  g.fillStyle = shade;
  g.fillRect(x - 12, y, w + 24, h);
}

function drawCurtains(g, L) {
  const { cx, w, top } = L.window;
  const x = cx - w / 2;
  const hTot = L.floorY - top + 60;
  // قضيب
  const rod = g.createLinearGradient(0, top - 52, 0, top - 40);
  rod.addColorStop(0, "#d7b472");
  rod.addColorStop(1, "#7d5a24");
  g.fillStyle = rod;
  g.fillRect(x - 110, top - 50, w + 220, 9);
  for (const ex of [x - 118, x + w + 110]) {
    const fg = g.createRadialGradient(ex - 2, top - 48, 1, ex, top - 45, 10);
    fg.addColorStop(0, "#fff0c4");
    fg.addColorStop(1, "#8a6528");
    g.fillStyle = fg;
    g.beginPath();
    g.arc(ex, top - 45, 9, 0, Math.PI * 2);
    g.fill();
  }
  curtainPanel(g, x - 100, top - 42, 92, hTot, false);
  curtainPanel(g, x + w + 8, top - 42, 92, hTot, true);
  // رباط
  for (const sx of [x - 54, x + w + 54]) {
    g.fillStyle = "#e9c783";
    rr(g, sx - 52, top + 150, 104, 8, 4);
    g.fill();
  }
}

function drawFrame(g, x, y, w, h, seed) {
  const r = rng(seed);
  g.save();
  g.shadowColor = "rgba(30,20,10,0.35)";
  g.shadowBlur = 14;
  g.shadowOffsetX = 4;
  g.shadowOffsetY = 8;
  const wood = g.createLinearGradient(x, y, x + w, y + h);
  wood.addColorStop(0, "#8e5f31");
  wood.addColorStop(1, "#5e3a1a");
  g.fillStyle = wood;
  rr(g, x, y, w, h, 3);
  g.fill();
  g.restore();
  g.fillStyle = "#f6f1e3";
  g.fillRect(x + 9, y + 9, w - 18, h - 18);
  const ix = x + 18;
  const iy = y + 18;
  const iw = w - 36;
  const ih = h - 36;
  const sky = g.createLinearGradient(0, iy, 0, iy + ih);
  sky.addColorStop(0, ["#f6c88a", "#a9d3ea"][seed % 2]);
  sky.addColorStop(1, "#fbeedd");
  g.fillStyle = sky;
  g.fillRect(ix, iy, iw, ih);
  g.fillStyle = "rgba(255,244,200,0.9)";
  g.beginPath();
  g.arc(ix + iw * (0.3 + r() * 0.4), iy + ih * 0.3, iw * 0.09, 0, Math.PI * 2);
  g.fill();
  for (let k = 0; k < 3; k++) {
    g.fillStyle = ["#7da07a", "#5e8460", "#46674b"][k];
    g.beginPath();
    g.moveTo(ix, iy + ih);
    g.lineTo(ix, iy + ih * (0.65 + k * 0.08));
    g.bezierCurveTo(ix + iw * 0.3, iy + ih * (0.45 + k * 0.1), ix + iw * 0.6, iy + ih * (0.8 + k * 0.03), ix + iw, iy + ih * (0.6 + k * 0.1));
    g.lineTo(ix + iw, iy + ih);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 1.5;
  g.strokeRect(ix, iy, iw, ih);
}

function drawWainscot(g, L, width) {
  const top = L.floorY - 232;
  const bottom = L.floorY - 26;
  // لوح التغطية
  const body = g.createLinearGradient(0, top, 0, bottom);
  body.addColorStop(0, "#f3ecda");
  body.addColorStop(1, "#e4dbc3");
  g.fillStyle = body;
  g.fillRect(0, top, width, bottom - top);
  // سكة الكرسي
  const rail = g.createLinearGradient(0, top - 8, 0, top + 14);
  rail.addColorStop(0, "#fffaf0");
  rail.addColorStop(1, "#d8cdb3");
  g.fillStyle = rail;
  g.fillRect(0, top - 8, width, 22);
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(0, top + 14, width, 3);
  // لوحات غائرة
  const pw = 170;
  const gap = 26;
  for (let x = 12; x < width; x += pw + gap) {
    const py = top + 34;
    const ph = bottom - top - 62;
    g.fillStyle = "rgba(120,100,60,0.2)";
    g.fillRect(x, py, pw, ph);
    g.fillStyle = "#f1e9d3";
    g.fillRect(x + 4, py + 4, pw - 8, ph - 8);
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillRect(x + 4, py + 4, pw - 8, 2);
    g.fillRect(x + 4, py + 4, 2, ph - 8);
    g.fillStyle = "rgba(90,70,30,0.18)";
    g.fillRect(x + 4, py + ph - 6, pw - 8, 2);
    g.fillRect(x + pw - 6, py + 4, 2, ph - 8);
  }
  // لوح القاعدة (baseboard)
  const bb = g.createLinearGradient(0, bottom, 0, L.floorY);
  bb.addColorStop(0, "#fff8e8");
  bb.addColorStop(1, "#d9cfb4");
  g.fillStyle = bb;
  g.fillRect(0, bottom, width, L.floorY - bottom);
  g.fillStyle = "rgba(60,40,10,0.22)";
  g.fillRect(0, L.floorY - 2, width, 3);
}

function drawFloor(g, L, wood) {
  const { dW, dH, floorY } = L;
  const r = rng(14);
  let y = floorY;
  let h = 18;
  let row = 0;
  while (y < dH + 4) {
    g.save();
    g.beginPath();
    g.rect(0, y, dW, h);
    g.clip();
    // ألواح بإزاحة متدرّجة
    const plankW = 330 + (h - 18) * 3.2;
    let x = -((row * 137) % plankW);
    while (x < dW) {
      g.drawImage(wood, (r() * 200) | 0, 0, 380, 96, x, y, plankW, h);
      g.fillStyle = "rgba(50,28,8,0.38)";
      g.fillRect(x, y, 1.6, h);
      x += plankW;
    }
    g.fillStyle = "rgba(40,22,6,0.4)";
    g.fillRect(0, y, dW, 1.6);
    g.fillStyle = "rgba(255,230,190,0.12)";
    g.fillRect(0, y + 1.6, dW, 1);
    g.restore();
    y += h;
    h *= 1.24;
    row++;
  }
  // إضاءة وظلال
  const sh = g.createLinearGradient(0, floorY, 0, dH);
  sh.addColorStop(0, "rgba(40,20,0,0.35)");
  sh.addColorStop(0.18, "rgba(40,20,0,0)");
  sh.addColorStop(1, "rgba(40,20,0,0.18)");
  g.fillStyle = sh;
  g.fillRect(0, floorY, dW, dH - floorY);
}

function drawRug(g, L) {
  const cx = (L.sweater.cx + L.pillarX) / 2 + 10;
  const cy = L.floorY + 80;
  const rx = Math.min(460, (L.pillarX - L.sweater.cx) * 0.62);
  const ry = 46;
  g.save();
  g.fillStyle = "rgba(30,15,0,0.25)";
  g.beginPath();
  g.ellipse(cx + 6, cy + 6, rx + 8, ry + 6, 0, 0, Math.PI * 2);
  g.fill();
  const bands = ["#a34a32", "#f1e4c4", "#2f8a8a", "#f1e4c4", "#c9893a", "#f1e4c4", "#a34a32"];
  for (let i = 0; i < bands.length; i++) {
    const k = 1 - i / bands.length;
    g.fillStyle = bands[i];
    g.beginPath();
    g.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  // نسيج
  const rg = rng(2);
  for (let i = 0; i < 1200; i++) {
    const a = rg() * Math.PI * 2;
    const rad = Math.sqrt(rg());
    g.fillStyle = rg() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    g.fillRect(cx + Math.cos(a) * rx * rad, cy + Math.sin(a) * ry * rad, 2.6, 1.2);
  }
  g.restore();
}

function drawPlant(g, L) {
  const x = L.window.cx - L.window.w / 2 - 175;
  const base = L.floorY + 52;
  // وعاء فخاري
  g.save();
  g.fillStyle = "rgba(25,12,0,0.28)";
  g.beginPath();
  g.ellipse(x + 3, base + 2, 48, 9, 0, 0, Math.PI * 2);
  g.fill();
  const pot = g.createLinearGradient(x - 40, 0, x + 40, 0);
  pot.addColorStop(0, "#9a4a2c");
  pot.addColorStop(0.35, "#d3774b");
  pot.addColorStop(1, "#8a3f24");
  g.fillStyle = pot;
  g.beginPath();
  g.moveTo(x - 42, base - 70);
  g.lineTo(x + 42, base - 70);
  g.lineTo(x + 32, base);
  g.lineTo(x - 32, base);
  g.closePath();
  g.fill();
  g.fillStyle = "#b95f38";
  rr(g, x - 46, base - 82, 92, 16, 4);
  g.fill();
  g.fillStyle = "#3a2412";
  g.beginPath();
  g.ellipse(x, base - 80, 40, 6, 0, 0, Math.PI * 2);
  g.fill();
  // أوراق
  const r = rng(8);
  const leaves = [-0.9, -0.55, -0.2, 0.15, 0.5, 0.85, 0.05];
  leaves.forEach((a, i) => {
    const len = 130 + r() * 90;
    const lx = x + Math.sin(a) * len * 0.8;
    const ly = base - 80 - Math.cos(a) * len;
    g.strokeStyle = "#3b5a2a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + (r() - 0.5) * 8, base - 80);
    g.quadraticCurveTo(x + Math.sin(a) * len * 0.3, base - 80 - len * 0.55, lx, ly);
    g.stroke();
    g.save();
    g.translate(lx, ly);
    g.rotate(a + (i % 2 ? 0.3 : -0.3));
    const lg = g.createLinearGradient(-30, 0, 30, 0);
    lg.addColorStop(0, "#2f6a35");
    lg.addColorStop(0.5, "#5da44c");
    lg.addColorStop(1, "#2a5a2f");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, 20);
    g.bezierCurveTo(-42, 6, -36, -52, 0, -64);
    g.bezierCurveTo(36, -52, 42, 6, 0, 20);
    g.fill();
    g.strokeStyle = "rgba(210,240,180,0.6)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 18);
    g.lineTo(0, -58);
    g.stroke();
    g.restore();
  });
  g.restore();
}

function drawTableLamp(g, L) {
  const { cx, top, w } = L.table;
  const floor = L.floorY + 56;
  // توهّج المصباح على الجدار
  const glow = g.createRadialGradient(cx, top - 120, 10, cx, top - 120, 260);
  glow.addColorStop(0, "rgba(255,226,150,0.55)");
  glow.addColorStop(1, "rgba(255,226,150,0)");
  g.fillStyle = glow;
  g.fillRect(cx - 270, top - 380, 540, 520);
  // ظل الطاولة
  g.fillStyle = "rgba(25,12,0,0.28)";
  g.beginPath();
  g.ellipse(cx + 6, floor + 2, w * 0.58, 12, 0, 0, Math.PI * 2);
  g.fill();
  // الأرجل
  const legG = g.createLinearGradient(0, top, 0, floor);
  legG.addColorStop(0, "#a8723a");
  legG.addColorStop(1, "#6d4420");
  g.fillStyle = legG;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * (w / 2 - 22), top + 12);
    g.lineTo(cx + s * (w / 2 - 14), top + 12);
    g.lineTo(cx + s * (w / 2 + 4), floor);
    g.lineTo(cx + s * (w / 2 - 8), floor);
    g.closePath();
    g.fill();
  }
  // سطح الطاولة
  const topG = g.createLinearGradient(0, top - 10, 0, top + 14);
  topG.addColorStop(0, "#e2ac6d");
  topG.addColorStop(1, "#a8723a");
  g.fillStyle = topG;
  rr(g, cx - w / 2, top - 8, w, 20, 6);
  g.fill();
  g.fillStyle = "rgba(255,240,200,0.5)";
  g.fillRect(cx - w / 2 + 4, top - 7, w - 8, 2);
  g.fillStyle = "rgba(40,20,4,0.35)";
  g.fillRect(cx - w / 2 + 3, top + 11, w - 6, 3);
  // كتب
  const books = [
    { w: 70, h: 14, c: "#2f6f6a", dx: -6 },
    { w: 62, h: 12, c: "#c47a2c", dx: 2 },
    { w: 56, h: 12, c: "#8a3b34", dx: -2 },
  ];
  let by = top - 8;
  books.forEach((b) => {
    by -= b.h;
    g.fillStyle = b.c;
    rr(g, cx + 22 + b.dx, by, b.w, b.h, 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(cx + 24 + b.dx, by + 2, b.w - 4, 2);
    g.fillStyle = "#f4ecd4";
    g.fillRect(cx + 22 + b.dx + b.w - 8, by + 3, 6, b.h - 6);
  });
  // المصباح: قاعدة خزفية + ظلة
  const lx = cx - 40;
  const bg = g.createRadialGradient(lx - 8, top - 52, 4, lx, top - 40, 34);
  bg.addColorStop(0, "#f6efe2");
  bg.addColorStop(1, "#bda98a");
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(lx, top - 36, 24, 32, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#bda98a";
  g.fillRect(lx - 5, top - 76, 10, 20);
  const sg = g.createLinearGradient(lx - 50, 0, lx + 50, 0);
  sg.addColorStop(0, "#d9b46d");
  sg.addColorStop(0.5, "#fbe5a8");
  sg.addColorStop(1, "#c9a156");
  g.fillStyle = sg;
  g.beginPath();
  g.moveTo(lx - 28, top - 128);
  g.lineTo(lx + 28, top - 128);
  g.lineTo(lx + 48, top - 66);
  g.lineTo(lx - 48, top - 66);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,230,0.55)";
  g.beginPath();
  g.ellipse(lx, top - 66, 47, 6, 0, 0, Math.PI * 2);
  g.fill();
}

function drawClock(g, x, y, R) {
  g.save();
  g.shadowColor = "rgba(30,20,10,0.35)";
  g.shadowBlur = 12;
  g.shadowOffsetY = 6;
  const rim = g.createRadialGradient(x - R * 0.3, y - R * 0.3, 2, x, y, R);
  rim.addColorStop(0, "#c98f4b");
  rim.addColorStop(1, "#6e4420");
  g.fillStyle = rim;
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = "#fbf6e8";
  g.beginPath();
  g.arc(x, y, R - 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#3a2a1c";
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 === 0 ? 3 : 1.6;
    g.beginPath();
    g.moveTo(x + Math.sin(a) * (R - 18), y - Math.cos(a) * (R - 18));
    g.lineTo(x + Math.sin(a) * (R - 12), y - Math.cos(a) * (R - 12));
    g.stroke();
  }
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(2.3) * R * 0.45, y - Math.cos(2.3) * R * 0.45);
  g.stroke();
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(0.6) * R * 0.66, y - Math.cos(0.6) * R * 0.66);
  g.stroke();
}

function drawRack(g, L) {
  const { cx, cy } = L.sweater;
  const y = cy - 222;
  const wood = g.createLinearGradient(0, y, 0, y + 26);
  wood.addColorStop(0, "#c99458");
  wood.addColorStop(1, "#8a5a2a");
  g.save();
  g.shadowColor = "rgba(30,15,0,0.4)";
  g.shadowBlur = 12;
  g.shadowOffsetY = 8;
  g.fillStyle = wood;
  rr(g, cx - 170, y, 340, 26, 5);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,235,190,0.5)";
  g.fillRect(cx - 166, y + 2, 332, 2);
  for (const px of [-110, 0, 110]) {
    const pg = g.createLinearGradient(0, y, 0, y + 12);
    pg.addColorStop(0, "#d8aa6f");
    pg.addColorStop(1, "#8a5a2a");
    g.fillStyle = pg;
    rr(g, cx + px - 7, y - 16, 14, 26, 6);
    g.fill();
    g.fillStyle = "rgba(255,240,200,0.6)";
    g.fillRect(cx + px - 4, y - 14, 3, 18);
  }
}

/* ---------- الغرفة كاملة ---------- */
export function renderRoom(L, dpr) {
  const W = Math.round(L.dW * L.s * dpr);
  const H = Math.round(L.dH * L.s * dpr);
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  g.scale(L.s * dpr, L.s * dpr);
  const { dW, dH, floorY } = L;

  // ورق جدران
  const tile = wallpaperTile();
  g.fillStyle = g.createPattern(tile, "repeat");
  g.save();
  g.scale(1, 1);
  g.fillRect(0, 0, dW, floorY);
  g.restore();
  // إضاءة الجدار + تظليل الزوايا
  const warm = g.createRadialGradient(L.window.cx, L.window.top + 80, 40, L.window.cx, L.window.top + 80, dW * 0.62);
  warm.addColorStop(0, "rgba(255,248,215,0.34)");
  warm.addColorStop(1, "rgba(255,248,215,0)");
  g.fillStyle = warm;
  g.fillRect(0, 0, dW, floorY);
  const vig = g.createLinearGradient(0, 0, 0, floorY);
  vig.addColorStop(0, "rgba(40,30,10,0.2)");
  vig.addColorStop(0.2, "rgba(40,30,10,0)");
  vig.addColorStop(1, "rgba(40,30,10,0.08)");
  g.fillStyle = vig;
  g.fillRect(0, 0, dW, floorY);
  const side = g.createLinearGradient(0, 0, dW, 0);
  side.addColorStop(0, "rgba(40,30,10,0.18)");
  side.addColorStop(0.16, "rgba(40,30,10,0)");
  side.addColorStop(0.9, "rgba(40,30,10,0)");
  side.addColorStop(1, "rgba(40,30,10,0.14)");
  g.fillStyle = side;
  g.fillRect(0, 0, dW, floorY);

  // كورنيش علوي
  const crown = g.createLinearGradient(0, 0, 0, 22);
  crown.addColorStop(0, "#fffaf0");
  crown.addColorStop(1, "#d3c8ac");
  g.fillStyle = crown;
  g.fillRect(0, 0, dW, 20);
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(0, 20, dW, 4);

  drawWainscot(g, L, dW);
  drawFloor(g, L, woodTile());
  drawRug(g, L);

  // الإطار والنافذة والستائر
  drawFrame(g, L.sweater.cx - 310, L.sweater.cy - 190, 108, 140, 1);
  drawRack(g, L);
  drawWindow(g, L);
  drawCurtains(g, L);
  if (L.floorY > 600 && !L.portrait) {
    drawClock(g, (L.window.cx + L.pillarX) / 2 - 30, L.window.top + 20, 52);
  }
  drawFrame(g, (L.window.cx + L.pillarX) / 2 - 150, L.window.top + 140, 96, 124, 2);

  // شعاع ضوء النافذة على الأرضية
  const wx = L.window.cx - L.window.w / 2;
  const beam = g.createLinearGradient(wx, L.window.top, wx + 260, floorY + 120);
  beam.addColorStop(0, "rgba(255,248,210,0.28)");
  beam.addColorStop(1, "rgba(255,248,210,0.02)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(wx + 8, L.window.top + 10);
  g.lineTo(wx + L.window.w - 8, L.window.top + 10);
  g.lineTo(wx + L.window.w + 330, floorY + 130);
  g.lineTo(wx + 130, floorY + 130);
  g.closePath();
  g.fill();
  // بقعة ضوء على الأرض بعوارض النافذة
  g.save();
  g.beginPath();
  g.moveTo(wx + 150, floorY + 28);
  g.lineTo(wx + L.window.w + 300, floorY + 28);
  g.lineTo(wx + L.window.w + 400, floorY + 128);
  g.lineTo(wx + 40, floorY + 128);
  g.closePath();
  g.clip();
  g.fillStyle = "rgba(255,246,205,0.22)";
  g.fillRect(wx, floorY, L.window.w + 500, 140);
  g.fillStyle = "rgba(255,255,255,0.0)";
  g.strokeStyle = "rgba(90,60,20,0.14)";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(wx + L.window.w * 0.55 + 90, floorY + 20);
  g.lineTo(wx + L.window.w * 0.45 + 120, floorY + 140);
  g.moveTo(wx + 60, floorY + 70);
  g.lineTo(wx + L.window.w + 420, floorY + 78);
  g.stroke();
  g.restore();

  drawPlant(g, L);
  drawTableLamp(g, L);

  // سكة علوية لوح الجدار
  g.fillStyle = "#6e4a26";
  g.fillRect(L.pillarX - 40, 20, dW - L.pillarX + 40, 8);
  g.fillStyle = "rgba(255,230,180,0.4)";
  g.fillRect(L.pillarX - 40, 20, dW - L.pillarX + 40, 1.5);
  return c;
}

/* ---------- لوح الجدار المنزلق (تتحرّك صورته) ---------- */
export function renderWallPanel(L, dpr) {
  const w = L.pillarW + 90;
  const h = L.floorY + 30;
  const c = makeCanvas(w * L.s * dpr, h * L.s * dpr);
  const g = c.getContext("2d");
  g.scale(L.s * dpr, L.s * dpr);
  const base = g.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, "#eadcc0");
  base.addColorStop(0.4, "#efe3c8");
  base.addColorStop(1, "#e2d3b2");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // نسيج جص دقيق
  const r = rng(33);
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.13)" : "rgba(120,95,50,0.09)";
    g.fillRect(r() * w, r() * h, 1.6, 1.6);
  }
  // حواف: سُمك الجدار عند الحافة اليسرى
  const edge = g.createLinearGradient(0, 0, 22, 0);
  edge.addColorStop(0, "#9a8660");
  edge.addColorStop(0.5, "#fff4d8");
  edge.addColorStop(1, "rgba(255,244,216,0)");
  g.fillStyle = edge;
  g.fillRect(0, 0, 22, h);
  g.fillStyle = "rgba(60,40,10,0.35)";
  g.fillRect(0, 0, 2, h);
  // لوحة القاعدة
  const bb = g.createLinearGradient(0, L.floorY - 26, 0, L.floorY);
  bb.addColorStop(0, "#fff8e8");
  bb.addColorStop(1, "#d9cfb4");
  g.fillStyle = bb;
  g.fillRect(0, L.floorY - 26, w, 26);
  g.fillStyle = "rgba(60,40,10,0.25)";
  g.fillRect(0, L.floorY - 2, w, 3);
  // قاطع إنارة وقابس
  const sx = 118;
  const sy = L.floorY - 170;
  g.fillStyle = "rgba(60,40,10,0.28)";
  rr(g, sx - 1, sy - 1, 38, 62, 7);
  g.fill();
  const plate = g.createLinearGradient(sx, sy, sx + 36, sy + 60);
  plate.addColorStop(0, "#fffdf6");
  plate.addColorStop(1, "#e2dac5");
  g.fillStyle = plate;
  rr(g, sx, sy, 36, 60, 6);
  g.fill();
  g.fillStyle = "#e9e1cc";
  rr(g, sx + 8, sy + 12, 20, 36, 4);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(sx + 8, sy + 28, 20, 2);
  g.fillStyle = "#fffdf4";
  rr(g, sx + 9, sy + 13, 18, 14, 3);
  g.fill();
  const ox = 118;
  const oy = L.floorY - 72;
  g.fillStyle = plate;
  rr(g, ox, oy, 36, 36, 6);
  g.fill();
  g.fillStyle = "#4a4338";
  for (const dy of [9, 22]) {
    rr(g, ox + 10, oy + dy, 16, 4, 2);
    g.fill();
  }
  // صورة معلّقة
  drawFrame(g, 74, 118, 96, 124, 4);
  // مقبض سحب نحاسي
  const hx = 40;
  const hy = L.floorY - 270;
  g.fillStyle = "rgba(40,24,6,0.35)";
  rr(g, hx - 7, hy - 4, 20, 112, 10);
  g.fill();
  const brass = g.createLinearGradient(hx - 10, 0, hx + 10, 0);
  brass.addColorStop(0, "#8a6420");
  brass.addColorStop(0.4, "#ffe9a0");
  brass.addColorStop(1, "#8a6420");
  g.fillStyle = brass;
  rr(g, hx - 5, hy, 16, 104, 8);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillRect(hx - 1, hy + 8, 3, 86);
  return c;
}

/* ---------- سلّة الخوص ---------- */
export function renderBasket(L, dpr) {
  const { w, h } = L.basket;
  const pad = 40;
  const SW = (w + pad * 2) * 2;
  const SH = (h + pad * 2) * 2;
  const mk = (front) => {
    const c = makeCanvas(SW, SH);
    const g = c.getContext("2d");
    g.scale(2, 2);
    g.translate(pad + w / 2, pad + h);
    const rt = w / 2; // نصف قطر الحافة العلوية
    const rb = w * 0.38;
    const ry = 16;
    const bodyPath = () => {
      g.beginPath();
      g.moveTo(-rt, -h);
      g.lineTo(-rb, 0);
      g.ellipse(0, 0, rb, ry * 0.7, 0, Math.PI, 0, true);
      g.lineTo(rt, -h);
      g.closePath();
    };
    if (!front) {
      // داخل السلّة (الجدار الخلفي) + حافة خلفية
      g.fillStyle = "#4a2f16";
      g.beginPath();
      g.ellipse(0, -h, rt, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#8a5a2a";
      g.lineWidth = 7;
      g.beginPath();
      g.ellipse(0, -h, rt, ry, 0, Math.PI, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(255,225,160,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(0, -h - 3, rt, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } else {
      g.save();
      bodyPath();
      g.clip();
      const base = g.createLinearGradient(-rt, 0, rt, 0);
      base.addColorStop(0, "#9a6a35");
      base.addColorStop(0.3, "#d8a866");
      base.addColorStop(0.75, "#b9824a");
      base.addColorStop(1, "#7e5128");
      g.fillStyle = base;
      g.fillRect(-rt - 4, -h - ry, rt * 2 + 8, h + ry * 2);
      // خوص مضفور: أشرطة أفقية وأضلاع رأسية
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const y0 = -h + (i / rows) * h;
        const rh = h / rows;
        for (let x = -rt - 10; x < rt + 10; x += 15) {
          const off = (i % 2) * 7.5;
          g.fillStyle = (Math.floor((x + 200) / 15) + i) % 2 ? "rgba(255,230,170,0.22)" : "rgba(60,30,6,0.24)";
          rr(g, x + off, y0 + 1, 13, rh - 2, 3);
          g.fill();
        }
        g.fillStyle = "rgba(50,25,4,0.34)";
        g.fillRect(-rt - 6, y0, rt * 2 + 12, 1.5);
      }
      const shade = g.createLinearGradient(0, -h, 0, 0);
      shade.addColorStop(0, "rgba(255,240,200,0.18)");
      shade.addColorStop(1, "rgba(30,14,0,0.34)");
      g.fillStyle = shade;
      g.fillRect(-rt - 4, -h - ry, rt * 2 + 8, h + ry * 2);
      g.restore();
      // الحافة الأمامية الملتفة
      g.strokeStyle = "#7a4e22";
      g.lineWidth = 11;
      g.beginPath();
      g.ellipse(0, -h, rt, ry, 0, 0, Math.PI);
      g.stroke();
      const rim = g.createLinearGradient(0, -h, 0, -h + ry);
      rim.addColorStop(0, "#f0c98a");
      rim.addColorStop(1, "#a97434");
      g.strokeStyle = rim;
      g.lineWidth = 8;
      g.beginPath();
      g.ellipse(0, -h, rt, ry, 0, 0.02, Math.PI - 0.02);
      g.stroke();
      // ظل تحت السلّة
    }
    return c;
  };
  void dpr;
  return { back: mk(false), front: mk(true), pad, scale: 2 };
}
