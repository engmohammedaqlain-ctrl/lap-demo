/**
 * BuoyancyScene.jsx — مشهد مختبر الطفو على Canvas 2D:
 * خزان زجاجي كبير، رف أجسام تُسحب بالإصبع، ماء بموجات ورذاذ وفقاعات،
 * أجسام بخامات واقعية، أسهم قوى، ومسطرة حجم. كل الرسم بإحداثيات "تصميم"
 * (design px) تُكبَّر لتناسب الشاشة، فيبدو المشهد متناسقاً على أي جهاز.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { World, MAX_BODIES, TABLE_Y } from "./engine.js";
import { getTextures } from "./textures.js";
import {
  OBJECTS,
  OBJECT_ORDER,
  MYSTERY_MATERIALS,
  MYSTERY_ORDER,
  MYSTERY_SIZE,
  TANK_W,
  TANK_AREA,
  halfH,
  halfW,
} from "./catalog.js";
import { play, setMuted, preload } from "../audio/sfx.js";
import { haptic } from "../mobile/device.js";

const PXM = 640; // بكسل تصميم لكل متر
const SHELF_SCALE = 0.62;
const ar = (n, d = 1) => n.toLocaleString("ar-EG", { minimumFractionDigits: d, maximumFractionDigits: d });
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const FONT = "'IBM Plex Sans Arabic', sans-serif";
let UI_S = 1; // مقياس الشاشة الحالي (لإبقاء الخطوط مقروءة على الجوال)
const fsz = (n) => Math.max(n, 11.5 / UI_S);

/* ======================= التخطيط ======================= */
function computeLayout(W, H, mode) {
  const s = Math.max(0.3, Math.min(W / 1280, H / 700));
  const dW = W / s;
  const dH = H / s;
  // وضع التخمين: نرفع الخزان قليلاً ليبقى مكان للوحة الاختيار أسفل الطاولة
  const extra = mode === "mystery" ? Math.max(0, 96 / s - 92) : 0;
  const innerH = Math.max(400, Math.min(600, dH - 250 - extra));
  const floorY = dH - 118 - extra;
  const tankL = dW / 2 - (TANK_W * PXM) / 2;
  const shelfX = tankL + TANK_W * PXM + 46;
  const shelfW = Math.max(200, Math.min(290, dW - shelfX - 14));
  const shelfTop = floorY - innerH - 14;
  const shelfH = innerH + 14 + (-TABLE_Y) * PXM;
  return { s, dW, dH, innerH, floorY, tankL, tankTop: floorY - innerH, shelf: { x: shelfX, y: shelfTop, w: shelfW, h: shelfH } };
}

const px = (L, xm) => L.tankL + xm * PXM;
const py = (L, ym) => L.floorY - ym * PXM;

function shelfSlots(L, mode, world) {
  const { x, y, w, h } = L.shelf;
  const board = 14;
  const rowH = (h - board * 3 - 18) / 3;
  const slots = [];
  const keys = mode === "mystery" ? ["mystery"] : OBJECT_ORDER;
  keys.forEach((key, i) => {
    const row = mode === "mystery" ? 1 : Math.floor(i / 2);
    const col = mode === "mystery" ? 0.5 : i % 2 === 0 ? 0.28 : 0.72;
    const boardTop = y + 18 + (row + 1) * rowH + row * board;
    slots.push({ key, cx: x + w * col, base: boardTop, rowTop: boardTop - rowH, rowH, w: (w * (mode === "mystery" ? 0.6 : 0.42)) });
  });
  void world;
  return slots;
}

/* ======================= رسم الأجسام ======================= */
function bodyBounds(L, b) {
  const o = b.o;
  const cx = px(L, b.x);
  const cy = py(L, b.y);
  const sc = b.scale;
  const hw = halfW(o) * PXM * sc;
  const hh = halfH(o) * PXM * sc;
  if (o.shape === "box") {
    const ox = o.d * PXM * 0.26 * sc;
    const oy = o.d * PXM * 0.2 * sc;
    return { x0: cx - hw, x1: cx + hw + ox, y0: cy - hh - oy, y1: cy + hh };
  }
  if (o.shape === "cyl") return { x0: cx - hw, x1: cx + hw, y0: cy - hh - hw * 0.35, y1: cy + hh + hw * 0.35 };
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh - 6, y1: cy + hh };
}

function textureKeyOf(b) {
  if (b.mystery) return b.mystery.revealed ? `m_${b.mystery.key}` : "mystery";
  return b.key;
}

