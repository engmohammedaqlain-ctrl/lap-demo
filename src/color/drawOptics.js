/**
 * drawOptics.js — قلب التجربة: الشخصية المقصوصة، شجرة الإضاءة والكشّافات
 * (أجسام معدنية بعدسات متوهّجة)، الأشعّة (فوتونات/موجات/شعاع) بالمزج الجمعي،
 * إطار الشفّاف الملوّن، النظّارة المرتداة، توهّج القشرة، النبضات العصبية وسحابة
 * التفكير التي تعرض اللون المُدرَك.
 */
import { EYE, CORTEX, LENS_X, GEL_X, GEL_TOP, GEL_BOT, TABLE_Y, LIGHTS, FILTERS, SUBJECTS, VISION_MODES } from "./colorData.js";
import { getArt, rr, rgba, mix, hexToRgb, drawGlow, shadowed, glowSprite } from "./sceneArt.js";
import { txt } from "./drawEnv.js";

export const POLE_X = 1214;

export function lightFrame(i) {
  const L = LIGHTS[i];
  const dx = EYE.x - LENS_X;
  const dy = EYE.y - L.y;
  const len = Math.hypot(dx, dy);
  return { x: LENS_X, y: L.y, ang: Math.atan2(dy, dx), dirX: dx / len, dirY: dy / len, len };
}

/* ======================= شجرة الإضاءة ======================= */
export function drawLightTree(S) {
  const g = S.g;
  const y0 = S.ext.y0;
  // العمود
  const pole = g.createLinearGradient(POLE_X - 7, 0, POLE_X + 7, 0);
  pole.addColorStop(0, "#27313b");
  pole.addColorStop(0.35, "#9aa8b6");
  pole.addColorStop(0.6, "#4d5a67");
  pole.addColorStop(1, "#1a222a");
  shadowed(g, () => {
    g.fillStyle = pole;
    g.fillRect(POLE_X - 7, y0, 14, TABLE_Y - y0 + 6);
  }, 10, 2, 0.5);
  // الأذرع والكولارات
  LIGHTS.forEach((L, i) => {
    const f = lightFrame(i);
    const ax = f.x - f.dirX * 108;
    const ay = f.y - f.dirY * 108;
    g.strokeStyle = "#2a343e";
    g.lineWidth = 11;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(POLE_X, ay + 6);
    g.lineTo(ax, ay + 6);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(POLE_X, ay + 2);
    g.lineTo(ax, ay + 2);
    g.stroke();
    // كولار
    rr(g, POLE_X - 12, ay - 2, 24, 16, 4);
    g.fillStyle = "#38434f";
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(POLE_X - 10, ay, 20, 1.5);
  });
}

/* ======================= الشخصية ======================= */
export function drawSubject(S) {
  const g = S.g;
  const key = S.p.character;
  const sub = SUBJECTS[key];
  const img = S.imgs[key];
  if (!img) return;
  const x = EYE.x - sub.eye[0] * sub.k;
  const y = EYE.y - sub.eye[1] * sub.k;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 30;
  g.shadowOffsetX = -8;
  g.shadowOffsetY = 6;
  g.drawImage(img, x, y, sub.w * sub.k, sub.h * sub.k);
  g.restore();
  // ضوء الحافة (rim light) من الكشّافات: لمعة ملوّنة على الوجه حسب الشدّة
  const vals = [S.p.rVal, S.p.gVal, S.p.bVal];
  g.save();
  g.globalCompositeOperation = "lighter";
  LIGHTS.forEach((L, i) => {
    const a = (vals[i] / 100) * 0.1;
    if (a > 0.004) drawGlow(g, L.color, EYE.x + 50, EYE.y + (i - 1) * 24, 120, a);
  });
  g.restore();
}

