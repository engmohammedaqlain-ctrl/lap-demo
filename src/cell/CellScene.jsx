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
import onionUrl from "./assets/onion.png";
import mouthUrl from "./assets/mouth.png";
import personUrl from "./assets/person.png";
import microscopeUrl from "./assets/microscope.png";
import swabUrl from "./assets/swab.png";
import tweezersUrl from "./assets/tweezers.png";
import stainSlideSetUrl from "./assets/stain_slide_set.png";
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

/* جدولة المقدّمة السينمائية (بالثواني) — مهل تُظهر الوجه/البصلة والحدّ بوضوح.
 * تُبنى كمنحنى Hermite واحد متصل الميل عبر كل النقاط (بدل smoothstep مقطعي
 * كان يُصفّر السرعة عند كل حدّ بين مرحلتين — أي ٦ توقّفات فعلية خلال ١١ث تجعل
 * الزووم يبدو متعثّراً). السرعة صفر فقط عند البداية والنهاية كما ينبغي؛ داخلياً
 * تنتقل بسلاسة بين وتيرة كل مرحلة. */
const INTRO_KEYS = [
  [0, 0.01], // لبث على الوجه/البصلة الكاملة
  [1.6, 0.03], // اقتراب نحو نقطة أخذ العيّنة
  [2.6, 0.06], // بداية تحضير الشريحة
  [5.6, 0.25], // نهاية تحضير الشريحة: عيّنة ← شريحة ← صبغة ← غطاء
  [7.0, 0.5], // نسيج الخلايا تحت المجهر
  [8.2, 0.6], // اقتراب بطيء من حدّ المجهر
  [9.2, 0.62], // لبث درامي عند الحدّ
  [11.0, 0.82], // انفجار الدخول
];
const INTRO_TANGENTS = INTRO_KEYS.map(([t, p], i, arr) => {
  if (i === 0 || i === arr.length - 1) return 0; // سكون فقط عند بداية/نهاية الرحلة كلها
  const [tp, pp] = arr[i - 1];
  const [tn, pn] = arr[i + 1];
  return 0.5 * ((pn - p) / (tn - t) + (p - pp) / (t - tp));
});
function introSchedule(t) {
  const n = INTRO_KEYS.length;
  if (t <= INTRO_KEYS[0][0]) return INTRO_KEYS[0][1];
  if (t >= INTRO_KEYS[n - 1][0]) return INTRO_KEYS[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > INTRO_KEYS[i + 1][0]) i++;
  const [t0, p0] = INTRO_KEYS[i];
  const [t1, p1] = INTRO_KEYS[i + 1];
  const m0 = INTRO_TANGENTS[i];
  const m1 = INTRO_TANGENTS[i + 1];
  const dt = t1 - t0;
  const u = (t - t0) / dt;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * p0 + h10 * dt * m0 + h01 * p1 + h11 * dt * m1;
}

/* العضيّات المصمتة (تملأ محيطها) — تتلقّى طبقة اللمعان/العمق دون الخطّية */
const SOLID_ORG = new Set(["nucleus", "mito", "lysosome", "vacuole", "chloroplast"]);

function stageLabel(p) {
  if (p < 0.09) return "المقدّمة";
  if (p < 0.28) return "تحضير الشريحة";
  if (p < 0.5) return "نسيج خلايا";
  if (p < 0.7) return "خلية واحدة";
  return "داخل الخلية";
}
function magLabel(p) {
  if (p < 0.09) return STAGES.droplet.mag;
  if (p < 0.28) return STAGES.prep.mag;
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
    wheelVel: 0, // قصور ذاتي عجلة الفأرة/اللمس — إحساس "مقبض تركيز" بدل قفزات مباشرة
    autoplay: !reduced,
    autoT: 0,
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
    slideSoundPlayed: false,
  };
}

