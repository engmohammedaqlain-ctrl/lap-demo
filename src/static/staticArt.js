/**
 * staticArt.js — رسم إجرائي واقعي: سترة صوف مضفّرة (مرسومة مرة واحدة على
 * Canvas مخفي)، بالونات لاتكس لامعة بخيط، وجسيمات الشحنات المتوهّجة.
 */
import { CHARGE } from "./staticData.js";

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

/* ======================= السترة ======================= */
export const SWEATER_SPRITE = { ppd: 2, ox: 210, oy: 250, w: 420, h: 470 }; // مركز الجسم عند (ox,oy) بوحدات التصميم

function sweaterPath(g) {
  g.beginPath();
  g.moveTo(-46, -130);
  g.quadraticCurveTo(-84, -134, -118, -102);
  g.bezierCurveTo(-150, -88, -168, 0, -172, 122);
  g.lineTo(-110, 128);
  g.bezierCurveTo(-108, 44, -104, 0, -103, -20);
  g.bezierCurveTo(-106, 60, -104, 112, -102, 150);
  g.quadraticCurveTo(0, 162, 102, 150);
  g.bezierCurveTo(104, 112, 106, 60, 103, -20);
  g.bezierCurveTo(104, 0, 108, 44, 110, 128);
  g.lineTo(172, 122);
  g.bezierCurveTo(168, 0, 150, -88, 118, -102);
  g.quadraticCurveTo(84, -134, 46, -130);
  g.quadraticCurveTo(0, -150, -46, -130);
  g.closePath();
}