/** النظّارة المرتداة على الشخصية (منظر جانبي) */
export function drawGlassesWorn(S) {
  const mode = VISION_MODES.find((v) => v.id === S.p.visionMode);
  if (!mode || !mode.tint) return;
  const wear = S.anim.worn; // 0..1
  if (wear < 0.02) return;
  const g = S.g;
  const tint = mode.tint;
  g.save();
  g.globalAlpha = wear;
  g.translate(EYE.x + 10, EYE.y);
  g.translate(0, (1 - wear) * -14);
  // الذراع نحو الأذن
  g.strokeStyle = "#171d24";
  g.lineWidth = 4.5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-12, -6);
  g.lineTo(-78, 4);
  g.lineTo(-92, 14);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.3)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-12, -8);
  g.lineTo(-78, 2);
  g.stroke();
  // جسر الأنف
  g.strokeStyle = "#171d24";
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(21, -2);
  g.quadraticCurveTo(32, 3, 38, 14);
  g.stroke();
  // العدسة (ناحية العين)
  g.beginPath();
  g.ellipse(6, 0, 15, 22, 0.05, 0, Math.PI * 2);
  const lf = g.createLinearGradient(-10, -20, 22, 22);
  if (tint) {
    lf.addColorStop(0, rgba(mix(tint, [255, 255, 255], 0.3), 0.62));
    lf.addColorStop(1, rgba(tint, 0.5));
  } else {
    lf.addColorStop(0, "rgba(220,240,255,0.30)");
    lf.addColorStop(1, "rgba(180,210,240,0.10)");
  }
  g.fillStyle = lf;
  g.fill();
  g.strokeStyle = "#171d24";
  g.lineWidth = 3.8;
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(4, -2, 11, Math.PI * 1.1, Math.PI * 1.6);
  g.stroke();
  g.restore();
}

/* ======================= الكشّافات ======================= */
export function drawLights(S) {
  const g = S.g;
  const vals = [S.p.rVal, S.p.gVal, S.p.bVal];
  LIGHTS.forEach((L, i) => {
    const f = lightFrame(i);
    const a = vals[i] / 100;
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.ang);
    // ظلّ
    shadowed(g, () => {
      rr(g, -124, -24, 112, 48, 8);
      g.fillStyle = "#222b33";
      g.fill();
    }, 16, 8, 0.55);
    // الغطاء الخلفي بزعانف التبريد
    rr(g, -156, -22, 40, 44, 7);
    g.fillStyle = "#1a2128";
    g.fill();
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 2 ? "#2d3842" : "#46535f";
      g.fillRect(-152 + k * 6, -26 + Math.abs(k - 2.5) * 0.6, 3.6, 52 - Math.abs(k - 2.5) * 1.2);
    }
    // الأسطوانة
    rr(g, -124, -24, 112, 48, 8);
    const body = g.createLinearGradient(0, -24, 0, 24);
    body.addColorStop(0, "#7d8a97");
    body.addColorStop(0.18, "#56626e");
    body.addColorStop(0.55, "#2c353e");
    body.addColorStop(1, "#171d23");
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.fillRect(-120, -21, 104, 2);
    // حلقة اللون
    rr(g, -66, -24.5, 12, 49, 3);
    g.fillStyle = rgba(mix(L.rgb, [0, 0, 0], 0.15), 1);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(-66, -22, 12, 2);
    // فتحات تهوية
    g.fillStyle = "rgba(0,0,0,0.5)";
    for (let k = 0; k < 5; k++) g.fillRect(-112 + k * 9, 6, 5, 11);
    // مقبض علوي
    rr(g, -88, -31, 22, 7, 3);
    g.fillStyle = "#39444f";
    g.fill();
    // القمع الأمامي
    g.beginPath();
    g.moveTo(-14, -24);
    g.lineTo(2, -35);
    g.lineTo(2, 35);
    g.lineTo(-14, 24);
    g.closePath();
    const hood = g.createLinearGradient(-14, 0, 2, 0);
    hood.addColorStop(0, "#3e4a56");
    hood.addColorStop(1, "#aab6c2");
    g.fillStyle = hood;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.4)";
    g.stroke();
    // العدسة
    g.beginPath();
    g.ellipse(2, 0, 7, 32, 0, 0, Math.PI * 2);
    if (a > 0.01) {
      const lens = g.createLinearGradient(-4, 0, 9, 0);
      lens.addColorStop(0, rgba(L.rgb, 1));
      lens.addColorStop(1, rgba(mix(L.rgb, [255, 255, 255], 0.75), 1));
      g.fillStyle = lens;
    } else g.fillStyle = "#4b5661";
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1.6;
    g.stroke();
    // مؤشّر LED خلفي
    g.beginPath();
    g.arc(-136, 0, 3, 0, Math.PI * 2);
    g.fillStyle = a > 0.01 ? "#5cff8b" : "#35403a";
    g.fill();
    g.restore();

    // هالة العدسة
    if (a > 0.01) {
      g.save();
      g.globalCompositeOperation = "lighter";
      drawGlow(g, L.color, f.x + 2, f.y, 38 + a * 40, 0.5 + a * 0.5);
      drawGlow(g, [255, 255, 255], f.x + 2, f.y, 14 + a * 12, 0.5 * a);
      g.restore();
    }
  });
}

