/**
 * PhLab.jsx — مختبر الأس الهيدروجيني على Canvas 2D (نفس روح مختبر الطفو):
 * جدار بلاط، طاولة خشبية، دورق مُدرَّج بزجاج وسائل حقيقي، حنفية، ستاند مع
 * قطّارة، مقياس pH رقمي بمسبار، جرّة تصريف تتجمّع فيها السوائل المصرَّفة،
 * ورفّ فيه ١٢ قارورة سوائل يومية تُختار باللمس. الضغط المطوّل على الحنفية
 * أو القطّارة أو صمام التصريف يشغّل التدفّق (المنطق في PhApp).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getTextures } from "../buoyancy/textures.js";
import { SOLUTIONS, SOLUTION_ORDER } from "./phData.js";
import { phColorRGB, universalGradientCSS } from "./phColor.js";
import { MAX_VOLUME, formatAr } from "./phModel.js";

const FONT = "'IBM Plex Sans Arabic', sans-serif";
const EMOJI_FONT = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
let UI_S = 1;
const fsz = (n) => Math.max(n, 11.5 / UI_S);
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// أبعاد التصميم (design px)
const BEAKER_W = 230;
const BEAKER_H = 270;
const RISER_H = 30;
const JAR_W = 150;
const JAR_H = 170;
const JAR_CAP = 3.0; // لتر (سعة الجرّة المعروضة)

/* ======================= التخطيط ======================= */
function computeLayout(W, H) {
  const s = Math.max(0.3, Math.min(W / 1280, H / 700));
  const dW = W / s;
  const dH = H / s;
  const benchY = dH - 140;
  const bx = Math.max(580, dW * 0.46);
  const y0 = benchY - RISER_H; // قاعدة الدورق
  const shelfX = Math.max(bx + 215, dW - 500);
  const shelfW = Math.min(470, dW - 24 - shelfX);
  const shelfTop = Math.max(84, y0 - BEAKER_H - 120);
  return {
    s,
    dW,
    dH,
    benchY,
    bx,
    y0,
    top: y0 - BEAKER_H,
    jarX: bx - 345,
    jarBase: benchY,
    tapBaseX: bx - 235,
    standX: bx + 175,
    spoutX: bx - 105,
    shelf: { x: shelfX, y: shelfTop, w: shelfW, rows: 3, cols: 4, rowH: (benchY - 150 - shelfTop) / 3 },
    chart: { x: 70, y1: 110, y2: benchY - 215 },
    meter: { x: bx + 262, y: benchY - 128, w: 196, h: 118 },
    maker: { x: bx + 262 + 196 + 18, y: benchY - 128, w: 192, h: 118 },
  };
}