function drawBox(g, b, tex) {
  const o = b.o;
  const w = o.w * PXM;
  const h = o.h * PXM;
  const d = o.d * PXM;
  const ox = d * 0.26;
  const oy = d * 0.2;
  const fx = -w / 2;
  const fy = -h / 2;
  const ice = b.key === "ice" || (b.mystery?.revealed && b.mystery.key === "ice");

  // الوجه الجانبي الأيمن
  g.save();
  g.transform(ox / tex.side.width, -oy / tex.side.width, 0, h / tex.side.height, fx + w, fy);
  g.drawImage(tex.side, 0, 0);
  g.restore();
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.moveTo(fx + w, fy);
  g.lineTo(fx + w + ox, fy - oy);
  g.lineTo(fx + w + ox, fy + h - oy);
  g.lineTo(fx + w, fy + h);
  g.closePath();
  g.fill();

  // الوجه العلوي
  g.save();
  g.transform(w / tex.top.width, 0, ox / tex.top.height, -oy / tex.top.height, fx, fy);
  g.drawImage(tex.top, 0, 0);
  g.restore();
  g.fillStyle = tex.topTint;
  g.beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx + ox, fy - oy);
  g.lineTo(fx + w + ox, fy - oy);
  g.lineTo(fx + w, fy);
  g.closePath();
  g.fill();

  // الوجه الأمامي
  g.drawImage(tex.front, fx, fy, w, h);

  // حواف مشطوفة ولمعان
  g.lineJoin = "round";
  g.strokeStyle = ice ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(fx + 1, fy + h - 1);
  g.lineTo(fx + 1, fy + 1);
  g.lineTo(fx + w - 1, fy + 1);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.32)";
  g.beginPath();
  g.moveTo(fx + w - 1, fy + 1);
  g.lineTo(fx + w - 1, fy + h - 1);
  g.lineTo(fx + 1, fy + h - 1);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.22)";
  g.lineWidth = 1.2;
  g.strokeRect(fx, fy, w, h);
  g.beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx + ox, fy - oy);
  g.lineTo(fx + w + ox, fy - oy);
  g.lineTo(fx + w + ox, fy + h - oy);
  g.lineTo(fx + w, fy + h);
  g.stroke();
}

function drawCylinder(g, b, tex) {
  const o = b.o;
  const r = o.r * PXM;
  const hh = (o.h * PXM) / 2;
  const ry = r * 0.34;
  g.save();
  g.beginPath();
  g.moveTo(-r, -hh);
  g.lineTo(-r, hh);
  g.ellipse(0, hh, r, ry, 0, Math.PI, 0, true);
  g.lineTo(r, -hh);
  g.closePath();
  g.clip();
  g.drawImage(tex.body, -r, -hh - ry, r * 2, hh * 2 + ry * 2);
  const sh = g.createLinearGradient(-r, 0, r, 0);
  sh.addColorStop(0, "rgba(0,0,0,0.38)");
  sh.addColorStop(0.28, "rgba(255,255,255,0.12)");
  sh.addColorStop(0.55, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = sh;
  g.fillRect(-r, -hh - ry, r * 2, hh * 2 + ry * 2);
  g.restore();
  // القاعدة العلوية
  g.save();
  g.beginPath();
  g.ellipse(0, -hh, r, ry, 0, 0, Math.PI * 2);
  g.clip();
  g.drawImage(tex.top, -r, -hh - ry, r * 2, ry * 2);
  const tg = g.createLinearGradient(-r, -hh - ry, r, -hh + ry);
  tg.addColorStop(0, "rgba(255,255,255,0.28)");
  tg.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = tg;
  g.fillRect(-r, -hh - ry, r * 2, ry * 2);
  g.restore();
  g.strokeStyle = "rgba(60,36,10,0.55)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(0, -hh, r, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(-r, -hh);
  g.lineTo(-r, hh);
  g.ellipse(0, hh, r, ry, 0, Math.PI, 0, true);
  g.lineTo(r, -hh);
  g.stroke();
}

function drawSphere(g, b, tex) {
  const R = b.o.r * PXM;
  g.drawImage(tex.img, -R, -R, R * 2, R * 2);
  if (b.key === "apple") {
    g.strokeStyle = "#5a3a1a";
    g.lineWidth = Math.max(2, R * 0.07);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, -R * 0.82);
    g.quadraticCurveTo(R * 0.06, -R * 1.12, R * 0.22, -R * 1.22);
    g.stroke();
    g.fillStyle = "#4d9a3a";
    g.beginPath();
    g.moveTo(R * 0.1, -R * 1.02);
    g.quadraticCurveTo(R * 0.55, -R * 1.42, R * 0.82, -R * 1.02);
    g.quadraticCurveTo(R * 0.45, -R * 0.86, R * 0.1, -R * 1.02);
    g.fill();
    g.strokeStyle = "rgba(20,70,20,0.6)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(R * 0.14, -R * 1.02);
    g.quadraticCurveTo(R * 0.45, -R * 1.12, R * 0.74, -R * 1.04);
    g.stroke();
  }
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, R - 0.5, 0, Math.PI * 2);
  g.stroke();
}

function drawBody(g, L, b, tex) {
  const cx = px(L, b.x);
  const cy = py(L, b.y);
  g.save();
  g.translate(cx, cy);
  if (b.angle) g.rotate(-b.angle);
  g.scale(b.scale, b.scale);
  const t = tex[textureKeyOf(b)];
  if (t.type === "box") drawBox(g, b, t);
  else if (t.type === "cyl") drawCylinder(g, b, t);
  else drawSphere(g, b, t);
  g.restore();
}

