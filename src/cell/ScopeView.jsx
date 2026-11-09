/**
 * ScopeView.jsx — الشاشة الأولى لتجربة الخلية: مجهر كامل على طاولة المعمل.
 * كل عنصر ماديّ يعمل:
 *   - البرج: المس عدسة أو اسحبه ليدور فتنزل العدسة المختارة أسفل الأنبوب.
 *   - المقبضان الخشن والدقيق: اسحب دائرياً فيدوران وترتفع المنصّة ويتغيّر التكبير.
 *   - قرص الإضاءة: يضيء المصباح ويصل الضوء إلى العيّنة.
 *   - صندوق الشرائح: المس شريحة لوضعها على المنصّة (حيوانية/نباتية).
 *   - العينية: المسها لتنظر من المجهر (انتقال سلس إلى مجال الرؤية).
 */
import { useEffect, useRef } from "react";
import { getTextures } from "../buoyancy/textures.js";
import { OBJECTIVES } from "./layout.js";
import { play } from "../audio/sfx.js";
import { haptic } from "../mobile/device.js";
import { rr } from "./bench.js";
import {
  AX,
  K_COARSE,
  K_FINE,
  buildScopeStatic,
  drawScopeDynamic,
  drawRack,
  hitScope,
} from "./scope.js";

const FONT = "'IBM Plex Sans Arabic', sans-serif";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => {
  let x = a;
  while (x > Math.PI) x -= TAU;
  while (x < -Math.PI) x += TAU;
  return x;
};

