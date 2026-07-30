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
  SCOPE_INFO,
  interiorFor,
  organelleKind,
  CLAMP,
  LERP,
  fade,
} from "./cellData.js";
import { CellSound } from "./cellAudio.js";
import microscopeUrl from "./assets/microscope.png";
import nucleusUrl from "./assets/nucleus.png";
import mitochondriaUrl from "./assets/mitochondria.png";
import chloroplastUrl from "./assets/chloroplast.png";
import golgiUrl from "./assets/golgi.png";
import erUrl from "./assets/er.png";
import lysosomeUrl from "./assets/lysosome.png";

const CELL_FIT = Math.min(SCENE_W, SCENE_H) / (2 * CELL_R);
const CONFINE_R = CELL_R * 0.94;

/* معدّلا ملاحقة الزووم اليدوي لهدفه (وحدة: 1/إطار-٦٠هرتز)، مُحوّلان لصيغة
 * مستقلّة عن معدّل الإطارات عبر 1-e^-k·dt بدل ضرب مباشر بعامل ثابت لكل إطار
 * (كان يجعل السرعة تعتمد على معدّل تحديث الشاشة). القيمتان تُبقيان نفس
 * "الإحساس" السابق عند ٦٠هرتز بالضبط. */
const ZOOM_FOLLOW_K = -Math.log(1 - 0.18);
const ZOOM_FOLLOW_K_NEAR = -Math.log(1 - 0.06);

const insideProgress = (p) => {
  const t = CLAMP((p - STAGES.inside.in[0]) / (1 - STAGES.inside.in[0]), 0, 1);
  return t * t * (3 - 2 * t);
};
const worldScaleFor = (p) => CELL_FIT * 0.92 * LERP(0.82, 2.45, insideProgress(p));

/* ===================================================================== *
 * البداية: المجهر والشريحة عليه — ثم زووم واحد متّصل حتى داخل الخلية
 * ---------------------------------------------------------------------
 * سابقاً كانت المقدّمة تعرض وجه إنسان وبصلة وخطوات تحضير الشريحة كلقطات
 * منفصلة. أُلغيت كلّها: الدرس يبدأ من حيث يبدأ المجهر فعلاً — الجهاز أمامك
 * والشريحة على منضدته مع شرح أجزائه، ثمّ تُكبّر بنفسك (عجلة الماوس أو
 * إصبعين) فتدخل الشريحة تدريجياً: نسيج ← خلية ← داخل الخلية، بلا أي قطع.
 * ===================================================================== */

/* موضع الشريحة داخل صورة المجهر (نسبة من عرض/ارتفاع الصورة) — وهو مركز
 * التكبير: التقريب يندفع نحو هذه النقطة تحديداً فيبدو أننا ندخل الشريحة. */
const SLIDE_FOCUS = { fx: 0.556, fy: 0.606 };

/* نافذة لقطة المجهر على محور p: كاملة الوضوح في البداية، وتتلاشى مع اندفاعنا
 * داخل الشريحة حتى يحلّ محلّها نسيج الخلايا. */
const SCOPE_OUT = [0.05, 0.19];
/* تقدّم الاندفاع داخل الشريحة (0 = اللقطة الكاملة، 1 = صرنا داخل النسيج) */
const scopePush = (p) => CLAMP(p / SCOPE_OUT[1], 0, 1);

/* أجزاء المجهر المشروحة — [نسبة x, نسبة y داخل الصورة, الاسم, جهة اللافتة] */
const SCOPE_PARTS = [
  [0.79, 0.13, "العدسة العينيّة", "right"],
  [0.63, 0.47, "العدسات الشيئيّة", "right"],
  [0.556, 0.606, "الشريحة والعيّنة", "left"],
  [0.3, 0.64, "منضدة الشريحة", "left"],
  [0.5, 0.75, "مصدر الضوء", "left"],
  [0.13, 0.63, "قرص الضبط", "left"],
];

/* العضيّات المصمتة (تملأ محيطها) — تتلقّى طبقة اللمعان/العمق دون الخطّية */
const SOLID_ORG = new Set(["nucleus", "mito", "lysosome", "vacuole", "chloroplast"]);