function drawShadow(g, L, b) {
  const floorM = b.x > 0 && b.x < TANK_W ? 0 : TABLE_Y;
  const gap = Math.max(0, b.y - halfH(b.o) - floorM);
  if (gap > 0.25) return;
  const a = 0.22 * (1 - gap / 0.25);
  const w = halfW(b.o) * PXM * 1.05 * b.scale;
  g.fillStyle = `rgba(30,24,16,${a})`;
  g.beginPath();
  g.ellipse(px(L, b.x) + w * 0.12, py(L, floorM) + 2, w, w * 0.16, 0, 0, Math.PI * 2);
  g.fill();
}

/* ======================= الخلفية والطاولة والرف ======================= */
function drawBackground(g, L, time) {
  const { dW, dH, floorY } = L;
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, "#f1f6f1");
  wall.addColorStop(0.65, "#dfeae5");
  wall.addColorStop(1, "#cfe0da");
  g.fillStyle = wall;
  g.fillRect(0, 0, dW, dH);
  // خطوط لوح الجدار الباهتة
  g.strokeStyle = "rgba(60,110,100,0.07)";
  g.lineWidth = 2;
  for (let x = 0; x < dW; x += 120) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, floorY);
    g.stroke();
  }
  // شعاع ضوء من نافذة
  const beam = g.createLinearGradient(dW * 0.15, 0, dW * 0.6, floorY);
  beam.addColorStop(0, "rgba(255,255,240,0.55)");
  beam.addColorStop(1, "rgba(255,255,240,0)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(dW * 0.08, 0);
  g.lineTo(dW * 0.3, 0);
  g.lineTo(dW * 0.78, floorY);
  g.lineTo(dW * 0.46, floorY);
  g.closePath();
  g.fill();
  void time;
}

function drawTable(g, L, woodTex) {
  const { dW, dH, floorY } = L;
  const top = floorY + -TABLE_Y * PXM;
  const grad = g.createLinearGradient(0, top, 0, dH);
  grad.addColorStop(0, "#a8733f");
  grad.addColorStop(0.08, "#8d5e33");
  grad.addColorStop(1, "#6b4526");
  g.fillStyle = grad;
  g.fillRect(0, top, dW, dH - top);
  g.save();
  g.globalAlpha = 0.3;
  g.fillStyle = g.createPattern(woodTex.front, "repeat");
  g.fillRect(0, top + 22, dW, dH - top);
  g.restore();
  // حافة الطاولة العلوية
  const edge = g.createLinearGradient(0, top - 2, 0, top + 22);
  edge.addColorStop(0, "#e0b27a");
  edge.addColorStop(1, "#b9854e");
  g.fillStyle = edge;
  g.fillRect(0, top - 2, dW, 22);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(0, top + 20, dW, 3);
}

