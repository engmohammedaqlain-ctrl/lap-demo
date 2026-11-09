/**
 * MicroscopeBench.jsx — بيئة المعمل: مجهر على طاولة، وكل أدوات التحكم "ماديّة":
 *  - مقبضا التركيز (خشن/دقيق): اسحب رأسياً فيدوران ويتغيّر التكبير.
 *  - برج العدسات (×4 ×10 ×40 ×100): المس عدسة لتقفز إلى تكبيرها.
 *  - رفّ الشرائح: المس أو اسحب الشريحة الأخرى إلى طاولة العيّنة لتبديل نوع الخلية.
 *  - رافعة الغوص: تدخل العضيّ المحدّد وتخرج منه.
 *  - لوحة نحاسية منقوشة تعرض المرحلة والتكبير.
 * المشهد العلمي نفسه (CellScene) يُعرض في مجال رؤية العدسة العينية فوق هذا الكانفس.
 */
import { useEffect, useRef } from "react";
import { OBJECTIVES } from "./layout.js";
import { buildStatic, drawDynamic, SLIDE_SIZE } from "./bench.js";
import { play } from "../audio/sfx.js";

const K_COARSE = 0.09; // تغيير p لكل راديان على المقبض الخشن
const K_FINE = 0.026;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function MicroscopeBench({ L, type, zoom, canDive, diving, sceneRef, onType, onObjective, onLever, soundEnabled }) {
  const canvasRef = useRef(null);
  const live = useRef({});
  live.current = { L, type, zoom, canDive, diving, sceneRef, onType, onObjective, onLever, soundEnabled };

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas.getContext("2d");
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let staticCanvas = null;
    let builtFor = "";
    let dpr = 1;

    const st = {
      time: 0,
      zoom: { stage: "", mag: "" },
      pShown: 0,
      coarseTau: 0,
      fineTau: 0,
      turretAngle: 0,
      turretIndexF: 0,
      activeObj: 0,
      type: "animal",
      slides: {},
      lever: { pos: 0, enabled: false },
      hover: null,
      press: null,
      tip: null,
      drag: null,
    };
    let lastTickBucket = 0;

    const slideTarget = (key, Lx, isOnStage) => {
      const { w, h } = SLIDE_SIZE(Lx);
      if (isOnStage) return { x: Lx.stage.x + Lx.stage.w / 2, y: Lx.stage.y + Lx.stage.h / 2 - 3, w, h, lift: 0, rot: 0 };
      const i = key === "animal" ? 0 : 1;
      return { x: Lx.tray.x + Lx.tray.w / 2, y: Lx.tray.y + Lx.tray.h * (0.3 + 0.4 * i), w, h, lift: 0, rot: 0 };
    };

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      builtFor = "";
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    /* ---------- تحويل المؤشر إلى إحداثيات التصميم ---------- */
    const toDesign = (e) => {
      const r = canvas.getBoundingClientRect();
      const Lx = live.current.L;
      return { X: (e.clientX - r.left) / Lx.s, Y: (e.clientY - r.top) / Lx.s };
    };

    function hitTest(X, Y) {
      const { L: Lx } = live.current;
      for (const k of Lx.knobs) {
        if (Math.abs(X - k.cx) <= k.w / 2 + 6 && Math.abs(Y - k.cy) <= k.h / 2 + 4) return { kind: "knob", sub: k.kind, k };
      }
      const t = Lx.turret;
      for (let i = 0; i < OBJECTIVES.length; i++) {
        const a = Math.PI / 2 + (i - st.turretIndexF) * (TAU / OBJECTIVES.length);
        const x = t.cx + Math.cos(a) * t.ring;
        const y = t.cy + Math.sin(a) * t.ring;
        if (Math.hypot(X - x, Y - y) <= t.objR + 14) return { kind: "obj", i };
      }
      for (const key of ["plant", "animal"]) {
        const s = st.slides[key];
        if (s && Math.abs(X - s.x) <= s.w / 2 + 6 && Math.abs(Y - s.y) <= s.h / 2 + 8) return { kind: "slide", key };
      }
      const b = Lx.lever;
      if (X >= b.x - 6 && X <= b.x + b.w + 6 && Y >= b.y - 8 && Y <= b.y + b.h + 8) return { kind: "lever" };
      return null;
    }

    const tipFor = (hit) => {
      const { L: Lx, canDive, diving } = live.current;
      if (!hit) return null;
      if (hit.kind === "knob") {
        const k = hit.k;
        return { text: k.kind === "coarse" ? "تقريب" : "ضبط دقيق", x: k.cx, y: k.cy - k.h / 2 - 20 };
      }
      if (hit.kind === "obj") {
        const t = Lx.turret;
        return { text: `العدسة ${OBJECTIVES[hit.i].label}`, x: t.cx, y: t.cy - t.R - 22 };
      }
      if (hit.kind === "slide") {
        const s = st.slides[hit.key];
        return { text: hit.key === "plant" ? "شريحة نباتية" : "شريحة حيوانية", x: s.x, y: s.y - s.h / 2 - 20 };
      }
      if (hit.kind === "lever") {
        const b = Lx.lever;
        return { text: diving ? "خروج من العضيّ" : canDive ? "غوص داخل العضيّ" : "اختر عضيّاً أولاً", x: b.x + b.w / 2, y: b.y - 20 };
      }
      return null;
    };

    /* ---------- أحداث المؤشر ---------- */
    let drag = null;

    function onDown(e) {
      const { X, Y } = toDesign(e);
      const hit = hitTest(X, Y);
      if (!hit) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* غير نشط */
      }
      e.preventDefault();
      if (hit.kind === "knob") {
        drag = { kind: "knob", k: hit.k, y: Y, moved: 0 };
        st.press = `knob:${hit.sub}`;
      } else if (hit.kind === "slide") {
        if (live.current.type === hit.key) return;
        const s = st.slides[hit.key];
        drag = { kind: "slide", key: hit.key, dx: s.x - X, dy: s.y - Y, moved: 0, X0: X, Y0: Y };
        play("grab", { volume: 0.8 });
      } else if (hit.kind === "obj") {
        drag = { kind: "obj", i: hit.i };
      } else if (hit.kind === "lever") {
        drag = { kind: "lever" };
      }
      st.tip = tipFor(hit);
    }

    function onMove(e) {
      const { X, Y } = toDesign(e);
      if (drag) {
        if (drag.kind === "knob") {
          const dy = Y - drag.y;
          drag.y = Y;
          drag.moved += Math.abs(dy);
          const R = drag.k.h / 2;
          const kk = drag.k.kind === "coarse" ? K_COARSE : K_FINE;
          const sc = live.current.sceneRef.current;
          if (sc) sc.nudgeZoom((-dy / R) * kk);
        } else if (drag.kind === "slide") {
          const s = st.slides[drag.key];
          s.x = X + drag.dx;
          s.y = Y + drag.dy;
          s.lift = 1;
          s.rot = clamp((X - drag.X0) * 0.0012, -0.18, 0.18);
          drag.moved = Math.hypot(X - drag.X0, Y - drag.Y0);
        }
        return;
      }
      const hit = hitTest(X, Y);
      st.hover = hit ? (hit.kind === "knob" ? `knob:${hit.sub}` : hit.kind === "slide" ? `slide:${hit.key}` : hit.kind === "obj" ? `obj:${hit.i}` : "lever") : null;
      st.tip = tipFor(hit);
      canvas.style.cursor = hit ? (hit.kind === "knob" ? "ns-resize" : "pointer") : "default";
    }

    function onUp(e) {
      const d = drag;
      drag = null;
      st.press = null;
      if (!d) return;
      const { X, Y } = toDesign(e);
      const { L: Lx } = live.current;
      if (d.kind === "slide") {
        const s = st.slides[d.key];
        const stg = Lx.stage;
        const onStage = X > stg.x - 40 && X < stg.x + stg.w + 40 && Y > stg.y - 50 && Y < stg.y + stg.h + 40;
        if (onStage || d.moved < 8) {
          live.current.onType(d.key);
          play("hit_wood", { volume: 0.5, rate: 1.4 });
        } else {
          s.lift = 0;
        }
      } else if (d.kind === "obj") {
        live.current.onObjective(d.i);
        play("hit_steel", { volume: 0.4, rate: 1.6 });
      } else if (d.kind === "lever") {
        live.current.onLever();
        play("hit_steel", { volume: 0.45, rate: 1.2 });
      }
      st.tip = null;
    }

    function onLeave() {
      st.hover = null;
      if (!drag) st.tip = null;
    }

    function onWheel(e) {
      const sc = live.current.sceneRef.current;
      if (!sc) return;
      e.preventDefault();
      sc.nudgeZoom(-e.deltaY * 0.0011);
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    /* ---------- الحلقة ---------- */
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { L: Lx, type: ty, zoom: z, canDive, diving, sceneRef } = live.current;
      st.time += dt;

      // الطبقة الثابتة
      const key = `${Lx.orient}|${Math.round(Lx.dW)}x${Math.round(Lx.dH)}|${canvas.width}`;
      if (builtFor !== key) {
        staticCanvas = buildStatic(Lx, dpr);
        builtFor = key;
      }

      // حالة الزووم → المقابض والبرج والمقياس
      const sc = sceneRef.current;
      const zz = sc ? sc.getZoom() : { p: z.p || 0, target: z.p || 0 };
      st.pShown = clamp(zz.p, 0, 1);
      st.zoom = z;
      const ease = 1 - Math.exp(-dt * 14);
      st.coarseTau += (-zz.target / K_COARSE - st.coarseTau) * ease;
      st.fineTau += (-zz.target / K_FINE - st.fineTau) * ease;
      const bucket = Math.floor(st.coarseTau / 0.42);
      if (bucket !== lastTickBucket) {
        lastTickBucket = bucket;
        if (live.current.soundEnabled) play("tick", { volume: 0.32, throttle: 36, jitter: 0.1 });
      }

      let best = 0;
      let bd = 9;
      OBJECTIVES.forEach((o, i) => {
        const d = Math.abs(o.p - zz.target);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      const prevActive = st.activeObj;
      st.activeObj = best;
      if (best !== prevActive && live.current.soundEnabled) play("hit_steel", { volume: 0.18, rate: 1.8, throttle: 200 });
      const n = OBJECTIVES.length;
      let diff = (((best - st.turretIndexF) % n) + n) % n;
      if (diff > n / 2) diff -= n;
      st.turretIndexF += diff * (1 - Math.exp(-dt * 7));
      st.turretAngle = st.turretIndexF * (TAU / n);

      // الشرائح
      st.type = ty;
      for (const k of ["animal", "plant"]) {
        const tgt = slideTarget(k, Lx, ty === k);
        let s = st.slides[k];
        if (!s) s = st.slides[k] = { ...tgt };
        if (!(drag && drag.kind === "slide" && drag.key === k)) {
          const e2 = 1 - Math.exp(-dt * 10);
          s.x += (tgt.x - s.x) * e2;
          s.y += (tgt.y - s.y) * e2;
          s.lift += ((Math.hypot(tgt.x - s.x, tgt.y - s.y) > 6 ? 0.6 : 0) - s.lift) * e2;
          s.rot += (0 - s.rot) * e2;
        }
        s.w = tgt.w;
        s.h = tgt.h;
      }

      // الرافعة
      st.lever.enabled = !!canDive;
      const target = diving ? 1 : 0;
      st.lever.pos += (target - st.lever.pos) * (1 - Math.exp(-dt * 10));

      // الرسم
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (staticCanvas) g.drawImage(staticCanvas, 0, 0, canvas.width, canvas.height);
      g.setTransform(Lx.s * dpr, 0, 0, Lx.s * dpr, 0, 0);
      drawDynamic(g, Lx, st);
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
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return <canvas ref={canvasRef} className="cl-bench-canvas" />;
}