/* بعض صور المقدّمة الحقيقية (onion.png/mouth.png) لقطات استوديو بخلفية بيضاء
 * مصمتة (بلا قناة شفافية) — تُستخدم عند حجم صغير فوق مقعد المختبر الملوّن في
 * مرحلة "تحضير الشريحة"، فتظهر كصندوق أبيض إن لم تُزَل الخلفية. نُفرّغ الأبيض
 * المتّصل بحواف الصورة فقط (flood-fill من الإطار) كي لا نلمس بياضاً محاطاً
 * بالموضوع نفسه (كأسنان بيضاء داخل صورة الفم). ننفّذ هذا مرّة واحدة عند التحميل،
 * لا كل إطار.
 */
function stripWhiteBackground(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const cnv = document.createElement("canvas");
  cnv.width = w;
  cnv.height = h;
  const cctx = cnv.getContext("2d");
  cctx.drawImage(img, 0, 0, w, h);
  const data = cctx.getImageData(0, 0, w, h);
  const d = data.data;
  const THRESH = 238;
  const isWhite = (i) => d[i] > THRESH && d[i + 1] > THRESH && d[i + 2] > THRESH;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    if (!isWhite(idx * 4)) return;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) {
    consider(x, 0);
    consider(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    consider(0, y);
    consider(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    d[idx * 4 + 3] = 0;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }
  cctx.putImageData(data, 0, 0);
  // خصائص مطابقة لعنصر Image كي تعمل مع كل فحوصات img.complete/naturalWidth الحالية
  cnv.complete = true;
  cnv.naturalWidth = w;
  cnv.naturalHeight = h;
  return cnv;
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
    onion: null,
    mouth: null,
    person: null,
    microscope: null,
    swab: null,
    tweezers: null,
    stainSlideSet: null,
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
      const s = simRef.current;
      const reduced = propsRef.current.reducedMotion;
      s.p = reduced ? 0.82 : 0.0;
      s.pTarget = 0.82;
      s.panX = 0;
      s.panY = 0;
      s.autoplay = !reduced;
      s.autoT = 0;
      s.limitCrossed = reduced;
      s.focusId = null;
      s.diveP = 0;
      s.diveTarget = 0;
      s.slideSoundPlayed = false;
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

    // الزووم — مقدّمة سينمائية مجدولة بمهل كافية لرؤية الوجه/البصلة ولافتة المجهر
    sim.prevP = sim.p;
    if (sim.autoplay) {
      sim.autoT += dt / 60; // ثوانٍ
      sim.p = introSchedule(sim.autoT);
      sim.pTarget = sim.p;
      if (sim.autoT > 11.0) sim.autoplay = false;
    } else {
      // ملاحقة الهدف اليدوي بمعدّل مستقلّ عن معدّل الإطارات (1-e^-k·dt بدل عامل
      // ثابت لكل إطار)، مع انتقال ناعم (smoothstep) لمعدّل التباطؤ قرب حدّ
      // المجهر بدل قفزة ثنائية مفاجئة بين سرعتين.
      const dist = CLAMP(Math.abs(sim.p - MICRO_LIMIT_P) / 0.05, 0, 1);
      const ease = dist * dist * (3 - 2 * dist);
      const k = LERP(ZOOM_FOLLOW_K_NEAR, ZOOM_FOLLOW_K, ease);
      sim.p += (sim.pTarget - sim.p) * (1 - Math.exp(-k * dt));
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
    const aPrep = fade(sim.p, STAGES.prep.in, STAGES.prep.out);
    const aClu = fade(sim.p, STAGES.cluster.in, STAGES.cluster.out);
    const aCell = fade(sim.p, STAGES.cell.in, STAGES.cell.out);
    const aIn = fade(sim.p, STAGES.inside.in, null) * (1 - sim.diveP);
    const aScope = fade(sim.p, SCOPE_SHOT_WINDOW.in, SCOPE_SHOT_WINDOW.out);

    if (aIntro > 0.01) drawIntro(ctx, sim, aIntro, type);
    if (aPrep > 0.01) drawSlidePrep(ctx, sim, aPrep, type);
    if (aScope > 0.01) drawMicroscopeShot(ctx, sim, aScope);
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

  /* ---- المقدّمة حسب النوع: وجه حقيقي / بصلة حقيقية (دفعة أولى معتدلة فقط) ---- */
  function drawIntro(ctx, sim, alpha, type) {
    const gp = CLAMP((sim.p - STAGES.droplet.in[0]) / (STAGES.droplet.out[1] - STAGES.droplet.in[0] || 1e-6), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (type === "plant") {
      const img = imagesRef.current.onion;
      if (img) drawPhotoIntro(ctx, sim, gp, img, 0.5, 0.5, "قشرة البصل");
      else drawOnion(ctx, sim, gp);
    } else {
      const img = imagesRef.current.person;
      if (img) drawPhotoIntro(ctx, sim, gp, img, 0.46, 0.52, "الخدّ");
      else drawFace(ctx, sim, gp);
    }
    ctx.restore();
  }

  /* رسم صورة حقيقية ودفعة تقريب معتدلة فقط (الغوص الحقيقي يتم عبر مشهد تحضير الشريحة) */
  function drawPhotoIntro(ctx, sim, gp, img, fx, fy, label) {
    const iw = img.width;
    const ih = img.height;
    const fit = Math.max((SCENE_W * 1.02) / iw, (SCENE_H * 1.02) / ih); // cover التصميم
    const w = iw * fit;
    const h = ih * fit;
    // ضع نقطة التركيز (fx,fy) داخل الصورة في مركز الشاشة، ثم كبّر حولها قليلاً فقط
    const ox = CX - fx * w;
    const oy = CY - fy * h;
    const scale = LERP(1, 2.1, gp * gp);
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    ctx.translate(-CX, -CY);
    ctx.drawImage(img, ox, oy, w, h);
    const vg = ctx.createRadialGradient(CX, CY, 10, CX, CY, Math.max(w, h) * 0.6);
    vg.addColorStop(0, "rgba(255,220,150,0.05)");
    vg.addColorStop(1, "rgba(20,10,20,0.32)");
    ctx.fillStyle = vg;
    ctx.fillRect(ox, oy, w, h);
    ctx.restore();
    // حلقة تحديد نابضة + لافتة على نقطة الغوص (مركز الشاشة)
    const pulse = 0.5 + 0.5 * Math.sin(sim.t * 3);
    ctx.save();
    ctx.globalAlpha = 1 - gp;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    ctx.setLineDash([7, 9]);
    ctx.beginPath();
    ctx.arc(CX, CY, 46 + pulse * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 10;
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "bold 20px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText(label, CX, CY - 62);
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

  /* =====================================================================
   * تحضير الشريحة — بدل القفز مباشرة إلى زووم البصلة/الخدّ، نرى كيف تُؤخذ
   * عيّنة حقيقية (رقاقة قشرة/مسحة خدّية) وتُوضع على شريحة زجاجية تحت المجهر.
   * ===================================================================== */
  const SLIDE_POS = { x: CX + 150, y: CY - 4, w: 250, h: 108 };
  const SPECIMEN_POS = { x: CX - 220, y: CY + 8 };
  const MARKER_OFFSET = { x: 92, y: -34 };

  function prepProgress(sim) {
    return CLAMP((sim.p - STAGES.prep.in[0]) / (STAGES.prep.out[1] - STAGES.prep.in[0] || 1e-6), 0, 1);
  }

  function drawSlidePrep(ctx, sim, alpha, type) {
    const gp = prepProgress(sim);
    const accent = type === "plant" ? "#f2a638" : "#42a5f5"; // يود كهرماني / ميثيلين أزرق
    ctx.save();
    ctx.globalAlpha = alpha;

    // مقعد المختبر — سطح دافئ خفيف يميّز منطقة العمل
    const benchY = CY + 150;
    const bg = ctx.createLinearGradient(0, benchY - 30, 0, SCENE_H);
    bg.addColorStop(0, "rgba(120,90,60,0)");
    bg.addColorStop(1, "rgba(120,90,60,0.14)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, benchY - 30, SCENE_W, SCENE_H - benchY + 30);

    const marker = { x: SPECIMEN_POS.x + MARKER_OFFSET.x, y: SPECIMEN_POS.y + MARKER_OFFSET.y };

    if (type === "plant") drawOnionSpecimen(ctx, sim, SPECIMEN_POS, marker);
    else drawMouthSpecimen(ctx, sim, SPECIMEN_POS, marker);

    // الأداة تبقى ثابتة عند نقطة أخذ العيّنة (بلا انتقال عبر الشاشة) — عصر خفيف فقط
    const take = CLAMP(gp / 0.28, 0, 1); // أخذ العيّنة
    if (take > 0.01) {
      const toolX = marker.x - 6;
      const toolY = marker.y - 60;
      if (type === "plant") drawTweezers(ctx, toolX, toolY, take);
      else drawSwab(ctx, toolX, toolY, take);
    }

    // الشريحة الزجاجية دوماً حاضرة على المقعد
    drawGlassSlide(ctx, SLIDE_POS);

    // بقيّة الخطوات تظهر بمكانها النهائي مباشرة (تلاشٍ فقط، بلا حركة/طيران عبر الشاشة)
    const sampleAt = { x: SLIDE_POS.x - 40, y: SLIDE_POS.y };
    const sample = CLAMP((gp - 0.28) / 0.14, 0, 1); // العيّنة تستقرّ على الشريحة
    const stain = CLAMP((gp - 0.46) / 0.14, 0, 1); // قطرة الصبغة/الكاشف
    const cover = CLAMP((gp - 0.6) / 0.2, 0, 1); // الغطاء الزجاجي (يكتمل عند gp≈0.8)

    if (sample > 0.02) {
      if (type === "plant") drawPeelStrip(ctx, sampleAt.x, sampleAt.y, sample);
      else drawCheekSmear(ctx, sampleAt.x, sampleAt.y, sample);
    }

    // قطرة الصبغة/الكاشف — تلاشٍ ثابت بمكانه، بلا سقوط
    if (stain > 0.02) drawLiquidDrop(ctx, SLIDE_POS, accent, stain);
    if (stain > 0.02 && type === "animal") drawDropperTool(ctx, SLIDE_POS, stain);

    // الغطاء الزجاجي يظهر بمكانه مباشرة، مع ومضة لمعان خفيفة عند الاستقرار
    if (cover > 0.02) drawCoverslip(ctx, SLIDE_POS, cover);

    // صوت "طقّة" الشريحة عند اكتمال التغطية (مرّة واحدة لكل دورة مقدّمة)
    if (cover > 0.85 && !sim.slideSoundPlayed) {
      sim.slideSoundPlayed = true;
      if (propsRef.current.soundEnabled) CellSound.playSlideClink();
    }
    if (gp < 0.4) sim.slideSoundPlayed = false;

    drawPrepCaption(ctx, type, gp, accent);
    ctx.restore();
  }

  function drawOnionSpecimen(ctx, sim, pos, marker) {
    const img = imagesRef.current["onion"];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const h = 220;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      for (let i = 4; i >= 0; i--) {
        const rr = 46 + i * 14;
        const g = ctx.createRadialGradient(-6, -12, rr * 0.2, 0, 0, rr);
        const shade = 236 - i * 10;
        g.addColorStop(0, `rgb(${shade},${shade - 18},${shade - 55})`);
        g.addColorStop(1, `rgb(${shade - 28},${shade - 50},${shade - 88})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * 1.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(150,110,60,0.3)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.strokeStyle = "#7cb342";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -104);
      ctx.quadraticCurveTo(-16, -150, -6, -180);
      ctx.stroke();
      ctx.restore();
    }
    drawMarker(ctx, marker, sim);
  }

  function drawMouthSpecimen(ctx, sim, pos, marker) {
    const img = imagesRef.current["mouth"];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const h = 220;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const skin = ctx.createRadialGradient(-14, -20, 12, 0, 0, 90);
      skin.addColorStop(0, "#ffe0c2");
      skin.addColorStop(1, "#e3a97f");
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(0, 0, 78, 96, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a2a2e";
      ctx.beginPath();
      ctx.ellipse(6, 30, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c85a5a";
      ctx.beginPath();
      ctx.ellipse(10, 34, 34, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawMarker(ctx, marker, sim);
  }

  function drawMarker(ctx, m, sim) {
    const pulse = 0.5 + 0.5 * Math.sin(sim.t * 3);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 16 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawTweezers(ctx, x, y, close) {
    const img = imagesRef.current.tweezers;
    ctx.save();
    ctx.translate(x, y);
    if (img && img.complete && img.naturalWidth > 0) {
      const pinch = LERP(0, -0.08, CLAMP(close, 0, 1));
      const h = 128;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      ctx.rotate(-2.02 + pinch);
      ctx.drawImage(img, -w * 0.06, -h * 0.5, w, h);
    } else {
      const gap = LERP(16, 3, CLAMP(close, 0, 1));
      ctx.strokeStyle = "#9e9e9e";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-gap, -70);
      ctx.lineTo(-2, 4);
      ctx.moveTo(gap, -70);
      ctx.lineTo(2, 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSwab(ctx, x, y, take) {
    const img = imagesRef.current.swab;
    ctx.save();
    ctx.translate(x, y);
    if (img && img.complete && img.naturalWidth > 0) {
      const h = 132;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      ctx.globalAlpha = 0.55 + 0.45 * CLAMP(take, 0, 1);
      ctx.rotate(Math.PI / 2 + 0.06);
      ctx.drawImage(img, -w * 0.5, -h * 0.5, w, h);
    } else {
      ctx.strokeStyle = "#c8a86a";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(0, 2);
      ctx.stroke();
      ctx.globalAlpha = CLAMP(take, 0, 1);
      ctx.fillStyle = "#fdfaf3";
      ctx.beginPath();
      ctx.arc(0, 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(200,190,170,0.6)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* رقاقة/مسحة تظهر بمكانها النهائي على الشريحة مباشرة (تلاشٍ فقط) */
  function drawPeelStrip(ctx, x, y, sample) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.75 * CLAMP(sample, 0, 1);
    const g = ctx.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, "rgba(238,220,190,0.9)");
    g.addColorStop(1, "rgba(210,185,140,0.85)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.quadraticCurveTo(0, -18, 34, 0);
    ctx.quadraticCurveTo(0, 10, -34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(150,110,60,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawCheekSmear(ctx, x, y, sample) {
    ctx.save();
    ctx.globalAlpha = 0.55 * CLAMP(sample, 0, 1);
    const g = ctx.createLinearGradient(x - 55, 0, x + 40, 0);
    g.addColorStop(0, "rgba(230,180,170,0)");
    g.addColorStop(0.5, "rgba(228,175,165,0.7)");
    g.addColorStop(1, "rgba(230,180,170,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x - 15, y, 62, 14, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGlassSlide(ctx, pos) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    const g = ctx.createLinearGradient(0, -pos.h / 2, 0, pos.h / 2);
    g.addColorStop(0, "rgba(225,240,245,0.55)");
    g.addColorStop(1, "rgba(190,215,225,0.4)");
    ctx.fillStyle = g;
    roundRect(ctx, -pos.w / 2, -pos.h / 2, pos.w, pos.h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,150,160,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-pos.w / 2 + 4, -pos.h / 2 + 4);
    ctx.lineTo(pos.w / 2 - 4, -pos.h / 2 + 4);
    ctx.stroke();
    ctx.restore();
  }

  /* الغطاء الزجاجي يظهر بمكانه النهائي مباشرة (تلاشٍ فقط، بلا نزول) */
  function drawCoverslip(ctx, pos, cover) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.globalAlpha = 0.5 + 0.3 * CLAMP(cover, 0, 1);
    ctx.fillStyle = "rgba(210,235,245,0.45)";
    const w = pos.w * 0.62;
    const h = pos.h * 0.72;
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (cover > 0.8) {
      const shine = CLAMP((cover - 0.8) / 0.2, 0, 1);
      ctx.globalAlpha = shine * (1 - shine) * 4 * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      roundRect(ctx, -w / 2, -h / 2, w, h, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  /* أداة القطّارة (مقصوصة من stain_slide_set.png — سائلها أزرق فتُستخدم لصبغة الميثيلين
   * الحيوانية فقط؛ كاشف اليود الكهرماني النباتي يبقى متجهياً كي لا يتعارض اللون) */
  function drawDropperTool(ctx, pos, stain) {
    const img = imagesRef.current.stainSlideSet;
    if (!img || !img.complete || img.naturalWidth <= 0) return;
    const s = CLAMP(stain, 0, 1);
    const appear = s < 0.55 ? CLAMP(s / 0.15, 0, 1) : CLAMP(1 - (s - 0.55) / 0.2, 0, 1);
    if (appear < 0.02) return;
    // قصّ ربع الصورة الأيسر (القطّارة فقط، بلا الشرائح على يمينها)
    const sx = 0,
      sy = 0,
      sw = img.naturalWidth * 0.56,
      sh = img.naturalHeight;
    const h = 118;
    const w = (h * sw) / sh;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(pos.x - 10, pos.y - 78);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* بقعة الصبغة/الكاشف تظهر بمكانها النهائي على الشريحة مباشرة (تلاشٍ فقط، بلا سقوط) */
  function drawLiquidDrop(ctx, pos, color, stain) {
    const s = CLAMP(stain, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.15 * s;
    const g = ctx.createRadialGradient(pos.x - 4, pos.y, 2, pos.x - 4, pos.y, 30 + s * 6);
    g.addColorStop(0, hexA(color, 0.55));
    g.addColorStop(1, hexA(color, 0.05));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(pos.x - 4, pos.y, 22 + s * 6, 12 + s * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPrepCaption(ctx, type, gp, accent) {
    const steps = INTRO[type].prepSteps;
    const bounds = [0, 0.28, 0.46, 0.6, 1.01];
    let idx = 0;
    for (let i = 0; i < steps.length; i++) if (gp >= bounds[i]) idx = i;
    // مزج سلس عند حدود الخطوات
    const next = Math.min(idx + 1, steps.length - 1);
    const span = bounds[idx + 1] - bounds[idx] || 1;
    const localT = CLAMP((gp - bounds[idx]) / span, 0, 1);
    const settle = idx === next ? 1 : localT < 0.85 ? 1 : 1 - (localT - 0.85) / 0.15;

    ctx.save();
    ctx.globalAlpha = CLAMP(settle, 0, 1);
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "700 21px 'IBM Plex Sans Arabic', sans-serif";
    const txt = steps[idx];
    const tw = ctx.measureText(txt).width;
    const bw = Math.min(tw + 48, SCENE_W - 60);
    const bh = 46;
    const by = SCENE_H - 88;
    ctx.fillStyle = "rgba(8,10,20,0.88)";
    ctx.strokeStyle = hexA(accent, 0.85);
    ctx.lineWidth = 2;
    roundRect(ctx, CX - bw / 2, by - bh / 2, bw, bh, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(txt, CX, by + 7);
    // نقاط تقدّم الخطوات الأربع
    const dotY = by + bh / 2 + 16;
    const dotGap = 16;
    const startX = CX - (dotGap * (steps.length - 1)) / 2;
    for (let i = 0; i < steps.length; i++) {
      ctx.beginPath();
      ctx.fillStyle = i <= idx ? accent : "rgba(255,255,255,0.35)";
      ctx.arc(startX + i * dotGap, dotY, i === idx ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* نافذة ظهور "لقطة المجهر" الجسرية بين تحضير الشريحة ونسيج الخلايا */
  const SCOPE_SHOT_WINDOW = { in: [0.18, 0.23], out: [0.27, 0.32] };

  /* لقطة قصيرة للشريحة وهي تُوضع تحت المجهر — جسر بين "تحضير الشريحة" و"نسيج الخلايا" */
  function drawMicroscopeShot(ctx, sim, alpha) {
    const img = imagesRef.current.microscope;
    if (!img || !img.complete || img.naturalWidth <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const vg = ctx.createRadialGradient(CX, CY, 20, CX, CY, SCENE_W * 0.65);
    vg.addColorStop(0, "rgba(20,10,20,0.15)");
    vg.addColorStop(1, "rgba(10,5,12,0.7)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    const h = SCENE_H * 0.86;
    const w = (h * img.naturalWidth) / img.naturalHeight;
    const bob = Math.sin(sim.t * 1.4) * 3;
    ctx.drawImage(img, CX - w / 2, CY - h / 2 + bob, w, h);
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 18px 'IBM Plex Sans Arabic', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText("نضع الشريحة تحت المجهر", CX, SCENE_H - 60);
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
    ctx.save();
    // تعتيم درامي
    const vg = ctx.createRadialGradient(CX, CY, SCENE_H * 0.15, CX, CY, SCENE_W * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(3,6,15,${0.62 * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);

    const y = CY;
    // خطّان متوهّجان بلون كهرماني تحذيري (تباين عالٍ على الخلفية)
    ctx.globalAlpha = a;
    ctx.strokeStyle = `rgba(255,193,7,${a})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.shadowColor = "rgba(255,193,7,0.95)";
    ctx.shadowBlur = 14;
    for (const off of [-46, 46]) {
      ctx.beginPath();
      ctx.moveTo(SCENE_W * 0.08, y + off);
      ctx.lineTo(SCENE_W * 0.92, y + off);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // لوحة داكنة صلبة خلف النص (تباين قصوى)
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
    roundRect(ctx, CX - bw / 2, y - bh / 2, bw, bh, 14);
    ctx.fill();
    ctx.stroke();
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

    // تحميل الصور الحقيقية (بصلة + وجه اختياري)
    const loadImg = (url, key) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => (imagesRef.current[key] = im);
      im.src = url;
    };
    // onion/mouth: صور استوديو بخلفية بيضاء مصمتة تُستخدم بحجم صغير فوق مقعد
    // المختبر — نُفرّغ الأبيض المحيط كي لا تظهر كصندوق أبيض (person تبقى كما
    // هي: تُرسم ملء الشاشة فلا يهمّ عدم وجود شفافية فيها)
    const loadImgKeyWhite = (url, key) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => {
        try {
          imagesRef.current[key] = stripWhiteBackground(im);
        } catch {
          imagesRef.current[key] = im; // احتياطي إن فشل getImageData (مثلاً قيود CORS)
        }
      };
      im.src = url;
    };
    loadImgKeyWhite(onionUrl, "onion");
    loadImgKeyWhite(mouthUrl, "mouth");
    loadImg(personUrl, "person");
    loadImg(microscopeUrl, "microscope");
    loadImg(swabUrl, "swab");
    loadImg(tweezersUrl, "tweezers");
    loadImg(stainSlideSetUrl, "stainSlideSet");
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