function drawShelf(g, L, mode, world, tex, hoverKey, spawned) {
  const { x, y, w, h } = L.shelf;
  // ظهر الخزانة
  const back = g.createLinearGradient(x, y, x + w, y + h);
  back.addColorStop(0, "#7d5530");
  back.addColorStop(1, "#5e3f22");
  g.fillStyle = back;
  g.fillRect(x, y, w, h - 4);
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(x, y, w, 10);
  // الجانبان
  const sideG = g.createLinearGradient(0, 0, 0, h);
  sideG.addColorStop(0, "#b98550");
  sideG.addColorStop(1, "#8f6238");
  g.fillStyle = sideG;
  g.fillRect(x - 10, y - 8, 14, h + 4);
  g.fillRect(x + w - 4, y - 8, 14, h + 4);
  g.fillRect(x - 10, y - 14, w + 24, 14);

  const slots = shelfSlots(L, mode, world);
  const rows = 3;
  const board = 14;
  const rowH = (h - board * 3 - 18) / 3;
  for (let r = 0; r < rows; r++) {
    const by = y + 18 + (r + 1) * rowH + r * board;
    const bg = g.createLinearGradient(0, by, 0, by + board);
    bg.addColorStop(0, "#d1a06a");
    bg.addColorStop(1, "#a3733f");
    g.fillStyle = bg;
    g.fillRect(x - 6, by, w + 12, board);
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(x - 6, by, w + 12, 2);
  }
  for (const sl of slots) {
    const key = sl.key;
    const hasWorld = mode === "mystery" && spawned;
    const o = key === "mystery" ? { shape: "box", w: MYSTERY_SIZE, h: MYSTERY_SIZE, d: MYSTERY_SIZE } : OBJECTS[key];
    const hh = halfH(o) * PXM * SHELF_SCALE;
    const cy = sl.base - hh;
    if (hasWorld) {
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.setLineDash([6, 6]);
      g.lineWidth = 2;
      g.strokeRect(sl.cx - hh, sl.base - hh * 2, hh * 2, hh * 2);
      g.setLineDash([]);
      continue;
    }
    // ظل تحت الجسم + توهّج عند التمرير
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(sl.cx, sl.base + 1, halfW(o) * PXM * SHELF_SCALE * 1.05, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(sl.cx, cy);
    const hover = hoverKey === key;
    const sc = SHELF_SCALE * (hover ? 1.08 : 1);
    g.scale(sc, sc);
    if (hover) {
      g.shadowColor = "rgba(255,245,200,0.9)";
      g.shadowBlur = 24;
    }
    const fake = { o, key, scale: 1, angle: 0, mystery: key === "mystery" ? { revealed: false } : null };
    const t = tex[textureKeyOf(fake)];
    if (t.type === "box") drawBox(g, fake, t);
    else if (t.type === "cyl") drawCylinder(g, fake, t);
    else drawSphere(g, fake, t);
    g.restore();
    // اسم المادة
    g.font = `600 ${fsz(13)}px ${FONT}`;
    g.textAlign = "center";
    g.fillStyle = "rgba(255,244,220,0.92)";
    const label = key === "mystery" ? "جسم غامض" : OBJECTS[key].nameAr;
    g.fillText(label, sl.cx, sl.rowTop + 16);
  }
}

/* ======================= الخزان والماء ======================= */
function waterPath(g, L, world) {
  const N = world.h.length;
  g.beginPath();
  g.moveTo(L.tankL, L.floorY);
  for (let i = 0; i < N; i++) {
    const xm = (i / (N - 1)) * TANK_W;
    g.lineTo(px(L, xm), py(L, world.level + world.h[i]));
  }
  g.lineTo(L.tankL + TANK_W * PXM, L.floorY);
  g.closePath();
}

function drawWater(g, L, world, time) {
  const liq = world.liquid;
  const topY = py(L, world.level) - 14;
  g.save();
  waterPath(g, L, world);
  g.clip();
  const grad = g.createLinearGradient(0, topY, 0, L.floorY);
  grad.addColorStop(0, rgba(liq.color, liq.alpha * 0.72));
  grad.addColorStop(0.5, rgba(liq.color, liq.alpha * 0.9));
  grad.addColorStop(1, rgba(liq.deep, liq.alpha * 0.85));
  g.fillStyle = grad;
  g.fillRect(L.tankL, topY - 20, TANK_W * PXM, L.floorY - topY + 30);

  // أشعة ضوء تتحرك ببطء داخل الماء
  g.globalCompositeOperation = "screen";
  for (let i = 0; i < 6; i++) {
    const x = L.tankL + ((i * 0.19 + 0.08 + Math.sin(time * 0.3 + i) * 0.03) % 1) * TANK_W * PXM;
    const rg = g.createLinearGradient(x, topY, x + 60, L.floorY);
    rg.addColorStop(0, "rgba(255,255,255,0.16)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(x, topY);
    g.lineTo(x + 36, topY);
    g.lineTo(x + 120 + Math.sin(time * 0.5 + i) * 20, L.floorY);
    g.lineTo(x + 70, L.floorY);
    g.closePath();
    g.fill();
  }
  // كاوستيك على القاع
  g.globalAlpha = 0.28;
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const cx = L.tankL + ((i / 14 + time * 0.02 * (i % 3 === 0 ? 1 : -1)) % 1 + 1) % 1 * TANK_W * PXM;
    g.beginPath();
    g.ellipse(cx, L.floorY - 8, 26 + (i % 4) * 8, 4 + Math.sin(time * 1.2 + i) * 1.5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  // خط السطح اللامع
  g.save();
  g.lineJoin = "round";
  const N = world.h.length;
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const xm = (i / (N - 1)) * TANK_W;
    const X = px(L, xm);
    const Y = py(L, world.level + world.h[i]);
    if (i === 0) g.moveTo(X, Y);
    else g.lineTo(X, Y);
  }
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = rgba(liq.color, 0.5);
  g.lineWidth = 7;
  g.globalAlpha = 0.35;
  g.translate(0, 4);
  g.stroke();
  g.restore();
}

function drawTankGlass(g, L, world) {
  const { tankL, floorY, tankTop } = L;
  const W = TANK_W * PXM;
  const T = 13; // سُمك الزجاج
  const base = (-TABLE_Y) * PXM;
  const top = floorY - world.tankH * PXM;
  void tankTop;
  // ظل الخزان على الطاولة
  g.fillStyle = "rgba(20,16,10,0.22)";
  g.beginPath();
  g.ellipse(tankL + W / 2, floorY + base + 4, W / 2 + 30, 12, 0, 0, Math.PI * 2);
  g.fill();

  // الجدران الزجاجية (يمين ويسار + قاعدة)
  const glass = (x, y, w, h) => {
    const gg = g.createLinearGradient(x, y, x + w, y);
    gg.addColorStop(0, "rgba(210,238,240,0.62)");
    gg.addColorStop(0.5, "rgba(236,250,250,0.42)");
    gg.addColorStop(1, "rgba(170,210,216,0.66)");
    g.fillStyle = gg;
    g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 1.2;
    g.strokeRect(x, y, w, h);
  };
  glass(tankL - T, top, T, floorY - top + base);
  glass(tankL + W, top, T, floorY - top + base);
  glass(tankL - T, floorY, W + T * 2, base);
  // حافة خضراء زجاجية للقاعدة
  g.fillStyle = "rgba(40,120,110,0.25)";
  g.fillRect(tankL - T, floorY + base - 5, W + T * 2, 5);

  // انعكاسات على الواجهة الأمامية
  g.save();
  g.beginPath();
  g.rect(tankL, top, W, floorY - top);
  g.clip();
  const refl = g.createLinearGradient(tankL, top, tankL + W, floorY);
  refl.addColorStop(0.08, "rgba(255,255,255,0)");
  refl.addColorStop(0.14, "rgba(255,255,255,0.14)");
  refl.addColorStop(0.2, "rgba(255,255,255,0)");
  refl.addColorStop(0.62, "rgba(255,255,255,0)");
  refl.addColorStop(0.66, "rgba(255,255,255,0.09)");
  refl.addColorStop(0.7, "rgba(255,255,255,0)");
  g.fillStyle = refl;
  g.fillRect(tankL, top, W, floorY - top);
  g.restore();
}

function drawRuler(g, L, world) {
  const x = L.tankL + 4;
  g.save();
  g.font = `600 ${fsz(12)}px ${FONT}`;
  g.textAlign = "left";
  g.fillStyle = "rgba(20,50,50,0.78)";
  g.strokeStyle = "rgba(20,50,50,0.55)";
  g.lineWidth = 1.2;
  for (let m = 0.05; m < world.tankH - 0.01; m += 0.05) {
    const y = py(L, m);
    const major = Math.round(m * 100) % 10 === 0;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (major ? 18 : 9), y);
    g.stroke();
    if (major) g.fillText(ar(m * TANK_AREA * 1000, 0), x + 22, y + 4);
  }
  g.font = `700 ${fsz(12)}px ${FONT}`;
  g.fillText("لتر", x + 22, py(L, world.tankH - 0.02));
  g.restore();
}

/* ======================= طبقات إيضاحية ======================= */
function pill(g, text, x, y, opts = {}) {
  const { bg = "rgba(255,255,255,0.92)", fg = "#1d2b22", weight = 600, pad = 10, align = "center", border } = opts;
  const size = fsz(opts.size || 15);
  g.font = `${weight} ${size}px ${FONT}`;
  const w = g.measureText(text).width + pad * 2;
  const h = size + 12;
  let x0 = x - w / 2;
  if (align === "left") x0 = x;
  if (align === "right") x0 = x - w;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(x0, y - h / 2, w, h, h / 2);
  g.fill();
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x0 + w / 2, y + 1);
  g.textBaseline = "alphabetic";
  return { x0, w, h };
}