function knitLayer(w, h, ppd) {
  // طبقة غُرز (V) بصوف خردلي، مع تنويع طفيف وإضاءة
  const c = makeCanvas(w * ppd, h * ppd);
  const g = c.getContext("2d");
  g.scale(ppd, ppd);
  const r = rng(77);
  g.translate(w / 2, h / 2 + 20);
  const sw = 9.5;
  const sh = 10.5;
  for (let y = -190; y < 200; y += sh) {
    for (let x = -200; x < 200; x += sw) {
      const jx = (r() - 0.5) * 0.9;
      const jy = (r() - 0.5) * 0.9;
      const lit = 52 + (r() - 0.5) * 9;
      const hue = 37 + (r() - 0.5) * 4;
      const cx = x + jx + ((Math.round(y / sh) % 2) * sw) / 2;
      const cy = y + jy;
      for (const side of [-1, 1]) {
        g.save();
        g.translate(cx + side * 2.1, cy);
        g.rotate(side * 0.42);
        const grad = g.createLinearGradient(-2.6, -sh / 2, 2.6, sh / 2);
        grad.addColorStop(0, `hsl(${hue}, 80%, ${lit + 12}%)`);
        grad.addColorStop(0.5, `hsl(${hue}, 78%, ${lit}%)`);
        grad.addColorStop(1, `hsl(${hue - 3}, 74%, ${lit - 14}%)`);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(0, 0, 2.9, sh * 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // ظل غُرزة صغير بين الصفوف
      g.fillStyle = "rgba(90,48,8,0.18)";
      g.fillRect(cx - sw / 2, cy + sh / 2 - 1.2, sw, 1.2);
    }
  }
  return c;
}

function cablePanel(g) {
  // ضفيرة (cable) وسطية: حبلان متشابكان بلمعة وظل
  const r = rng(5);
  void r;
  for (let y = -118; y < 130; y += 46) {
    for (const dir of [-1, 1]) {
      const grad = g.createLinearGradient(-34, 0, 34, 0);
      grad.addColorStop(0, "#c98a2a");
      grad.addColorStop(0.35, "#f2c25c");
      grad.addColorStop(0.7, "#e2a43b");
      grad.addColorStop(1, "#a96d1a");
      g.save();
      g.beginPath();
      g.moveTo(dir * -24, y);
      g.bezierCurveTo(dir * -24, y + 14, dir * 24, y + 14, dir * 24, y + 30);
      g.bezierCurveTo(dir * 24, y + 40, dir * 10, y + 48, dir * 10, y + 52);
      g.lineWidth = 17;
      g.lineCap = "round";
      g.strokeStyle = "rgba(60,30,4,0.5)";
      g.stroke();
      g.lineWidth = 14;
      g.strokeStyle = grad;
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = "rgba(255,238,190,0.55)";
      g.translate(-2, -1.5);
      g.stroke();
      g.restore();
    }
  }
}

function ribBand(g, x, y, w, h, vertical = true) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const base = g.createLinearGradient(x, y, x, y + h);
  base.addColorStop(0, "#d28a25");
  base.addColorStop(1, "#b36d12");
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  if (vertical) {
    for (let i = x; i < x + w; i += 5) {
      g.fillStyle = "rgba(255,226,150,0.5)";
      g.fillRect(i, y, 2.2, h);
      g.fillStyle = "rgba(70,34,2,0.32)";
      g.fillRect(i + 2.6, y, 1.6, h);
    }
  }
  g.restore();
}

export function makeSweaterSprite() {
  const { ppd, ox, oy, w, h } = SWEATER_SPRITE;
  const c = makeCanvas(w * ppd, h * ppd);
  const g = c.getContext("2d");
  g.scale(ppd, ppd);
  g.translate(ox, oy);

  // --- شمّاعة خشبية خلف السترة ---
  g.save();
  const wood = g.createLinearGradient(-130, -110, 130, -90);
  wood.addColorStop(0, "#b8814a");
  wood.addColorStop(0.5, "#d6a46a");
  wood.addColorStop(1, "#9a6735");
  g.strokeStyle = "rgba(40,22,6,0.55)";
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = 13;
  g.beginPath();
  g.moveTo(-132, -96);
  g.quadraticCurveTo(-60, -150, 0, -158);
  g.quadraticCurveTo(60, -150, 132, -96);
  g.stroke();
  g.strokeStyle = wood;
  g.lineWidth = 10;
  g.stroke();
  // خطاف معدني
  g.strokeStyle = "#8d949a";
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(0, -158);
  g.lineTo(0, -178);
  g.bezierCurveTo(0, -200, 22, -206, 22, -194);
  g.bezierCurveTo(22, -186, 12, -186, 12, -192);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-1, -160);
  g.lineTo(-1, -178);
  g.stroke();
  g.restore();

  // --- ظل ناعم مدمج ---
  g.save();
  g.shadowColor = "rgba(30,14,2,0.38)";
  g.shadowBlur = 26;
  g.shadowOffsetX = 10;
  g.shadowOffsetY = 16;
  sweaterPath(g);
  g.fillStyle = "#b9791f";
  g.fill();
  g.restore();

  // --- النسيج داخل الشكل ---
  g.save();
  sweaterPath(g);
  g.clip();
  const knit = knitLayer(420, 470, 2);
  g.drawImage(knit, -SWEATER_SPRITE.ox, -SWEATER_SPRITE.oy + 0, 420, 470);

  // ضفيرة وسطية على الجسم
  g.save();
  g.beginPath();
  g.rect(-38, -118, 76, 250);
  g.clip();
  cablePanel(g);
  g.restore();
  // خطوط فاصلة على جانبي الضفيرة
  g.strokeStyle = "rgba(70,36,4,0.38)";
  g.lineWidth = 2.2;
  for (const x of [-40, 40]) {
    g.beginPath();
    g.moveTo(x, -118);
    g.lineTo(x, 132);
    g.stroke();
  }

  // أطواق مضلّعة: الحاشية والأساور
  ribBand(g, -105, 128, 210, 30);
  ribBand(g, -176, 100, 70, 32);
  ribBand(g, 106, 100, 70, 32);
  g.fillStyle = "rgba(60,30,4,0.35)";
  g.fillRect(-105, 126.5, 210, 2.2);
  g.fillRect(-176, 99, 70, 2);
  g.fillRect(106, 99, 70, 2);

  // تظليل الأجسام: الحواف أغمق والوسط أفتح
  const side = g.createLinearGradient(-176, 0, 176, 0);
  side.addColorStop(0, "rgba(55,26,0,0.42)");
  side.addColorStop(0.12, "rgba(55,26,0,0.05)");
  side.addColorStop(0.5, "rgba(255,240,190,0.1)");
  side.addColorStop(0.88, "rgba(55,26,0,0.08)");
  side.addColorStop(1, "rgba(55,26,0,0.45)");
  g.fillStyle = side;
  g.fillRect(-180, -150, 360, 320);
  // ظل الإبط/تحت الذراع
  for (const sx of [-1, 1]) {
    const arm = g.createLinearGradient(sx * 100, 0, sx * 112, 0);
    arm.addColorStop(0, "rgba(40,18,0,0.5)");
    arm.addColorStop(1, "rgba(40,18,0,0)");
    g.fillStyle = arm;
    g.fillRect(sx > 0 ? 100 : -112, -26, 12, 156);
  }
  // طيّات قماش ناعمة (أخاديد مظلّلة وبارزة مضيئة)
  const folds = [
    { x: -62, w: 24, a: 0.11, y0: -110, y1: 126 },
    { x: 64, w: 28, a: 0.13, y0: -110, y1: 126 },
    { x: -132, w: 22, a: 0.14, y0: -90, y1: 100 },
    { x: 140, w: 22, a: 0.14, y0: -90, y1: 100 },
  ];
  for (const f of folds) {
    const fg = g.createLinearGradient(f.x - f.w, 0, f.x + f.w, 0);
    fg.addColorStop(0, "rgba(50,24,0,0)");
    fg.addColorStop(0.5, `rgba(50,24,0,${f.a})`);
    fg.addColorStop(1, "rgba(50,24,0,0)");
    g.fillStyle = fg;
    g.fillRect(f.x - f.w, f.y0, f.w * 2, f.y1 - f.y0);
  }
  // ضوء من أعلى (كتفان)
  const top = g.createLinearGradient(0, -140, 0, 40);
  top.addColorStop(0, "rgba(255,244,205,0.26)");
  top.addColorStop(1, "rgba(255,244,205,0)");
  g.fillStyle = top;
  g.fillRect(-180, -150, 360, 190);
  // تدرّج سفلي أغمق
  const bot = g.createLinearGradient(0, 60, 0, 160);
  bot.addColorStop(0, "rgba(40,18,0,0)");
  bot.addColorStop(1, "rgba(40,18,0,0.2)");
  g.fillStyle = bot;
  g.fillRect(-180, 60, 360, 110);

  // درزات الكتف
  g.strokeStyle = "rgba(70,36,4,0.5)";
  g.lineWidth = 2;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 103, -20);
    g.bezierCurveTo(sx * 104, -60, sx * 108, -88, sx * 118, -102);
    g.stroke();
  }
  g.restore();

  // --- ياقة مضلّعة ---
  g.save();
  g.beginPath();
  g.ellipse(0, -132, 48, 15, 0, 0, Math.PI * 2);
  g.fillStyle = "#2a1707";
  g.fill();
  g.beginPath();
  g.ellipse(0, -131, 41, 10, 0, 0, Math.PI * 2);
  g.fillStyle = "#4a2d10";
  g.fill();
  // الحلقة المضلّعة (النصف الأمامي)
  g.beginPath();
  g.ellipse(0, -130, 51, 17, 0, 0.02 * Math.PI, 0.98 * Math.PI);
  g.ellipse(0, -128, 41, 11, 0, 0.98 * Math.PI, 0.02 * Math.PI, true);
  g.closePath();
  g.clip();
  const col = g.createLinearGradient(0, -134, 0, -108);
  col.addColorStop(0, "#d99a30");
  col.addColorStop(1, "#b2701a");
  g.fillStyle = col;
  g.fillRect(-60, -140, 120, 40);
  for (let x = -55; x < 55; x += 4.4) {
    g.fillStyle = "rgba(255,226,150,0.55)";
    g.fillRect(x, -140, 1.8, 40);
    g.fillStyle = "rgba(70,34,2,0.36)";
    g.fillRect(x + 2.2, -140, 1.4, 40);
  }
  g.restore();
  g.strokeStyle = "rgba(50,24,0,0.55)";
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(0, -130, 51, 17, 0, 0.02 * Math.PI, 0.98 * Math.PI);
  g.stroke();

  // --- حدّ السترة الخارجي الخفيف ---
  sweaterPath(g);
  g.strokeStyle = "rgba(60,28,0,0.4)";
  g.lineWidth = 1.5;
  g.stroke();
  return c;
}

