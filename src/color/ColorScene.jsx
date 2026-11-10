/**
 * ColorScene.jsx — استوديو بصريات هادئ على Canvas 2D (تصميم 1280×720):
 *   - ثلاثة كشّافات LED على حامل واحد تُضيء عين الشخصية (فوتونات/موجات/شعاع).
 *   - إطار شفّاف ملوّن بين الكشّافات والعين (تُنقل إليه الشفّافات من الرفّ).
 *   - الدماغ: نبضات المخاريط L/M/S تسير من العين إلى القشرة، وسحابة التفكير تعرض
 *     اللون المُدرَك (ومقارنته بالطبيعي عند ارتداء نظّارة عمى ألوان).
 *   - منصّة تحكم واحدة: ثلاثة فيدرات + مفتاح نمط الضوء + شاشة تعرض خليط الضوء الفعلي.
 *   - لوحة نظّارات، صورتا الشخصيتين، وبطاقة "طابق اللون" (تحدٍّ).
 * كل اللمس هنا بـ Pointer Events. لا إيموجي ولا لوحات عائمة.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DW, DH, EYE, CORTEX, LIGHTS, FILTERS, VISION_MODES, SUBJECTS, TARGETS, calculatePerceivedColor, CLAMP } from "./colorData.js";
import boyUrl from "./assets/boy.webp";
import girlUrl from "./assets/girl.webp";

const FONT = "'IBM Plex Sans Arabic', sans-serif";
const MODES = ["particles", "waves", "solid"];
const MODE_NAMES = { particles: "فوتونات", waves: "موجات", solid: "شعاع متصل" };

/* ---- تخطيط التصميم ---- */
const LX = 925; // مقدّمة عدسات الكشّافات
const LAMP_Y = [128, 290, 452];
const BEAM_END = { x: 668, y: 330 };
const GEL_X = 800;
const GEL_TOP = 150;
const GEL_BOT = 478;
const DESK_Y = 566;
const RAIL_X = 1196;
const CONSOLE = { x: 352, y: 578, w: 574, h: 126 };
const FADER = { xs: [420, 492, 564], top: 602, bottom: 666 };
const KNOB = { x: 668, y: 636, r: 32 };
const LCD = { x: 732, y: 592, w: 178, h: 98 };
const SLABS = [0, 1, 2, 3].map((i) => ({ x: 968 + i * 74, w: 48, h: 76 }));
const PORTRAITS = { boy: { x: 38, y: 168, w: 92, h: 112 }, girl: { x: 144, y: 168, w: 92, h: 112 } };
const BOARD = { x: 32, y: 318, w: 210, h: 232 };
const TARGET_CARD = { x: 32, y: 26, w: 210, h: 118 };
const GLASSES = VISION_MODES.map((m, i) => ({
  ...m,
  x: BOARD.x + 56 + (i % 2) * 100,
  y: BOARD.y + 62 + Math.floor(i / 2) * 100,
}));

const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const lerp = (a, b, t) => a + (b - a) * t;
const ease3 = (t) => 1 - Math.pow(1 - t, 3);

function rr(g, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

function rngMaker(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ======================= طبقة الخلفية (تُرسم مرة عند تغيّر الحجم) ======================= */
function buildBackdrop(S, W, H, dpr) {
  const c = document.createElement("canvas");
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#16232b");
  wall.addColorStop(0.7, "#0f1b22");
  wall.addColorStop(1, "#0b141a");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);

  // دائرة ضوء ناعمة خلف الرأس + هالة خافتة عند الكشّافات
  const cx = S.ox + 470 * S.s;
  const cy = S.oy + 330 * S.s;
  const pool = g.createRadialGradient(cx, cy, 20, cx, cy, 520 * S.s);
  pool.addColorStop(0, "rgba(120,168,186,0.26)");
  pool.addColorStop(1, "rgba(120,168,186,0)");
  g.fillStyle = pool;
  g.fillRect(0, 0, W, H);

  // ألواح جدار خافتة
  g.strokeStyle = "rgba(255,255,255,0.035)";
  g.lineWidth = 1;
  const pw = 160 * S.s;
  for (let x = S.ox % pw; x < W; x += pw) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, S.oy + DESK_Y * S.s);
    g.stroke();
  }
  // تعتيم الأطراف
  const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  // سطح الطاولة (يمتد على عرض الشاشة)
  const dy = S.oy + DESK_Y * S.s;
  const top = g.createLinearGradient(0, dy, 0, dy + 14 * S.s);
  top.addColorStop(0, "#6e4b2e");
  top.addColorStop(1, "#4a301c");
  g.fillStyle = top;
  g.fillRect(0, dy, W, 14 * S.s);
  const body = g.createLinearGradient(0, dy + 14 * S.s, 0, H);
  body.addColorStop(0, "#2d2014");
  body.addColorStop(1, "#1a120b");
  g.fillStyle = body;
  g.fillRect(0, dy + 14 * S.s, W, H - dy);
  const rnd = rngMaker(7);
  g.globalAlpha = 0.12;
  for (let i = 0; i < 150; i++) {
    g.fillStyle = rnd() < 0.5 ? "#000" : "#a06b3a";
    g.fillRect(rnd() * W, dy + rnd() * (H - dy), 30 + rnd() * 120, 1);
  }
  g.globalAlpha = 1;
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(0, dy, W, 1.5);
  return c;
}

/* ======================= رسم الأجزاء ======================= */
function drawRail(S, g) {
  const rg = g.createLinearGradient(RAIL_X - 7, 0, RAIL_X + 7, 0);
  rg.addColorStop(0, "#2a3138");
  rg.addColorStop(0.4, "#6e7983");
  rg.addColorStop(1, "#1b2025");
  g.fillStyle = rg;
  g.fillRect(RAIL_X - 7, 60, 14, DESK_Y - 60);
  g.fillStyle = "#2b333a";
  rr(g, RAIL_X - 40, DESK_Y - 12, 80, 14, 5);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(RAIL_X - 38, DESK_Y - 11, 76, 1.5);
}

