/**
 * CellScene.jsx — لوحة (canvas) واحدة لتجربة «رحلة داخل الخلية» (v2).
 *
 * الجديد في v2:
 *  - مقدّمة حسب النوع: الحيوانية تبدأ من وجه إنسان ← الخدّ؛ النباتية من بصلة.
 *  - غوص أعمق: انقر «اغطس داخله» فتدخل العضيّ نفسه وترى مكوّناته الداخلية.
 *  - كشف hover فخم: تمرير المؤشّر يُظهر مكوّنات العضيّ بحلقة مسح ووصلات.
 *  - صوت زوم قويّ يتبع سرعة التكبير + تحديد «خيالي».
 *
 * الأساس كما v1: حلقة rAF واحدة على simRef، مرآة propsRef، كل الرسم متجهي على
 * canvas (صفر صور نقطية)، كاشف أداء يقلّل الجسيمات، احترام reduced-motion.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SCENE_W,
  SCENE_H,
  CX,
  CY,
  CELL_R,
  STAGES,
  MICRO_LIMIT_P,
  FINE_DETAIL_P,
  CROWD,
  PARTICLE_HUES,
  PALETTE,
  ORGANELLES,
  INTRO,
  interiorFor,
  organelleKind,
  CLAMP,
  LERP,
  fade,
} from "./cellData.js";
import { CellSound } from "./cellAudio.js";
import onionUrl from "./assets/onion.jpg";
// صورة وجه حقيقية اختيارية: ضع ملفاً باسم face.jpg في مجلد assets ثم فعّل
// السطر التالي (وحده) وستُستخدم تلقائياً بدل الوجه الإجرائي:
// import faceUrl from "./assets/face.jpg";
const faceUrl = null;

const CELL_FIT = Math.min(SCENE_W, SCENE_H) / (2 * CELL_R);
const CONFINE_R = CELL_R * 0.94;

const insideProgress = (p) => {
  const t = CLAMP((p - STAGES.inside.in[0]) / (1 - STAGES.inside.in[0]), 0, 1);
  return t * t * (3 - 2 * t);
};
const worldScaleFor = (p) => CELL_FIT * 0.92 * LERP(0.82, 2.45, insideProgress(p));

function stageLabel(p) {
  if (p < 0.2) return "المقدّمة";
  if (p < 0.45) return "نسيج خلايا";
  if (p < 0.7) return "خلية واحدة";
  return "داخل الخلية";
}
function magLabel(p) {
  if (p < 0.2) return STAGES.droplet.mag;
  if (p < 0.45) return STAGES.cluster.mag;
  if (p < 0.7) return STAGES.cell.mag;
  return STAGES.inside.mag;
}

function buildOrganelles(cellType) {
  return ORGANELLES.filter((o) => !o.only || o.only === cellType).map((o) => {
    const inst = { ...o };
    if (cellType === "plant" && o.plant) Object.assign(inst, o.plant);
    if (cellType === "plant" && o.plantShift) {
      inst.x = o.x + o.plantShift.x;
      inst.y = o.y + o.plantShift.y;
    }
    return inst;
  });
}

function makeParticles(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(makeParticle());
  return arr;
}
function makeParticle(fine) {
  const layer = fine ? 2 : (Math.random() * 3) | 0;
  const a = Math.random() * Math.PI * 2;
  const rr = Math.sqrt(Math.random()) * CONFINE_R;
  const base = fine ? 1.1 : 2.2;
  return {
    x: Math.cos(a) * rr,
    y: Math.sin(a) * rr,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: base + Math.random() * (fine ? 1.2 : 3.4) - layer * 0.4,
    layer,
    hue: (Math.random() * PARTICLE_HUES.length) | 0,
    alpha: fine ? 0.5 : 0.6 + Math.random() * 0.4,
    fine: !!fine,
  };
}

function buildSprites() {
  const sprites = [];
  for (let h = 0; h < PARTICLE_HUES.length; h++) {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const rg = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    rg.addColorStop(0, PARTICLE_HUES[h] + "1)");
    rg.addColorStop(0.5, PARTICLE_HUES[h] + "0.55)");
    rg.addColorStop(1, PARTICLE_HUES[h] + "0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 32);
    sprites.push(c);
  }
  return sprites;
}

function buildGrain() {
  const c = document.createElement("canvas");
  c.width = c.height = 140;
  const g = c.getContext("2d");
  const img = g.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeSim(cellType, reduced) {
  return {
    t: 0,
    p: reduced ? 0.82 : 0.0,
    pTarget: reduced ? 0.82 : 0.82,
    prevP: reduced ? 0.82 : 0.0,
    zoomVel: 0,
    autoplay: !reduced,
    panX: 0,
    panY: 0,
    organelles: buildOrganelles(cellType),
    particles: makeParticles(CROWD.target),
    fine: makeParticles(CROWD.fine).map((p) => ((p.fine = true), p)),
    activeCount: CROWD.target,
    fineActive: 0,
    vesicles: [],
    atp: [],
    chain: 0,
    diffFlash: 0,
    shake: null,
    celebrate: 0,
    limitCrossed: false,
    frameAvg: 16,
    perfTick: 0,
    lastReport: "",
    lastPerf: -1,
    // v2
    hoverId: null,
    hoverAmt: 0,
    focusId: null,
    diveP: 0,
    diveTarget: 0,
    burst: [], // ومضات تحديد خيالية
    lastFocusReport: "",
  };
}

const CellScene = forwardRef(function CellScene(
  { cellType, mode, selectedId, reducedMotion, soundEnabled, onPick, onZoom, onPerf, onFocus },
  ref
) {
  const canvasRef = useRef(null);
  const simRef = useRef(makeSim(cellType, reducedMotion));
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const spritesRef = useRef(null);
  const grainRef = useRef(null);
  const imagesRef = useRef({ onion: null, face: null });
  const viewRef = useRef({ cs: 1, tx: 0, ty: 0, cw: SCENE_W, ch: SCENE_H, dpr: 1 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  const propsRef = useRef({});
  propsRef.current = { cellType, mode, selectedId, reducedMotion, soundEnabled, onPick, onZoom, onPerf, onFocus };

  useImperativeHandle(ref, () => ({
    resetView() {
      const s = simRef.current;
      const reduced = propsRef.current.reducedMotion;
      s.p = reduced ? 0.82 : 0.02;
      s.pTarget = 0.82;
      s.panX = 0;
      s.panY = 0;
      s.autoplay = !reduced;
      s.limitCrossed = reduced;
      s.focusId = null;
      s.diveP = 0;
      s.diveTarget = 0;
    },
    flashDifferences() {
      simRef.current.diffFlash = 2.6;
    },
    hintWrong(id) {
      simRef.current.shake = { id, t: 0.6 };
    },
    celebrate() {
      simRef.current.celebrate = 1.4;
      spawnBurst(simRef.current, 0, 0, 40);
    },
    diveInto(id) {
      const s = simRef.current;
      if (!interiorFor(id)) return;
      s.focusId = id;
      s.diveTarget = 1;
      if (propsRef.current.soundEnabled) CellSound.playDiveIn();
    },
    exitDive() {
      simRef.current.diveTarget = 0;
    },
  }));

  function worldScale() {
    return worldScaleFor(simRef.current.p);
  }
  // من إحداثيات الشاشة إلى تصميم المشهد (عكس تحويل cover)
  function toDesign(clientX, clientY) {
    const rect = canvasRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    return { x: (cssX - v.tx) / v.cs, y: (cssY - v.ty) / v.cs };
  }
  function toLocal(clientX, clientY) {
    const d = toDesign(clientX, clientY);
    const s = worldScale();
    const sim = simRef.current;
    return { x: (d.x - CX) / s - sim.panX, y: (d.y - CY) / s - sim.panY };
  }

  function pickAt(clientX, clientY) {
    const { x, y } = toLocal(clientX, clientY);
    const sim = simRef.current;
    for (const o of sim.organelles) {
      const dx = x - o.x;
      const dy = y - o.y;
      const rot = o.rot || 0;
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const ex = (dx * c - dy * s) / (o.rx * 1.05);
      const ey = (dx * s + dy * c) / (o.ry * 1.05);
      if (ex * ex + ey * ey <= 1) return o.id;
    }
    const d = Math.hypot(x, y);
    if (d > CONFINE_R * 0.9) return propsRef.current.cellType === "plant" ? "wall" : "membrane";
    if (d < CONFINE_R) return "cytoplasm";
    return null;
  }

  function spawnBurst(sim, x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      sim.burst.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        hue: Math.random() * 360,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  /* ===================================================================== */
  /* التحديث                                                                */
  /* ===================================================================== */
  function step(dt) {
    const sim = simRef.current;
    const { reducedMotion: reduced, soundEnabled: sound, selectedId: sel } = propsRef.current;
    const animDt = reduced ? 0 : dt;
    sim.t += animDt;

    // الزووم
    sim.prevP = sim.p;
    if (sim.autoplay) {
      const nearLimit = Math.abs(sim.p - MICRO_LIMIT_P) < 0.06;
      sim.p += (sim.pTarget - sim.p) * (nearLimit ? 0.055 : 0.14);
      if (Math.abs(sim.p - sim.pTarget) < 0.002) sim.autoplay = false;
    } else {
      const nearLimit = Math.abs(sim.p - MICRO_LIMIT_P) < 0.05;
      sim.p += (sim.pTarget - sim.p) * (nearLimit ? 0.06 : 0.18);
    }
    sim.p = CLAMP(sim.p, 0, 1);
    sim.zoomVel = sim.zoomVel * 0.7 + Math.abs(sim.p - sim.prevP) * 0.3;

    // الغوص داخل العضي
    sim.diveP += (sim.diveTarget - sim.diveP) * 0.12;
    if (sim.diveTarget === 0 && sim.diveP < 0.02) sim.focusId = null;

    // كشف hover
    sim.hoverAmt += ((sim.hoverId ? 1 : 0) - sim.hoverAmt) * 0.15;

    // صوت الزوم القوي (يتبع السرعة) + whoosh الغوص
    if (sound && !reduced) {
      const v = sim.zoomVel * 55 + Math.abs(sim.diveTarget - sim.diveP) * 8;
      CellSound.updateZoom(v);
    }

    if (!sim.limitCrossed && sim.p > MICRO_LIMIT_P + 0.01) {
      sim.limitCrossed = true;
      if (sound && !reduced) CellSound.playDive();
    }
    if (sim.p < MICRO_LIMIT_P - 0.05) sim.limitCrossed = false;

    const inside = sim.p > 0.6 && sim.diveP < 0.6;
    if (inside && !reduced) {
      updateParticles(sim, sim.particles, sim.activeCount, animDt);
      sim.fineActive = sim.p > FINE_DETAIL_P ? Math.min(sim.fine.length, sim.activeCount * 0.4) : 0;
      if (sim.fineActive > 0) updateParticles(sim, sim.fine, sim.fineActive, animDt);
    }

    // حياة جولجي
    if (!reduced && inside) {
      const golgi = sim.organelles.find((o) => o.id === "golgi");
      if (golgi) {
        golgi._vt = (golgi._vt || 0) + animDt;
        const rate = sim.celebrate > 0 || sel === "golgi" ? 1.1 : 2.4;
        if (golgi._vt > rate) {
          golgi._vt = 0;
          const a = Math.random() * Math.PI * 2;
          sim.vesicles.push({ x: golgi.x + Math.cos(a) * golgi.rx * 0.4, y: golgi.y - golgi.ry, vx: Math.cos(a) * 8, vy: -14 - Math.random() * 8, r: 5 + Math.random() * 3, life: 1 });
          if (sound) CellSound.playPop();
        }
      }
      for (let i = sim.vesicles.length - 1; i >= 0; i--) {
        const v = sim.vesicles[i];
        v.x += v.vx * animDt;
        v.y += v.vy * animDt;
        v.vy += 3 * animDt;
        v.life -= 0.35 * animDt;
        if (v.life <= 0) sim.vesicles.splice(i, 1);
      }
    }

    // ATP للميتوكوندريا المختارة
    if (!reduced && inside && sel && sel.startsWith("mito")) {
      const m = sim.organelles.find((o) => o.id === sel);
      if (m) {
        m._at = (m._at || 0) + animDt;
        if (m._at > 0.7) {
          m._at = 0;
          const a = Math.random() * Math.PI * 2;
          sim.atp.push({ x: m.x, y: m.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, life: 1 });
          if (sound) CellSound.playPulse();
        }
      }
    }
    for (let i = sim.atp.length - 1; i >= 0; i--) {
      const a = sim.atp[i];
      a.x += a.vx * animDt;
      a.y += a.vy * animDt;
      a.life -= 0.7 * animDt;
      if (a.life <= 0) sim.atp.splice(i, 1);
    }

    if (!reduced && sel === "ribosome") {
      sim.chain += animDt * 2.2;
      if (sim.chain > 14) {
        sim.chain = 0;
        if (sound) CellSound.playPop();
      }
    }

    // ومضات التحديد الخيالية
    for (let i = sim.burst.length - 1; i >= 0; i--) {
      const b = sim.burst[i];
      b.x += b.vx * animDt;
      b.y += b.vy * animDt;
      b.vx *= 0.94;
      b.vy *= 0.94;
      b.life -= 0.5 * animDt;
      if (b.life <= 0) sim.burst.splice(i, 1);
    }

    if (sim.diffFlash > 0) sim.diffFlash -= dt;
    if (sim.celebrate > 0) sim.celebrate -= dt;
    if (sim.shake) {
      sim.shake.t -= dt;
      if (sim.shake.t <= 0) sim.shake = null;
    }

    // كاشف الأداء
    sim.frameAvg = sim.frameAvg * 0.9 + Math.min(50, dt * 16.667) * 0.1;
    sim.perfTick++;
    if (sim.perfTick > 30) {
      sim.perfTick = 0;
      if (sim.frameAvg > 22 && sim.activeCount > CROWD.min) sim.activeCount = Math.max(CROWD.min, sim.activeCount - 40);
      else if (sim.frameAvg < 15 && sim.activeCount < CROWD.target) sim.activeCount = Math.min(CROWD.target, sim.activeCount + 20);
    }

    reportState(sim);
  }

  function updateParticles(sim, list, count, dt) {
    for (let i = 0; i < count; i++) {
      const pt = list[i];
      pt.vx += (Math.random() - 0.5) * 0.9 * (3 - pt.layer);
      pt.vy += (Math.random() - 0.5) * 0.9 * (3 - pt.layer);
      pt.vx *= 0.9;
      pt.vy *= 0.9;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const d = Math.hypot(pt.x, pt.y);
      if (d > CONFINE_R - pt.r) {
        const nx = pt.x / d;
        const ny = pt.y / d;
        pt.x = nx * (CONFINE_R - pt.r);
        pt.y = ny * (CONFINE_R - pt.r);
        const dot = pt.vx * nx + pt.vy * ny;
        pt.vx -= 2 * dot * nx;
        pt.vy -= 2 * dot * ny;
      }
      for (const o of sim.organelles) {
        if (o.rx < 20) continue;
        const dx = pt.x - o.x;
        const dy = pt.y - o.y;
        const rot = o.rot || 0;
        const c = Math.cos(-rot);
        const s = Math.sin(-rot);
        const ex = (dx * c - dy * s) / (o.rx + pt.r);
        const ey = (dx * s + dy * c) / (o.ry + pt.r);
        const dd = ex * ex + ey * ey;
        if (dd < 1) {
          const push = 1 - Math.sqrt(dd) + 0.02;
          const wx = ex * c + ey * s;
          const wy = -ex * s + ey * c;
          const wl = Math.hypot(wx, wy) || 1;
          pt.x += (wx / wl) * push * (o.rx * 0.25);
          pt.y += (wy / wl) * push * (o.ry * 0.25);
          const dot = pt.vx * (wx / wl) + pt.vy * (wy / wl);
          if (dot < 0) {
            pt.vx -= 1.6 * dot * (wx / wl);
            pt.vy -= 1.6 * dot * (wy / wl);
          }
        }
      }
    }
  }

  function reportState(sim) {
    const { onZoom, onPerf, onFocus } = propsRef.current;
    const pct = Math.round(sim.p * 20) * 5;
    const label = stageLabel(sim.p);
    const atLimit = Math.abs(sim.p - MICRO_LIMIT_P) < 0.06;
    const sig = `${label}|${pct}|${atLimit}`;
    if (sig !== sim.lastReport) {
      sim.lastReport = sig;
      onZoom && onZoom({ p: sim.p, pct, stage: label, mag: magLabel(sim.p), atLimit });
    }
    if (sim.activeCount !== sim.lastPerf) {
      sim.lastPerf = sim.activeCount;
      onPerf && onPerf(sim.activeCount);
    }
    const fsig = `${sim.focusId || ""}|${sim.diveP > 0.5}`;
    if (fsig !== sim.lastFocusReport) {
      sim.lastFocusReport = fsig;
      onFocus && onFocus({ focusId: sim.diveP > 0.15 ? sim.focusId : null, inside: sim.diveP > 0.5 });
    }
  }

  /* ===================================================================== */
  /* الرسم                                                                  */
  /* ===================================================================== */
  function render(ctx) {
    const sim = simRef.current;
    const type = propsRef.current.cellType;
    const v = viewRef.current;
    // امسح كامل مخزن البكسل ثم طبّق تحويل cover (تصميم → يملأ اللوحة بحدّة)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.setTransform(v.cs * v.dpr, 0, 0, v.cs * v.dpr, v.tx * v.dpr, v.ty * v.dpr);
    drawBackdrop(ctx, sim);

    const aIntro = fade(sim.p, STAGES.droplet.in, STAGES.droplet.out);
    const aClu = fade(sim.p, STAGES.cluster.in, STAGES.cluster.out);
    const aCell = fade(sim.p, STAGES.cell.in, STAGES.cell.out);
    const aIn = fade(sim.p, STAGES.inside.in, null) * (1 - sim.diveP);

    if (aIntro > 0.01) drawIntro(ctx, sim, aIntro, type);
    if (aClu > 0.01) drawCluster(ctx, sim, aClu, type);
    if (aCell > 0.01) drawCellExterior(ctx, sim, aCell, type);
    if (aIn > 0.01) drawInside(ctx, sim, aIn);

    // الغوص داخل العضي (فوق كل شيء)
    if (sim.diveP > 0.01) drawInterior(ctx, sim);

    drawMicroLimit(ctx, sim);
    drawBurst(ctx, sim);
    drawGrain(ctx);
  }

  function drawBackdrop(ctx, sim) {
    const g = ctx.createRadialGradient(CX, CY * 0.7, 40, CX, CY, SCENE_W * 0.75);
    if (sim.diveP > 0.4 && sim.focusId) {
      const it = interiorFor(sim.focusId);
      g.addColorStop(0, it.bg[0]);
      g.addColorStop(1, it.bg[1]);
    } else if (sim.p < 0.55) {
      // خلفية المقدّمة — دافئة موحّدة مع ثيم الموقع
      g.addColorStop(0, "#fdf6ea");
      g.addColorStop(1, "#efe3cf");
    } else {
      g.addColorStop(0, PALETTE.cytoMid);
      g.addColorStop(0.6, PALETTE.cytoDeep);
      g.addColorStop(1, "#b98cc0");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }

  /* ---- المقدّمة حسب النوع: وجه حقيقي / بصلة حقيقية ---- */
  function drawIntro(ctx, sim, alpha, type) {
    const gp = CLAMP(sim.p / 0.24, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (type === "plant") {
      const img = imagesRef.current.onion;
      if (img) drawPhotoIntro(ctx, sim, gp, img, 0.5, 0.5, "قشرة البصل");
      else drawOnion(ctx, sim, gp);
    } else {
      const img = imagesRef.current.face;
      if (img) drawPhotoIntro(ctx, sim, gp, img, 0.62, 0.55, "الخدّ");
      else drawFace(ctx, sim, gp);
    }
    ctx.restore();
  }

  /* رسم صورة حقيقية والغوص في نقطة منها (fx,fy نسبيّتان) */
  function drawPhotoIntro(ctx, sim, gp, img, fx, fy, label) {
    const iw = img.width;
    const ih = img.height;
    const fit = Math.max((SCENE_W * 1.02) / iw, (SCENE_H * 1.02) / ih); // cover التصميم
    const w = iw * fit;
    const h = ih * fit;
    const px = CX + (fx - 0.5) * w * 0.6; // نقطة الغوص
    const py = CY + (fy - 0.5) * h * 0.6;
    const scale = LERP(1, 6.5, gp * gp);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.translate(-px, -py);
    ctx.drawImage(img, CX - w / 2, CY - h / 2, w, h);
    // تدرّج حيوي خفيف يوحّدها مع ثيم المشهد
    const vg = ctx.createRadialGradient(px, py, 10, px, py, Math.max(w, h) * 0.6);
    vg.addColorStop(0, "rgba(255,220,150,0.05)");
    vg.addColorStop(1, "rgba(20,10,20,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(CX - w / 2, CY - h / 2, w, h);
    ctx.restore();
    // حلقة تحديد نابضة على نقطة الغوص + لافتة
    const pulse = 0.5 + 0.5 * Math.sin(sim.t * 3);
    ctx.save();
    ctx.globalAlpha = 1 - gp;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(px, py, 40 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "bold 18px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText(label, px, py - 54);
    ctx.restore();
  }

  function drawFace(ctx, sim, gp) {
    // نغوص نحو الخدّ (يمين أسفل الوجه)
    const cheekX = CX + 70;
    const cheekY = CY + 30;
    const scale = LERP(1, 6, gp);
    ctx.translate(cheekX, cheekY);
    ctx.scale(scale, scale);
    ctx.translate(-cheekX, -cheekY);
    // رأس
    const skin = ctx.createRadialGradient(CX - 30, CY - 40, 20, CX, CY, 170);
    skin.addColorStop(0, "#ffe0c2");
    skin.addColorStop(0.7, "#f4c19a");
    skin.addColorStop(1, "#e0a985");
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(CX, CY, 120, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    // شعر
    ctx.fillStyle = "#4e342e";
    ctx.beginPath();
    ctx.ellipse(CX, CY - 110, 118, 70, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // عينان
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(CX - 45, CY - 30, 22, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(CX + 45, CY - 30, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b2b20";
    ctx.beginPath();
    ctx.arc(CX - 45, CY - 30, 8, 0, Math.PI * 2);
    ctx.arc(CX + 45, CY - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    // أنف
    ctx.strokeStyle = "rgba(180,120,90,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(CX, CY - 20);
    ctx.quadraticCurveTo(CX + 10, CY + 10, CX, CY + 20);
    ctx.stroke();
    // ابتسامة
    ctx.beginPath();
    ctx.arc(CX, CY + 40, 40, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // وهج على الخدّ (نقطة الغوص)
    const glow = 0.4 + 0.4 * Math.sin(sim.t * 3);
    const gg = ctx.createRadialGradient(cheekX, cheekY, 2, cheekX, cheekY, 46);
    gg.addColorStop(0, `rgba(255,120,120,${0.6 * glow})`);
    gg.addColorStop(1, "rgba(255,120,120,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(cheekX, cheekY, 46, 0, Math.PI * 2);
    ctx.fill();
    // لافتة
    ctx.globalAlpha = 1 - gp;
    ctx.fillStyle = "#8a3b2a";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "bold 16px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText("الخدّ", cheekX, cheekY - 54);
  }

  function drawOnion(ctx, sim, gp) {
    const scale = LERP(1, 6, gp);
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    ctx.translate(-CX, -CY);
    // بصلة (طبقات)
    for (let i = 6; i >= 0; i--) {
      const rr = 40 + i * 20;
      const g = ctx.createRadialGradient(CX, CY - 10, rr * 0.2, CX, CY, rr);
      const shade = 235 - i * 12;
      g.addColorStop(0, `rgb(${shade},${shade - 20},${shade - 60})`);
      g.addColorStop(1, `rgb(${shade - 30},${shade - 55},${shade - 95})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(CX, CY, rr, rr * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(150,110,60,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // جذور
    ctx.strokeStyle = "rgba(220,210,180,0.8)";
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(CX + i * 6, CY + 165);
      ctx.lineTo(CX + i * 9, CY + 195 + Math.sin(sim.t + i) * 4);
      ctx.stroke();
    }
    // ساق أخضر
    ctx.strokeStyle = "#7cb342";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(CX, CY - 130);
    ctx.quadraticCurveTo(CX - 20, CY - 190, CX - 8, CY - 230);
    ctx.stroke();
    ctx.globalAlpha = 1 - gp;
    ctx.fillStyle = "#5a7a2a";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "bold 16px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText("بصلة", CX, CY - 10);
  }

  /* ---- نسيج الخلايا (حيواني دائري / نباتي مستطيل) ---- */
  function drawCluster(ctx, sim, alpha, type) {
    const gp = CLAMP((sim.p - 0.16) / 0.34, 0, 1);
    const scale = LERP(0.7, 4.2, gp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    if (type === "plant") {
      // خلايا نباتية مرصوصة كالطوب (جدران مستقيمة)
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const x = c * 96 + (r % 2) * 12;
          const y = r * 78;
          const wob = Math.sin(sim.t * 0.5 + x + y) * 2;
          const g = ctx.createLinearGradient(x - 45, y, x + 45, y);
          g.addColorStop(0, "#d7ecc4");
          g.addColorStop(1, "#a7cf87");
          ctx.fillStyle = g;
          roundRect(ctx, x - 45, y - 36 + wob, 90, 72, 10);
          ctx.fill();
          ctx.strokeStyle = "rgba(90,130,60,0.7)";
          ctx.lineWidth = 4 / scale + 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(120,180,90,0.5)";
          ctx.beginPath();
          ctx.arc(x + 18, y - 6, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const cells = [[0, 0, 62], [-95, -40, 48], [88, -55, 52], [-70, 70, 50], [80, 72, 46], [0, -110, 40], [-140, 15, 38], [140, 10, 40], [10, 118, 44]];
      for (const [x, y, r] of cells) {
        const wob = Math.sin(sim.t * 0.6 + x) * 3;
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, "rgba(255,224,205,0.97)");
        g.addColorStop(0.7, "rgba(244,193,154,0.9)");
        g.addColorStop(1, "rgba(210,150,110,0.7)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r + wob, r - wob, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(126,87,194,0.55)";
        ctx.beginPath();
        ctx.arc(x + r * 0.1, y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(180,120,90,0.5)";
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCellExterior(ctx, sim, alpha, type) {
    const gp = CLAMP((sim.p - 0.42) / 0.3, 0, 1);
    const scale = LERP(0.85, 3.2, gp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    drawMembranePath(ctx, sim, CELL_R * 0.62, type === "plant");
    const g = ctx.createRadialGradient(-20, -12, 8, -20, -12, 70);
    g.addColorStop(0, "rgba(126,87,194,0.85)");
    g.addColorStop(1, "rgba(69,39,160,0.2)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(-20, -12, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawInside(ctx, sim, alpha) {
    const s = worldScale();
    ctx.save();
    ctx.globalAlpha = alpha;
    drawParticleLayer(ctx, sim, s, 0.6, [0]);
    ctx.save();
    ctx.translate(CX + sim.panX * s, CY + sim.panY * s);
    ctx.scale(s, s);
    drawCytoBody(ctx, sim);
    drawOrganelles(ctx, sim);
    drawVesicles(ctx, sim);
    drawATP(ctx, sim);
    drawHoverReveal(ctx, sim);
    ctx.restore();
    drawParticleLayer(ctx, sim, s, 1.25, [1, 2]);
    ctx.restore();
  }

  function drawCytoBody(ctx, sim) {
    const plant = propsRef.current.cellType === "plant";
    const nuc = sim.organelles.find((o) => o.id === "nucleus");
    if (nuc) {
      const gg = ctx.createRadialGradient(nuc.x, nuc.y, 10, nuc.x, nuc.y, CELL_R * 1.1);
      gg.addColorStop(0, PALETTE.nucleusGlow);
      gg.addColorStop(0.5, "rgba(255,210,140,0.12)");
      gg.addColorStop(1, "rgba(255,210,140,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, CONFINE_R, 0, Math.PI * 2);
      ctx.fill();
    }
    if (plant) {
      const hi = sim.diffFlash > 0 ? 0.5 + 0.5 * Math.sin(sim.t * 8) : 0;
      ctx.lineWidth = 20;
      ctx.strokeStyle = "rgba(120,170,90,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, CELL_R * 0.99, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 10;
      ctx.strokeStyle = `rgba(160,200,120,${0.6 + hi * 0.4})`;
      ctx.stroke();
    }
    drawMembranePath(ctx, sim, CONFINE_R, plant);
  }

  function drawMembranePath(ctx, sim, R, plant) {
    ctx.beginPath();
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const wob = plant ? 0 : Math.sin(a * 6 + sim.t * 1.4) * 4 + Math.sin(a * 11 - sim.t) * 2;
      const rr = R + wob;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(194,24,91,0.16)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = PALETTE.membrane;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.membraneLight;
    ctx.stroke();
  }

  function drawParticleLayer(ctx, sim, s, depthFactor, layers) {
    if (sim.p < 0.6) return;
    const sprites = spritesRef.current;
    ctx.save();
    ctx.translate(CX + sim.panX * s * depthFactor, CY + sim.panY * s * depthFactor);
    ctx.scale(s, s);
    const draw = (list, count) => {
      for (let i = 0; i < count; i++) {
        const pt = list[i];
        if (!layers.includes(pt.layer)) continue;
        const df = pt.layer === 0 ? 1.6 : pt.layer === 1 ? 1.15 : 0.95;
        const r = pt.r * df;
        ctx.globalAlpha = pt.alpha * (pt.layer === 0 ? 0.5 : pt.layer === 1 ? 0.8 : 1);
        ctx.drawImage(sprites[pt.hue], pt.x - r * 2, pt.y - r * 2, r * 4, r * 4);
      }
    };
    draw(sim.particles, sim.activeCount);
    if (sim.fineActive > 0) draw(sim.fine, sim.fineActive);
    ctx.restore();
  }

  /* ===== العضيّات ===== */
  function drawOrganelles(ctx, sim) {
    const sel = propsRef.current.selectedId;
    const dim = sel && sel !== "cytoplasm" ? 0.32 : 1;
    for (const o of sim.organelles) {
      const isSel = o.id === sel || (sel === "chloroplast" && o.group === "chloroplast");
      const isHover = o.id === sim.hoverId;
      const a = isSel ? 1 : sel ? dim : isHover ? 1 : 1;
      let sx = 0;
      if (sim.shake && (sim.shake.id === o.id || sim.shake.id === o.group)) sx = Math.sin(sim.t * 40) * 5 * sim.shake.t;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(o.x + sx, o.y);
      ctx.save();
      ctx.translate(0, o.ry * 0.28);
      ctx.fillStyle = "rgba(60,20,60,0.18)";
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx * 0.92, o.ry * 0.7, o.rot || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isSel || isHover) {
        const k = isSel ? 1 : sim.hoverAmt;
        const gr = ctx.createRadialGradient(0, 0, o.rx * 0.4, 0, 0, o.rx * 1.8);
        gr.addColorStop(0, `rgba(255,255,210,${0.5 * k})`);
        gr.addColorStop(1, "rgba(255,255,210,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0, 0, o.rx * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const fn = ORG_DRAW[o.draw];
      if (fn) fn(ctx, o, sim);
      ctx.restore();
    }
    if (sel === "ribosome") drawProteinChain(ctx, sim);
  }

  /* كشف hover الفخم: حلقة مسح دوّارة + وصلات لأسماء المكوّنات */
  function drawHoverReveal(ctx, sim) {
    if (sim.hoverAmt < 0.02 || !sim.hoverId) return;
    const o = sim.organelles.find((x) => x.id === sim.hoverId);
    const it = interiorFor(sim.hoverId);
    if (!o || !it) return;
    const k = sim.hoverAmt;
    ctx.save();
    ctx.translate(o.x, o.y);
    // حلقة مسح دوّارة
    const R = Math.max(o.rx, o.ry) * 1.5;
    ctx.globalAlpha = k;
    ctx.strokeStyle = "rgba(120,230,255,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, R, sim.t * 2, sim.t * 2 + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
    // أسماء المكوّنات تظهر تباعاً بوصلات — على أقراص داكنة لتباين عالٍ
    ctx.font = "700 12px 'IBM Plex Sans Arabic', sans-serif";
    ctx.direction = "rtl";
    ctx.textBaseline = "middle";
    const n = it.parts.length;
    for (let i = 0; i < n; i++) {
      const appear = CLAMP(k * n - i, 0, 1);
      if (appear <= 0) continue;
      const ang = -0.75 + (i / Math.max(1, n - 1)) * 1.5;
      const lx = Math.cos(ang) * (R + 6);
      const ly = Math.sin(ang) * (R + 6);
      const tx = Math.cos(ang) * (R + 66);
      const ty = Math.sin(ang) * (R + 66);
      const right = tx >= 0;
      ctx.globalAlpha = appear * k;
      // وصلة متوهّجة
      ctx.strokeStyle = "rgba(130,235,255,0.85)";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(80,200,255,0.9)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9becff";
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
      // قرص داكن خلف النص (تباين)
      const label = it.parts[i].label;
      const tw = ctx.measureText(label).width;
      const padX = 8;
      const bw = tw + padX * 2;
      const bh = 20;
      const bx = right ? tx : tx - bw;
      const by = ty - bh / 2;
      ctx.fillStyle = "rgba(10,14,26,0.9)";
      ctx.strokeStyle = "rgba(130,235,255,0.6)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, bw, bh, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#eaffff";
      ctx.textAlign = right ? "right" : "left";
      ctx.fillText(label, right ? bx + bw - padX : bx + padX, ty + 1);
    }
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  /* ===== الغوص داخل العضي ===== */
  function drawInterior(ctx, sim) {
    const it = interiorFor(sim.focusId);
    if (!it) return;
    const k = sim.diveP;
    ctx.save();
    ctx.globalAlpha = k;
    // خلفية العضي
    ctx.fillStyle = `rgba(0,0,0,${0.25 * k})`;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    const scale = LERP(0.3, 2.3, k) * 1.6;
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    // إطار العضي الكبير
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (const part of it.parts) {
      const fn = INTERIOR_PART[part.kind];
      if (fn) fn(ctx, part, sim);
    }
    ctx.restore();

    // عنوان ووصف + مفاتيح المكوّنات (HUD)
    if (k > 0.4) {
      ctx.save();
      ctx.globalAlpha = (k - 0.4) / 0.6;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px 'IBM Plex Sans Arabic', sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = 12;
      // ضمن نطاق آمن رأسياً (قد يُقصّ cover الحوافّ على الشاشات العريضة)
      ctx.fillText(it.title, CX, 96);
      ctx.font = "600 15px 'IBM Plex Sans Arabic', sans-serif";
      ctx.fillText(it.caption, CX, SCENE_H - 76);
      ctx.restore();
    }
  }

  const INTERIOR_PART = {
    fluid(ctx, part) {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, part.r);
      g.addColorStop(0, hexA(part.color[0], 0.55));
      g.addColorStop(1, hexA(part.color[0], 0.05));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.r, 0, Math.PI * 2);
      ctx.fill();
    },
    core(ctx, part, sim) {
      const b = 1 + Math.sin(sim.t * 1.2) * 0.05;
      const g = ctx.createRadialGradient(part.x - part.r * 0.3, part.y - part.r * 0.3, 2, part.x, part.y, part.r);
      g.addColorStop(0, part.color[0]);
      g.addColorStop(1, part.color[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.r * b, 0, Math.PI * 2);
      ctx.fill();
    },
    "capsule-ring"(ctx, part) {
      ctx.strokeStyle = part.color[0];
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(part.x, part.y, part.r, part.r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hexA(part.color[1] || part.color[0], 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    "ring-dots"(ctx, part) {
      ctx.fillStyle = part.color[0];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(part.x + Math.cos(a) * part.r, part.y + Math.sin(a) * part.r * 0.78, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    helix(ctx, part, sim) {
      ctx.lineWidth = 3;
      for (let s = 0; s < 2; s++) {
        ctx.strokeStyle = part.color[s];
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const u = (i / 60) * Math.PI * 4;
          const x = part.x - part.r + (i / 60) * part.r * 2;
          const y = part.y + Math.sin(u + sim.t * 2 + s * Math.PI) * 22;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = hexA(part.color[0], 0.5);
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 60; i += 4) {
        const u = (i / 60) * Math.PI * 4;
        const x = part.x - part.r + (i / 60) * part.r * 2;
        ctx.beginPath();
        ctx.moveTo(x, part.y + Math.sin(u + sim.t * 2) * 22);
        ctx.lineTo(x, part.y + Math.sin(u + sim.t * 2 + Math.PI) * 22);
        ctx.stroke();
      }
    },
    cristae(ctx, part, sim) {
      ctx.strokeStyle = part.color[1];
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const px = -part.r + 12 + (i / 5) * (part.r * 2 - 24);
        const h = part.r * 0.62 * Math.sqrt(Math.max(0, 1 - Math.pow(px / part.r, 2)));
        const wob = Math.sin(sim.t * 2 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(px, -h);
        ctx.quadraticCurveTo(px + 14 + wob, 0, px, h);
        ctx.stroke();
      }
    },
    grana(ctx, part, sim) {
      for (let s = 0; s < 4; s++) {
        const gx = -part.r * 0.6 + s * part.r * 0.42;
        const gy = Math.sin(s + sim.t) * 10;
        ctx.fillStyle = part.color[0];
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(gx, gy - 20 + k * 10, 20, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    membranes(ctx, part, sim) {
      ctx.strokeStyle = part.color[0];
      ctx.lineWidth = 6;
      for (let b = 0; b < 5; b++) {
        const yy = -part.r * 0.7 + (b / 4) * part.r * 1.4;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const x = -part.r + (i / 30) * part.r * 2;
          const y = yy + Math.sin(i * 0.5 + sim.t + b) * 8;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    "bump-dots"(ctx, part, sim) {
      ctx.fillStyle = part.color[0];
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4 + sim.t * 0.3;
        const rr = part.r * (0.3 + ((i * 7) % 10) / 14);
        ctx.beginPath();
        ctx.arc(part.x + Math.cos(a) * rr, part.y + Math.sin(a) * rr, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    "spark-dots"(ctx, part, sim) {
      for (let i = 0; i < 26; i++) {
        const a = i * 1.7 + sim.t * 1.5;
        const rr = part.r * (0.2 + ((i * 5) % 10) / 12);
        const gl = 0.5 + 0.5 * Math.sin(sim.t * 4 + i);
        const g = ctx.createRadialGradient(Math.cos(a) * rr, Math.sin(a) * rr, 0.5, Math.cos(a) * rr, Math.sin(a) * rr, 8);
        g.addColorStop(0, hexA(part.color[0], gl));
        g.addColorStop(1, hexA(part.color[0], 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    chain(ctx, part, sim) {
      const cols = [part.color[0], part.color[1] || part.color[0]];
      const n = 8 + (Math.floor(sim.t * 2) % 8);
      for (let i = 0; i < n; i++) {
        const x = part.x - part.r + i * 16;
        const y = part.y + Math.sin(i * 0.6 + sim.t) * 10;
        ctx.fillStyle = cols[i % 2];
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    stack(ctx, part, sim) {
      for (let i = 0; i < 5; i++) {
        const yy = -part.r * 0.5 + (i / 4) * part.r;
        const wob = Math.sin(sim.t + i) * 6;
        ctx.strokeStyle = i % 2 ? part.color[1] : part.color[0];
        ctx.lineWidth = 12 - i;
        ctx.lineCap = "round";
        const w = part.r * (1 - i * 0.1);
        ctx.beginPath();
        ctx.moveTo(-w, yy + wob);
        ctx.quadraticCurveTo(0, yy - 20 + wob, w, yy + wob);
        ctx.stroke();
      }
    },
    "vesicle-dots"(ctx, part, sim) {
      for (let i = 0; i < 12; i++) {
        const a = i * 0.9 + sim.t;
        const rr = part.r * 0.8 * ((i % 4) / 4 + 0.3);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
        g.addColorStop(0, part.color[0]);
        g.addColorStop(1, part.color[1] || part.color[0]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };

  function drawVesicles(ctx, sim) {
    for (const v of sim.vesicles) {
      ctx.globalAlpha = CLAMP(v.life, 0, 1);
      const g = ctx.createRadialGradient(v.x - v.r * 0.3, v.y - v.r * 0.3, 1, v.x, v.y, v.r);
      g.addColorStop(0, "#ffe0b2");
      g.addColorStop(1, "#fb8c00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawATP(ctx, sim) {
    for (const a of sim.atp) {
      ctx.globalAlpha = CLAMP(a.life, 0, 1);
      const gr = ctx.createRadialGradient(a.x, a.y, 1, a.x, a.y, 12);
      gr.addColorStop(0, "rgba(255,241,118,1)");
      gr.addColorStop(1, "rgba(255,193,7,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a5900";
      ctx.font = "bold 9px 'IBM Plex Sans Arabic', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ATP", a.x, a.y + 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawProteinChain(ctx, sim) {
    const rib = sim.organelles.find((o) => o.id === "ribosome");
    if (!rib) return;
    const n = Math.floor(sim.chain);
    ctx.save();
    ctx.translate(rib.x, rib.y);
    const cols = ["#ef5350", "#42a5f5", "#66bb6a", "#ffca28", "#ab47bc"];
    for (let i = 0; i < n; i++) {
      const x = rib.rx + i * 7;
      const y = Math.sin(i * 0.6) * 8;
      ctx.fillStyle = cols[i % cols.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (i > 0) {
        ctx.strokeStyle = "rgba(120,90,60,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rib.rx + (i - 1) * 7, Math.sin((i - 1) * 0.6) * 8);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* دوال رسم العضيّات (متجهية، متنفّسة) — كما v1 مع لمسات واقعية */
  const ORG_DRAW = {
    nucleus(ctx, o, sim) {
      const pulse = 1 + Math.sin(sim.t * o.speed + o.phase) * 0.03;
      const R = o.rx * pulse;
      const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.15, 0, 0, R);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(0.6, o.color[1]);
      g.addColorStop(1, o.color[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, o.ry * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 0.98, Math.sin(a) * o.ry * pulse * 0.98, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.3) {
          const rr = R * (0.3 + (0.4 * ((i * 3) % 5)) / 5);
          const x = Math.cos(a + i + sim.t * 0.2) * rr;
          const y = Math.sin(a * 1.5 + i) * rr * 0.7;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const ng = ctx.createRadialGradient(R * 0.1, -R * 0.1, 2, R * 0.15, 0, R * 0.4);
      ng.addColorStop(0, "#ede7f6");
      ng.addColorStop(1, "#9575cd");
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(R * 0.12, 0, R * 0.32, 0, Math.PI * 2);
      ctx.fill();
    },
    mito(ctx, o, sim) {
      const bend = Math.sin(sim.t * o.speed + o.phase) * 0.35;
      const breath = 1 + Math.sin(sim.t * o.speed * 1.3 + o.phase) * 0.06;
      ctx.rotate((o.rot || 0) + Math.sin(sim.t * o.speed * 0.5 + o.phase) * 0.08);
      const g = ctx.createLinearGradient(-o.rx, 0, o.rx, 0);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(0.5, o.color[1]);
      g.addColorStop(1, o.color[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * Math.PI * 2;
        const spine = Math.sin(u) * bend * o.ry;
        const x = Math.cos(u) * o.rx;
        const y = Math.sin(u) * o.ry * breath + Math.cos(u) * spine;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,230,0.7)";
      ctx.lineWidth = 2;
      const M = 7;
      for (let i = 1; i < M; i++) {
        const px = -o.rx + (i / M) * o.rx * 2;
        const h = o.ry * breath * 0.8 * Math.sqrt(1 - Math.pow(px / o.rx, 2) || 0);
        const wob = Math.sin(sim.t * o.speed * 2 + i + o.phase) * 4;
        ctx.beginPath();
        ctx.moveTo(px, -h);
        ctx.quadraticCurveTo(px + 8 + wob, 0, px, h);
        ctx.stroke();
      }
    },
    roughER(ctx, o, sim) {
      const g = ctx.createLinearGradient(-o.rx, 0, o.rx, 0);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(1, o.color[2]);
      ctx.strokeStyle = g;
      for (let b = 0; b < 5; b++) {
        const yy = -o.ry * 0.7 + (b / 4) * o.ry * 1.4;
        ctx.lineWidth = 9;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const x = -o.rx + (i / 30) * o.rx * 2;
          const y = yy + Math.sin(i * 0.5 + sim.t * o.speed + b) * 6;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = "#4e342e";
        for (let i = 2; i < 30; i += 4) {
          const x = -o.rx + (i / 30) * o.rx * 2;
          const y = yy + Math.sin(i * 0.5 + sim.t * o.speed + b) * 6;
          ctx.beginPath();
          ctx.arc(x, y - 6, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    smoothER(ctx, o, sim) {
      const g = ctx.createLinearGradient(-o.rx, 0, o.rx, 0);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(1, o.color[2]);
      ctx.strokeStyle = g;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      for (let b = 0; b < 4; b++) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = (i / 40) * Math.PI * 2;
          const rr = o.rx * (0.5 + 0.4 * Math.sin(b + t * 2));
          const x = Math.cos(t) * rr + Math.sin(sim.t * o.speed + b) * 5;
          const y = Math.sin(t) * o.ry * 0.7 * (0.6 + 0.3 * Math.cos(b + t));
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    golgi(ctx, o, sim) {
      for (let i = 0; i < 5; i++) {
        const yy = -o.ry * 0.6 + (i / 4) * o.ry * 1.2;
        const wob = Math.sin(sim.t * o.speed + i) * 4;
        const w = o.rx * (1 - i * 0.12);
        ctx.strokeStyle = i % 2 ? o.color[1] : o.color[0];
        ctx.lineWidth = 11 - i;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-w, yy + wob);
        ctx.quadraticCurveTo(0, yy - 16 + wob, w, yy + wob);
        ctx.stroke();
      }
    },
    ribosomeCluster(ctx, o, sim) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const jig = Math.sin(sim.t * o.speed * 2 + i) * 2;
        const x = Math.cos(a) * o.rx * 0.6 + jig;
        const y = Math.sin(a) * o.ry * 0.6;
        const g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 6);
        g.addColorStop(0, o.color[0]);
        g.addColorStop(1, o.color[2]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    lysosome(ctx, o, sim) {
      const breath = 1 + Math.sin(sim.t * o.speed + o.phase) * 0.08;
      const g = ctx.createRadialGradient(-o.rx * 0.3, -o.rx * 0.3, 2, 0, 0, o.rx);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(1, o.color[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, o.rx * breath, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 7; i++) {
        const a = i * 1.3 + sim.t * o.speed;
        const rr = o.rx * 0.5 * ((i % 3) / 2 + 0.3);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    vacuole(ctx, o, sim) {
      const breath = 1 + Math.sin(sim.t * o.speed + o.phase) * 0.02;
      const g = ctx.createRadialGradient(-o.rx * 0.3, -o.rx * 0.3, o.rx * 0.1, 0, 0, o.rx);
      g.addColorStop(0, "rgba(225,245,254,0.65)");
      g.addColorStop(0.7, "rgba(129,212,250,0.4)");
      g.addColorStop(1, "rgba(2,136,209,0.3)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx * breath, o.ry * breath, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(2,136,209,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(-o.rx * 0.35, -o.ry * 0.4, o.rx * 0.16, o.ry * 0.1, -0.5, 0, Math.PI * 2);
      ctx.fill();
    },
    chloroplast(ctx, o, sim) {
      ctx.rotate((o.rot || 0) + Math.sin(sim.t * o.speed * 0.4 + o.phase) * 0.06);
      const g = ctx.createLinearGradient(-o.rx, 0, o.rx, 0);
      g.addColorStop(0, o.color[0]);
      g.addColorStop(0.5, o.color[1]);
      g.addColorStop(1, o.color[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(20,90,30,0.8)";
      for (let s = 0; s < 4; s++) {
        const gx = -o.rx * 0.5 + s * o.rx * 0.35;
        const gy = Math.sin(s + sim.t * o.speed) * o.ry * 0.2;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(gx, gy - 8 + k * 5, 8, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  };

  function drawMicroLimit(ctx, sim) {
    const a = fade(sim.p, [0.5, 0.56], [0.66, 0.72]) * (1 - sim.diveP);
    if (a < 0.01) return;
    ctx.save();
    const vg = ctx.createRadialGradient(CX, CY, SCENE_H * 0.2, CX, CY, SCENE_W * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(3,6,15,${0.6 * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    const y = CY;
    ctx.globalAlpha = a;
    ctx.strokeStyle = `rgba(120,210,255,${a})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.shadowColor = "rgba(120,210,255,0.9)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(SCENE_W * 0.12, y);
    ctx.lineTo(SCENE_W * 0.88, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(230,245,255,0.98)";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText("هنا يتوقف المجهر المدرسي", CX, y - 18);
    ctx.shadowBlur = 0;
    ctx.font = "600 13px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = `rgba(150,210,255,${a})`;
    ctx.fillText("… لكنّنا سنواصل الغوص", CX, y + 26);
    ctx.restore();
  }

  function drawBurst(ctx, sim) {
    if (!sim.burst.length) return;
    const s = worldScale();
    ctx.save();
    ctx.translate(CX + sim.panX * s, CY + sim.panY * s);
    ctx.scale(s, s);
    for (const b of sim.burst) {
      ctx.globalAlpha = CLAMP(b.life, 0, 1);
      ctx.fillStyle = `hsl(${b.hue},90%,65%)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawGrain(ctx) {
    const grain = grainRef.current;
    if (!grain) return;
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = "overlay";
    for (let x = 0; x < SCENE_W; x += 140) for (let y = 0; y < SCENE_H; y += 140) ctx.drawImage(grain, x, y);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* ===== حلقة الرسم ===== */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    spritesRef.current = buildSprites();
    grainRef.current = buildGrain();

    // تحميل الصور الحقيقية (بصلة + وجه اختياري)
    const loadImg = (url, key) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => (imagesRef.current[key] = im);
      im.src = url;
    };
    loadImg(onionUrl, "onion");
    loadImg(faceUrl, "face");

    // ملء اللوحة بأبعاد العنصر الفعلية (بلا سواد جانبي، بحدّة كاملة)
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || SCENE_W;
      const ch = canvas.clientHeight || SCENE_H;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      const cs = Math.max(cw / SCENE_W, ch / SCENE_H); // cover
      viewRef.current = { cs, tx: (cw - SCENE_W * cs) / 2, ty: (ch - SCENE_H * cs) / 2, cw, ch, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (propsRef.current.soundEnabled && !propsRef.current.reducedMotion) CellSound.startAmbient();

    const loop = (ts) => {
      const last = lastTsRef.current || ts;
      const dt = CLAMP((ts - last) / 16.667, 0, 2.5);
      lastTsRef.current = ts;
      step(dt);
      render(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const wheelHandler = (e) => {
      e.preventDefault();
      const sim = simRef.current;
      sim.autoplay = false;
      // إن كنا داخل عضي: العجلة للخارج تخرج منه
      if (sim.diveP > 0.2 && e.deltaY > 0) {
        sim.diveTarget = 0;
        return;
      }
      // إن كان عضي محدّداً ونحن في أقصى تكبير: العجلة للداخل تغوص فيه
      if (sim.diveP < 0.1 && e.deltaY < 0 && sim.pTarget > 0.985 && propsRef.current.selectedId && interiorFor(propsRef.current.selectedId)) {
        sim.focusId = propsRef.current.selectedId;
        sim.diveTarget = 1;
        if (propsRef.current.soundEnabled) CellSound.playDiveIn();
        return;
      }
      sim.pTarget = CLAMP(sim.pTarget - e.deltaY * 0.0011, 0, 1);
    };
    canvas.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("wheel", wheelHandler);
      ro.disconnect();
      CellSound.stopAmbient();
      CellSound.stopZoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sim = simRef.current;
    sim.organelles = buildOrganelles(cellType);
    sim.diffFlash = reducedMotion ? 0 : 2.6;
    sim.focusId = null;
    sim.diveTarget = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellType]);

  useEffect(() => {
    if (soundEnabled && !reducedMotion) CellSound.startAmbient();
    else CellSound.stopAmbient();
    CellSound.setMuted(!soundEnabled);
  }, [soundEnabled, reducedMotion]);

  /* ===== التفاعل ===== */
  function onPointerDown(e) {
    const sim = simRef.current;
    canvasRef.current.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    sim.autoplay = false;
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      gestureRef.current = { mode: "pinch", dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), startP: sim.pTarget };
    } else {
      gestureRef.current = { mode: "drag", x: e.clientX, y: e.clientY, px: sim.panX, py: sim.panY, moved: 0 };
    }
  }

  function onPointerMove(e) {
    const ptrs = pointersRef.current;
    const sim = simRef.current;
    // hover (بلا ضغط، داخل الخلية، بلا غوص)
    if (!ptrs.has(e.pointerId) && sim.p > 0.66 && sim.diveP < 0.1) {
      const id = pickAt(e.clientX, e.clientY);
      sim.hoverId = id && interiorFor(id) ? id : null;
    }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    if (g.mode === "pinch" && ptrs.size >= 2) {
      const pts = [...ptrs.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      sim.pTarget = CLAMP(g.startP + (d - g.dist) * 0.0016, 0, 1);
    } else if (g.mode === "drag") {
      const s = worldScale();
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = (e.clientX - g.x) / (rect.width / SCENE_W);
      const dy = (e.clientY - g.y) / (rect.height / SCENE_H);
      g.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (sim.p > 0.7 && sim.diveP < 0.1) {
        sim.panX = CLAMP(g.px + dx / s, -CELL_R * 1.2, CELL_R * 1.2);
        sim.panY = CLAMP(g.py + dy / s, -CELL_R * 1.2, CELL_R * 1.2);
      }
    }
  }

  function onPointerUp(e) {
    const ptrs = pointersRef.current;
    const g = gestureRef.current;
    const sim = simRef.current;
    ptrs.delete(e.pointerId);
    try {
      canvasRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (g && g.mode === "drag" && g.moved < 8 && sim.p > 0.66 && sim.diveP < 0.2) {
      const id = pickAt(e.clientX, e.clientY);
      const { onPick, soundEnabled } = propsRef.current;
      if (soundEnabled) CellSound.playFantasySelect();
      if (id && id !== "cytoplasm" && id !== "membrane" && id !== "wall") {
        const local = toLocal(e.clientX, e.clientY);
        spawnBurst(sim, local.x, local.y, 26);
      }
      onPick && onPick(id);
    }
    gestureRef.current = ptrs.size ? gestureRef.current : null;
  }

  function onPointerLeave() {
    simRef.current.hoverId = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="cl-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
    />
  );
});

function hexA(hex, a) {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default CellScene;