/* ======================= الفوتونات والنبضات ======================= */
export function updateOptics(S, dt) {
  const vals = [S.p.rVal, S.p.gVal, S.p.bVal];
  const pass = S.pass;
  const playing = S.p.isPlaying;
  S.spawn = S.spawn || [0, 0, 0];
  if (playing && S.p.beamMode === "particles") {
    LIGHTS.forEach((L, i) => {
      const a = vals[i] / 100;
      if (a <= 0) return;
      S.spawn[i] += 78 * a * dt;
      const f = lightFrame(i);
      while (S.spawn[i] >= 1 && S.photons.length < 320) {
        S.spawn[i] -= 1;
        const spread = (Math.random() - 0.5) * 18;
        const sp = 330 + Math.random() * 120;
        S.photons.push({
          x: f.x - f.dirY * spread,
          y: f.y + f.dirX * spread,
          vx: f.dirX * sp,
          vy: f.dirY * sp,
          size: 6 + Math.random() * 4,
          li: i,
          life: 1,
          crossed: false,
        });
      }
    });
  }
  if (playing) {
    for (const p of S.photons) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.crossed && p.x <= GEL_X) {
        p.crossed = true;
        if (S.anim.gel > 0.9 && Math.random() < 0.92 * (1 - pass[p.li])) {
          p.life = 0;
          S.sparks.push({ x: GEL_X, y: p.y, t: 0, col: LIGHTS[p.li].color });
        }
      }
      const d = Math.hypot(p.x - EYE.x, p.y - EYE.y);
      if (d < 16 || p.x < EYE.x - 20) {
        p.life = 0;
        if (d < 24 && Math.random() < 0.3 && S.pulses.length < 40) S.pulses.push({ s: 0, v: 0.55 + Math.random() * 0.3, col: LIGHTS[p.li].particleColor });
      }
    }
    S.photons = S.photons.filter((p) => p.life > 0);
    if (S.p.beamMode !== "particles" && S.info.total > 15 && Math.random() < dt * 11 && S.pulses.length < 40) {
      S.pulses.push({ s: 0, v: 0.55 + Math.random() * 0.3, col: S.info.hex });
    }
    for (const q of S.pulses) q.s += q.v * dt;
    S.pulses = S.pulses.filter((q) => q.s <= 1);
  }
  for (const k of S.sparks) k.t += dt;
  S.sparks = S.sparks.filter((k) => k.t < 0.35);
  // ذرّات غبار
  for (const m of S.motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.x < 140) m.x = 1180;
    if (m.x > 1180) m.x = 140;
    if (m.y < 60) m.y = 640;
    if (m.y > 650) m.y = 70;
  }
}