/* ======================= طبقة ثابتة (تُرسَم مرة) ======================= */
function buildStatic(L, dpr, tex) {
  const c = document.createElement("canvas");
  c.width = Math.round(L.dW * L.s * dpr);
  c.height = Math.round(L.dH * L.s * dpr);
  const g = c.getContext("2d");
  g.setTransform(dpr * L.s, 0, 0, dpr * L.s, 0, 0);
  const { dW, dH, benchY } = L;

  // --- الجدار: بلاط أبيض ---
  const wall = g.createLinearGradient(0, 0, 0, benchY);
  wall.addColorStop(0, "#f4f8f6");
  wall.addColorStop(1, "#e4ece9");
  g.fillStyle = wall;
  g.fillRect(0, 0, dW, benchY + 4);
  const tile = document.createElement("canvas");
  tile.width = 96;
  tile.height = 48;
  const t = tile.getContext("2d");
  const tg = t.createLinearGradient(0, 0, 96, 48);
  tg.addColorStop(0, "rgba(255,255,255,0.55)");
  tg.addColorStop(1, "rgba(190,210,206,0.25)");
  t.fillStyle = tg;
  t.fillRect(0, 0, 96, 48);
  t.strokeStyle = "rgba(110,140,134,0.28)";
  t.lineWidth = 2;
  t.strokeRect(0, 0, 96, 48);
  t.fillStyle = "rgba(255,255,255,0.5)";
  t.fillRect(3, 3, 90, 2);
  g.fillStyle = g.createPattern(tile, "repeat");
  g.fillRect(0, 0, dW, benchY);
  // شعاع ضوء من نافذة
  const beam = g.createLinearGradient(dW * 0.1, 0, dW * 0.55, benchY);
  beam.addColorStop(0, "rgba(255,255,235,0.5)");
  beam.addColorStop(1, "rgba(255,255,235,0)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(dW * 0.05, 0);
  g.lineTo(dW * 0.26, 0);
  g.lineTo(dW * 0.7, benchY);
  g.lineTo(dW * 0.38, benchY);
  g.closePath();
  g.fill();
  // شريط حماية أسفل الجدار
  g.fillStyle = "rgba(60,90,90,0.18)";
  g.fillRect(0, benchY - 6, dW, 6);

  // --- الطاولة والخزانة ---
  const woodPat = g.createPattern(tex.wood.front, "repeat");
  const top = g.createLinearGradient(0, benchY, 0, benchY + 24);
  top.addColorStop(0, "#e1b67f");
  top.addColorStop(1, "#b8854e");
  g.fillStyle = top;
  g.fillRect(0, benchY, dW, 24);
  g.save();
  g.globalAlpha = 0.28;
  g.fillStyle = woodPat;
  g.fillRect(0, benchY, dW, 24);
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(0, benchY, dW, 2);
  // واجهة الخزانة
  const cab = g.createLinearGradient(0, benchY + 24, 0, dH);
  cab.addColorStop(0, "#8d5e33");
  cab.addColorStop(1, "#6a4526");
  g.fillStyle = cab;
  g.fillRect(0, benchY + 24, dW, dH - benchY);
  g.save();
  g.globalAlpha = 0.2;
  g.fillStyle = woodPat;
  g.fillRect(0, benchY + 24, dW, dH - benchY);
  g.restore();
  const doorW = 230;
  for (let x = 10; x < dW; x += doorW) {
    g.strokeStyle = "rgba(30,16,6,0.45)";
    g.lineWidth = 2;
    g.strokeRect(x + 6, benchY + 36, doorW - 12, dH - benchY - 48);
    g.strokeStyle = "rgba(255,225,180,0.18)";
    g.strokeRect(x + 9, benchY + 39, doorW - 18, dH - benchY - 54);
    g.fillStyle = "#cfd5d8";
    g.beginPath();
    g.roundRect(x + doorW - 40, benchY + 50, 8, 40, 4);
    g.fill();
  }

  // --- قاعدة الدورق (قطعة خشب) ---
  const rx = L.bx - BEAKER_W / 2 - 22;
  const rw = BEAKER_W + 44;
  const rg = g.createLinearGradient(0, L.y0, 0, benchY);
  rg.addColorStop(0, "#d7a86f");
  rg.addColorStop(1, "#a97943");
  g.fillStyle = rg;
  g.beginPath();
  g.roundRect(rx, L.y0, rw, RISER_H + 2, 4);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(rx, benchY - 3, rw, 5);

  // --- ستاند القطّارة (قاعدة + ساق) ---
  const sx = L.standX;
  const baseG = g.createLinearGradient(0, benchY - 12, 0, benchY);
  baseG.addColorStop(0, "#5c666c");
  baseG.addColorStop(1, "#30383c");
  g.fillStyle = baseG;
  g.beginPath();
  g.roundRect(sx - 52, benchY - 12, 104, 12, 4);
  g.fill();
  const rodTop = L.top - 150;
  const rodG = g.createLinearGradient(sx - 5, 0, sx + 5, 0);
  rodG.addColorStop(0, "#9aa6ad");
  rodG.addColorStop(0.45, "#e9eef1");
  rodG.addColorStop(1, "#6f7b82");
  g.fillStyle = rodG;
  g.fillRect(sx - 5, rodTop, 10, benchY - rodTop - 10);

  // --- أنبوب الحنفية (جسم ثابت) ---
  const tx = L.tapBaseX;
  const spoutY = L.top - 70;
  g.lineCap = "round";
  g.lineJoin = "round";
  const pipe = (w, col) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(tx, benchY);
    g.lineTo(tx, spoutY + 70);
    g.quadraticCurveTo(tx, spoutY, tx + 70, spoutY);
    g.lineTo(L.spoutX - 10, spoutY);
    g.quadraticCurveTo(L.spoutX + 6, spoutY, L.spoutX + 6, spoutY + 16);
    g.stroke();
  };
  pipe(26, "#6f7a80");
  pipe(20, "#c7d0d5");
  pipe(8, "#f4f8fa");
  g.fillStyle = "#4f595f";
  g.beginPath();
  g.roundRect(tx - 28, benchY - 16, 56, 16, 5);
  g.fill();

  // --- الرف: هيكل خشبي ---
  const sh = L.shelf;
  const sw = sh.w;
  const sy = sh.y;
  const shH = sh.rowH * sh.rows;
  const back = g.createLinearGradient(sh.x, sy, sh.x + sw, sy + shH);
  back.addColorStop(0, "#7d5530");
  back.addColorStop(1, "#5e3f22");
  g.fillStyle = back;
  g.fillRect(sh.x, sy, sw, shH);
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(sh.x, sy, sw, 12);
  const sideG = g.createLinearGradient(0, sy, 0, sy + shH);
  sideG.addColorStop(0, "#b98550");
  sideG.addColorStop(1, "#8f6238");
  g.fillStyle = sideG;
  g.fillRect(sh.x - 12, sy - 10, 14, shH + 18);
  g.fillRect(sh.x + sw - 2, sy - 10, 14, shH + 18);
  g.fillRect(sh.x - 12, sy - 16, sw + 26, 14);
  for (let r = 0; r < sh.rows; r++) {
    const by = sy + (r + 1) * sh.rowH;
    const bg = g.createLinearGradient(0, by, 0, by + 12);
    bg.addColorStop(0, "#d6a56c");
    bg.addColorStop(1, "#a3733f");
    g.fillStyle = bg;
    g.fillRect(sh.x - 8, by, sw + 16, 12);
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(sh.x - 8, by, sw + 16, 2);
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.fillRect(sh.x, by + 12, sw, 8);
  }

  // --- مخطّط ألوان الكاشف على الجدار ---
  const ch = L.chart;
  const cw = 46;
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.beginPath();
  g.roundRect(ch.x - 16, ch.y1 - 40, cw + 112, ch.y2 - ch.y1 + 66, 16);
  g.fill();
  g.strokeStyle = "rgba(60,100,100,0.25)";
  g.lineWidth = 1.5;
  g.stroke();
  const gr = g.createLinearGradient(0, ch.y2, 0, ch.y1);
  [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14].forEach((p) => {
    const c2 = phColorRGB(p);
    gr.addColorStop(p / 14, `rgb(${c2[0]},${c2[1]},${c2[2]})`);
  });
  g.fillStyle = gr;
  g.beginPath();
  g.roundRect(ch.x, ch.y1, cw, ch.y2 - ch.y1, 8);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.stroke();
  g.fillStyle = "#33463f";
  g.font = `600 ${fsz(13)}px ${FONT}`;
  g.textAlign = "left";
  for (let p = 0; p <= 14; p += 2) {
    const y = ch.y2 - (p / 14) * (ch.y2 - ch.y1);
    g.fillRect(ch.x + cw, y - 0.8, 7, 1.6);
    g.fillText(formatAr(p, 0), ch.x + cw + 12, y + 4);
  }
  g.save();
  g.translate(ch.x + 22, (ch.y1 + ch.y2) / 2);
  g.rotate(-Math.PI / 2);
  g.textAlign = "center";
  g.font = `700 ${fsz(13)}px ${FONT}`;
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.fillText("قاعدي ←  تعادل  → حمضي", 0, 4);
  g.restore();
  g.fillStyle = "#33463f";
  g.font = `700 ${fsz(14)}px ${FONT}`;
  g.textAlign = "center";
  g.fillText("pH", ch.x + cw / 2, ch.y1 - 14);

  return c;
}