export default function ScopeView({ L, type, active, light, looked, sceneRef, soundEnabled, onLook, onObjective, onType, onLight }) {
  const canvasRef = useRef(null);
  const live = useRef({});
  live.current = { L, type, active, light, looked, sceneRef, soundEnabled, onLook, onObjective, onType, onLight };

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas.getContext("2d");
    const wood = getTextures().wood;
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let staticCanvas = null;
    let builtFor = "";
    let dpr = 1;

    const st = {
      time: 0,
      p: 0,
      light: live.current.light,
      turretAngle: 0,
      activeObj: 0,
      coarseTau: 0,
      fineTau: 0,
      slide: { type: live.current.type, prev: null, t: 1 },
      type: live.current.type,
      hover: null,
      press: null,
      looked: live.current.looked,
      objHits: [],
    };
    if (import.meta.env.DEV) window.__scope = st;

    let tip = null;
    let drag = null;
    let tickBucket = 0;

    const toDesign = (e) => {
      const r = canvas.getBoundingClientRect();
      const Lx = live.current.L;
      return { X: ((e.clientX - r.left) / r.width) * Lx.dW, Y: ((e.clientY - r.top) / r.height) * Lx.dH };
    };
    const knobCenter = () => {
      const Lx = live.current.L;
      return { x: Lx.ox + 160 * Lx.ks, y: Lx.y0 - 172 * Lx.ks };
    };
    const nearestAngle = (a, cur) => {
      // أقرب مكافئ لـ a (modulo 2π) من الزاوية الحالية
      return a + TAU * Math.round((cur - a) / TAU);
    };
    const snapToObj = (i) => {
      st.activeObj = i;
      st.turretTarget = nearestAngle((-i * Math.PI) / 2, st.turretAngle);
    };

    const tipFor = (hit) => {
      const Lx = live.current.L;
      if (!hit) return null;
      if (hit.kind === "eye") return { text: "انظر من العدسة", x: Lx.eye.x, y: Lx.eye.y - 48 * Lx.ks - 10 };
      if (hit.kind === "obj") return { text: `العدسة ${OBJECTIVES[hit.i].label}`, x: Lx.ox + AX * Lx.ks, y: Lx.y0 - 395 * Lx.ks };
      if (hit.kind === "turret") return { text: "برج العدسات: اسحب", x: Lx.ox + AX * Lx.ks, y: Lx.y0 - 395 * Lx.ks };
      if (hit.kind === "knob") {
        const k = knobCenter();
        return { text: hit.sub === "coarse" ? "التركيز الخشن: لفّ" : "التركيز الدقيق: لفّ", x: k.x, y: k.y - 66 * Lx.ks };
      }
      if (hit.kind === "dial") return { text: "الإضاءة: اسحب", x: Lx.ox - 130 * Lx.ks, y: Lx.y0 - 62 * Lx.ks };
      if (hit.kind === "slide") return { text: hit.key === "plant" ? "شريحة نباتية" : "شريحة حيوانية", x: Lx.rack.x + Lx.rack.w * (hit.key === "plant" ? 0.7 : 0.3), y: Lx.rack.y - 34 };
      return null;
    };

    function onDown(e) {
      const { X, Y } = toDesign(e);
      const Lx = live.current.L;
      const hit = hitScope(Lx, st, X, Y);
      if (!hit) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* غير نشط */
      }
      e.preventDefault();
      drag = { hit, X0: X, Y0: Y, X, Y, moved: 0 };
      if (hit.kind === "knob") {
        const k = knobCenter();
        drag.ang = Math.atan2(Y - k.y, X - k.x);
        st.press = `knob:${hit.sub}`;
      } else if (hit.kind === "dial") {
        st.press = "dial";
      } else if (hit.kind === "turret" || hit.kind === "obj") {
        drag.a0 = st.turretAngle;
        st.press = "turret";
        st.turretTarget = undefined;
      }
      tip = tipFor(hit);
      haptic(6);
    }

    function onMove(e) {
      const { X, Y } = toDesign(e);
      const Lx = live.current.L;
      if (drag) {
        const dx = X - drag.X;
        const dy = Y - drag.Y;
        drag.X = X;
        drag.Y = Y;
        drag.moved = Math.hypot(X - drag.X0, Y - drag.Y0);
        const h = drag.hit;
        if (h.kind === "knob") {
          const k = knobCenter();
          const a = Math.atan2(Y - k.y, X - k.x);
          const da = wrapPi(a - drag.ang);
          drag.ang = a;
          const sc = live.current.sceneRef.current;
          if (sc) sc.nudgeZoom(da * (h.sub === "coarse" ? K_COARSE : K_FINE));
        } else if (h.kind === "dial") {
          live.current.onLight(clamp(live.current.light + (dx - dy) / 110, 0, 1));
        } else if ((h.kind === "turret" || h.kind === "obj") && drag.moved > 7) {
          st.turretAngle = drag.a0 + ((X - drag.X0) / Lx.ks) * 0.016;
          drag.turning = true;
        }
        return;
      }
      const hit = hitScope(Lx, st, X, Y);
      st.hover = hit ? (hit.kind === "knob" ? `knob:${hit.sub}` : hit.kind === "slide" ? `slide:${hit.key}` : hit.kind === "obj" ? `obj:${hit.i}` : hit.kind === "turret" ? "turret" : hit.kind) : null;
      tip = tipFor(hit);
      canvas.style.cursor = hit ? (hit.kind === "knob" ? "grab" : "pointer") : "default";
    }

    function onUp(e) {
      const d = drag;
      drag = null;
      st.press = null;
      if (!d) return;
      const h = d.hit;
      const sound = live.current.soundEnabled;
      if (h.kind === "eye" && d.moved < 14) {
        live.current.onLook();
      } else if (h.kind === "slide" && d.moved < 14) {
        if (live.current.type !== h.key) {
          live.current.onType(h.key);
          if (sound) {
            play("grab", { volume: 0.8 });
            play("hit_wood", { volume: 0.4, rate: 1.5, delay: 0.1 });
          }
        }
      } else if (h.kind === "obj" && !d.turning) {
        live.current.onObjective(h.i);
        snapToObj(h.i);
        if (sound) play("hit_steel", { volume: 0.45, rate: 1.6 });
      } else if ((h.kind === "turret" || h.kind === "obj") && d.turning) {
        const i = ((Math.round(-st.turretAngle / (Math.PI / 2)) % 4) + 4) % 4;
        live.current.onObjective(i);
        snapToObj(i);
        if (sound) play("hit_steel", { volume: 0.45, rate: 1.6 });
      }
      tip = null;
      void e;
    }

    function onLeave() {
      st.hover = null;
      if (!drag) tip = null;
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

    function pill(text, x, y, size) {
      g.font = `700 ${size}px ${FONT}`;
      const w = g.measureText(text).width + 22;
      const h = size + 14;
      const Lx = live.current.L;
      const cx = clamp(x, w / 2 + 8, Lx.dW - w / 2 - 8);
      g.fillStyle = "rgba(255,255,255,0.96)";
      rr(g, cx - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.strokeStyle = "rgba(60,40,10,0.28)";
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = "#2f2208";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, cx, y + 1, w);
      g.textBaseline = "alphabetic";
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const lv = live.current;
      if (!lv.active) return;
      const Lx = lv.L;
      st.time += dt;

      const d = Math.min(2, window.devicePixelRatio || 1);
      const key = `${Lx.orient}|${Math.round(Lx.dW)}x${Math.round(Lx.dH)}|${d}`;
      if (builtFor !== key) {
        dpr = d;
        canvas.width = Math.round(Lx.dW * Lx.s * dpr);
        canvas.height = Math.round(Lx.dH * Lx.s * dpr);
        staticCanvas = buildScopeStatic(Lx, dpr, wood);
        builtFor = key;
      }

      // الحالة من المشهد العلمي
      const sc = lv.sceneRef.current;
      // أثناء المقدّمة السينمائية (قبل أي لمسة) نعرض عدسة ×4 الافتراضية
      const zs = sc ? sc.getZoom() : { target: OBJECTIVES[0].p, auto: false };
      const target = zs.auto ? OBJECTIVES[0].p : zs.target;
      st.p += (target - st.p) * (1 - Math.exp(-dt * 12));
      const ease = 1 - Math.exp(-dt * 14);
      st.coarseTau += (target / K_COARSE - st.coarseTau) * ease;
      st.fineTau += (target / K_FINE - st.fineTau) * ease;
      const bucket = Math.floor(st.coarseTau / 0.42);
      if (bucket !== tickBucket) {
        tickBucket = bucket;
        if (lv.soundEnabled) play("tick", { volume: 0.32, throttle: 36, jitter: 0.1 });
      }
      st.light += (lv.light - st.light) * (1 - Math.exp(-dt * 10));
      st.looked = lv.looked;

      // العدسة النشطة المشتقّة من هدف الزووم (إلا أثناء سحب البرج)
      if (!(drag && drag.turning)) {
        let best = 0;
        let bd = 9;
        OBJECTIVES.forEach((o, i) => {
          const dd = Math.abs(o.p - target);
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        });
        if (best !== st.activeObj) {
          snapToObj(best);
          if (lv.soundEnabled) play("hit_steel", { volume: 0.25, rate: 1.9, throttle: 120 });
        }
        if (st.turretTarget !== undefined) {
          st.turretAngle += (st.turretTarget - st.turretAngle) * (1 - Math.exp(-dt * 11));
        }
      }

      // تبديل الشريحة
      if (lv.type !== st.type) {
        st.slide = { type: lv.type, prev: st.type, t: 0 };
        st.type = lv.type;
      }
      if (st.slide.t < 1) st.slide.t = Math.min(1, st.slide.t + dt / 0.42);

      // ---- رسم ----
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(staticCanvas, 0, 0);
      g.setTransform(dpr * Lx.s, 0, 0, dpr * Lx.s, 0, 0);
      st.type = lv.type;
      drawRack(g, Lx, st);
      drawScopeDynamic(g, Lx, st);

      // تعتيم خفيف حين يُطفأ المصباح
      if (st.light < 0.5) {
        g.fillStyle = `rgba(8,14,22,${(0.5 - st.light) * 0.34})`;
        g.fillRect(0, 0, Lx.dW, Lx.dH);
      }

      const fs = Math.max(13, 12 / Lx.s);
      if (tip) pill(tip.text, tip.x, tip.y, fs);
      else if (!st.looked) pill("المس العدسة العينية", Lx.eye.x + (Lx.orient === "landscape" ? 150 : 0), Lx.eye.y - (Lx.orient === "landscape" ? 0 : 50 * Lx.ks) - (Lx.orient === "landscape" ? 0 : 6), fs);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return <canvas ref={canvasRef} className="cl-scope-canvas" />;
}