/* ======================= الأشعّة ======================= */
function beamSeg(S, i, p0, p1, alpha, nx, ny) {
  const g = S.g;
  const L = LIGHTS[i];
  const mode = S.p.beamMode;
  const rgb = L.rgb;
  const a = Math.max(0.02, alpha);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const w0 = (18 + 14 * a) * (mode === "solid" ? 1 : 0.6);
  const w1 = 9;
  // مخروط ضوء ناعم (يظهر في كل الأنماط بدرجات)
  const grad = g.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
  const base = mode === "solid" ? 0.5 : mode === "waves" ? 0.14 : 0.18;
  grad.addColorStop(0, rgba(rgb, (0.06 + a * base) * 1.1));
  grad.addColorStop(1, rgba(rgb, 0.05 + a * base * 0.55));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(p0.x + nx * w0, p0.y + ny * w0);
  g.lineTo(p1.x + nx * w1, p1.y + ny * w1);
  g.lineTo(p1.x - nx * w1, p1.y - ny * w1);
  g.lineTo(p0.x - nx * w0, p0.y - ny * w0);
  g.closePath();
  g.fill();
  if (mode === "solid") {
    const core = g.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    core.addColorStop(0, rgba(mix(rgb, [255, 255, 255], 0.55), 0.75 * a));
    core.addColorStop(1, rgba(mix(rgb, [255, 255, 255], 0.3), 0.35 * a));
    g.strokeStyle = core;
    g.lineWidth = 3.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  } else if (mode === "waves") {
    const freq = L.wavelength > 600 ? 0.034 : L.wavelength > 500 ? 0.047 : 0.062;
    const amp = 8 + 9 * a;
    for (let k = 0; k < 2; k++) {
      g.strokeStyle = rgba(mix(rgb, [255, 255, 255], 0.25 + k * 0.2), (0.4 + a * 0.5) * (k ? 0.6 : 1));
      g.lineWidth = k ? 1.6 : 2.8;
      g.beginPath();
      const steps = Math.max(10, Math.floor(len / 5));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const off = Math.sin(u * len * freq - S.t * 8 + k * 1.2) * amp * (0.45 + u * 0.55);
        const x = p0.x + dx * u + nx * off;
        const y = p0.y + dy * u + ny * off;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
}

export function drawBeams(S) {
  const g = S.g;
  const vals = [S.p.rVal, S.p.gVal, S.p.bVal];
  const gel = S.anim.gel;
  g.save();
  g.globalCompositeOperation = "lighter";
  LIGHTS.forEach((L, i) => {
    const a = vals[i] / 100;
    if (a <= 0.005) return;
    const f = lightFrame(i);
    const nx = -f.dirY;
    const ny = f.dirX;
    const p0 = { x: f.x, y: f.y };
    const end = { x: EYE.x + 12, y: EYE.y };
    if (gel > 0.9) {
      // نقطة تقاطع الشعاع مع مستوى الشفّاف
      const u = (GEL_X - f.x) / (end.x - f.x);
      const m = { x: GEL_X, y: f.y + (end.y - f.y) * u };
      beamSeg(S, i, p0, m, a, nx, ny);
      beamSeg(S, i, m, end, a * S.pass[i], nx, ny);
      // توهّج على سطح الشفّاف
      drawGlow(g, L.color, m.x, m.y, 26, 0.45 * a);
    } else {
      beamSeg(S, i, p0, end, a, nx, ny);
    }
  });
  g.restore();
}

export function drawPhotons(S) {
  const g = S.g;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const p of S.photons) {
    const L = LIGHTS[p.li];
    const dim = S.anim.gel > 0.9 && p.x < GEL_X ? S.pass[p.li] : 1;
    g.globalAlpha = Math.min(1, 0.35 + 0.65 * dim);
    const sp = glowSprite(L.particleColor);
    g.drawImage(sp, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
  }
  g.globalAlpha = 1;
  for (const k of S.sparks) {
    const u = k.t / 0.35;
    drawGlow(g, k.col, k.x, k.y, 10 + u * 22, 0.8 * (1 - u));
  }
  g.restore();
}

/* ======================= إطار الشفّاف الملوّن ======================= */
export function drawGelFrame(S) {
  const g = S.g;
  const t = S.anim.gel;
  const x = GEL_X;
  // القاعدة والعمود
  const stem = g.createLinearGradient(x - 6, 0, x + 6, 0);
  stem.addColorStop(0, "#222b34");
  stem.addColorStop(0.5, "#8996a3");
  stem.addColorStop(1, "#222b34");
  g.fillStyle = stem;
  g.fillRect(x - 5, GEL_BOT + 8, 10, TABLE_Y - GEL_BOT - 8);
  rr(g, x - 38, TABLE_Y - 8, 76, 12, 5);
  g.fillStyle = "#313c47";
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.28)";
  g.fillRect(x - 36, TABLE_Y - 8, 72, 1.5);
  // الإطار
  const post = (px) => {
    const pg = g.createLinearGradient(px - 3, 0, px + 3, 0);
    pg.addColorStop(0, "#262f38");
    pg.addColorStop(0.5, "#a6b2be");
    pg.addColorStop(1, "#262f38");
    g.fillStyle = pg;
    g.fillRect(px - 3, GEL_TOP - 12, 6, GEL_BOT - GEL_TOP + 28);
  };
  post(x - 13);
  post(x + 13);
  rr(g, x - 18, GEL_TOP - 16, 36, 9, 3);
  g.fillStyle = "#3b4752";
  g.fill();
  rr(g, x - 18, GEL_BOT + 4, 36, 9, 3);
  g.fill();
  // الشفّاف المنزلق
  const f = S.filterObj || S.lastFilter;
  if (f && t > 0.01) {
    const e = 1 - Math.pow(1 - t, 3);
    const off = -(1 - e) * (GEL_BOT - GEL_TOP + 40);
    g.save();
    g.beginPath();
    g.rect(x - 15, GEL_TOP - 8, 30, GEL_BOT - GEL_TOP + 16);
    g.clip();
    const rgb = f.rgb;
    const gg = g.createLinearGradient(x - 10, 0, x + 10, 0);
    gg.addColorStop(0, rgba(mix(rgb, [255, 255, 255], 0.35), 0.72));
    gg.addColorStop(0.5, rgba(rgb, 0.55));
    gg.addColorStop(1, rgba(mix(rgb, [0, 0, 0], 0.2), 0.7));
    g.fillStyle = gg;
    g.fillRect(x - 10, GEL_TOP + off, 20, GEL_BOT - GEL_TOP);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(x - 9, GEL_TOP + off, 2, GEL_BOT - GEL_TOP);
    g.restore();
    // تأثير الضوء الملوّن العابر
    g.save();
    g.globalCompositeOperation = "lighter";
    drawGlow(g, rgb, x, (GEL_TOP + GEL_BOT) / 2, 220, 0.07 * e);
    g.restore();
  }
}

/* ======================= الدماغ: توهّج + نبضات + سحابة التفكير ======================= */
export function drawCortexAndPulses(S) {
  const g = S.g;
  const info = S.info;
  if (info.total > 15) {
    const pulse = 0.78 + Math.sin(S.t * 3) * 0.12;
    g.save();
    g.globalCompositeOperation = "lighter";
    const a = Math.min(0.95, 0.3 + (info.total / 765) * 0.7);
    drawGlow(g, info.hex, CORTEX.x, CORTEX.y, 54 * pulse, a);
    drawGlow(g, info.hex, EYE.x, EYE.y, 30, a * 0.35);
    g.restore();
  }
  // النبضات على العصب البصري
  const p0 = { x: EYE.x - 8, y: EYE.y + 4 };
  const p1 = { x: (EYE.x + CORTEX.x) / 2 - 6, y: EYE.y + 20 };
  const p2 = { x: CORTEX.x, y: CORTEX.y };
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const q of S.pulses) {
    const s = q.s;
    const x = (1 - s) * (1 - s) * p0.x + 2 * (1 - s) * s * p1.x + s * s * p2.x;
    const y = (1 - s) * (1 - s) * p0.y + 2 * (1 - s) * s * p1.y + s * s * p2.y;
    drawGlow(g, q.col === "#FFFFFF" || q.col === "#ffffff" ? "#FFD54A" : q.col, x, y, 11, 0.95);
    drawGlow(g, [255, 255, 255], x, y, 4.5, 0.9);
  }
  g.restore();
}