function drawLamp(S, g, i, v) {
  const L = LIGHTS[i];
  const cy = LAMP_Y[i];
  const c = L.rgb;
  const t = S.t;
  // ذراع التثبيت إلى الحامل
  g.fillStyle = "#222a30";
  g.fillRect(1100, cy - 6, RAIL_X - 1100, 12);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(1100, cy - 6, RAIL_X - 1100, 2);
  g.fillStyle = "#3a444c";
  g.beginPath();
  g.arc(RAIL_X, cy, 9, 0, Math.PI * 2);
  g.fill();

  // جسم الكشّاف
  const bx = 982;
  const bw = 130;
  const bh = 62;
  const body = g.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
  body.addColorStop(0, "#4a545d");
  body.addColorStop(0.18, "#2f373e");
  body.addColorStop(0.6, "#1d2328");
  body.addColorStop(1, "#14181c");
  g.fillStyle = body;
  rr(g, bx, cy - bh / 2, bw, bh, 12);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 1.2;
  g.stroke();
  // زعانف التبريد
  g.strokeStyle = "rgba(255,255,255,0.09)";
  g.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.moveTo(bx + bw - 14 - k * 8, cy - bh / 2 + 8);
    g.lineTo(bx + bw - 14 - k * 8, cy + bh / 2 - 8);
    g.stroke();
  }
  // حلقة بلون القناة
  const ring = g.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
  ring.addColorStop(0, rgba(c.map((x) => Math.min(255, x + 70)), 1));
  ring.addColorStop(0.5, rgba(c, 1));
  ring.addColorStop(1, rgba(c.map((x) => x * 0.6), 1));
  g.fillStyle = ring;
  g.fillRect(bx + 28, cy - bh / 2 + 1, 10, bh - 2);
  // مخروط القناع الأمامي (كروم)
  const cone = g.createLinearGradient(0, cy - 40, 0, cy + 40);
  cone.addColorStop(0, "#9aa5ad");
  cone.addColorStop(0.3, "#e8edf0");
  cone.addColorStop(0.55, "#7d8890");
  cone.addColorStop(1, "#3b444b");
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(bx + 6, cy - bh / 2);
  g.lineTo(LX + 4, cy - 40);
  g.lineTo(LX + 4, cy + 40);
  g.lineTo(bx + 6, cy + bh / 2);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(20,28,34,0.7)";
  g.lineWidth = 1.2;
  g.stroke();
  // عدسة زجاجية تتوهّج بلون القناة
  const glowA = 0.12 + 0.88 * v;
  const lens = g.createRadialGradient(LX + 2, cy - 6, 2, LX + 2, cy, 38);
  lens.addColorStop(0, rgba([255, 255, 255], 0.15 + 0.85 * v));
  lens.addColorStop(0.35, rgba(c.map((x) => Math.min(255, x + 40)), glowA));
  lens.addColorStop(1, rgba(c.map((x) => x * 0.45), 0.55 + 0.4 * v));
  g.fillStyle = lens;
  g.beginPath();
  g.ellipse(LX + 2, cy, 12, 38, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(LX - 1, cy - 14, 3, 9, 0.15, 0, Math.PI * 2);
  g.fill();
  // بريق خارج العدسة
  if (v > 0.02) {
    g.save();
    g.globalCompositeOperation = "lighter";
    const bloom = g.createRadialGradient(LX, cy, 4, LX, cy, 90);
    bloom.addColorStop(0, rgba(c, 0.55 * v));
    bloom.addColorStop(1, rgba(c, 0));
    g.fillStyle = bloom;
    g.beginPath();
    g.arc(LX, cy, 90, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // مؤشّر LED
  g.fillStyle = v > 0.02 ? rgba(c, 1) : "#2a3036";
  g.shadowColor = v > 0.02 ? rgba(c, 0.9) : "transparent";
  g.shadowBlur = v > 0.02 ? 10 : 0;
  g.beginPath();
  g.arc(bx + bw - 10, cy - bh / 2 + 9, 3.2, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  void t;
}

/** نقاط الشعاع من العدسة إلى العين */
function beamPoint(i, t) {
  const x0 = LX - 6;
  const y0 = LAMP_Y[i];
  const x1 = BEAM_END.x;
  const y1 = BEAM_END.y + (i - 1) * 7;
  return { x: lerp(x0, x1, t), y: lerp(y0, y1, t), dx: x1 - x0, dy: y1 - y0 };
}
const GEL_T = (LX - 6 - GEL_X) / (LX - 6 - BEAM_END.x);

function drawBeams(S, g, vals, pass, mode) {
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const v = vals[i] / 100;
    if (v < 0.01) continue;
    const c = LIGHTS[i].rgb;
    const a = beamPoint(i, 0);
    const b = beamPoint(i, 1);
    const len = Math.hypot(a.dx, a.dy);
    const nx = -a.dy / len;
    const ny = a.dx / len;
    const segs = [
      [0, GEL_T, v],
      [GEL_T, 1, v * pass[i]],
    ];
    if (mode === "solid") {
      for (const [t0, t1, vv] of segs) {
        if (vv < 0.01) continue;
        const p0 = beamPoint(i, t0);
        const p1 = beamPoint(i, t1);
        const w0 = lerp(30, 3, t0);
        const w1 = lerp(30, 3, t1);
        const grd = g.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
        grd.addColorStop(0, rgba(c, 0.34 * vv));
        grd.addColorStop(1, rgba(c, 0.5 * vv));
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(p0.x + nx * w0, p0.y + ny * w0);
        g.lineTo(p1.x + nx * w1, p1.y + ny * w1);
        g.lineTo(p1.x - nx * w1, p1.y - ny * w1);
        g.lineTo(p0.x - nx * w0, p0.y - ny * w0);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(c.map((x) => Math.min(255, x + 70)), 0.7 * vv);
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.stroke();
      }
    } else if (mode === "waves") {
      const cycles = 10 + (700 - LIGHTS[i].wavelength) / 22;
      for (const [t0, t1, vv] of segs) {
        if (vv < 0.01) continue;
        g.strokeStyle = rgba(c.map((x) => Math.min(255, x + 60)), 0.5 + 0.5 * vv);
        g.lineWidth = 2.6;
        g.beginPath();
        for (let k = 0; k <= 70; k++) {
          const t = lerp(t0, t1, k / 70);
          const p = beamPoint(i, t);
          const amp = lerp(24, 3, t) * (0.35 + 0.65 * vv);
          const off = Math.sin(t * cycles * Math.PI * 2 - S.t * 5.2) * amp;
          const X = p.x + nx * off;
          const Y = p.y + ny * off;
          if (k === 0) g.moveTo(X, Y);
          else g.lineTo(X, Y);
        }
        g.stroke();
      }
    } else {
      // فوتونات: خط خافت + جسيمات متحرّكة
      for (const [t0, t1, vv] of segs) {
        if (vv < 0.01) continue;
        const p0 = beamPoint(i, t0);
        const p1 = beamPoint(i, t1);
        g.strokeStyle = rgba(c, 0.13 * vv);
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.stroke();
      }
      for (const ph of S.photons) {
        if (ph.i !== i) continue;
        const p = beamPoint(i, ph.t);
        const vv = ph.t < GEL_T ? v : v * pass[i];
        if (vv < 0.02) continue;
        const spread = lerp(20, 2, ph.t);
        const X = p.x + nx * ph.off * spread;
        const Y = p.y + ny * ph.off * spread;
        const gl = g.createRadialGradient(X, Y, 0, X, Y, 8);
        gl.addColorStop(0, rgba([255, 255, 255], 0.9 * vv));
        gl.addColorStop(0.3, rgba(c.map((x) => Math.min(255, x + 60)), 0.85 * vv));
        gl.addColorStop(1, rgba(c, 0));
        g.fillStyle = gl;
        g.beginPath();
        g.arc(X, Y, 8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();
}

function drawGelFrame(S, g, filterObj, A) {
  // حامل الإطار
  g.fillStyle = "#222a30";
  rr(g, GEL_X - 30, DESK_Y - 14, 60, 16, 5);
  g.fill();
  const post = g.createLinearGradient(GEL_X - 28, 0, GEL_X + 28, 0);
  post.addColorStop(0, "#2a3138");
  post.addColorStop(0.45, "#7a8791");
  post.addColorStop(1, "#1d2328");
  g.fillStyle = post;
  g.fillRect(GEL_X - 30, GEL_TOP - 6, 7, GEL_BOT - GEL_TOP + 14);
  g.fillRect(GEL_X + 23, GEL_TOP - 6, 7, GEL_BOT - GEL_TOP + 14);
  g.fillRect(GEL_X - 30, GEL_TOP - 8, 60, 8);
  g.fillRect(GEL_X - 30, GEL_BOT + 2, 60, 8);
  g.fillStyle = "#1d2328";
  g.fillRect(GEL_X - 4, GEL_BOT + 10, 8, DESK_Y - GEL_BOT - 22);
  // الشفّاف داخل الإطار
  if (filterObj && A.gel > 0.01) {
    const c = filterObj.rgb;
    const y = lerp(-(GEL_BOT - GEL_TOP), 0, ease3(A.gel));
    g.save();
    g.beginPath();
    g.rect(GEL_X - 23, GEL_TOP, 46, GEL_BOT - GEL_TOP);
    g.clip();
    const gp = g.createLinearGradient(GEL_X - 23, 0, GEL_X + 23, 0);
    gp.addColorStop(0, rgba(c, 0.55));
    gp.addColorStop(0.5, rgba(c, 0.38));
    gp.addColorStop(1, rgba(c, 0.5));
    g.fillStyle = gp;
    g.fillRect(GEL_X - 23, GEL_TOP + y, 46, GEL_BOT - GEL_TOP);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(GEL_X - 18, GEL_TOP + y, 5, GEL_BOT - GEL_TOP);
    g.restore();
  }
}

function drawGelRack(S, g, filterId, A) {
  // صينية خشبية
  const tx = SLABS[0].x - 20;
  const tw = SLABS[3].x + SLABS[3].w + 20 - tx;
  const wg = g.createLinearGradient(0, DESK_Y - 12, 0, DESK_Y + 6);
  wg.addColorStop(0, "#7d5633");
  wg.addColorStop(1, "#4a301b");
  g.fillStyle = wg;
  rr(g, tx, DESK_Y - 10, tw, 16, 4);
  g.fill();
  FILTERS.forEach((f, i) => {
    const s = SLABS[i];
    const used = filterId === f.id;
    const x = s.x;
    const y = DESK_Y - 10 - s.h;
    g.save();
    if (used) {
      g.globalAlpha = 0.3;
    }
    const gp = g.createLinearGradient(x, 0, x + s.w, 0);
    gp.addColorStop(0, rgba(f.rgb, 0.78));
    gp.addColorStop(0.5, rgba(f.rgb, 0.55));
    gp.addColorStop(1, rgba(f.rgb, 0.72));
    g.fillStyle = gp;
    rr(g, x, y, s.w, s.h, 5);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.65)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(x + 6, y + 6, 6, s.h - 12);
    g.restore();
    if (S.hover === `gel:${f.id}` && !used) {
      g.strokeStyle = "rgba(255,238,160,0.95)";
      g.lineWidth = 2.5;
      rr(g, x - 3, y - 3, s.w + 6, s.h + 6, 7);
      g.stroke();
    }
  });
  void A;
}

function drawSubject(S, g, character) {
  const sub = SUBJECTS[character];
  const img = S.imgs[character];
  if (!img) return;
  const x = EYE.x - sub.eye[0] * sub.k;
  const y = EYE.y - sub.eye[1] * sub.k;
  g.drawImage(img, x, y, sub.w * sub.k, sub.h * sub.k);
}

function drawGlassesWorn(S, g, vision, A) {
  if (vision === "normal" && A.worn < 0.02) return;
  const m = VISION_MODES.find((q) => q.id === (vision === "normal" ? S.lastVision : vision)) || VISION_MODES[0];
  const k = ease3(A.worn);
  if (k < 0.02) return;
  const tint = m.tint || [200, 200, 200];
  g.save();
  g.globalAlpha = k;
  g.translate((1 - k) * 36, -(1 - k) * 22);
  // الذراع نحو الأذن
  g.strokeStyle = "#1a1f24";
  g.lineWidth = 5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(EYE.x + 6, EYE.y - 20);
  g.lineTo(EYE.x - 120, EYE.y - 6);
  g.stroke();
  // العدسة
  g.fillStyle = rgba(tint, 0.42);
  g.strokeStyle = "#1a1f24";
  g.lineWidth = 4.5;
  g.beginPath();
  g.ellipse(EYE.x + 18, EYE.y, 17, 26, 0.04, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath();
  g.ellipse(EYE.x + 12, EYE.y - 10, 3.5, 10, 0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/* مدخل بصري: نظّارة أمامية على اللوحة */
function drawGlassesIcon(S, g, m, x, y, selected, hover) {
  const tint = m.tint || [210, 214, 218];
  if (selected || hover) {
    g.save();
    g.shadowColor = selected ? "rgba(255,230,140,0.95)" : "rgba(255,255,255,0.7)";
    g.shadowBlur = selected ? 18 : 10;
    g.fillStyle = "rgba(255,255,255,0.02)";
    rr(g, x - 44, y - 30, 88, 60, 12);
    g.fill();
    g.restore();
  }
  g.strokeStyle = "#171b1f";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x - 38, y - 8);
  g.lineTo(x - 30, y - 8);
  g.moveTo(x + 30, y - 8);
  g.lineTo(x + 38, y - 8);
  g.moveTo(x - 9, y - 4);
  g.quadraticCurveTo(x, y - 12, x + 9, y - 4);
  g.stroke();
  for (const sx of [-1, 1]) {
    const gp = g.createRadialGradient(x + sx * 20 - 5, y - 4, 1, x + sx * 20, y, 18);
    gp.addColorStop(0, rgba(tint.map((q) => Math.min(255, q + 60)), 0.9));
    gp.addColorStop(1, rgba(tint, 0.78));
    g.fillStyle = gp;
    g.beginPath();
    g.ellipse(x + sx * 20, y, 17, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#171b1f";
    g.lineWidth = 3.5;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.beginPath();
    g.ellipse(x + sx * 20 - 6, y - 5, 4, 2.4, -0.4, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBoard(S, g, vision) {
  // لوحة خشبية مثبّتة على الجدار
  g.fillStyle = "rgba(0,0,0,0.35)";
  rr(g, BOARD.x + 5, BOARD.y + 7, BOARD.w, BOARD.h, 12);
  g.fill();
  const bg = g.createLinearGradient(0, BOARD.y, 0, BOARD.y + BOARD.h);
  bg.addColorStop(0, "#37464f");
  bg.addColorStop(1, "#27333a");
  g.fillStyle = bg;
  rr(g, BOARD.x, BOARD.y, BOARD.w, BOARD.h, 12);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.78)";
  g.font = `700 ${S.fs(14)}px ${FONT}`;
  g.textAlign = "center";
  g.fillText("النظّارات", BOARD.x + BOARD.w / 2, BOARD.y + 24);
  GLASSES.forEach((m) => {
    drawGlassesIcon(S, g, m, m.x, m.y, vision === m.id, S.hover === `vision:${m.id}`);
    g.fillStyle = vision === m.id ? "#ffe59a" : "rgba(255,255,255,0.78)";
    g.font = `600 ${S.fs(12.5)}px ${FONT}`;
    g.textAlign = "center";
    g.fillText(m.short, m.x, m.y + 42, 92);
  });
}

function drawPortraits(S, g, character) {
  for (const key of ["boy", "girl"]) {
    const P = PORTRAITS[key];
    const sel = character === key;
    const hot = S.hover === `char:${key}`;
    g.fillStyle = "rgba(0,0,0,0.35)";
    rr(g, P.x + 3, P.y + 5, P.w, P.h, 8);
    g.fill();
    const bg = g.createLinearGradient(0, P.y, 0, P.y + P.h);
    bg.addColorStop(0, "#394a54");
    bg.addColorStop(1, "#202c33");
    g.fillStyle = bg;
    rr(g, P.x, P.y, P.w, P.h, 8);
    g.fill();
    const img = S.imgs[key];
    if (img) {
      const s = SUBJECTS[key];
      const [hx, hy, hw, hh] = s.head;
      g.save();
      rr(g, P.x + 3, P.y + 3, P.w - 6, P.h - 6, 6);
      g.clip();
      const sc = Math.max((P.w - 6) / hw, (P.h - 6) / hh);
      g.drawImage(img, hx, hy, hw, hh, P.x + 3 + (P.w - 6 - hw * sc) / 2, P.y + 3, hw * sc, hh * sc);
      g.restore();
    }
    g.strokeStyle = sel ? "#ffd75e" : hot ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)";
    g.lineWidth = sel ? 3.5 : 2;
    rr(g, P.x, P.y, P.w, P.h, 8);
    g.stroke();
  }
}

function drawConsole(S, g, vals, mode, info, A) {
  const C = CONSOLE;
  g.fillStyle = "rgba(0,0,0,0.4)";
  rr(g, C.x + 4, C.y + 8, C.w, C.h, 16);
  g.fill();
  const pg = g.createLinearGradient(0, C.y, 0, C.y + C.h);
  pg.addColorStop(0, "#2f3a42");
  pg.addColorStop(1, "#1b2329");
  g.fillStyle = pg;
  rr(g, C.x, C.y, C.w, C.h, 16);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.09)";
  g.fillRect(C.x + 16, C.y + 2, C.w - 32, 2);

  // فيدرات
  for (let i = 0; i < 3; i++) {
    const x = FADER.xs[i];
    const c = LIGHTS[i].rgb;
    const v = A.fader[i] / 100;
    g.fillStyle = "#0b1014";
    rr(g, x - 5, FADER.top - 8, 10, FADER.bottom - FADER.top + 16, 5);
    g.fill();
    // شريط الإضاءة
    const fy = FADER.bottom - v * (FADER.bottom - FADER.top);
    const fg = g.createLinearGradient(0, fy, 0, FADER.bottom);
    fg.addColorStop(0, rgba(c.map((q) => Math.min(255, q + 60)), 1));
    fg.addColorStop(1, rgba(c.map((q) => q * 0.55), 1));
    g.fillStyle = fg;
    g.shadowColor = rgba(c, 0.8);
    g.shadowBlur = 8 * v;
    rr(g, x - 3, fy, 6, FADER.bottom - fy + 6, 3);
    g.fill();
    g.shadowBlur = 0;
    // علامات
    g.fillStyle = "rgba(255,255,255,0.28)";
    for (let k = 0; k <= 4; k++) g.fillRect(x + 12, FADER.bottom - (k / 4) * (FADER.bottom - FADER.top) - 0.5, 8, 1.2);
    // المقبض
    const cap = g.createLinearGradient(x - 15, 0, x + 15, 0);
    cap.addColorStop(0, "#c8d0d6");
    cap.addColorStop(0.5, "#ffffff");
    cap.addColorStop(1, "#8f9aa2");
    g.fillStyle = cap;
    rr(g, x - 15, fy - 9, 30, 18, 6);
    g.fill();
    g.strokeStyle = S.hover === `fader:${i}` || S.drag === `fader:${i}` ? "#ffe27a" : "rgba(0,0,0,0.5)";
    g.lineWidth = S.hover === `fader:${i}` || S.drag === `fader:${i}` ? 2.5 : 1;
    g.stroke();
    g.fillStyle = rgba(c, 1);
    g.fillRect(x - 9, fy - 1.5, 18, 3);
    // الاسم والقيمة
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = `700 ${S.fs(13)}px ${FONT}`;
    g.fillText(`${Math.round(A.fader[i])}`, x, C.y + C.h - 6);
    g.fillStyle = rgba(c, 1);
    g.beginPath();
    g.arc(x, C.y + 14, 4.2, 0, Math.PI * 2);
    g.fill();
  }

  // مفتاح نمط الضوء (٣ أوضاع)
  const K = KNOB;
  const angles = { particles: -0.9, waves: 0, solid: 0.9 };
  const ang = A.knob;
  // تدريج
  g.strokeStyle = "rgba(255,255,255,0.4)";
  g.lineWidth = 2;
  for (const key of MODES) {
    const a = angles[key] - Math.PI / 2;
    g.beginPath();
    g.moveTo(K.x + Math.cos(a) * (K.r + 5), K.y + Math.sin(a) * (K.r + 5));
    g.lineTo(K.x + Math.cos(a) * (K.r + 11), K.y + Math.sin(a) * (K.r + 11));
    g.stroke();
  }
  // أيقونات الأوضاع (نقاط/موجة/خط)
  const iconAt = (key, label) => {
    const a = angles[key] - Math.PI / 2;
    const ix = K.x + Math.cos(a) * (K.r + 22);
    const iy = K.y + Math.sin(a) * (K.r + 22);
    g.strokeStyle = mode === key ? "#ffe27a" : "rgba(255,255,255,0.5)";
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 2;
    if (key === "particles") {
      for (let d = -1; d <= 1; d++) {
        g.beginPath();
        g.arc(ix + d * 6, iy, 1.9, 0, Math.PI * 2);
        g.fill();
      }
    } else if (key === "waves") {
      g.beginPath();
      for (let k = -8; k <= 8; k++) {
        const X = ix + k;
        const Y = iy + Math.sin(k * 0.8) * 3.5;
        if (k === -8) g.moveTo(X, Y);
        else g.lineTo(X, Y);
      }
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(ix - 8, iy);
      g.lineTo(ix + 8, iy);
      g.stroke();
    }
    void label;
  };
  iconAt("particles");
  iconAt("waves");
  iconAt("solid");
  const kg = g.createRadialGradient(K.x - 9, K.y - 11, 3, K.x, K.y, K.r);
  kg.addColorStop(0, "#8a959d");
  kg.addColorStop(0.6, "#3a444b");
  kg.addColorStop(1, "#14191d");
  g.fillStyle = kg;
  g.beginPath();
  g.arc(K.x, K.y, K.r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = S.hover === "knob" ? "#ffe27a" : "rgba(255,255,255,0.2)";
  g.lineWidth = S.hover === "knob" ? 3 : 1.5;
  g.stroke();
  g.strokeStyle = "#f4f7f9";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(K.x + Math.cos(ang - Math.PI / 2) * 8, K.y + Math.sin(ang - Math.PI / 2) * 8);
  g.lineTo(K.x + Math.cos(ang - Math.PI / 2) * (K.r - 7), K.y + Math.sin(ang - Math.PI / 2) * (K.r - 7));
  g.stroke();

  // شاشة LCD: خليط الضوء الفعلي (قبل الإدراك)
  const Lc = LCD;
  g.fillStyle = "#06090c";
  rr(g, Lc.x, Lc.y, Lc.w, Lc.h, 10);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 1.5;
  g.stroke();
  const phys = A.phys;
  g.fillStyle = `rgb(${phys[0]},${phys[1]},${phys[2]})`;
  g.shadowColor = `rgba(${phys[0]},${phys[1]},${phys[2]},0.7)`;
  g.shadowBlur = 14;
  rr(g, Lc.x + 10, Lc.y + 10, 66, Lc.h - 20, 8);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,255,255,0.18)";
  rr(g, Lc.x + 14, Lc.y + 13, 12, Lc.h - 26, 5);
  g.fill();
  g.direction = "ltr";
  g.textAlign = "left";
  g.fillStyle = "#d9f2e6";
  g.font = `700 ${S.fs(16, 10)}px ${FONT}`;
  g.fillText(info.hex.toUpperCase(), Lc.x + 88, Lc.y + 28);
  g.font = `600 ${S.fs(12, 9)}px ${FONT}`;
  g.fillStyle = "rgba(217,242,230,0.82)";
  g.fillText(`R ${Math.round(A.fader[0] * A.pass[0])}  G ${Math.round(A.fader[1] * A.pass[1])}`, Lc.x + 88, Lc.y + 50);
  g.fillText(`B ${Math.round(A.fader[2] * A.pass[2])}`, Lc.x + 88, Lc.y + 67);
  g.fillText(info.wavelengthNm ? `${info.wavelengthNm} nm` : "— nm", Lc.x + 88, Lc.y + 84);
  g.direction = "inherit";
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.textAlign = "right";
  g.font = `600 ${S.fs(11)}px ${FONT}`;
  g.fillText("الضوء الفعلي", Lc.x + Lc.w - 8, Lc.y - 7);
}

function puff(g, cx, cy) {
  const puffs = [
    [-120, 6, 34], [-86, -22, 40], [-36, -34, 46], [20, -36, 46], [70, -26, 42], [112, 2, 36],
    [96, 28, 30], [40, 38, 38], [-22, 40, 36], [-78, 30, 32],
  ];
  g.beginPath();
  for (const [x, y, r] of puffs) {
    g.moveTo(cx + x + r, cy + y);
    g.arc(cx + x, cy + y, r, 0, Math.PI * 2);
  }
  g.rect(cx - 100, cy - 24, 200, 62);
}

function drawCloud(S, g, info, normal, compare) {
  const cx = 500;
  const cy = 100;
  // ظل ثم جسم السحابة
  g.save();
  g.translate(3, 6);
  g.fillStyle = "rgba(0,0,0,0.3)";
  puff(g, cx, cy);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(248,251,253,0.97)";
  puff(g, cx, cy);
  g.fill();
  // ذيل السحابة
  [[440, 160, 9], [428, 178, 6], [420, 194, 4]].forEach(([x, y, r]) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  });
  // العيّنة
  if (compare) {
    g.fillStyle = `rgb(${normal.r},${normal.g},${normal.b})`;
    g.beginPath();
    g.arc(cx - 118, cy + 4, 20, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = "#8a99a3";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - 92, cy + 4);
    g.lineTo(cx - 76, cy + 4);
    g.lineTo(cx - 82, cy - 2);
    g.moveTo(cx - 76, cy + 4);
    g.lineTo(cx - 82, cy + 10);
    g.stroke();
  }
  const sx = compare ? cx - 44 : cx - 80;
  const sg = g.createRadialGradient(sx - 8, cy - 8, 3, sx, cy, 34);
  sg.addColorStop(0, `rgb(${Math.min(255, info.r + 40)},${Math.min(255, info.g + 40)},${Math.min(255, info.b + 40)})`);
  sg.addColorStop(1, `rgb(${info.r},${info.g},${info.b})`);
  g.fillStyle = sg;
  g.beginPath();
  g.arc(sx, cy, 32, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = "#1d2b33";
  g.textAlign = "center";
  g.font = `700 ${S.fs(24)}px ${FONT}`;
  g.fillText(info.arabicName, compare ? cx + 50 : cx + 32, cy + 9, compare ? 120 : 150);
}

function drawTargetCard(S, g, info) {
  const T = TARGET_CARD;
  const flash = S.matchFlash;
  g.fillStyle = "rgba(0,0,0,0.35)";
  rr(g, T.x + 4, T.y + 6, T.w, T.h, 10);
  g.fill();
  g.fillStyle = flash > 0 ? "#d6f5df" : "#f6efe0";
  rr(g, T.x, T.y, T.w, T.h, 10);
  g.fill();
  g.fillStyle = "#c93d3d";
  g.beginPath();
  g.arc(T.x + T.w / 2, T.y + 10, 5, 0, Math.PI * 2);
  g.fill();
  const tg = TARGETS[S.targetIndex];
  const tr = tg.map((q) => Math.round(q * 2.55));
  g.fillStyle = `rgb(${tr[0]},${tr[1]},${tr[2]})`;
  rr(g, T.x + 12, T.y + 24, 78, 62, 8);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.3)";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#3b2f1a";
  g.textAlign = "left";
  g.font = `700 ${S.fs(15)}px ${FONT}`;
  g.fillText("طابق", T.x + 100, T.y + 44);
  g.fillText("اللون", T.x + 100, T.y + 66);
  // شريط التقارب
  const close = CLAMP(1 - S.targetDist / 220, 0, 1);
  g.fillStyle = "rgba(0,0,0,0.14)";
  rr(g, T.x + 12, T.y + 96, T.w - 24, 10, 5);
  g.fill();
  g.fillStyle = close > 0.88 ? "#2f9d57" : "#e2a43a";
  rr(g, T.x + 12, T.y + 96, (T.w - 24) * close, 10, 5);
  g.fill();
  void info;
}

/* ======================= المكوّن ======================= */
const ColorScene = forwardRef(function ColorScene(props, ref) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const sRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      const S = sRef.current;
      if (!S) return;
      S.photons = [];
      S.pulses = [];
      S.sparks = [];
      S.hint = true;
      S.targetIndex = 0;
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const g = canvas.getContext("2d");
    const r = rngMaker(123);
    const S = {
      t: 0,
      s: 1,
      ox: 0,
      oy: 0,
      imgs: {},
      photons: [],
      pulses: [],
      sparks: [],
      anim: { fader: [100, 100, 100], knob: 0, gel: 0, worn: 0, pass: [1, 1, 1], phys: [255, 255, 255] },
      hot: [],
      hover: null,
      drag: null,
      hint: true,
      tip: null,
      tipUntil: 0,
      filterObj: null,
      lastVision: "normal",
      targetIndex: 0,
      targetDist: 999,
      matchHold: 0,
      matchFlash: 0,
      nextTarget: 0,
      fs: (n, min = 11) => Math.min(n * 1.7, Math.max(n, min / S.s)),
      backdrop: null,
      lastKey: "",
      lastName: "",
    };
    sRef.current = S;
    if (import.meta.env.DEV) window.__color = S;
    let alive = true;
    let raf = 0;
    let last = performance.now();

    for (const [key, url] of [
      ["boy", boyUrl],
      ["girl", girlUrl],
    ]) {
      const img = new Image();
      img.onload = () => (S.imgs[key] = img);
      img.src = url;
    }

    function resize() {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      S.dpr = dpr;
      S.cssW = rect.width;
      S.cssH = rect.height;
      S.s = Math.min(rect.width / DW, rect.height / DH);
      S.ox = (rect.width - DW * S.s) / 2;
      S.oy = (rect.height - DH * S.s) / 2;
      S.backdrop = buildBackdrop(S, rect.width, rect.height, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ---------- تفاعل ---------- */
    const toDesign = (e) => {
      const rc = canvas.getBoundingClientRect();
      return { X: (e.clientX - rc.left - S.ox) / S.s, Y: (e.clientY - rc.top - S.oy) / S.s };
    };
    function pick(X, Y) {
      let best = null;
      let bd = Infinity;
      const minHalf = 22 / S.s;
      for (const h of S.hot) {
        const hw = Math.max(h.hw, minHalf);
        const hh = Math.max(h.hh, minHalf);
        const dx = Math.abs(X - h.cx) / hw;
        const dy = Math.abs(Y - h.cy) / hh;
        if (dx <= 1 && dy <= 1) {
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = h;
          }
        }
      }
      return best;
    }
    const valFromY = (Y) => Math.max(0, Math.min(100, Math.round(((FADER.bottom - Y) / (FADER.bottom - FADER.top)) * 100)));
    function showTip(h, ms) {
      if (!h) {
        S.tip = null;
        return;
      }
      S.tip = { text: h.tip, x: h.cx, y: h.cy - Math.max(h.hh, 14) - 8 };
      S.tipUntil = ms ? performance.now() + ms : 0;
    }
    function act(h) {
      const p = propsRef.current;
      const id = h.id;
      if (id.startsWith("char:")) p.onCharacter(id.slice(5));
      else if (id.startsWith("vision:")) p.onVision(id.slice(7));
      else if (id.startsWith("gel:")) {
        const f = id.slice(4);
        p.onFilter(p.filter === f ? null : f);
      } else if (id === "knob") {
        p.onBeamMode(MODES[(MODES.indexOf(p.beamMode) + 1) % 3]);
      } else if (id === "target") {
        S.targetIndex = (S.targetIndex + 1) % TARGETS.length;
        S.matchHold = 0;
        p.onTarget && p.onTarget();
      }
    }
    function onDown(e) {
      const { X, Y } = toDesign(e);
      const h = pick(X, Y);
      if (!h) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* مؤشّر غير نشط */
      }
      S.pressId = h.id;
      if (h.kind === "fader") {
        S.drag = h.id;
        S.hint = false;
        propsRef.current.onValChange(LIGHTS[h.index].id, valFromY(Y));
      }
      showTip(h, 0);
      e.preventDefault();
    }
    function onMove(e) {
      const { X, Y } = toDesign(e);
      if (S.drag) {
        const h = S.hot.find((q) => q.id === S.drag);
        if (h) {
          propsRef.current.onValChange(LIGHTS[h.index].id, valFromY(Y));
          showTip(h, 0);
        }
        return;
      }
      const h = pick(X, Y);
      S.hover = h ? h.id : null;
      canvas.style.cursor = h ? h.cursor || "pointer" : "default";
      if (e.pointerType === "mouse") showTip(h, 0);
    }
    function onUp(e) {
      const { X, Y } = toDesign(e);
      const wasDrag = S.drag;
      S.drag = null;
      const h = pick(X, Y);
      if (!wasDrag && S.pressId && h && h.id === S.pressId) act(h);
      if (e.pointerType !== "mouse") showTip(h || null, 1100);
      else if (!h) S.tip = null;
      S.pressId = null;
    }
    function onLeave() {
      S.hover = null;
      if (!S.drag) S.tip = null;
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    function pill(text, x, y) {
      g.font = `700 ${S.fs(13)}px ${FONT}`;
      const w = g.measureText(text).width + 22;
      const h = S.fs(13) + 14;
      const px = CLAMP(x, w / 2 + 6, DW - w / 2 - 6);
      g.fillStyle = "rgba(255,255,255,0.96)";
      rr(g, px - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.fillStyle = "#1d2b33";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, px, y + 1, w);
      g.textBaseline = "alphabetic";
    }

    /* ---------- الحلقة ---------- */
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!S.cssW) return;
      S.t += dt;
      const p = propsRef.current;
      const A = S.anim;

      // تنعيم القيم
      const vals = [p.rVal, p.gVal, p.bVal];
      for (let i = 0; i < 3; i++) A.fader[i] += (vals[i] - A.fader[i]) * Math.min(1, dt * 16);
      const knobTarget = { particles: -0.9, waves: 0, solid: 0.9 }[p.beamMode];
      A.knob += (knobTarget - A.knob) * Math.min(1, dt * 14);
      if (p.filter) S.filterObj = FILTERS.find((f) => f.id === p.filter);
      A.gel += ((p.filter ? 1 : 0) - A.gel) * Math.min(1, dt * 5);
      if (!p.filter && A.gel < 0.02) S.filterObj = null;
      if (p.visionMode !== "normal") S.lastVision = p.visionMode;
      A.worn += ((p.visionMode !== "normal" ? 1 : 0) - A.worn) * Math.min(1, dt * 7);

      const gelPass = S.filterObj ? S.filterObj.pass : [1, 1, 1];
      const pass = gelPass.map((q) => lerp(1, q, A.gel));
      A.pass = pass;
      const v100 = [A.fader[0] * pass[0], A.fader[1] * pass[1], A.fader[2] * pass[2]];
      const infoNormal = calculatePerceivedColor(v100[0], v100[1], v100[2], "normal");
      const info = p.visionMode === "normal" ? infoNormal : calculatePerceivedColor(v100[0], v100[1], v100[2], p.visionMode);
      A.phys = [infoNormal.r, infoNormal.g, infoNormal.b];
      if (info.arabicName !== S.lastName) {
        S.lastName = info.arabicName;
        p.onStatus && p.onStatus(info);
      }

      // تحدّي "طابق اللون"
      const tg = TARGETS[S.targetIndex];
      const tr = tg.map((q) => q * 2.55);
      S.targetDist = Math.hypot(infoNormal.r - tr[0], infoNormal.g - tr[1], infoNormal.b - tr[2]);
      if (S.matchFlash > 0) S.matchFlash -= dt;
      if (S.targetDist < 30 && S.matchFlash <= 0) {
        S.matchHold += dt;
        if (S.matchHold > 0.55) {
          S.matchHold = 0;
          S.matchFlash = 1.4;
          S.nextTarget = 1.5;
          for (let k = 0; k < 46; k++) {
            const a = r() * Math.PI * 2;
            const sp = 90 + r() * 230;
            S.sparks.push({ x: TARGET_CARD.x + 90, y: TARGET_CARD.y + 56, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1.1 + r() * 0.6, c: [tr, [255, 215, 94], [255, 255, 255]][k % 3] });
          }
          p.onMatch && p.onMatch();
        }
      } else if (S.targetDist >= 30) S.matchHold = 0;
      if (S.nextTarget > 0) {
        S.nextTarget -= dt;
        if (S.nextTarget <= 0) S.targetIndex = (S.targetIndex + 1) % TARGETS.length;
      }

      // فوتونات
      if (p.beamMode === "particles") {
        for (let i = 0; i < 3; i++) {
          const v = vals[i] / 100;
          S.__acc = S.__acc || [0, 0, 0];
          S.__acc[i] += dt * 30 * v;
          while (S.__acc[i] >= 1) {
            S.__acc[i] -= 1;
            S.photons.push({ i, t: 0, sp: 0.5 + r() * 0.25, off: r() * 2 - 1 });
          }
        }
      }
      for (const ph of S.photons) ph.t += dt * ph.sp;
      S.photons = S.photons.filter((q) => q.t < 1).slice(-260);

      // نبضات المخاريط من العين إلى القشرة
      for (let c = 0; c < 3; c++) {
        const act = [info.lCone, info.mCone, info.sCone][c] / 100;
        S.__pa = S.__pa || [0, 0, 0];
        S.__pa[c] += dt * 5 * act;
        while (S.__pa[c] >= 1) {
          S.__pa[c] -= 1;
          S.pulses.push({ c, t: 0, sp: 0.55 + r() * 0.15, off: (r() - 0.5) * 16 });
        }
      }
      for (const q of S.pulses) q.t += dt * q.sp;
      S.pulses = S.pulses.filter((q) => q.t < 1).slice(-120);
      for (const sp of S.sparks) {
        sp.vy += 420 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
      }
      S.sparks = S.sparks.filter((q) => q.life > 0);

      // ---- مناطق اللمس ----
      const hot = [];
      for (let i = 0; i < 3; i++) {
        hot.push({ id: `fader:${i}`, kind: "fader", index: i, cx: FADER.xs[i], cy: (FADER.top + FADER.bottom) / 2, hw: 24, hh: (FADER.bottom - FADER.top) / 2 + 20, cursor: "ns-resize", tip: `${LIGHTS[i].name} ${Math.round(vals[i])}٪` });
      }
      hot.push({ id: "knob", kind: "knob", cx: KNOB.x, cy: KNOB.y, hw: KNOB.r + 10, hh: KNOB.r + 10, tip: `نمط الضوء: ${MODE_NAMES[p.beamMode]}` });
      FILTERS.forEach((f, i) => {
        const s = SLABS[i];
        hot.push({ id: `gel:${f.id}`, kind: "gel", cx: s.x + s.w / 2, cy: DESK_Y - 10 - s.h / 2, hw: s.w / 2 + 6, hh: s.h / 2 + 6, tip: p.filter === f.id ? "أزل الشفّاف" : `شفّاف ${f.name}` });
      });
      GLASSES.forEach((m) => hot.push({ id: `vision:${m.id}`, kind: "vision", cx: m.x, cy: m.y, hw: 44, hh: 34, tip: m.name }));
      for (const key of ["boy", "girl"]) {
        const P = PORTRAITS[key];
        hot.push({ id: `char:${key}`, kind: "char", cx: P.x + P.w / 2, cy: P.y + P.h / 2, hw: P.w / 2, hh: P.h / 2, tip: key === "boy" ? "ولد" : "بنت" });
      }
      hot.push({ id: "target", kind: "target", cx: TARGET_CARD.x + TARGET_CARD.w / 2, cy: TARGET_CARD.y + TARGET_CARD.h / 2, hw: TARGET_CARD.w / 2, hh: TARGET_CARD.h / 2, tip: "لون جديد" });
      S.hot = hot;

      // ---- رسم ----
      const dpr = S.dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(S.backdrop, 0, 0, canvas.width, canvas.height);
      g.setTransform(dpr * S.s, 0, 0, dpr * S.s, dpr * S.ox, dpr * S.oy);

      drawPortraits(S, g, p.character);
      drawBoard(S, g, p.visionMode);
      drawTargetCard(S, g, infoNormal);
      drawRail(S, g);
      for (let i = 0; i < 3; i++) drawLamp(S, g, i, A.fader[i] / 100);
      drawSubject(S, g, p.character);

      // توهّج القشرة
      const total = CLAMP(info.total / 765, 0, 1);
      g.save();
      g.globalCompositeOperation = "lighter";
      const cg = g.createRadialGradient(CORTEX.x, CORTEX.y, 4, CORTEX.x, CORTEX.y, 70);
      cg.addColorStop(0, `rgba(${info.r},${info.g},${info.b},${0.55 * total})`);
      cg.addColorStop(1, `rgba(${info.r},${info.g},${info.b},0)`);
      g.fillStyle = cg;
      g.beginPath();
      g.arc(CORTEX.x, CORTEX.y, 70, 0, Math.PI * 2);
      g.fill();
      g.restore();

      drawGelFrame(S, g, S.filterObj, A);
      drawBeams(S, g, vals.map((v, i) => A.fader[i]), pass, p.beamMode);

      // توهّج العين بلون الضوء الواصل
      g.save();
      g.globalCompositeOperation = "lighter";
      const eg = g.createRadialGradient(BEAM_END.x, BEAM_END.y, 2, BEAM_END.x, BEAM_END.y, 56);
      eg.addColorStop(0, `rgba(${infoNormal.r},${infoNormal.g},${infoNormal.b},${0.75 * total})`);
      eg.addColorStop(1, `rgba(${infoNormal.r},${infoNormal.g},${infoNormal.b},0)`);
      g.fillStyle = eg;
      g.beginPath();
      g.arc(BEAM_END.x, BEAM_END.y, 56, 0, Math.PI * 2);
      g.fill();
      // نبضات العصب البصري
      const cols = [LIGHTS[0].rgb, LIGHTS[1].rgb, LIGHTS[2].rgb];
      for (const q of S.pulses) {
        const t = q.t;
        const x0 = 632;
        const y0 = 332;
        const cx1 = 540;
        const cy1 = 372;
        const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx1 + t * t * CORTEX.x;
        const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy1 + t * t * CORTEX.y + q.off * Math.sin(t * Math.PI);
        const pg = g.createRadialGradient(px, py, 0, px, py, 7);
        pg.addColorStop(0, "rgba(255,255,255,0.95)");
        pg.addColorStop(0.35, rgba(cols[q.c].map((x) => Math.min(255, x + 50)), 0.85));
        pg.addColorStop(1, rgba(cols[q.c], 0));
        g.fillStyle = pg;
        g.beginPath();
        g.arc(px, py, 7, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      drawGlassesWorn(S, g, p.visionMode, A);
      drawCloud(S, g, info, infoNormal, p.visionMode !== "normal");
      drawGelRack(S, g, p.filter, A);
      drawConsole(S, g, vals, p.beamMode, infoNormal, A);

      // شرر الاحتفال
      for (const sp of S.sparks) {
        g.globalAlpha = CLAMP(sp.life, 0, 1);
        g.fillStyle = rgba(sp.c, 1);
        g.fillRect(sp.x - 2.5, sp.y - 2.5, 5, 5);
      }
      g.globalAlpha = 1;

      // إشارة أولى: نبض حول الفيدر الأول
      if (S.hint) {
        const k = 0.5 + 0.5 * Math.sin(S.t * 3);
        g.strokeStyle = `rgba(255,226,122,${0.35 + 0.5 * k})`;
        g.lineWidth = 2.5;
        rr(g, FADER.xs[0] - 22, FADER.top - 16, 44, FADER.bottom - FADER.top + 32, 10);
        g.stroke();
      }

      // التلميح
      if (S.tip && (!S.tipUntil || performance.now() < S.tipUntil || S.drag)) pill(S.tip.text, S.tip.x, S.tip.y);
      else if (S.tipUntil && performance.now() >= S.tipUntil && !S.drag) S.tip = null;
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
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className="co-canvas-wrap">
      <canvas ref={canvasRef} className="co-canvas" />
    </div>
  );
});

export default ColorScene;
