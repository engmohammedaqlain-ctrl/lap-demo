/**
 * ColorScene.jsx — غرفة بصريات كاملة على Canvas: الشخصية على المنصّة، ثلاثة
 * كشّافات على شجرة إضاءة، ومنصّة تحكّم بفيدرات حقيقية، مفتاح نمط الضوء، وزرّ
 * تشغيل. باقي الخيارات عناصر في الغرفة نفسها: صورتان على الحائط (الشخصية)،
 * لوحة نظّارات (عمى الألوان)، رفّ شفّافات ملوّنة، ولوحة ألوان رسّام (أمزجة).
 * القراءات على مطياف الحائط وفي سحابة تفكير الدماغ. كل اللمس هنا (Pointer Events).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DW, DH, LIGHTS, FILTERS, MIXES, VISION_MODES, calculatePerceivedColor } from "./colorData.js";
import { rng } from "./sceneArt.js";
import { drawBackdrop, drawTable, drawVennPoster, drawSpectrometer, drawPortraits, drawGlassBoard, drawPalette, drawGelRack, drawConsole, FADER, KNOB_ANGLES } from "./drawEnv.js";
import {
  drawLightTree,
  drawSubject,
  drawGlassesWorn,
  drawLights,
  updateOptics,
  drawBeams,
  drawPhotons,
  drawGelFrame,
  drawCortexAndPulses,
  drawCloud,
  drawMotes,
  drawTip,
} from "./drawOptics.js";
import boyUrl from "./assets/boy.webp";
import girlUrl from "./assets/girl.webp";

const MODES = ["particles", "waves", "solid"];
const MODE_NAMES = { particles: "فوتونات", waves: "موجات", solid: "شعاع" };

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
    },
    applyMix(rgb) {
      const S = sRef.current;
      if (!S) return;
      const p = propsRef.current;
      S.tween = { from: [p.rVal, p.gVal, p.bVal], to: rgb, t: 0 };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const g = canvas.getContext("2d");
    const r = rng(99);
    const S = {
      g,
      t: 0,
      s: 1,
      ox: 0,
      oy: 0,
      ext: { x0: 0, x1: DW, y0: 0, y1: DH },
      p: propsRef.current,
      imgs: {},
      photons: [],
      pulses: [],
      sparks: [],
      motes: Array.from({ length: 46 }, () => ({
        x: 160 + r() * 1000,
        y: 70 + r() * 570,
        vx: (r() - 0.5) * 7,
        vy: (r() - 0.7) * 5,
        r: 0.9 + r() * 1.6,
        a: 0.1 + r() * 0.35,
      })),
      anim: { fader: [100, 100, 100], knob: 0, btn: 0, gel: 0, worn: 1 },
      info: calculatePerceivedColor(100, 100, 100, "normal"),
      pass: [1, 1, 1],
      hot: [],
      hover: null,
      drag: null,
      hint: true,
      tip: null,
      tipUntil: 0,
      tween: null,
      lastFilter: null,
      filterObj: null,
      lastVision: "normal",
      // خطّ مقروء على الشاشات الصغيرة بلا تضخّم مفرط (يكبر حتى ١٫٧× كحدّ أقصى)
      fs: (n, min = 10) => Math.min(n * 1.7, Math.max(n, min / S.s)),
    };
    sRef.current = S;
    if (import.meta.env.DEV) window.__color = S; // أداة تصحيح محلية فقط
    let alive = true;
    let raf = 0;
    let last = performance.now();
    let lastKey = "";

    for (const [key, url] of [["boy", boyUrl], ["girl", girlUrl]]) {
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
      S.ext = { x0: -S.ox / S.s, x1: (rect.width - S.ox) / S.s, y0: -S.oy / S.s, y1: (rect.height - S.oy) / S.s };
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ---------- تفاعل ---------- */
    const toDesign = (e) => {
      const rc = canvas.getBoundingClientRect();
      return { X: ((e.clientX - rc.left - S.ox) / S.s), Y: ((e.clientY - rc.top - S.oy) / S.s) };
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
      S.tip = { text: h.tip, x: h.cx, y: h.cy - Math.max(h.hh, 14) - 6 };
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
      } else if (id.startsWith("mix:")) {
        const m = MIXES.find((q) => q.id === id.slice(4));
        S.tween = { from: [p.rVal, p.gVal, p.bVal], to: m.rgb, t: 0 };
        S.hint = false;
        p.onMix && p.onMix(m);
      } else if (id === "knob") {
        const next = MODES[(MODES.indexOf(p.beamMode) + 1) % 3];
        p.onBeamMode(next);
      } else if (id === "btn") {
        S.anim.btn = 1;
        p.onTogglePlay();
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
        S.tween = null;
        propsRef.current.onValChange(LIGHTS[h.index].id, valFromY(Y));
      }
      showTip(h, 0);
      e.preventDefault();
    }
    function onMove(e) {
      const { X, Y } = toDesign(e);
      if (S.drag) {
        const h = S.hot.find((q) => q.id === S.drag);
        propsRef.current.onValChange(LIGHTS[h.index].id, valFromY(Y));
        showTip(h, 0);
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

    /* ---------- الحلقة ---------- */
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = propsRef.current;
      S.p = p;
      const A = S.anim;
      if (!S.cssW) return;

      // أمزجة جاهزة: الفيدرات تنزلق فعلاً
      if (S.tween) {
        S.tween.t = Math.min(1, S.tween.t + dt / 0.55);
        const e = 1 - Math.pow(1 - S.tween.t, 3);
        ["red", "green", "blue"].forEach((id, i) => {
          const v = Math.round(S.tween.from[i] + (S.tween.to[i] - S.tween.from[i]) * e);
          const cur = [p.rVal, p.gVal, p.bVal][i];
          if (v !== cur) p.onValChange(id, v);
        });
        if (S.tween.t >= 1) S.tween = null;
      }

      const vals = [p.rVal, p.gVal, p.bVal];
      A.fader = vals;
      A.knob += (KNOB_ANGLES[p.beamMode] - A.knob) * Math.min(1, dt * 14);
      A.btn = Math.max(0, A.btn - dt * 6);
      if (p.filter) {
        S.filterObj = FILTERS.find((f) => f.id === p.filter);
        S.lastFilter = S.filterObj;
      } else S.filterObj = null;
      A.gel += ((p.filter ? 1 : 0) - A.gel) * Math.min(1, dt * 7);
      if (Math.abs(A.gel - (p.filter ? 1 : 0)) < 0.004) A.gel = p.filter ? 1 : 0;
      if (p.visionMode !== S.lastVision) {
        S.lastVision = p.visionMode;
        A.worn = 0;
      }
      A.worn = Math.min(1, A.worn + dt * 5);

      const f = S.filterObj;
      S.pass = f ? f.pass : [1, 1, 1];
      const eff = vals.map((v, i) => v * S.pass[i]);
      S.info = calculatePerceivedColor(eff[0], eff[1], eff[2], p.visionMode);
      const key = `${S.info.hex}|${S.info.arabicName}|${S.info.wavelengthNm}`;
      if (key !== lastKey) {
        lastKey = key;
        p.onStatus && p.onStatus(S.info);
      }
      if (p.isPlaying) S.t += dt;
      if (S.tipUntil && now > S.tipUntil) {
        S.tip = null;
        S.tipUntil = 0;
      }
      updateOptics(S, dt);

      // ---------- رسم ----------
      const t0 = performance.now();
      const k = S.dpr;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = "#0f1620";
      g.fillRect(0, 0, S.cssW, S.cssH);
      g.setTransform(k * S.s, 0, 0, k * S.s, k * S.ox, k * S.oy);
      S.hot = [];
      g.direction = "rtl";

      drawBackdrop(S);
      drawSpectrometer(S);
      drawVennPoster(S);
      drawPortraits(S);
      drawGlassBoard(S);
      drawPalette(S);
      drawGelRack(S);
      drawLightTree(S);
      drawSubject(S);
      drawGlassesWorn(S);
      drawLights(S);
      drawBeams(S);
      drawGelFrame(S);
      drawPhotons(S);
      // الغبار فوق الأشعّة
      drawMotes(S);
      // الجسم الأمامي: الطاولة ثم المنصّة
      drawTable(S);
      drawConsole(S);
      drawCortexAndPulses(S);
      drawCloud(S);
      // مقبض الشفّاف المنزلق قابل للنقر لإزالته
      if (p.filter) {
        const fh = S.hot.find((q) => q.id === `gel:${p.filter}`);
        if (fh) {
          S.hot.push({ id: `gel:${p.filter}`, cx: 790, cy: 370, hw: 22, hh: 200, tip: "إزالة المرشّح", cursor: "pointer" });
        }
      }
      if (S.drag) {
        const dh = S.hot.find((q) => q.id === S.drag);
        if (dh) S.tip = { text: dh.tip, x: dh.cx, y: dh.cy - Math.max(dh.hh, 14) - 6 };
      }
      drawTip(S);
      S.ms = (S.ms || 0) * 0.9 + (performance.now() - t0) * 0.1;
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

  void VISION_MODES;
  void MODE_NAMES;
  return (
    <div ref={wrapRef} className="co-stage">
      <canvas ref={canvasRef} className="co-canvas" aria-label="غرفة البصريات" />
    </div>
  );
});

export default ColorScene;