/* ======================= رسم الزجاجيات ======================= */
function glassBeaker(g, L, liquid, level, time, st) {
  const { bx, y0 } = L;
  const x0 = bx - BEAKER_W / 2;
  const x1 = bx + BEAKER_W / 2;
  const top = y0 - BEAKER_H;

  // ظل وانعكاس لون السائل على الطاولة
  g.fillStyle = "rgba(20,14,8,0.22)";
  g.beginPath();
  g.ellipse(bx + 6, L.benchY - 1, BEAKER_W / 2 + 18, 7, 0, 0, Math.PI * 2);
  g.fill();

  // الجسم الخلفي
  g.save();
  g.beginPath();
  g.roundRect(x0, top, BEAKER_W, BEAKER_H, [3, 3, 12, 12]);
  const back = g.createLinearGradient(x0, 0, x1, 0);
  back.addColorStop(0, "rgba(210,236,240,0.34)");
  back.addColorStop(0.5, "rgba(235,250,252,0.12)");
  back.addColorStop(1, "rgba(180,214,222,0.36)");
  g.fillStyle = back;
  g.fill();
  g.clip();

  // السائل
  if (level > 0.5) {
    const surfY = y0 - level;
    const col = liquid.rgb;
    const a = liquid.a;
    g.beginPath();
    g.moveTo(x0 - 2, y0 + 2);
    for (let x = x0 - 2; x <= x1 + 2; x += 6) {
      const w = Math.sin(x * 0.045 + time * 2.2) * (0.9 + st.amp * 3.2) + Math.sin(x * 0.11 - time * 3.1) * st.amp * 2;
      g.lineTo(x, surfY + w);
    }
    g.lineTo(x1 + 2, y0 + 2);
    g.closePath();
    const lg = g.createLinearGradient(0, surfY, 0, y0);
    lg.addColorStop(0, rgba(col, a * 0.82));
    lg.addColorStop(0.6, rgba(col, a));
    lg.addColorStop(1, rgba(col.map((v) => v * 0.72), Math.min(1, a + 0.05)));
    g.fillStyle = lg;
    g.fill();
    // سطح لامع + حواف التقعّر (meniscus)
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2.2;
    g.beginPath();
    for (let x = x0; x <= x1; x += 6) {
      const w = Math.sin(x * 0.045 + time * 2.2) * (0.9 + st.amp * 3.2) + Math.sin(x * 0.11 - time * 3.1) * st.amp * 2;
      if (x === x0) g.moveTo(x, surfY + w);
      else g.lineTo(x, surfY + w);
    }
    g.stroke();
    g.fillStyle = rgba(col.map((v) => v * 0.6), 0.55);
    g.fillRect(x0, surfY - 1, 6, 5);
    g.fillRect(x1 - 6, surfY - 1, 6, 5);
    // لمعة داخل السائل
    const sh = g.createLinearGradient(x0, 0, x1, 0);
    sh.addColorStop(0.08, "rgba(255,255,255,0.3)");
    sh.addColorStop(0.18, "rgba(255,255,255,0)");
    sh.addColorStop(0.82, "rgba(255,255,255,0)");
    sh.addColorStop(0.92, "rgba(255,255,255,0.16)");
    g.fillStyle = sh;
    g.fillRect(x0, surfY, BEAKER_W, y0 - surfY);
    // فقاعات
    for (const b of st.bubbles) {
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
  g.restore();

  // القاع السميك للزجاج
  const base = g.createLinearGradient(0, y0 - 14, 0, y0);
  base.addColorStop(0, "rgba(255,255,255,0.0)");
  base.addColorStop(1, "rgba(220,244,246,0.5)");
  g.fillStyle = base;
  g.beginPath();
  g.roundRect(x0, y0 - 14, BEAKER_W, 14, [0, 0, 12, 12]);
  g.fill();

  // حواف الزجاج
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 2.5;
  g.beginPath();
  g.roundRect(x0, top, BEAKER_W, BEAKER_H, [3, 3, 12, 12]);
  g.stroke();
  g.strokeStyle = "rgba(70,120,130,0.45)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.roundRect(x0 - 1.5, top - 1.5, BEAKER_W + 3, BEAKER_H + 3, [3, 3, 13, 13]);
  g.stroke();
  // شفة الدورق
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.fillRect(x0 - 5, top - 4, BEAKER_W + 10, 7);
  g.strokeStyle = "rgba(70,120,130,0.5)";
  g.lineWidth = 1.2;
  g.strokeRect(x0 - 5, top - 4, BEAKER_W + 10, 7);
  // انعكاس طولي
  const refl = g.createLinearGradient(x0, 0, x0 + 40, 0);
  refl.addColorStop(0, "rgba(255,255,255,0.5)");
  refl.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = refl;
  g.fillRect(x0 + 8, top + 14, 30, BEAKER_H - 40);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(x1 - 22, top + 20, 8, BEAKER_H - 50);

  // تدريج الدورق (لتر)
  g.fillStyle = "rgba(30,60,60,0.85)";
  g.strokeStyle = "rgba(30,60,60,0.7)";
  g.font = `600 ${fsz(13)}px ${FONT}`;
  g.textAlign = "left";
  g.lineWidth = 1.4;
  for (let v = 0.1; v < MAX_VOLUME - 0.001; v += 0.1) {
    const y = y0 - (v / MAX_VOLUME) * BEAKER_H;
    const major = Math.round(v * 10) % 2 === 0;
    g.beginPath();
    g.moveTo(x1 - 4, y);
    g.lineTo(x1 - (major ? 30 : 16), y);
    g.stroke();
    if (major) g.fillText(formatAr(v, 1), x1 - 70, y + 4);
  }
  g.font = `700 ${fsz(12)}px ${FONT}`;
  g.fillText("لتر", x1 - 70, top + 18);
}

function drawJar(g, L, waste, time) {
  const x0 = L.jarX - JAR_W / 2;
  const x1 = L.jarX + JAR_W / 2;
  const y1 = L.jarBase;
  const top = y1 - JAR_H;
  g.fillStyle = "rgba(20,14,8,0.2)";
  g.beginPath();
  g.ellipse(L.jarX + 4, y1 - 1, JAR_W / 2 + 12, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.roundRect(x0, top, JAR_W, JAR_H, [4, 4, 10, 10]);
  g.fillStyle = "rgba(220,240,244,0.22)";
  g.fill();
  g.clip();
  const lvl = clamp(waste.vol / JAR_CAP, 0, 0.96) * (JAR_H - 8);
  if (lvl > 0.5) {
    const surf = y1 - lvl;
    g.beginPath();
    g.moveTo(x0, y1);
    for (let x = x0; x <= x1; x += 6) g.lineTo(x, surf + Math.sin(x * 0.07 + time * 2) * (0.8 + waste.amp * 3));
    g.lineTo(x1, y1);
    g.closePath();
    const lg = g.createLinearGradient(0, surf, 0, y1);
    lg.addColorStop(0, rgba(waste.rgb, waste.a * 0.8));
    lg.addColorStop(1, rgba(waste.rgb.map((v) => v * 0.7), Math.min(1, waste.a + 0.1)));
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.65)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, surf);
    for (let x = x0; x <= x1; x += 6) g.lineTo(x, surf + Math.sin(x * 0.07 + time * 2) * (0.8 + waste.amp * 3));
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 2.5;
  g.beginPath();
  g.roundRect(x0, top, JAR_W, JAR_H, [4, 4, 10, 10]);
  g.stroke();
  g.strokeStyle = "rgba(70,120,130,0.45)";
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(x0 + 8, top + 10, 18, JAR_H - 30);
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.fillRect(x0 - 4, top - 4, JAR_W + 8, 7);
  g.font = `600 ${fsz(12)}px ${FONT}`;
  g.fillStyle = "rgba(40,70,70,0.8)";
  g.textAlign = "center";
  g.fillText("نفايات", L.jarX, y1 + 36);
}

/* ======================= الأدوات ======================= */
function drawDropper(g, L, active, solRGB, level, bulbSq) {
  const sx = L.standX;
  const tipY = L.top - 12;
  const px = L.bx + 56;
  const tubeH = 108;
  const bulbH = 48;
  const armY = tipY - tubeH - bulbH - 4;
  // ذراع المشبك
  const rodG = g.createLinearGradient(0, armY - 4, 0, armY + 4);
  rodG.addColorStop(0, "#e9eef1");
  rodG.addColorStop(1, "#7f8b92");
  g.fillStyle = rodG;
  g.fillRect(px, armY - 4, sx - px + 5, 8);
  g.fillStyle = "#3d474c";
  g.beginPath();
  g.roundRect(sx - 12, armY - 12, 24, 24, 5);
  g.fill();
  // الأنبوب الزجاجي
  g.save();
  g.translate(px, 0);
  const tg = g.createLinearGradient(-9, 0, 9, 0);
  tg.addColorStop(0, "rgba(200,225,232,0.8)");
  tg.addColorStop(0.35, "rgba(255,255,255,0.7)");
  tg.addColorStop(1, "rgba(150,190,200,0.75)");
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(-9, tipY - tubeH);
  g.lineTo(9, tipY - tubeH);
  g.lineTo(9, tipY - 22);
  g.lineTo(3, tipY);
  g.lineTo(-3, tipY);
  g.lineTo(-9, tipY - 22);
  g.closePath();
  g.fill();
  // سائل داخل الأنبوب
  g.fillStyle = rgba(solRGB, 0.9);
  g.beginPath();
  g.moveTo(-7, tipY - 62);
  g.lineTo(7, tipY - 62);
  g.lineTo(7, tipY - 22);
  g.lineTo(2.2, tipY - 1);
  g.lineTo(-2.2, tipY - 1);
  g.lineTo(-7, tipY - 22);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(70,120,130,0.6)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-9, tipY - tubeH);
  g.lineTo(-9, tipY - 22);
  g.lineTo(-3, tipY);
  g.lineTo(3, tipY);
  g.lineTo(9, tipY - 22);
  g.lineTo(9, tipY - tubeH);
  g.stroke();
  // البصلة المطاطية (تنضغط عند الضغط)
  const sq = bulbSq;
  const bw = 34 + sq * 4;
  const bh = bulbH - sq * 8;
  const by = tipY - tubeH - bh + 6;
  const bg = g.createRadialGradient(-bw * 0.25, by + bh * 0.3, 2, 0, by + bh * 0.55, bw);
  bg.addColorStop(0, "#5a5f66");
  bg.addColorStop(0.5, "#23272b");
  bg.addColorStop(1, "#0d0f11");
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(-12, tipY - tubeH + 4);
  g.bezierCurveTo(-bw, by + bh * 0.6, -bw * 0.7, by, 0, by);
  g.bezierCurveTo(bw * 0.7, by, bw, by + bh * 0.6, 12, tipY - tubeH + 4);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.ellipse(-bw * 0.3, by + bh * 0.3, 4, 9, -0.4, 0, Math.PI * 2);
  g.fill();
  if (active) {
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.arc(0, by + bh * 0.5, bw * 0.9, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  g.restore();
  void level;
  return { x: px, tipY, hit: { x0: px - 36, x1: px + 36, y0: by - 14, y1: tipY + 6 } };
}

function drawTapHandle(g, L, on, hover) {
  const x = L.tapBaseX;
  const y = L.benchY - 118;
  g.save();
  g.translate(x, y);
  // جذع المقبض
  g.fillStyle = "#4f595f";
  g.beginPath();
  g.roundRect(-7, -10, 14, 22, 4);
  g.fill();
  g.rotate(on ? -0.5 : 0.1);
  const hg = g.createLinearGradient(0, -8, 0, 8);
  hg.addColorStop(0, "#5fb3ee");
  hg.addColorStop(1, "#1f6fb5");
  g.fillStyle = hg;
  g.beginPath();
  g.roundRect(-34, -8, 68, 16, 8);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(-28, -6, 56, 3);
  g.strokeStyle = on || hover ? "rgba(255,255,255,0.9)" : "rgba(20,60,100,0.5)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.roundRect(-34, -8, 68, 16, 8);
  g.stroke();
  g.restore();
  return { x, y, r: 52 };
}

function drawStopcock(g, L, on, hover) {
  const x0 = L.bx - BEAKER_W / 2;
  const y = L.y0 - 22;
  // فوّهة التصريف
  const tg = g.createLinearGradient(0, y - 8, 0, y + 8);
  tg.addColorStop(0, "#e9eef1");
  tg.addColorStop(1, "#7f8b92");
  g.fillStyle = tg;
  g.beginPath();
  g.roundRect(x0 - 54, y - 8, 56, 16, 5);
  g.fill();
  g.fillStyle = "#3d474c";
  g.fillRect(x0 - 56, y - 6, 6, 12);
  // مقبض أصفر
  g.save();
  g.translate(x0 - 22, y - 12);
  g.rotate(on ? 0.9 : 0);
  g.fillStyle = "#f2b630";
  g.beginPath();
  g.roundRect(-5, -30, 10, 32, 5);
  g.fill();
  g.fillStyle = "#d9962b";
  g.beginPath();
  g.arc(0, -30, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.beginPath();
  g.arc(-3, -33, 3.5, 0, Math.PI * 2);
  g.fill();
  if (on || hover) {
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -30, 13, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  return { x: x0 - 22, y: y - 34, r: 44, spoutX: x0 - 50, spoutY: y + 8 };
}

function drawMeter(g, L, pH, empty, time, tone) {
  const m = L.meter;
  // الجسم
  g.fillStyle = "rgba(20,14,8,0.22)";
  g.beginPath();
  g.ellipse(m.x + m.w / 2, L.benchY - 1, m.w / 2 + 10, 6, 0, 0, Math.PI * 2);
  g.fill();
  const body = g.createLinearGradient(0, m.y, 0, m.y + m.h);
  body.addColorStop(0, "#f2f5f6");
  body.addColorStop(1, "#c3cbcf");
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(m.x, m.y, m.w, m.h, 14);
  g.fill();
  g.strokeStyle = "rgba(60,80,90,0.5)";
  g.lineWidth = 1.5;
  g.stroke();
  // الشاشة
  const col = phColorRGB(pH);
  const lx = m.x + 12;
  const ly = m.y + 12;
  const lw = m.w - 24;
  const lh = 62;
  const lcd = g.createLinearGradient(0, ly, 0, ly + lh);
  const base = empty ? [168, 186, 178] : col.map((v) => v * 0.55 + 70);
  lcd.addColorStop(0, rgba(base.map((v) => Math.min(255, v + 25)), 1));
  lcd.addColorStop(1, rgba(base, 1));
  g.fillStyle = lcd;
  g.beginPath();
  g.roundRect(lx, ly, lw, lh, 8);
  g.fill();
  g.strokeStyle = "rgba(20,40,40,0.65)";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "rgba(10,20,20,0.88)";
  g.textAlign = "center";
  g.font = `700 ${fsz(38)}px ${FONT}`;
  g.fillText(empty ? "- - -" : formatAr(pH, 2), lx + lw / 2 + 6, ly + 44);
  g.font = `700 ${fsz(14)}px ${FONT}`;
  g.textAlign = "left";
  g.fillText("pH", lx + 8, ly + 18);
  if (tone && !empty) {
    g.font = `700 ${fsz(13)}px ${FONT}`;
    g.fillStyle = "rgba(10,20,20,0.85)";
    g.textAlign = "right";
    g.fillText(tone, lx + lw - 6, ly + 18);
  }
  // أزرار شكلية
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i === 0 ? "#2f8f56" : "#7d8a90";
    g.beginPath();
    g.arc(m.x + 28 + i * 26, m.y + m.h - 18, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(40,60,60,0.8)";
  g.font = `600 ${fsz(11)}px ${FONT}`;
  g.textAlign = "right";
  g.fillText("مقياس الحموضة", m.x + m.w - 14, m.y + m.h - 14);
  void time;
}

function drawProbe(g, L, level) {
  const m = L.meter;
  const px = L.bx - BEAKER_W / 2 + 40;
  const topY = L.top - 34;
  const botY = L.y0 - 30;
  // الكبل من الجهاز إلى المسبار
  g.strokeStyle = "#1f2528";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(m.x + 30, m.y);
  g.bezierCurveTo(m.x + 30, L.top - 120, px + 120, L.top - 120, px + 2, topY);
  g.stroke();
  // جسم المسبار
  const pg = g.createLinearGradient(px - 6, 0, px + 6, 0);
  pg.addColorStop(0, "#2d3438");
  pg.addColorStop(0.4, "#6c777c");
  pg.addColorStop(1, "#1d2326");
  g.fillStyle = pg;
  g.beginPath();
  g.roundRect(px - 6, topY, 12, 56, 4);
  g.fill();
  // الطرف الزجاجي
  g.fillStyle = "rgba(210,235,240,0.9)";
  g.beginPath();
  g.roundRect(px - 3.5, topY + 54, 7, botY - topY - 54, 3.5);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.fillRect(px - 2, topY + 56, 1.6, botY - topY - 60);
  g.fillStyle = "#e8b04a";
  g.beginPath();
  g.ellipse(px, botY, 6, 8, 0, 0, Math.PI * 2);
  g.fill();
  void level;
}

/* ======================= جهاز "محلول مخصّص" ======================= */
const KNOB_A0 = (-225 * Math.PI) / 180; // pH 0
const KNOB_A1 = (45 * Math.PI) / 180; // pH 14

function makerGeom(L) {
  const m = L.maker;
  return { m, kx: m.x + 66, ky: m.y + 62, kr: 38, lx: m.x + m.w - 34, ly0: m.y + 18, ly1: m.y + m.h - 18 };
}

function drawMaker(g, L, active, pH, vol, hover) {
  const { m, kx, ky, kr, lx, ly0, ly1 } = makerGeom(L);
  g.fillStyle = "rgba(20,14,8,0.22)";
  g.beginPath();
  g.ellipse(m.x + m.w / 2, L.benchY - 1, m.w / 2 + 10, 6, 0, 0, Math.PI * 2);
  g.fill();
  const body = g.createLinearGradient(0, m.y, 0, m.y + m.h);
  body.addColorStop(0, "#38444a");
  body.addColorStop(1, "#1e282d");
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(m.x, m.y, m.w, m.h, 14);
  g.fill();
  g.strokeStyle = active || hover ? "rgba(255,255,255,0.85)" : "rgba(10,20,24,0.8)";
  g.lineWidth = active || hover ? 2.5 : 1.5;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.1)";
  g.fillRect(m.x + 8, m.y + 3, m.w - 16, 2);

  const steps = 56;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const a0 = KNOB_A0 + (KNOB_A1 - KNOB_A0) * t0;
    const a1 = KNOB_A0 + (KNOB_A1 - KNOB_A0) * ((i + 1) / steps);
    const c = phColorRGB(t0 * 14);
    g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(kx, ky, kr + 8, a0, a1 + 0.02);
    g.stroke();
  }
  const kg = g.createRadialGradient(kx - 10, ky - 12, 4, kx, ky, kr);
  kg.addColorStop(0, "#9aa6ad");
  kg.addColorStop(0.55, "#4d585e");
  kg.addColorStop(1, "#1f272b");
  g.fillStyle = kg;
  g.beginPath();
  g.arc(kx, ky, kr, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 1.5;
  g.stroke();
  const ang = KNOB_A0 + (KNOB_A1 - KNOB_A0) * (clamp(pH, 0, 14) / 14);
  g.strokeStyle = "#f6f8f9";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(kx + Math.cos(ang) * 10, ky + Math.sin(ang) * 10);
  g.lineTo(kx + Math.cos(ang) * (kr - 6), ky + Math.sin(ang) * (kr - 6));
  g.stroke();

  g.fillStyle = "#0f1518";
  g.beginPath();
  g.roundRect(lx - 4, ly0, 8, ly1 - ly0, 4);
  g.fill();
  const hy = ly1 - (clamp(vol, 0, MAX_VOLUME) / MAX_VOLUME) * (ly1 - ly0);
  const hg = g.createLinearGradient(lx - 14, 0, lx + 14, 0);
  hg.addColorStop(0, "#d9dee1");
  hg.addColorStop(0.5, "#ffffff");
  hg.addColorStop(1, "#98a3a9");
  g.fillStyle = hg;
  g.beginPath();
  g.roundRect(lx - 15, hy - 9, 30, 18, 6);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.fillRect(lx - 9, hy - 1, 18, 2);

  g.fillStyle = active ? "#46e07a" : "#2a3a30";
  g.shadowColor = active ? "rgba(70,224,122,0.9)" : "transparent";
  g.shadowBlur = active ? 10 : 0;
  g.beginPath();
  g.arc(m.x + 16, m.y + 14, 5, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "rgba(220,235,240,0.85)";
  g.font = `700 ${fsz(11)}px ${FONT}`;
  g.textAlign = "center";
  g.fillText("pH", kx, m.y + m.h - 6);
  g.fillText("حجم", lx, m.y + m.h - 6);
}

/* ======================= القوارير ======================= */
function bottleBox(L, i) {
  const sh = L.shelf;
  const r = Math.floor(i / sh.cols);
  const c = i % sh.cols;
  const pitch = sh.w / sh.cols;
  return { cx: sh.x + pitch * (c + 0.5), base: sh.y + (r + 1) * sh.rowH, w: Math.min(80, pitch - 16), h: Math.min(104, sh.rowH - 18) };
}

function drawBottle(g, b, key, state) {
  const sol = SOLUTIONS[key];
  const { cx, base, w, h } = b;
  const lift = state.selected ? 8 : state.hover ? 4 : 0;
  const y1 = base - lift;
  const x0 = cx - w / 2;
  const neckW = w * 0.34;
  const shoulder = y1 - h * 0.62;
  // ظل
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(cx, base + 1, w * 0.46, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  if (state.selected) {
    g.shadowColor = "rgba(255,240,150,0.95)";
    g.shadowBlur = 22;
  }
  const body = () => {
    g.beginPath();
    g.moveTo(x0 + 6, y1);
    g.quadraticCurveTo(x0, y1, x0, y1 - 8);
    g.lineTo(x0, shoulder + 12);
    g.quadraticCurveTo(x0, shoulder, cx - neckW / 2 - 2, shoulder - 8);
    g.lineTo(cx - neckW / 2, y1 - h + 10);
    g.lineTo(cx + neckW / 2, y1 - h + 10);
    g.lineTo(cx + neckW / 2 + 2, shoulder - 8);
    g.quadraticCurveTo(x0 + w, shoulder, x0 + w, shoulder + 12);
    g.lineTo(x0 + w, y1 - 8);
    g.quadraticCurveTo(x0 + w, y1, x0 + w - 6, y1);
    g.closePath();
  };
  body();
  g.fillStyle = "rgba(225,242,246,0.5)";
  g.fill();
  g.restore();
  // السائل داخل القارورة
  g.save();
  body();
  g.clip();
  const lvlY = y1 - h * 0.5;
  const lg = g.createLinearGradient(0, lvlY, 0, y1);
  lg.addColorStop(0, rgba(sol.color, Math.min(1, sol.alpha + 0.1)));
  lg.addColorStop(1, rgba(sol.color.map((v) => v * 0.72), 1));
  g.fillStyle = lg;
  g.fillRect(x0, lvlY, w, y1 - lvlY);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(x0, lvlY, w, 2);
  g.restore();
  // ملصق
  const ly0 = y1 - h * 0.5 - 4;
  const lh = h * 0.36;
  g.fillStyle = "rgba(255,252,244,0.95)";
  g.beginPath();
  g.roundRect(x0 + 3, ly0, w - 6, lh, 4);
  g.fill();
  g.strokeStyle = "rgba(60,50,30,0.35)";
  g.lineWidth = 1;
  g.stroke();
  g.font = `${Math.round(lh * 0.74)}px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#222";
  g.fillText(sol.emoji, cx, ly0 + lh * 0.54);
  g.textBaseline = "alphabetic";
  // غطاء
  const capCol = ["#d64545", "#2b7de0", "#2f8f56", "#e8b04a", "#7d56c2", "#e07a2b"][(key.charCodeAt(0) + key.length) % 6];
  g.fillStyle = capCol;
  g.beginPath();
  g.roundRect(cx - neckW / 2 - 2, y1 - h, neckW + 4, 14, 3);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(cx - neckW / 2, y1 - h + 2, neckW * 0.3, 10);
  // حواف زجاج + لمعة
  body();
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "rgba(60,110,120,0.4)";
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillRect(x0 + 6, shoulder + 14, 5, h * 0.4);
}

/* ======================= طبقات ديناميكية ======================= */
function pill(g, text, x, y, o = {}) {
  const size = fsz(o.size || 15);
  g.font = `${o.weight || 700} ${size}px ${FONT}`;
  const pad = 10;
  const w = g.measureText(text).width + pad * 2;
  const h = size + 12;
  g.fillStyle = o.bg || "rgba(255,255,255,0.95)";
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  g.fill();
  g.strokeStyle = o.border || "rgba(15,77,42,0.18)";
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = o.fg || "#1d2b22";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y + 1);
  g.textBaseline = "alphabetic";
}

/* ======================= المكوّن ======================= */
const PhLab = forwardRef(function PhLab(props, ref) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const st = useRef({
    props,
    L: null,
    staticLayer: null,
    cssW: 0,
    cssH: 0,
    dpr: 1,
    hover: null,
    amp: 0,
    drops: [],
    splash: [],
    bubbles: [],
    shown: { rgb: [200, 228, 240], a: 0.5, level: 0 },
    waste: { rgb: [200, 228, 240], a: 0.5, vol: 0, amp: 0 },
    hold: null,
    bulbSq: 0,
    dripT: 0,
    time: 0,
  });
  st.current.props = props;

  useImperativeHandle(ref, () => ({}));

  useEffect(() => {
    const s = st.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const g = canvas.getContext("2d");
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
      s.L = computeLayout(r.width, r.height);
      s.staticLayer = buildStatic(s.L, dpr, tex);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const toDesign = (e) => {
      const r = canvas.getBoundingClientRect();
      return { X: ((e.clientX - r.left) / r.width) * (s.cssW / s.L.s), Y: ((e.clientY - r.top) / r.height) * (s.cssH / s.L.s) };
    };

    // مناطق اللمس
    function hits(X, Y) {
      const L = s.L;
      const p = s.props;
      const out = {};
      // الحنفية
      const th = { x: L.tapBaseX, y: L.benchY - 118 };
      if (Math.hypot(X - th.x, Y - th.y) < 54) out.tap = true;
      // الصمام
      const x0 = L.bx - BEAKER_W / 2;
      if (Math.hypot(X - (x0 - 22), Y - (L.y0 - 56)) < 46) out.drain = true;
      // القطّارة
      const px = L.bx + 56;
      const tipY = L.top - 12;
      if (X > px - 38 && X < px + 38 && Y > tipY - 190 && Y < tipY + 8) out.dropper = true;
      // جهاز المحلول المخصّص
      const mk = makerGeom(L);
      if (Math.hypot(X - mk.kx, Y - mk.ky) < mk.kr + 14) out.knob = true;
      else if (Math.abs(X - mk.lx) < 28 && Y > mk.ly0 - 14 && Y < mk.ly1 + 14) out.lever = true;
      // القوارير
      if (p) {
        SOLUTION_ORDER.forEach((key, i) => {
          const b = bottleBox(L, i);
          if (Math.abs(X - b.cx) < b.w / 2 + 6 && Y > b.base - b.h - 12 && Y < b.base + 6) out.bottle = key;
        });
      }
      return out;
    }

    function stopHold() {
      const h = s.hold;
      if (!h) return;
      s.hold = null;
      if (h === "tap") s.props.onWaterStop?.();
      if (h === "dropper") s.props.onDripStop?.();
      if (h === "drain") s.props.onDrainStop?.();
    }

    function setKnob(X, Y) {
      const mk = makerGeom(s.L);
      let a = Math.atan2(Y - mk.ky, X - mk.kx);
      if (a > KNOB_A1 + 0.5) a -= Math.PI * 2;
      const t = clamp((a - KNOB_A0) / (KNOB_A1 - KNOB_A0), 0, 1);
      s.props.onCustomPH?.(Math.round(t * 14 * 10) / 10);
    }
    function setLever(Y) {
      const mk = makerGeom(s.L);
      const t = clamp((mk.ly1 - Y) / (mk.ly1 - mk.ly0), 0, 1);
      s.props.onCustomVolume?.(Math.round(t * MAX_VOLUME * 20) / 20);
    }

    function onDown(e) {
      const { X, Y } = toDesign(e);
      const h = hits(X, Y);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (h.tap) {
        s.hold = "tap";
        s.props.onWaterStart?.();
      } else if (h.dropper) {
        s.hold = "dropper";
        s.props.onDripStart?.();
      } else if (h.drain) {
        s.hold = "drain";
        s.props.onDrainStart?.();
      } else if (h.knob) {
        s.hold = "knob";
        setKnob(X, Y);
      } else if (h.lever) {
        s.hold = "lever";
        setLever(Y);
      } else if (h.bottle) {
        s.props.onSelect?.(h.bottle);
      }
    }
    function onMove(e) {
      const { X, Y } = toDesign(e);
      if (s.hold === "knob") {
        setKnob(X, Y);
        return;
      }
      if (s.hold === "lever") {
        setLever(Y);
        return;
      }
      const h = hits(X, Y);
      s.hover = h.bottle || (h.tap ? "tap" : h.dropper ? "dropper" : h.drain ? "drain" : h.knob || h.lever ? "maker" : null);
      canvas.style.cursor = s.hover ? "pointer" : "default";
    }
    function onUp() {
      stopHold();
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", () => {
      s.hover = null;
    });

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.time += dt;
      const L = s.L;
      const p = s.props;
      const flows = p.flows;

      // سلسة اللون والمستوى
      const target = p.liquid;
      const k = Math.min(1, dt * 6);
      for (let i = 0; i < 3; i++) s.shown.rgb[i] += (target.rgb[i] - s.shown.rgb[i]) * k;
      s.shown.a += (target.a - s.shown.a) * k;
      const targetLevel = clamp(p.total / MAX_VOLUME, 0, 1) * BEAKER_H;
      s.shown.level += (targetLevel - s.shown.level) * Math.min(1, dt * 14);

      // الجرّة
      const wt = p.waste;
      s.waste.vol += (wt.vol - s.waste.vol) * Math.min(1, dt * 10);
      for (let i = 0; i < 3; i++) s.waste.rgb[i] += (wt.rgb[i] - s.waste.rgb[i]) * k;
      s.waste.a += (wt.a - s.waste.a) * k;
      s.waste.amp = Math.max(0, s.waste.amp - dt * 1.5);

      // زناد الموجات
      s.amp = Math.max(0, s.amp - dt * 1.2);

      const surfY = L.y0 - s.shown.level;
      const spoutTipY = L.top - 70 + 16;
      const tapX = L.spoutX + 6;
      // تدفّق الماء
      if (flows.water) {
        s.amp = Math.min(1, s.amp + dt * 2.2);
        if (Math.random() < dt * 16) {
          s.splash.push({ x: tapX + (Math.random() - 0.5) * 20, y: surfY, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 90, r: 1.6 + Math.random() * 2, life: 0.6 });
        }
        if (s.shown.level > 4 && Math.random() < dt * 9) {
          s.bubbles.push({ x: tapX + (Math.random() - 0.5) * 36, y: surfY + 8 + Math.random() * 40, r: 1.5 + Math.random() * 3, vy: 24 + Math.random() * 34, life: 1.8, wob: Math.random() * 6 });
        }
      }
      // القطّارة
      s.bulbSq += ((flows.dripping ? 1 : 0) - s.bulbSq) * Math.min(1, dt * 14);
      if (flows.dripping) {
        s.dripT -= dt;
        if (s.dripT <= 0) {
          s.dripT = 0.22;
          s.drops.push({ x: L.bx + 56, y: L.top - 8, vy: 40, color: p.solRGB });
        }
      }
      for (const d of s.drops) {
        d.vy += 1100 * dt;
        d.y += d.vy * dt;
        if (d.y >= surfY && s.shown.level >= 0) {
          d.dead = true;
          s.amp = Math.min(1, s.amp + 0.35);
          for (let i = 0; i < 4; i++) s.splash.push({ x: d.x, y: surfY, vx: (Math.random() - 0.5) * 80, vy: -90 - Math.random() * 70, r: 1.4 + Math.random() * 1.6, life: 0.5, color: d.color });
        }
      }
      s.drops = s.drops.filter((d) => !d.dead && d.y < L.benchY);
      // الرذاذ والفقاعات
      for (const q of s.splash) {
        q.vy += 700 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.life -= dt;
      }
      s.splash = s.splash.filter((q) => q.life > 0 && q.y < surfY + 6);
      for (const b of s.bubbles) {
        b.y -= b.vy * dt;
        b.x += Math.sin((b.wob += dt * 5)) * 0.2;
        b.life -= dt;
        if (b.y <= surfY + 2) b.life = 0;
      }
      s.bubbles = s.bubbles.filter((b) => b.life > 0).slice(-60);
      // التصريف
      const sc = L.bx - BEAKER_W / 2 - 50;
      if (flows.draining) s.waste.amp = Math.min(1, s.waste.amp + dt * 1.5);

      /* ---- رسم ---- */
      const { dpr } = s;
      UI_S = L.s;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(s.staticLayer, 0, 0);
      g.setTransform(dpr * L.s, 0, 0, dpr * L.s, 0, 0);

      // الرف: القوارير
      if (p.mode === "explore") {
        SOLUTION_ORDER.forEach((key, i) => {
          drawBottle(g, bottleBox(L, i), key, { selected: !p.customActive && key === p.solutionKey, hover: s.hover === key });
        });
        if (!p.customActive) {
          const sel = bottleBox(L, SOLUTION_ORDER.indexOf(p.solutionKey));
          pill(g, SOLUTIONS[p.solutionKey].nameAr, sel.cx, sel.base - sel.h - 24, { bg: "#1b7340", fg: "#fff", border: "rgba(255,255,255,0.7)", size: 14 });
        }
      } else {
        g.fillStyle = "rgba(255,255,255,0.0)";
      }

      drawJar(g, L, s.waste, s.time);
      drawMeter(g, L, p.pH, p.empty, s.time, p.tone);
      drawMaker(g, L, p.customActive, p.customPH, p.customVolume, s.hover === "maker");

      // المسبار خلف السائل ثم الدورق
      drawProbe(g, L, s.shown.level);
      glassBeaker(g, L, { rgb: s.shown.rgb, a: s.shown.a }, s.shown.level, s.time, s);

      // الأدوات
      drawDropper(g, L, flows.dripping, p.solRGB, s.shown.level, s.bulbSq);
      const tapH = drawTapHandle(g, L, flows.water, s.hover === "tap");
      const sk = drawStopcock(g, L, flows.draining, s.hover === "drain");
      void tapH;

      // مجرى الماء
      if (flows.water) {
        const x = tapX;
        const y0s = spoutTipY;
        const y1s = surfY;
        const sg = g.createLinearGradient(x - 6, 0, x + 6, 0);
        sg.addColorStop(0, "rgba(120,190,236,0.55)");
        sg.addColorStop(0.5, "rgba(210,240,255,0.85)");
        sg.addColorStop(1, "rgba(100,176,230,0.55)");
        g.fillStyle = sg;
        g.fillRect(x - 6, y0s, 12, Math.max(0, y1s - y0s));
        g.strokeStyle = "rgba(255,255,255,0.65)";
        g.lineWidth = 1.5;
        g.setLineDash([10, 12]);
        g.lineDashOffset = -s.time * 260;
        g.beginPath();
        g.moveTo(x - 1, y0s);
        g.lineTo(x - 1, y1s);
        g.stroke();
        g.setLineDash([]);
        // حلقات التموّج عند الاصطدام
        for (let i = 0; i < 2; i++) {
          const t = (s.time * 1.6 + i * 0.5) % 1;
          g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(x, surfY, 10 + t * 56, 2 + t * 5, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // مجرى التصريف
      if (flows.draining) {
        const x = sk.spoutX;
        const jarTop = L.jarBase - JAR_H;
        const jarSurf = L.jarBase - clamp(s.waste.vol / JAR_CAP, 0, 0.96) * (JAR_H - 8);
        g.fillStyle = rgba(s.shown.rgb, Math.min(0.9, s.shown.a + 0.1));
        g.fillRect(x - 4, sk.spoutY, 8, Math.max(0, jarSurf - sk.spoutY));
        g.strokeStyle = "rgba(255,255,255,0.55)";
        g.lineWidth = 1.4;
        g.setLineDash([8, 10]);
        g.lineDashOffset = -s.time * 220;
        g.beginPath();
        g.moveTo(x, sk.spoutY);
        g.lineTo(x, jarSurf);
        g.stroke();
        g.setLineDash([]);
        void jarTop;
      }
      void sc;

      // قطرات ورذاذ وفقاعات فوق السطح
      for (const d of s.drops) {
        g.fillStyle = rgba(d.color, 0.95);
        g.beginPath();
        g.ellipse(d.x, d.y, 3.4, 5.4, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.arc(d.x - 1, d.y - 1.5, 1.2, 0, Math.PI * 2);
        g.fill();
      }
      for (const q of s.splash) {
        g.fillStyle = q.color ? rgba(q.color, Math.min(1, q.life * 2)) : `rgba(190,228,250,${Math.min(1, q.life * 2)})`;
        g.beginPath();
        g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        g.fill();
      }

      // مؤشّر pH على المخطّط
      const ch = L.chart;
      if (!p.empty) {
        const my = ch.y2 - (clamp(p.pH, 0, 14) / 14) * (ch.y2 - ch.y1);
        g.fillStyle = "#1d2b22";
        g.beginPath();
        g.moveTo(ch.x - 4, my);
        g.lineTo(ch.x - 18, my - 8);
        g.lineTo(ch.x - 18, my + 8);
        g.closePath();
        g.fill();
        pill(g, formatAr(p.pH, 1), ch.x - 4 + 66, my, { bg: "#1d2b22", fg: "#fff", size: 13, border: "rgba(255,255,255,0.4)" });
      }

      // تلميح الأدوات عند التحويم
      const hov = s.hover;
      if (hov === "tap") pill(g, "اضغط باستمرار: ماء", L.tapBaseX + 70, L.benchY - 150, { size: 13 });
      if (hov === "dropper") pill(g, "اضغط باستمرار: قطّارة", L.bx + 56, L.top - 215, { size: 13 });
      if (hov === "maker") pill(g, "حضّر محلولك: لفّ المقبض", L.maker.x + L.maker.w / 2, L.maker.y - 22, { size: 13 });
      if (hov === "drain") pill(g, "اضغط باستمرار: تصريف", L.bx - BEAKER_W / 2 - 22, L.y0 - 112, { size: 13 });
      // حالة التنبيه: ممتلئ
      if (p.full && (flows.water || flows.dripping)) pill(g, "الدورق ممتلئ", L.bx, L.top - 28, { bg: "#d64545", fg: "#fff", size: 14 });
    }
    raf = requestAnimationFrame(frame);
    if (import.meta.env.DEV) window.__ph = s;

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      stopHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="ph-canvas-wrap">
      <canvas ref={canvasRef} className="ph-canvas" />
    </div>
  );
});

export default PhLab;
export { universalGradientCSS };