function arrow(g, x, y0, y1, color, label, side = 1) {
  const dir = Math.sign(y1 - y0) || 1;
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 6;
  g.lineCap = "round";
  g.shadowColor = "rgba(0,0,0,0.25)";
  g.shadowBlur = 4;
  g.beginPath();
  g.moveTo(x, y0);
  g.lineTo(x, y1 - dir * 12);
  g.stroke();
  g.beginPath();
  g.moveTo(x, y1);
  g.lineTo(x - 11, y1 - dir * 18);
  g.lineTo(x + 11, y1 - dir * 18);
  g.closePath();
  g.fill();
  g.restore();
  if (label) pill(g, label, x + 10 * side, (y0 + y1) / 2, { align: side > 0 ? "left" : "right", bg: color, fg: "#fff", size: 14, weight: 700, pad: 8 });
}

const arrowLen = (F) => Math.max(10, Math.min(190, 15 * Math.sqrt(F)));

function drawForces(g, L, world, flags) {
  for (const b of world.bodies) {
    if (b.dragging && b.scale < 0.9) continue;
    const cx = px(L, b.x);
    const cy = py(L, b.y);
    const off = Math.max(14, Math.min(34, halfW(b.o) * PXM * 0.42));
    const hasFb = b.sub.v > 1e-6;
    if (hasFb) {
      const by = py(L, b.sub.cy);
      const len = arrowLen(b.fb);
      arrow(g, cx + off, by, by - len, "#2b7de0", flags.values ? `${ar(b.fb, 1)} N` : null, 1);
    }
    const len = arrowLen(b.fg);
    arrow(g, cx - off, cy, cy + len, "#d64545", flags.values ? `${ar(b.fg, 1)} N` : null, -1);
  }
}

function drawTags(g, L, world) {
  for (const b of world.bodies) {
    if (b.scale < 0.9) continue;
    const bb = bodyBounds(L, b);
    const name = b.mystery && !b.mystery.revealed ? "؟" : b.mystery ? MYSTERY_MATERIALS[b.mystery.key].nameAr : OBJECTS[b.key].nameAr;
    const text = `${name} · ${ar(b.mass, b.mass < 1 ? 2 : 1)} كغ`;
    const y = bb.y0 - 20;
    const x = (bb.x0 + bb.x1) / 2;
    pill(g, text, x, y, {
      size: 14,
      pad: 10,
      bg: b.selected ? "#1b7340" : "rgba(255,255,255,0.92)",
      fg: b.selected ? "#fff" : "#1d2b22",
      border: b.selected ? "rgba(255,255,255,0.8)" : "rgba(15,77,42,0.18)",
    });
    if (b.selected && !(b.mystery && !b.mystery.revealed)) {
      pill(g, `الكثافة ${ar(b.density, 0)} كغ/م³`, x, y - 30, { size: 13, weight: 500, bg: "rgba(27,115,64,0.92)", fg: "#fff", pad: 9 });
    }
  }
}