export function drawCloud(S) {
  const g = S.g;
  const info = S.info;
  const cx = 372;
  const cy = 92;
  const active = info.total > 15;
  g.save();
  // نقاط التفكير
  [
    [CORTEX.x - 2, CORTEX.y - 64, 5],
    [CORTEX.x - 20, CORTEX.y - 100, 8],
    [cx + 36, cy + 60, 12],
  ].forEach(([x, y, r]) => {
    g.beginPath();
    g.arc(x, y, r + 1.5, 0, Math.PI * 2);
    g.fillStyle = "rgba(140,170,210,0.4)";
    g.fill();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = "#f4f8ff";
    g.fill();
  });
  const bumps = [
    [-96, 6, 30],
    [-72, -20, 36],
    [-34, -32, 40],
    [8, -30, 42],
    [48, -20, 38],
    [86, 4, 33],
    [60, 28, 34],
    [18, 36, 38],
    [-28, 36, 36],
    [-68, 26, 30],
  ];
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 24;
  g.shadowOffsetY = 8;
  g.fillStyle = "#f4f8ff";
  bumps.forEach(([dx, dy, r]) => {
    g.beginPath();
    g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    g.fill();
  });
  g.beginPath();
  g.ellipse(cx, cy, 96, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = "transparent";
  // حافة داخلية خفيفة
  g.strokeStyle = "rgba(120,150,190,0.5)";
  g.lineWidth = 1.5;
  bumps.forEach(([dx, dy, r]) => {
    g.beginPath();
    g.arc(cx + dx, cy + dy, r, Math.PI * 0.05, Math.PI * 0.05 + 0.01);
  });
  // قرص اللون المُدرَك
  const sx = cx - 50;
  g.save();
  if (active) {
    g.shadowColor = info.hex;
    g.shadowBlur = 26 + Math.sin(S.t * 3) * 5;
  }
  g.beginPath();
  g.arc(sx, cy, 33, 0, Math.PI * 2);
  g.fillStyle = active ? info.hex : "#15191e";
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(0,0,0,0.18)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(sx, cy, 33, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.4)";
  g.beginPath();
  g.ellipse(sx - 11, cy - 12, 10, 5.5, -0.5, 0, Math.PI * 2);
  g.fill();

  // الاسم: رئيسي كبير + توضيح
  const full = info.arabicName;
  const paren = full.indexOf("(");
  const main = paren > 0 ? full.slice(0, paren).trim() : full;
  const sub = paren > 0 ? full.slice(paren).trim() : "ما يراه الدماغ";
  const tx = cx + 84;
  const maxW = 96;
  let size = S.fs(22, 13);
  g.font = `800 ${size}px 'IBM Plex Sans Arabic', sans-serif`;
  const w = g.measureText(main).width;
  if (w > maxW) {
    size = Math.max(S.fs(12, 11), size * (maxW / w));
    g.font = `800 ${size}px 'IBM Plex Sans Arabic', sans-serif`;
  }
  g.textAlign = "right";
  g.textBaseline = "middle";
  g.fillStyle = "#1c2733";
  g.fillText(main, tx, cy - 6);
  txt(S, sub, tx, cy + 17, { size: 11, color: "#5d6f84", align: "right", weight: 600, min: 9 });
  g.restore();
}

export function drawMotes(S) {
  const g = S.g;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const m of S.motes) {
    g.globalAlpha = m.a;
    g.fillStyle = "#cfe6ff";
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function drawTip(S) {
  if (!S.tip) return;
  const g = S.g;
  const { text, x, y } = S.tip;
  const size = S.fs(13, 11);
  g.font = `700 ${size}px 'IBM Plex Sans Arabic', sans-serif`;
  const w = g.measureText(text).width + 22;
  const h = size + 14;
  const px = Math.max(w / 2 + 6, Math.min(1280 - w / 2 - 6, x));
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 12;
  g.shadowOffsetY = 4;
  rr(g, px - w / 2, y - h, w, h, h / 2);
  g.fillStyle = "rgba(250,252,255,0.97)";
  g.fill();
  g.restore();
  g.beginPath();
  g.moveTo(x - 6, y - 1);
  g.lineTo(x + 6, y - 1);
  g.lineTo(x, y + 6);
  g.closePath();
  g.fillStyle = "rgba(250,252,255,0.97)";
  g.fill();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#1b2733";
  g.fillText(text, px, y - h / 2 + 1);
}

export { hexToRgb, getArt };