function stageLabel(p) {
  if (p < 0.12) return "تحت المجهر";
  if (p < 0.5) return "نسيج خلايا";
  if (p < 0.7) return "خلية واحدة";
  return "داخل الخلية";
}
function magLabel(p) {
  if (p < 0.12) return STAGES.scope.mag;
  if (p < 0.5) return STAGES.cluster.mag;
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

/* حقل «بوكيه» عميق: كرات ضوئية ضبابية تنجرف ببطء خلف كل المراحل فتعطي الخلفية
 * حياةً وعمقاً بدل لون مصمت مملّ. مواضعها ثابتة، والحركة عبر sin(sim.t). */
function makeBokeh() {
  const arr = [];
  for (let i = 0; i < 12; i++) {
    arr.push({
      bx: Math.random() * SCENE_W,
      by: Math.random() * SCENE_H,
      r: 46 + Math.random() * 140,
      ax: 16 + Math.random() * 34,
      ay: 12 + Math.random() * 28,
      sx: 0.1 + Math.random() * 0.22,
      sy: 0.09 + Math.random() * 0.2,
      ph: Math.random() * Math.PI * 2,
      alpha: 0.05 + Math.random() * 0.1,
    });
  }
  return arr;
}

/* ذرّات غبار دقيقة تطفو صعوداً — تُشعر الطالب أنه «داخل» وسط حيّ، لا أمام لوحة. */
function makeMotes() {
  const arr = [];
  for (let i = 0; i < 34; i++) {
    arr.push({
      bx: Math.random() * SCENE_W,
      by: Math.random() * SCENE_H,
      r: 0.8 + Math.random() * 2.4,
      sp: 5 + Math.random() * 15,
      drift: 8 + Math.random() * 22,
      ph: Math.random() * Math.PI * 2,
      tw: 0.5 + Math.random() * 2.2,
    });
  }
  return arr;
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
    // الرحلة تبدأ دائماً من لقطة المجهر (p=0) ثم يُكبّر الطالب بنفسه
    p: 0.0,
    pTarget: 0.0,
    prevP: 0.0,
    zoomVel: 0,
    wheelVel: 0, // قصور ذاتي عجلة الفأرة/اللمس — إحساس "مقبض تركيز" بدل قفزات مباشرة
    scopeT: 0, // زمن لقطة المجهر (لظهور أسطر الشرح تباعاً)
    panX: 0,
    panY: 0,
    bokeh: makeBokeh(),
    motes: makeMotes(),
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
  const imagesRef = useRef({
    microscope: null,
    nucleus: null,
    mitochondria: null,
    chloroplast: null,
    golgi: null,
    er: null,
    lysosome: null,
  });
  const viewRef = useRef({ cs: 1, tx: 0, ty: 0, cw: SCENE_W, ch: SCENE_H, dpr: 1 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  const propsRef = useRef({});
  propsRef.current = { cellType, mode, selectedId, reducedMotion, soundEnabled, onPick, onZoom, onPerf, onFocus };

  useImperativeHandle(ref, () => ({
    resetView() {
      // إعادة الرحلة = العودة إلى لقطة المجهر من جديد
      const s = simRef.current;
      s.p = 0.0;
      s.pTarget = 0.0;
      s.wheelVel = 0;
      s.panX = 0;
      s.panY = 0;
      s.scopeT = 0;
      s.limitCrossed = false;
      s.focusId = null;
      s.diveP = 0;
      s.diveTarget = 0;
    },
    enterCell() {
      // قفزة مباشرة إلى داخل الخلية (يُستخدم عند بدء وضع التحدّي)
      const s = simRef.current;
      s.pTarget = 0.82;
      s.focusId = null;
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

    // قصور ذاتي عجلة الفأرة/اللمس: كل نقرة عجلة تضيف دفعة سرعة بدل تعيين الهدف
    // مباشرة، فتتراكم مع النقرات المتتالية وتتلاشى تدريجياً بعد التوقّف — إحساس
    // مقبض تركيز حقيقي له وزن، لا "خطوات" منفصلة.
    if (sim.wheelVel) {
      sim.pTarget = CLAMP(sim.pTarget + sim.wheelVel * dt, 0, 1);
      sim.wheelVel *= Math.exp(-6 * dt);
      if (Math.abs(sim.wheelVel) < 0.0002) sim.wheelVel = 0;
    }

    // زمن لقطة المجهر — يُشغّل ظهور أسطر الشرح تباعاً، ويُصفَّر عند العودة إليها
    if (sim.p < 0.02 && sim.pTarget < 0.02) sim.scopeT += dt / 60;
    else if (sim.p > 0.3) sim.scopeT = 0;

    // الزووم — كلّه بيد الطالب: ملاحقة الهدف بمعدّل مستقلّ عن معدّل الإطارات
    // (1-e^-k·dt بدل عامل ثابت لكل إطار)، مع انتقال ناعم (smoothstep) لمعدّل
    // التباطؤ قرب حدّ المجهر بدل قفزة ثنائية مفاجئة بين سرعتين.
    sim.prevP = sim.p;
    const dist = CLAMP(Math.abs(sim.p - MICRO_LIMIT_P) / 0.05, 0, 1);
    const ease = dist * dist * (3 - 2 * dist);
    const k = LERP(ZOOM_FOLLOW_K_NEAR, ZOOM_FOLLOW_K, ease);
    sim.p += (sim.pTarget - sim.p) * (1 - Math.exp(-k * dt));
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
        const golgiSelected = sel === "golgi";
        // كانت الحويصلة (وصوت "بوب" معها) تنطلق تلقائياً كل ٢.٤ث باستمرار طوال
        // وجودك داخل الخلية، بصرف النظر عن اختيارك — نقرة متكرّرة بلا فعل واضح
        // تُحسّ كخلل مزعج. الآن: حيويّة كاملة + صوت فقط عندما جولجي مختار فعلاً؛
        // خلاف ذلك حياة بصرية أبطأ بكثير وبلا صوت (لا إزعاج، لا سكون تام).
        const rate = sim.celebrate > 0 || golgiSelected ? 1.1 : 9;
        if (golgi._vt > rate) {
          golgi._vt = 0;
          const a = Math.random() * Math.PI * 2;
          sim.vesicles.push({ x: golgi.x + Math.cos(a) * golgi.rx * 0.4, y: golgi.y - golgi.ry, vx: Math.cos(a) * 8, vy: -14 - Math.random() * 8, r: 5 + Math.random() * 3, life: 1 });
          if (sound && golgiSelected) CellSound.playPop();
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
    // معامل التخميد مُحوَّل لصيغة مستقلّة عن معدّل الإطارات (Math.exp)، وحقن
    // الضجيج العشوائي مضروب بـdt كذلك — كانا سابقاً يُطبَّقان لكل إطار بلا ربط
    // بزمنه الفعلي، فتزداد شدّة الاهتزاز مع ارتفاع معدّل الإطارات (شاشات
    // ١٤٤هرتز مثلاً) بدل أن تبقى ثابتة. سقف سرعة إضافي يمنع أي تراكم تسارع.
    const damp = Math.exp(-0.105 * dt);
    for (let i = 0; i < count; i++) {
      const pt = list[i];
      pt.vx += (Math.random() - 0.5) * 0.9 * (3 - pt.layer) * dt;
      pt.vy += (Math.random() - 0.5) * 0.9 * (3 - pt.layer) * dt;
      pt.vx *= damp;
      pt.vy *= damp;
      const sp = Math.hypot(pt.vx, pt.vy);
      const MAX_SPEED = 6.5;
      if (sp > MAX_SPEED) {
        pt.vx = (pt.vx / sp) * MAX_SPEED;
        pt.vy = (pt.vy / sp) * MAX_SPEED;
      }
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
    const atScope = sim.p < 0.06; // ما زلنا ننظر إلى الجهاز نفسه
    const sig = `${label}|${pct}|${atLimit}|${atScope}`;
    if (sig !== sim.lastReport) {
      sim.lastReport = sig;
      onZoom &&
        onZoom({
          p: sim.p,
          pct,
          stage: label,
          mag: magLabel(sim.p),
          atLimit,
          atScope,
        });
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

    const aScope = fade(sim.p, null, STAGES.scope.out);
    const aClu = fade(sim.p, STAGES.cluster.in, STAGES.cluster.out);
    const aCell = fade(sim.p, STAGES.cell.in, STAGES.cell.out);
    const aIn = fade(sim.p, STAGES.inside.in, null) * (1 - sim.diveP);

    if (aScope > 0.01) drawScopeStage(ctx, sim, aScope, type);
    if (aClu > 0.01) drawCluster(ctx, sim, aClu, type);
    if (aCell > 0.01) drawCellExterior(ctx, sim, aCell, type);
    if (aIn > 0.01) drawInside(ctx, sim, aIn);

    // الغوص داخل العضي (فوق كل شيء)
    if (sim.diveP > 0.01) drawInterior(ctx, sim);

    drawMicroLimit(ctx, sim);
    drawBurst(ctx, sim);
    drawGrain(ctx);
  }

  /* خلفية سينمائية حيّة: تدرّج قاعدي يتنفّس + كرات بوكيه عميقة + ضوء مفتاحي
   * متحرّك + ذرّات غبار طافية + vignette. كلها مدفوعة بـ sim.t، فتتجمّد تلقائياً
   * عند تثبيت الحركة (animDt=0) احتراماً لـ reduced-motion. */
  function drawBackdrop(ctx, sim) {
    const t = sim.t;
    let c0, c1, c2, warm, scifi;
    if (sim.diveP > 0.4 && sim.focusId) {
      const it = interiorFor(sim.focusId);
      c0 = it.bg[0];
      c1 = it.bg[0];
      c2 = it.bg[1];
      warm = false;
      scifi = false;
    } else if (sim.p < 0.55) {
      // بيئة مختبر مستقبليّ داكنة (خيال علميّ) بدل الكريميّ المسطّح المملّ
      c0 = "#102a44";
      c1 = "#0a1a2e";
      c2 = "#050d18";
      warm = false;
      scifi = true;
    } else {
      c0 = PALETTE.cytoMid;
      c1 = PALETTE.cytoDeep;
      c2 = "#b98cc0";
      warm = false;
      scifi = false;
    }

    // تدرّج قاعدي يتنفّس (مركزه ينجرف قليلاً)
    const dxc = Math.sin(t * 0.15) * SCENE_W * 0.05;
    const dyc = Math.cos(t * 0.12) * SCENE_H * 0.05;
    const g = ctx.createRadialGradient(CX + dxc, CY * 0.7 + dyc, 40, CX, CY, SCENE_W * 0.8);
    g.addColorStop(0, c0);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);

    // شبكة تقنية متوهّجة تنزلق (خيال علميّ) — منظور بسيط يتكثّف نحو الأفق
    if (scifi) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(80,200,235,0.16)";
      ctx.lineWidth = 1;
      const gap = 54;
      const ox = ((t * 10) % gap);
      const oy = ((t * 8) % gap);
      for (let x = -ox; x <= SCENE_W + gap; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, SCENE_H);
        ctx.stroke();
      }
      for (let y = -oy; y <= SCENE_H + gap; y += gap) {
        const glow = 0.06 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.4 + y * 0.03));
        ctx.strokeStyle = `rgba(80,200,235,${glow})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SCENE_W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // كرات بوكيه عميقة (مزج إضاءي)
    const tint = scifi ? "90,205,240" : "206,168,226";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of sim.bokeh) {
      const x = b.bx + Math.sin(t * b.sx + b.ph) * b.ax;
      const y = b.by + Math.cos(t * b.sy + b.ph) * b.ay;
      const rr = b.r * (0.75 + 0.25 * Math.sin(t * 0.6 + b.ph));
      const rad = ctx.createRadialGradient(x, y, 0, x, y, rr);
      rad.addColorStop(0, `rgba(${tint},${b.alpha})`);
      rad.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ضوء مفتاحي متحرّك (يكنس المشهد ببطء)
    const lx = CX + Math.sin(t * 0.22) * SCENE_W * 0.3;
    const ly = CY - SCENE_H * 0.25 + Math.cos(t * 0.18) * SCENE_H * 0.12;
    const key = ctx.createRadialGradient(lx, ly, 0, lx, ly, SCENE_W * 0.5);
    key.addColorStop(0, scifi ? "rgba(120,220,255,0.16)" : "rgba(230,214,255,0.2)");
    key.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);

    // ذرّات غبار طافية
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const span = SCENE_H + 40;
    for (const m of sim.motes) {
      const y = (((m.by - t * m.sp) % span) + span) % span;
      const x = m.bx + Math.sin(t * 0.3 + m.ph) * m.drift;
      const tw = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * m.tw + m.ph));
      ctx.fillStyle = scifi ? `rgba(150,225,255,${tw})` : `rgba(226,214,255,${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // vignette يشدّ الانتباه للمركز
    const vg = ctx.createRadialGradient(CX, CY, SCENE_H * 0.35, CX, CY, SCENE_W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, scifi ? "rgba(3,8,16,0.55)" : "rgba(20,8,30,0.34)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }

  /* أقواس زوايا بأسلوب HUD حول مستطيل */
  function hudBrackets(ctx, x, y, w, h, len, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 2;
    ctx.lineCap = "round";
    const corners = [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ];
    for (const [px, py, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(px, py + sy * len);
      ctx.lineTo(px, py);
      ctx.lineTo(px + sx * len, py);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  /* =====================================================================
   * لقطة البداية: المجهر والشريحة على منضدته.
   * لا نعرض مصدر العيّنة (وجه/بصلة) ولا خطوات التحضير — الدرس يبدأ من الجهاز:
   * شرح أجزائه ولافتات على مواضعها، وبطاقة شرح تظهر أسطرها تباعاً، ثم يُكبّر
   * الطالب بنفسه فتندفع الكاميرا نحو الشريحة تحديداً حتى يحلّ نسيج الخلايا.
   * ===================================================================== */
  const SCOPE_IMG = { x: CX - 235, y: CY + 6, h: 430 };
  const SCOPE_CARD = { x: 548, w: 376 };

  function scopeImageRect() {
    const img = imagesRef.current.microscope;
    const ratio = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.655;
    const h = SCOPE_IMG.h;
    const w = h * ratio;
    return { img, x: SCOPE_IMG.x - w / 2, y: SCOPE_IMG.y - h / 2, w, h };
  }

  function drawScopeStage(ctx, sim, alpha, type) {
    const info = SCOPE_INFO[type === "plant" ? "plant" : "animal"];
    const rect = scopeImageRect();
    const push = scopePush(sim.p); // 0 = اللقطة الكاملة، 1 = صرنا داخل الشريحة
    // استقرار أوّل ناعم عند فتح التجربة (بلا اهتزاز دائم)
    const settle = 1 - Math.pow(1 - CLAMP(sim.scopeT / 1.2, 0, 1), 3);
    const slideX = rect.x + SLIDE_FOCUS.fx * rect.w;
    const slideY = rect.y + SLIDE_FOCUS.fy * rect.h;
    // الشرح واللافتات تنسحب فور بدء التكبير كي لا تحجب الاندفاع
    const ui = CLAMP(1 - push * 4, 0, 1) * alpha;

    ctx.save();
    ctx.globalAlpha = alpha;

    // تعتيم سينمائي + بقعة ضوء استوديو دافئة خلف الجهاز
    const vg = ctx.createRadialGradient(SCOPE_IMG.x, CY * 0.92, 20, CX, CY, SCENE_W * 0.72);
    vg.addColorStop(0, "rgba(24,16,26,0.06)");
    vg.addColorStop(1, "rgba(6,4,10,0.72)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const spot = ctx.createRadialGradient(SCOPE_IMG.x, CY * 0.8, 10, SCOPE_IMG.x, CY * 0.88, SCENE_W * 0.3);
    spot.addColorStop(0, `rgba(255,240,214,${0.26 * alpha})`);
    spot.addColorStop(1, "rgba(255,240,214,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    ctx.restore();

    // ---- طبقة الاندفاع: التكبير يدور حول الشريحة نفسها، وتنزلق نحو مركز
    // الشاشة تدريجياً كي يلتقي مكانها بمكان نسيج الخلايا الذي يظهر بعدها ----
    ctx.save();
    const zoom = LERP(1.06, 1, settle) * LERP(1, 4.8, push * push);
    ctx.translate(LERP(slideX, CX, push), LERP(slideY, CY, push));
    ctx.scale(zoom, zoom);
    ctx.translate(-slideX, -slideY);

    if (rect.img && rect.img.complete && rect.img.naturalWidth > 0) {
      // ظلّ أرضي بيضاويّ يمنح الجهاز رسوخاً
      ctx.save();
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.ellipse(SCOPE_IMG.x, rect.y + rect.h * 0.985, rect.w * 0.36, 15, 0, 0, Math.PI * 2);
      ctx.filter = "blur(7px)";
      ctx.fill();
      ctx.restore();
      ctx.drawImage(rect.img, rect.x, rect.y + (1 - settle) * 14, rect.w, rect.h);
    }

    // توهّج العيّنة على الشريحة — يشتدّ كلّما اقتربنا، فيقود العين إلى وجهتها
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glowPulse = 0.55 + 0.45 * Math.sin(sim.t * 1.8);
    const gr = 20 + 10 * glowPulse;
    const gg = ctx.createRadialGradient(slideX, slideY, 1, slideX, slideY, gr * 2.4);
    gg.addColorStop(0, hexA(info.accent, (0.3 + 0.2 * glowPulse) * (0.5 + 0.5 * push)));
    gg.addColorStop(1, hexA(info.accent, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(slideX, slideY, gr * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // حلقة هدف متقطّعة تدور فوق الشريحة (تختفي مع بدء الاندفاع)
    if (ui > 0.02) {
      ctx.save();
      ctx.globalAlpha = ui * (0.7 + 0.3 * glowPulse);
      ctx.translate(slideX, slideY);
      ctx.rotate(sim.t * 0.5);
      ctx.strokeStyle = "rgba(226,250,255,0.9)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 24 + glowPulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore(); // نهاية طبقة الاندفاع

    // ---- لافتات أجزاء المجهر + بطاقة الشرح ----
    if (ui > 0.02) {
      drawScopeLabels(ctx, sim, rect, ui);
      drawScopeCard(ctx, sim, info, ui);
    }
    ctx.restore();
  }

  /* لافتات الأجزاء: نقطة على الجزء، خطّ مرفقيّ، ثم الاسم — تظهر واحدةً تلو
   * الأخرى كي تُقرأ لا كي تُزاحم بعضها دفعةً واحدة. */
  const SCOPE_LABELS = [
    { fx: 0.79, fy: 0.13, y: 148, text: "العدسة العينيّة" },
    { fx: 0.63, fy: 0.47, y: 246, text: "العدسات الشيئيّة" },
    { fx: 0.556, fy: 0.606, y: 344, text: "الشريحة والعيّنة" },
    { fx: 0.5, fy: 0.75, y: 442, text: "مصدر الضوء" },
  ];
  function drawScopeLabels(ctx, sim, rect, ui) {
    const elbow = 408;
    const textX = 420;
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "left";
    ctx.font = "700 14px 'IBM Plex Sans Arabic', sans-serif";
    SCOPE_LABELS.forEach((L, i) => {
      const appear = CLAMP((sim.scopeT - (0.5 + i * 0.32)) / 0.5, 0, 1);
      if (appear < 0.02) return;
      const ax = rect.x + L.fx * rect.w;
      const ay = rect.y + L.fy * rect.h;
      ctx.globalAlpha = ui * appear;
      // الخطّ يُرسم تدريجياً حتى موضع الاسم
      const ex = LERP(ax, elbow, appear);
      const ey = LERP(ay, L.y, appear);
      ctx.strokeStyle = "rgba(140,230,255,0.62)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + 10 * appear, ey);
      ctx.stroke();
      ctx.fillStyle = "rgba(140,230,255,0.95)";
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dff5ff";
      ctx.shadowColor = "rgba(0,10,20,0.9)";
      ctx.shadowBlur = 6;
      ctx.fillText(L.text, textX, L.y + 5);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  /* تقسيم نصّ عربيّ على أسطر ضمن عرض معطى */
  function wrapText(ctx, text, maxW) {
    const words = text.split(" ");
    const out = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
    return out;
  }

  /* بطاقة الشرح: عنوان + أسطر تفصيلية تظهر تباعاً + دعوة للتكبير */
  function drawScopeCard(ctx, sim, info, ui) {
    const cyan = "#6fe0ff";
    const x = SCOPE_CARD.x;
    const w = SCOPE_CARD.w;
    const pad = 20;
    const maxW = w - pad * 2 - 16;

    // قياس التخطيط أوّلاً كي يضبط الصندوق ارتفاعه على النصّ فعلياً
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.font = "500 14px 'IBM Plex Sans Arabic', sans-serif";
    const blocks = info.lines.map((t) => wrapText(ctx, t, maxW));
    const lineH = 22;
    const blockGap = 12;
    const bodyH = blocks.reduce((s, b) => s + b.length * lineH + blockGap, 0);
    const h = 56 + bodyH + 46;
    const y = CY - h / 2;

    // اللوح الزجاجيّ
    ctx.globalAlpha = ui;
    ctx.fillStyle = "rgba(6,20,34,0.8)";
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = hexA(cyan, 0.45);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = hexA(cyan, 0.45);
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    hudBrackets(ctx, x, y, w, h, 14, hexA(cyan, 0.9));

    // سطر علويّ: مؤشّر حيّ + قراءة الجهاز
    const blink = 0.5 + 0.5 * Math.sin(sim.t * 4);
    ctx.fillStyle = `rgba(120,240,180,${0.4 + 0.6 * blink})`;
    ctx.beginPath();
    ctx.arc(x + w - pad - 4, y + 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "700 12.5px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = hexA(cyan, 0.9);
    ctx.fillText("المجهر الضوئيّ · تكبير ×400", x + w - pad - 18, y + 27);

    // العنوان
    const titleIn = CLAMP(sim.scopeT / 0.6, 0, 1);
    ctx.globalAlpha = ui * titleIn;
    ctx.font = "800 20px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = "#eafcff";
    ctx.shadowColor = hexA(cyan, 0.8);
    ctx.shadowBlur = 12;
    ctx.fillText(info.title, x + w - pad, y + 58);
    ctx.shadowBlur = 0;

    // الأسطر التفصيلية — سطر تلو الآخر
    let ty = y + 58 + 26;
    ctx.font = "500 14px 'IBM Plex Sans Arabic', sans-serif";
    blocks.forEach((b, i) => {
      const appear = CLAMP((sim.scopeT - (0.9 + i * 1.5)) / 0.8, 0, 1);
      ctx.globalAlpha = ui * appear;
      // نقطة تعداد
      ctx.fillStyle = hexA(info.accent, 0.95);
      ctx.beginPath();
      ctx.arc(x + w - pad - 3, ty - 5, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(226,244,252,0.94)";
      b.forEach((ln, j) => ctx.fillText(ln, x + w - pad - 16, ty + j * lineH));
      ty += b.length * lineH + blockGap;
    });

    // دعوة التكبير — تنبض كي تكون الخطوة التالية واضحة
    const hintIn = CLAMP((sim.scopeT - (0.9 + blocks.length * 1.5)) / 0.8, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(sim.t * 3);
    ctx.globalAlpha = ui * hintIn;
    ctx.fillStyle = hexA(cyan, 0.14);
    roundRect(ctx, x + pad - 6, y + h - 52, w - (pad - 6) * 2, 36, 12);
    ctx.fill();
    ctx.globalAlpha = ui * hintIn * (0.75 + 0.25 * pulse);
    ctx.font = "800 14px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = "#dff6ff";
    ctx.textAlign = "center";
    ctx.fillText(`🔍 ${info.hint}`, x + w / 2, y + h - 28);
    ctx.restore();
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
        const gr = ctx.createRadialGradient(0, 0, o.rx * 0.4, 0, 0, o.rx * 1.9);
        gr.addColorStop(0, `rgba(255,255,225,${0.55 * k})`);
        gr.addColorStop(1, "rgba(255,255,225,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0, 0, o.rx * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      const fn = ORG_DRAW[o.draw];
      if (fn) fn(ctx, o, sim);
      if (SOLID_ORG.has(o.draw)) glossPass(ctx, o); // عمق/لمعان للمصمتة فقط (لا هالات زجاجية للخطّية)
      if (isSel) drawSelectionRing(ctx, o, sim);
      ctx.restore();
    }
    if (sel === "ribosome") drawProteinChain(ctx, sim);
  }

  /* طبقة واقعية موحّدة: انسدال داخلي (AO) عند الحواف + لمعان علوي */
  function glossPass(ctx, o) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2);
    ctx.clip();
    // انسدال داخلي: مركز شفّاف → حواف داكنة (عمق)
    const ao = ctx.createRadialGradient(0, 0, Math.min(o.rx, o.ry) * 0.35, 0, 0, Math.max(o.rx, o.ry));
    ao.addColorStop(0, "rgba(0,0,0,0)");
    ao.addColorStop(0.75, "rgba(0,0,0,0)");
    ao.addColorStop(1, "rgba(20,5,20,0.4)");
    ctx.fillStyle = ao;
    ctx.beginPath();
    ctx.ellipse(0, 0, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2);
    ctx.fill();
    // لمعان علوي يسار (بريق رطب)
    const sx = -o.rx * 0.32;
    const sy = -o.ry * 0.42;
    const sp = ctx.createRadialGradient(sx, sy, 1, sx, sy, o.rx * 0.6);
    sp.addColorStop(0, "rgba(255,255,255,0.4)");
    sp.addColorStop(0.5, "rgba(255,255,255,0.1)");
    sp.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sp;
    ctx.beginPath();
    ctx.ellipse(sx, sy, o.rx * 0.55, o.ry * 0.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // حافّة ضوئية رفيعة (rim) تفصلها عن الخلفية
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, o.rx, o.ry, o.rot || 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* مؤشّر تحديد واضح جداً: حلقة بيضاء ناصعة + توهّج + شرطات دوّارة */
  function drawSelectionRing(ctx, o, sim) {
    const R = Math.max(o.rx, o.ry) * 1.22;
    ctx.save();
    // توهّج خارجي
    ctx.shadowColor = "rgba(120,230,255,0.95)";
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "rgba(255,255,255,0.98)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // شرطات دوّارة سماوية
    ctx.strokeStyle = "rgba(80,220,255,1)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -sim.t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // أربع علامات ركنية (قفل استهداف)
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const ang = i * (Math.PI / 2) + Math.PI / 4 + sim.t * 0.3;
      const x = Math.cos(ang) * (R + 8);
      const y = Math.sin(ang) * (R + 8);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
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
      const img = imagesRef.current["nucleus"];
      if (img && img.complete && img.naturalWidth > 0) {
        const pulse = 1 + Math.sin(sim.t * o.speed + o.phase) * 0.02;
        const R = o.rx * pulse;
        ctx.save();
        ctx.shadowColor = "rgba(126, 87, 194, 0.4)";
        ctx.shadowBlur = 18;
        ctx.drawImage(img, -R * 1.1, -R * 1.1, R * 2.2, R * 2.2);
        ctx.restore();
      } else {
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
        const ng = ctx.createRadialGradient(R * 0.1, -R * 0.1, 2, R * 0.15, 0, R * 0.4);
        ng.addColorStop(0, "#ede7f6");
        ng.addColorStop(1, "#9575cd");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(R * 0.12, 0, R * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    mito(ctx, o, sim) {
      const img = imagesRef.current["mitochondria"];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.rotate((o.rot || 0) + Math.sin(sim.t * o.speed * 0.5 + o.phase) * 0.06);
        const breath = 1 + Math.sin(sim.t * o.speed * 1.3 + o.phase) * 0.03;
        const w = o.rx * 2.2 * breath;
        const h = o.ry * 2.2 * breath;
        ctx.shadowColor = "rgba(244, 81, 30, 0.35)";
        ctx.shadowBlur = 14;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
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
      }
    },
    roughER(ctx, o, sim) {
      const img = imagesRef.current["er"];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        const wob = Math.sin(sim.t * o.speed) * 2;
        const w = o.rx * 2.2;
        const h = o.ry * 2.2;
        ctx.shadowColor = "rgba(77, 208, 225, 0.4)";
        ctx.shadowBlur = 12;
        ctx.drawImage(img, -w / 2, -h / 2 + wob, w, h);
        ctx.restore();
      } else {
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
      {
        // ملاحظة: golgi.png موجودة لكن بلون وردي يتعارض مع اللون البرتقالي/الكهرماني
        // المعتمد بكل مكان آخر (البيانات وداخل الجهاز نفسه) — رسم متجهي مؤقتاً حتى
        // تُعاد الصورة بالألوان الصحيحة. انظر ASSETS.md.
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
      {
        // ملاحظة: lysosome.png موجودة لكن بلون أصفر/ذهبي يتعارض مع اللون الوردي/الفوشيا
        // المعتمد بكل مكان آخر (البيانات وداخل الليسوسوم نفسه) — رسم متجهي مؤقتاً حتى
        // تُعاد الصورة بالألوان الصحيحة. انظر ASSETS.md.
        const breath = 1 + Math.sin(sim.t * o.speed + o.phase) * 0.08;
        const g = ctx.createRadialGradient(-o.rx * 0.3, -o.rx * 0.3, 2, 0, 0, o.rx);
        g.addColorStop(0, o.color[0]);
        g.addColorStop(1, o.color[2]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, o.rx * breath, 0, Math.PI * 2);
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
      const img = imagesRef.current["chloroplast"];
      ctx.rotate((o.rot || 0) + Math.sin(sim.t * o.speed * 0.4 + o.phase) * 0.06);
      if (img && img.complete && img.naturalWidth > 0) {
        const breath = 1 + Math.sin(sim.t * o.speed * 1.2 + o.phase) * 0.03;
        const w = o.rx * 2.2 * breath;
        const h = o.ry * 2.2 * breath;
        ctx.save();
        ctx.shadowColor = "rgba(67, 160, 71, 0.35)";
        ctx.shadowBlur = 14;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
      }
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
    // نافذة ضيّقة جداً حول حدّ المجهر فقط (كانت واسعة جداً وتتداخل مع كامل نطاق
    // مرحلة "خلية واحدة" التفاعلية، فتظهر اللافتة والتعتيم فوق العضيّات أثناء
    // استكشافها العادي). كما تُخفى تماماً إن كان عضيّ مختاراً فعلاً — المستخدم
    // منشغل بفحصه، لا حاجة للحظة الدرامية.
    if (propsRef.current.selectedId) return;
    const a = fade(sim.p, [0.585, 0.605], [0.615, 0.64]) * (1 - sim.diveP);
    if (a < 0.01) return;
    const t = sim.t;
    ctx.save();
    // تعتيم درامي
    const vg = ctx.createRadialGradient(CX, CY, SCENE_H * 0.15, CX, CY, SCENE_W * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(3,6,15,${0.66 * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);

    const y = CY;

    // حلقات طاقة تتمدّد من المركز — إحساس «اختراق الحاجز»
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const rp = (t * 0.5 + i / 3) % 1;
      const rr = LERP(30, SCENE_W * 0.5, rp);
      ctx.strokeStyle = `rgba(255,193,7,${a * (1 - rp) * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CX, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // خطّان متوهّجان بلون كهرماني — نمل زاحف
    ctx.globalAlpha = a;
    ctx.strokeStyle = `rgba(255,193,7,${a})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -t * 26;
    ctx.shadowColor = "rgba(255,193,7,0.95)";
    ctx.shadowBlur = 14;
    for (const off of [-46, 46]) {
      ctx.beginPath();
      ctx.moveTo(SCENE_W * 0.08, y + off);
      ctx.lineTo(SCENE_W * 0.92, y + off);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // شرارة تسري على الخطّين
    const sparkP = (t * 0.4) % 1;
    const sx = LERP(SCENE_W * 0.08, SCENE_W * 0.92, sparkP);
    for (const off of [-46, 46]) {
      const sg = ctx.createRadialGradient(sx, y + off, 0, sx, y + off, 18);
      sg.addColorStop(0, `rgba(255,244,170,${a})`);
      sg.addColorStop(1, "rgba(255,193,7,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, y + off, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // لوحة داكنة صلبة خلف النص + توهّج نابض
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "800 26px 'IBM Plex Sans Arabic', sans-serif";
    const txt = "هنا يتوقف المجهر المدرسي";
    const tw = ctx.measureText(txt).width;
    const bw = tw + 56;
    const bh = 58;
    ctx.fillStyle = `rgba(8,10,20,${0.92 * a})`;
    ctx.strokeStyle = `rgba(255,193,7,${a})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `rgba(255,193,7,${0.8 * a})`;
    ctx.shadowBlur = 8 + 8 * (0.5 + 0.5 * Math.sin(t * 3));
    roundRect(ctx, CX - bw / 2, y - bh / 2, bw, bh, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // النص أبيض ناصع
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(txt, CX, y - 4);
    ctx.font = "700 14px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = `rgba(255,213,79,${a})`;
    ctx.fillText("▼ لكنّنا سنواصل الغوص إلى ما لا يراه ▼", CX, y + 20);
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

    // تحميل الصور الحقيقية (المجهر + صور العضيّات)
    const loadImg = (url, key) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => (imagesRef.current[key] = im);
      im.src = url;
    };
    loadImg(microscopeUrl, "microscope");
    loadImg(nucleusUrl, "nucleus");
    loadImg(mitochondriaUrl, "mitochondria");
    loadImg(chloroplastUrl, "chloroplast");
    loadImg(golgiUrl, "golgi");
    loadImg(erUrl, "er");
    loadImg(lysosomeUrl, "lysosome");

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
      // دفعة سرعة (قصور ذاتي) بدل تعيين الهدف مباشرة — انظر معالجتها في step()
      sim.wheelVel = CLAMP(sim.wheelVel - e.deltaY * 0.0009, -0.045, 0.045);
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
      // القرص بإصبعين يُكبّر عبر الرحلة كلها: من الشريحة على المجهر حتى العضيّات
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
    const isTap = g && g.mode === "drag" && g.moved < 8;
    // ضغطة على لقطة المجهر = دفعة تكبير نحو الشريحة (بديل العجلة على الأجهزة
    // اللمسية بإصبع واحد؛ الرحلة كلها تبقى بيد الطالب لا تنتقل وحدها)
    if (isTap && sim.p < 0.5 && sim.diveP < 0.2) {
      sim.pTarget = CLAMP(sim.pTarget + 0.07, 0, 1);
      if (propsRef.current.soundEnabled) CellSound.playClick();
    } else if (isTap && sim.p > 0.66 && sim.diveP < 0.2) {
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