function drawDisplacement(g, L, world) {
  const y0 = py(L, world.level0);
  const y1 = py(L, world.level);
  const total = world.bodies.reduce((s, b) => s + b.sub.v, 0);
  if (total < 1e-5) return;
  g.save();
  g.setLineDash([8, 6]);
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(L.tankL, y0);
  g.lineTo(L.tankL + TANK_W * PXM, y0);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillRect(L.tankL, y1, TANK_W * PXM, y0 - y1);
  g.restore();
  pill(g, `الإزاحة ${ar(total * 1000, 1)} لتر`, L.tankL + TANK_W * PXM - 14, Math.min(y0, y1) - 20, {
    align: "right",
    bg: "rgba(255,255,255,0.95)",
    fg: "#0c447c",
    border: "rgba(43,125,224,0.45)",
    size: 14,
    weight: 700,
  });
}

function drawParticles(g, L, world) {
  g.save();
  for (const p of world.drops) {
    g.fillStyle = rgba(world.liquid.color, Math.min(0.9, p.life));
    g.beginPath();
    g.arc(px(L, p.x), py(L, p.y), p.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.arc(px(L, p.x) - p.r * 0.3, py(L, p.y) - p.r * 0.3, p.r * 0.35, 0, Math.PI * 2);
    g.fill();
  }
  for (const b of world.bubbles) {
    const X = px(L, b.x);
    const Y = py(L, b.y);
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(X, Y, b.r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawConfetti(g, L, world) {
  for (const c of world.confetti) {
    g.save();
    g.translate(px(L, c.x), py(L, c.y));
    g.rotate(c.rot);
    g.globalAlpha = Math.min(1, c.life);
    g.fillStyle = c.color;
    g.fillRect(-c.w * PXM * 0.5, -c.w * PXM * 0.25, c.w * PXM, c.w * PXM * 0.5);
    g.restore();
  }
}

/* ======================= المكوّن ======================= */
const BuoyancyScene = forwardRef(function BuoyancyScene({ mode, liquidKey, customDensity, flags, soundEnabled, onMystery }, ref) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const st = useRef({ world: null, L: null, dpr: 1, hoverKey: null, pointer: null, mystery: null, props: null });
  st.current.props = { mode, flags, soundEnabled, onMystery, liquidKey, customDensity };

  useImperativeHandle(ref, () => ({
    reset() {
      resetScene();
    },
    newMystery() {
      newMystery();
    },
    checkMystery(choice) {
      const s = st.current;
      if (!s.mystery) return { ok: false };
      const ok = choice === s.mystery.key;
      if (ok) {
        s.mystery.revealed = true;
        const b = s.world.bodies.find((x) => x.mystery);
        if (b) {
          b.mystery.revealed = true;
          s.world.celebrate(b.x, b.y + 0.15);
        } else s.world.celebrate(TANK_W / 2, 0.5);
        play("success");
        play("sparkle", { delay: 0.12, volume: 0.7 });
        haptic([20, 30, 40]);
      }
      return { ok, key: s.mystery.key, density: MYSTERY_MATERIALS[s.mystery.key].density };
    },
  }));

  function newMystery() {
    const s = st.current;
    const prev = s.mystery?.key;
    const pool = MYSTERY_ORDER.filter((k) => k !== prev);
    const key = pool[(Math.random() * pool.length) | 0];
    s.mystery = { key, revealed: false };
    s.world.bodies = s.world.bodies.filter((b) => !b.mystery);
    return key;
  }

  function resetScene() {
    const s = st.current;
    if (s.cssW) {
      s.L = computeLayout(s.cssW, s.cssH, s.props.mode);
      s.world.setTankHeight(s.L.innerH / PXM);
    }
    s.world.reset();
    s.world.setLiquid(s.props.liquidKey || "water", s.props.customDensity);
    if (s.props.mode === "mystery") {
      newMystery();
      s.props.onMystery?.({ type: "new" });
    } else {
      s.mystery = null;
      // عرض تعريفي: كتلة خشب تسقط في الماء
      setTimeout(() => {
        if (st.current.world === s.world && s.props.mode === "explore" && s.world.bodies.length === 0) {
          s.world.spawn("wood", TANK_W * 0.5, s.world.tankH + 0.28);
        }
      }, 450);
    }
  }

  /* سائل مخصّص / تبديل السائل */
  useEffect(() => {
    const s = st.current;
    if (!s.world) return;
    s.world.setLiquid(liquidKey, customDensity);
  }, [liquidKey, customDensity]);

  /* تبديل الوضع */
  useEffect(() => {
    const s = st.current;
    if (!s.world) return;
    resetScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const s = st.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const g = canvas.getContext("2d");
    const world = new World();
    s.world = world;
    if (import.meta.env.DEV) window.__bu = s; // أداة تصحيح محلية فقط
    world.setLiquid(liquidKey, customDensity);
    const tex = getTextures();
    let raf = 0;
    let last = performance.now();
    let alive = true;

    function resize() {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      s.dpr = dpr;
      s.cssW = r.width;
      s.cssH = r.height;
      s.L = computeLayout(r.width, r.height, s.props.mode);
      world.setTankHeight(s.L.innerH / PXM);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // بدء تعريفي
    resetScene();

    /* ---------- مؤشر ---------- */
    function toDesign(e) {
      const r = canvas.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * s.cssW;
      const sy = ((e.clientY - r.top) / r.height) * s.cssH;
      return { X: sx / s.L.s, Y: sy / s.L.s };
    }
    const toWorld = (L, X, Y) => ({ x: (X - L.tankL) / PXM, y: (L.floorY - Y) / PXM });

    function hitBody(L, X, Y) {
      for (let i = world.bodies.length - 1; i >= 0; i--) {
        const b = world.bodies[i];
        const bb = bodyBounds(L, b);
        if (X >= bb.x0 - 6 && X <= bb.x1 + 6 && Y >= bb.y0 - 6 && Y <= bb.y1 + 6) return b;
      }
      return null;
    }
    function hitSlot(L, X, Y) {
      const slots = shelfSlots(L, s.props.mode, world);
      for (const sl of slots) {
        const o = sl.key === "mystery" ? { shape: "box", w: MYSTERY_SIZE, h: MYSTERY_SIZE, d: MYSTERY_SIZE } : OBJECTS[sl.key];
        const hh = halfH(o) * PXM * SHELF_SCALE;
        const hw = halfW(o) * PXM * SHELF_SCALE;
        if (Math.abs(X - sl.cx) <= hw + 14 && Y >= sl.base - hh * 2 - 14 && Y <= sl.base + 6) return sl;
      }
      return null;
    }
    const overShelf = (L, X, Y) => X > L.shelf.x - 10 && X < L.shelf.x + L.shelf.w + 10 && Y > L.shelf.y - 14;

    function capture(e) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* مؤشر غير نشط */
      }
    }

    function selectOnly(b) {
      for (const x of world.bodies) x.selected = x === b;
    }

    function onDown(e) {
      const L = s.L;
      const { X, Y } = toDesign(e);
      setMuted(!s.props.soundEnabled);
      preload();
      const b = hitBody(L, X, Y);
      if (b) {
        capture(e);
        const w = toWorld(L, X, Y);
        b.dragging = true;
        b.vx = 0;
        b.vy = 0;
        b.grab = { dx: b.x - w.x, dy: b.y - w.y };
        b.target = { x: b.x, y: b.y };
        b.trail = [];
        b.moved = false;
        b.downX = X;
        b.downY = Y;
        world.bringToFront(b);
        s.drag = b;
        haptic(8);
        return;
      }
      const sl = hitSlot(L, X, Y);
      if (sl) {
        if (s.props.mode === "mystery" && world.bodies.some((x) => x.mystery)) return;
        capture(e);
        const w = toWorld(L, X, Y);
        let nb;
        if (sl.key === "mystery") {
          const m = s.mystery || { key: "wood", revealed: false };
          s.mystery = m;
          nb = world.spawn("mystery", w.x, w.y, {
            spec: { shape: "box", w: MYSTERY_SIZE, h: MYSTERY_SIZE, d: MYSTERY_SIZE },
            density: MYSTERY_MATERIALS[m.key].density,
            mystery: m,
            dragging: true,
            scale: SHELF_SCALE,
          });
        } else {
          nb = world.spawn(sl.key, w.x, w.y, { dragging: true, scale: SHELF_SCALE });
        }
        // حدّ أقصى للأجسام
        const free = world.bodies.filter((x) => x !== nb && !x.dragging);
        while (world.bodies.length > MAX_BODIES && free.length) world.remove(free.shift());
        nb.grab = { dx: 0, dy: 0 };
        nb.target = { x: w.x, y: w.y };
        nb.trail = [];
        nb.moved = true;
        nb.fromShelf = true;
        s.drag = nb;
        selectOnly(nb);
        haptic(10);
        play("grab", { volume: 0.9 });
        return;
      }
      selectOnly(null);
    }

    function onMove(e) {
      const L = s.L;
      const { X, Y } = toDesign(e);
      s.pointer = { X, Y };
      if (s.drag) {
        const w = toWorld(L, X, Y);
        const b = s.drag;
        b.target = { x: w.x + b.grab.dx, y: w.y + b.grab.dy };
        if (Math.hypot(X - (b.downX ?? X), Y - (b.downY ?? Y)) > 6) b.moved = true;
        canvas.style.cursor = "grabbing";
        return;
      }
      const sl = hitSlot(L, X, Y);
      s.hoverKey = sl ? sl.key : null;
      canvas.style.cursor = hitBody(L, X, Y) || sl ? "grab" : "default";
    }

    function onUp(e) {
      const L = s.L;
      const b = s.drag;
      s.drag = null;
      canvas.style.cursor = "default";
      if (!b) return;
      const { X, Y } = toDesign(e);
      b.dragging = false;
      b.downX = undefined;
      b.downY = undefined;
      // سرعة الإفلات من آخر عيّنات
      const tr = b.trail;
      if (tr.length >= 2) {
        const a = tr[0];
        const z = tr[tr.length - 1];
        const dt = Math.max(0.016, (z.t - a.t) / 1000);
        b.vx = Math.max(-3, Math.min(3, (z.x - a.x) / dt));
        b.vy = Math.max(-3, Math.min(3, (z.y - a.y) / dt));
      }
      b.scale = Math.max(b.scale, 0.8);
      // إرجاع إلى الرف
      if (overShelf(L, X, Y)) {
        world.remove(b);
        if (b.mystery) {
          /* يبقى الجسم الغامض بحالته */
        }
        haptic(6);
        play("whoosh", { volume: 0.8 });
        return;
      }
      if (!b.moved && !b.fromShelf) {
        // نقرة: تحديد/إلغاء تحديد
        const was = b.selected;
        selectOnly(was ? null : b);
        play("tick");
      } else {
        selectOnly(b);
      }
      b.fromShelf = false;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", () => (s.hoverKey = null));

    /* ---------- الحلقة ---------- */
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = s.L;

      // سحب: انسياب نحو الهدف
      for (const b of world.bodies) {
        if (b.dragging && b.target) {
          const k = Math.min(1, dt * 22);
          b.x += (b.target.x - b.x) * k;
          b.y += (b.target.y - b.y) * k;
          b.scale += (1 - b.scale) * Math.min(1, dt * 10);
          b.trail.push({ x: b.target.x, y: b.target.y, t: now });
          if (b.trail.length > 6) b.trail.shift();
        } else if (b.scale < 1) {
          b.scale += (1 - b.scale) * Math.min(1, dt * 12);
          if (b.scale > 0.995) b.scale = 1;
        }
      }

      world.step(dt);
      world.ambient(dt);
      for (const ev of world.drainEvents()) {
        if (!s.props.soundEnabled) continue;
        if (ev.type === "splash") {
          const heavy = ev.mass > 3 || ev.power > 0.7;
          const name = heavy ? "splash_big" : ev.power > 0.35 ? "splash_med" : "splash_small";
          const rate = 1.1 - Math.min(0.3, ev.mass * 0.035);
          play(name, { volume: 0.45 + ev.power * 0.55, rate, throttle: 60 });
          if (ev.power > 0.3) play("drop", { delay: 0.12, volume: 0.6 });
          if (ev.power > 0.45) play("bubble", { delay: 0.2, volume: 0.5 });
          haptic(10 + Math.round(ev.power * 14));
        } else if (ev.type === "thud") {
          const map = { plastic: "hit_wood", mystery: "hit_wood" };
          const sound = `hit_${map[ev.key] || ev.key}`;
          play(sound, { volume: 0.4 + ev.power * 0.6, rate: ev.key === "plastic" ? 1.25 : 1 });
        } else if (ev.type === "spill") play("pour", { volume: 0.7 });
      }
      if (Math.random() < dt * 0.5 && world.bodies.some((b) => b.sub.v > 0 && Math.abs(b.vy) > 0.2)) play("bubble", { volume: 0.35, throttle: 300 });

      // ---- رسم ----
      const { dpr } = s;
      UI_S = L.s;
      g.setTransform(dpr * L.s, 0, 0, dpr * L.s, 0, 0);
      g.clearRect(0, 0, L.dW, L.dH);
      const time = now / 1000;
      drawBackground(g, L, time);
      drawTable(g, L, tex.wood);
      const spawned = s.props.mode === "mystery" && world.bodies.some((b) => b.mystery);
      drawShelf(g, L, s.props.mode, world, tex, s.hoverKey, spawned);

      // خلفية الخزان (جدار خلفي شفاف)
      const W = TANK_W * PXM;
      const top = L.floorY - world.tankH * PXM;
      const back = g.createLinearGradient(0, top, 0, L.floorY);
      back.addColorStop(0, "rgba(255,255,255,0.34)");
      back.addColorStop(1, "rgba(220,242,244,0.22)");
      g.fillStyle = back;
      g.fillRect(L.tankL, top, W, L.floorY - top);

      // الأجسام ثم الماء فوقها (فيظهر الجزء المغمور بلون السائل)
      for (const b of world.bodies) {
        drawShadow(g, L, b);
        drawBody(g, L, b, tex);
      }
      drawWater(g, L, world, time);
      drawTankGlass(g, L, world);
      if (s.props.flags.ruler) drawRuler(g, L, world);
      if (s.props.flags.displacement) drawDisplacement(g, L, world);
      if (s.props.flags.forces) drawForces(g, L, world, s.props.flags);
      drawParticles(g, L, world);
      drawTags(g, L, world);
      drawConfetti(g, L, world);

      // منطقة الإرجاع إلى الرف أثناء السحب
      if (s.drag && s.pointer && overShelf(L, s.pointer.X, s.pointer.Y)) {
        const sh = L.shelf;
        g.fillStyle = "rgba(214,69,69,0.22)";
        g.fillRect(sh.x - 10, sh.y - 14, sh.w + 24, sh.h + 14);
        pill(g, "أفلت لإرجاعه", sh.x + sh.w / 2, sh.y + sh.h / 2, { bg: "#d64545", fg: "#fff", weight: 700, size: 16 });
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="bu-canvas-wrap">
      <canvas ref={canvasRef} className="bu-canvas" />
    </div>
  );
});

export default BuoyancyScene;