/* ======================= الشحنات ======================= */
const chargeCache = {};
export function chargeSprite(kind) {
  if (chargeCache[kind]) return chargeCache[kind];
  const S = 64;
  const c = makeCanvas(S, S);
  const g = c.getContext("2d");
  const col = kind === "plus" ? CHARGE.plus : CHARGE.minus;
  const glow = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  glow.addColorStop(0, kind === "plus" ? "rgba(255,120,110,0.55)" : "rgba(90,170,255,0.6)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  const body = g.createRadialGradient(S * 0.4, S * 0.36, 1, S / 2, S / 2, 14);
  body.addColorStop(0, kind === "plus" ? "#ffb3ab" : "#a8d4ff");
  body.addColorStop(0.5, col);
  body.addColorStop(1, kind === "plus" ? "#8f1c1c" : "#15458f");
  g.fillStyle = body;
  g.beginPath();
  g.arc(S / 2, S / 2, 13, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 1.8;
  g.stroke();
  g.strokeStyle = "#fff";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(S / 2 - 6, S / 2);
  g.lineTo(S / 2 + 6, S / 2);
  if (kind === "plus") {
    g.moveTo(S / 2, S / 2 - 6);
    g.lineTo(S / 2, S / 2 + 6);
  }
  g.stroke();
  chargeCache[kind] = c;
  return c;
}

/** يرسم جسيم شحنة. size = القطر بالبكسل التصميمي */
export function drawCharge(g, kind, x, y, size = 17, alpha = 1) {
  const s = chargeSprite(kind);
  const k = (size * 64) / 30; // الجسم الفعلي ≈ 26/64 من الـ sprite
  g.globalAlpha = alpha;
  g.drawImage(s, x - k / 2, y - k / 2, k, k);
  g.globalAlpha = 1;
}

/* ======================= البالون ======================= */
function balloonPath(g, R) {
  g.beginPath();
  g.moveTo(0, R * 1.03);
  g.bezierCurveTo(-R * 0.36, R * 0.98, -R * 1.0, R * 0.55, -R * 0.99, -R * 0.1);
  g.bezierCurveTo(-R * 1.0, -R * 0.78, -R * 0.5, -R * 1.08, 0, -R * 1.08);
  g.bezierCurveTo(R * 0.5, -R * 1.08, R * 1.0, -R * 0.78, R * 0.99, -R * 0.1);
  g.bezierCurveTo(R * 1.0, R * 0.55, R * 0.36, R * 0.98, 0, R * 1.03);
  g.closePath();
}

export function drawBalloon(g, b) {
  const R = b.r;
  const spec = b.spec;
  const squishX = b.stuck === "wall" ? 0.92 - b.stickPulse * 0.03 : b.stuck === "sweater" ? 0.97 : 1 + Math.sin(b.bob) * 0.006;
  const squishY = 1 / squishX;
  g.save();
  g.translate(b.x, b.y);
  g.rotate(b.angle);
  g.scale(squishX, Math.min(1.04, squishY));

  // ظل ناعم على الحائط خلف البالون
  g.save();
  g.shadowColor = "rgba(30,20,20,0.28)";
  g.shadowBlur = 26;
  g.shadowOffsetX = 14;
  g.shadowOffsetY = 20;
  balloonPath(g, R);
  g.fillStyle = spec.base;
  g.fill();
  g.restore();

  // الجسم بتدرّج شبه شفاف
  balloonPath(g, R);
  const body = g.createRadialGradient(-R * 0.34, -R * 0.42, R * 0.04, 0, 0, R * 1.2);
  body.addColorStop(0, spec.light);
  body.addColorStop(0.32, spec.base);
  body.addColorStop(0.82, spec.dark);
  body.addColorStop(1, spec.dark);
  g.fillStyle = body;
  g.fill();

  g.save();
  balloonPath(g, R);
  g.clip();
  // انعكاس ضوء ارتدادي من الأسفل/اليمين (يعطي شفافية اللاتكس)
  const bounce = g.createRadialGradient(R * 0.42, R * 0.52, 0, R * 0.42, R * 0.52, R * 0.85);
  bounce.addColorStop(0, spec.rim + "88");
  bounce.addColorStop(1, spec.rim + "00");
  g.fillStyle = bounce;
  g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  // تظليل الحافة
  const edge = g.createRadialGradient(0, 0, R * 0.62, 0, 0, R * 1.12);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = edge;
  g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  g.restore();

  // لمعتان رئيسية وثانوية
  g.save();
  g.rotate(-0.55);
  const hl = g.createRadialGradient(-R * 0.1, -R * 0.52, 0, -R * 0.1, -R * 0.52, R * 0.36);
  hl.addColorStop(0, "rgba(255,255,255,0.95)");
  hl.addColorStop(0.5, "rgba(255,255,255,0.55)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hl;
  g.beginPath();
  g.ellipse(-R * 0.1, -R * 0.52, R * 0.17, R * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.beginPath();
  g.ellipse(-R * 0.62, -R * 0.1, R * 0.045, R * 0.09, 0.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.28)";
  g.lineWidth = R * 0.04;
  g.beginPath();
  g.arc(0, 0, R * 0.9, 0.15, 1.0);
  g.stroke();

  // العقدة
  g.fillStyle = spec.dark;
  g.beginPath();
  g.moveTo(-R * 0.09, R * 1.0);
  g.quadraticCurveTo(0, R * 0.95, R * 0.09, R * 1.0);
  g.lineTo(R * 0.06, R * 1.09);
  g.quadraticCurveTo(0, R * 1.14, -R * 0.06, R * 1.09);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.3)";
  g.fillRect(-R * 0.03, R * 1.0, R * 0.03, R * 0.08);
  g.restore();
}

export function drawString(g, b) {
  const p = b.string;
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  g.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  g.strokeStyle = "rgba(40,30,28,0.28)";
  g.lineWidth = 3.4;
  g.stroke();
  g.strokeStyle = "rgba(235,225,215,0.95)";
  g.lineWidth = 1.7;
  g.stroke();
  g.restore();
}
