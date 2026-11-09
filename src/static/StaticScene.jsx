/**
 * StaticScene.jsx — مشهد الكهرباء الساكنة داخل غرفة جلوس على Canvas 2D.
 * لا لوحات واجهة: الأدوات جزء من الغرفة نفسها:
 *   - سلّة خوص فيها البالونات (اسحب بالوناً منها أو أعده).
 *   - لوح جدار منزلق بمقبض نحاسي (المس المقبض لفتح/إغلاق الجدار).
 *   - عدسة مكبّرة تكشف الشحنات (اسحبها فوق الأشياء، والمس مقبضها للتبديل
 *     بين "كل الشحنات" و"الصافية فقط").
 * الفيزياء في sim.js، والرسم الإجرائي في staticArt.js و room.js.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StaticWorld } from "./sim.js";
import { computeLayout, LENS_R, LENS_ZOOM, insideSweater, CLAMP } from "./staticData.js";
import { makeSweaterSprite, SWEATER_SPRITE, drawBalloon, drawString, drawCharge } from "./staticArt.js";
import { renderRoom, renderWallPanel, renderBasket } from "./room.js";
import { play, loop, setMuted } from "../audio/sfx.js";
import { haptic } from "../mobile/device.js";

const FONT = "'IBM Plex Sans Arabic', sans-serif";
let UI_S = 1;
const fsz = (n) => Math.max(n, 11.5 / UI_S);
const ar = (n) => Number(n).toLocaleString("ar-EG");
const WALL_SLIDE = (L) => L.pillarW - 70;

/* ---------- عناصر صغيرة ---------- */
function tip(g, text, x, y) {
  const size = fsz(14);
  g.save();
  g.font = `600 ${size}px ${FONT}`;
  const w = g.measureText(text).width + 22;
  const h = size + 14;
  const x0 = x - w / 2;
  g.fillStyle = "rgba(24,28,26,0.86)";
  g.beginPath();
  g.roundRect(x0, y - h / 2, w, h, h / 2);
  g.fill();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y + 1);
  g.restore();
}

function lensGeometry(lens) {
  const R = LENS_R * lens.scale;
  const th = 0.82;
  const hx = lens.x + Math.cos(th) * (R + 52 * lens.scale);
  const hy = lens.y + Math.sin(th) * (R + 52 * lens.scale);
  return { R, th, hx, hy };
}

const StaticScene = forwardRef(function StaticScene({ soundEnabled }, ref) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const st = useRef({ props: null });
  st.current.props = { soundEnabled };

  useImperativeHandle(ref, () => ({
    reset() {
      const s = st.current;
      if (!s.world) return;
      s.world.reset();
      s.lens.mode = "net";
      s.lens.x = s.L.lensRest.x;
      s.lens.y = s.L.lensRest.y;
      s.lens.scale = 0.62;
      s.hintDone = false;
      s.rubLoop?.stop();
      s.rubLoop = null;
    },
  }));

  useEffect(() => {
    setMuted(!soundEnabled);
    if (!soundEnabled) {
      st.current.rubLoop?.stop();
      st.current.rubLoop = null;
    }
  }, [soundEnabled]);

  useEffect(() => {
    const s = st.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const g = canvas.getContext("2d");
    let alive = true;
    let raf = 0;
    let last = performance.now();
    s.sweater = makeSweaterSprite();
    s.lens = { x: 0, y: 0, scale: 0.62, held: false, mode: "net", dragOff: { x: 0, y: 0 }, moved: false, down: null };
    s.hover = null;
    s.pressTip = null;
    s.hintDone = false;
    s.t0 = performance.now();

    function build() {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      s.dpr = dpr;
      s.cssW = r.width;
      s.cssH = r.height;
      const L = computeLayout(r.width, r.height);
      const first = !s.world;
      s.L = L;
      s.bg = renderRoom(L, dpr);
      s.panel = renderWallPanel(L, dpr);
      s.basket = renderBasket(L, dpr);
      if (first) {
        s.world = new StaticWorld(L, 1);
        s.lens.x = L.lensRest.x;
        s.lens.y = L.lensRest.y;
      } else {
        const oldRest = s.lens.scale <= 0.63;
        s.world.setLayout(L);
        if (oldRest) {
          s.lens.x = L.lensRest.x;
          s.lens.y = L.lensRest.y;
        }
      }
    }
    build();
    const ro = new ResizeObserver(build);
    ro.observe(wrap);
    if (import.meta.env.DEV) window.__st = s;

    /* ---------- إحداثيات ---------- */
    function toDesign(e) {
      const r = canvas.getBoundingClientRect();
      return { X: (((e.clientX - r.left) / r.width) * s.cssW) / s.L.s, Y: (((e.clientY - r.top) / r.height) * s.cssH) / s.L.s };
    }
    const capture = (e) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* مؤشر غير نشط */
      }
    };

    function hitLens(X, Y) {
      const { R, hx, hy } = lensGeometry(s.lens);
      const inGlass = Math.hypot(X - s.lens.x, Y - s.lens.y) < R + 8;
      const onHandle = Math.hypot(X - hx, Y - hy) < 34 * Math.max(0.8, s.lens.scale) + 14;
      return { inGlass, onHandle, any: inGlass || onHandle };
    }
    function hitWallHandle(X, Y) {
      const L = s.L;
      const wx = L.pillarX + (1 - s.world.wall.p) * WALL_SLIDE(L) + 40;
      return X > wx - 34 && X < wx + 34 && Y > L.floorY - 290 && Y < L.floorY - 150;
    }
    function hitBalloon(X, Y) {
      const bs = s.world.balloons;
      let best = null;
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        if (Math.hypot(X - b.x, Y - b.y) < b.r + 10) {
          best = b;
          break;
        }
      }
      return best;
    }
    function overBasket(X, Y) {
      const k = s.L.basket;
      return Math.abs(X - k.cx) < k.w / 2 + 26 && Y > s.L.floorY - 170 && Y < k.base + 30;
    }

    /* ---------- مؤشر ---------- */
    function onDown(e) {
      const { X, Y } = toDesign(e);
      setMuted(!s.props.soundEnabled);
      const lh = hitLens(X, Y);
      if (lh.any) {
        capture(e);
        s.lens.held = true;
        s.lens.moved = false;
        s.lens.down = { X, Y, onHandle: lh.onHandle && !lh.inGlass };
        s.lens.dragOff = { x: s.lens.x - X, y: s.lens.y - Y };
        s.drag = "lens";
        play("select", { volume: 0.7 });
        haptic(8);
        return;
      }
      if (hitWallHandle(X, Y)) {
        capture(e);
        s.drag = "wall";
        s.wallDown = { X, Y };
        s.pressTip = { text: "الجدار", until: performance.now() + 1400, x: X, y: Y };
        return;
      }
      const b = hitBalloon(X, Y);
      if (b) {
        capture(e);
        const w = s.world;
        if (!b.out) w.takeBalloon(b);
        b.held = true;
        b.stuck = null;
        b.vx = 0;
        b.vy = 0;
        b.grab = { dx: b.x - X, dy: b.y - Y };
        b.target = { x: b.x, y: b.y };
        b.trail = [];
        s.drag = b;
        s.hintDone = true;
        play("grab", { volume: 0.9 });
        haptic(8);
        return;
      }
      if (overBasket(X, Y)) s.pressTip = { text: "بالونات", until: performance.now() + 1300, x: s.L.basket.cx, y: s.L.floorY - 190 };
    }

    function onMove(e) {
      const { X, Y } = toDesign(e);
      s.pointer = { X, Y };
      const d = s.drag;
      if (d === "lens") {
        if (Math.hypot(X - s.lens.down.X, Y - s.lens.down.Y) > 8) s.lens.moved = true;
        s.lens.target = { x: X + s.lens.dragOff.x, y: Y + s.lens.dragOff.y };
        canvas.style.cursor = "grabbing";
        return;
      }
      if (d === "wall") return;
      if (d) {
        d.target = { x: X + d.grab.dx, y: Y + d.grab.dy };
        canvas.style.cursor = "grabbing";
        return;
      }
      // تمرير: مؤشر وتلميح
      if (hitLens(X, Y).any) s.hover = hitLens(X, Y).onHandle && !hitLens(X, Y).inGlass ? "lensHandle" : "lens";
      else if (hitWallHandle(X, Y)) s.hover = "wall";
      else if (hitBalloon(X, Y)) s.hover = "balloon";
      else if (overBasket(X, Y)) s.hover = "basket";
      else s.hover = null;
      canvas.style.cursor = s.hover === "basket" || !s.hover ? "default" : "pointer";
    }

    function onUp(e) {
      const d = s.drag;
      s.drag = null;
      canvas.style.cursor = "default";
      if (!d) return;
      const { X, Y } = toDesign(e);
      const w = s.world;
      if (d === "lens") {
        const lens = s.lens;
        lens.held = false;
        if (!lens.moved && lens.down.onHandle) {
          lens.mode = lens.mode === "net" ? "all" : "net";
          play("tick", { rate: lens.mode === "all" ? 1.25 : 0.9 });
          s.pressTip = { text: lens.mode === "all" ? "كل الشحنات" : "الشحنة الصافية", until: performance.now() + 1600, x: lens.x, y: lens.y - LENS_R * lens.scale - 34 };
        } else if (Math.hypot(lens.x - s.L.lensRest.x, lens.y - s.L.lensRest.y) < 110) {
          lens.target = { x: s.L.lensRest.x, y: s.L.lensRest.y };
          lens.snap = true;
        }
        return;
      }
      if (d === "wall") {
        if (Math.hypot(X - s.wallDown.X, Y - s.wallDown.Y) < 14) {
          w.toggleWall();
          play("whoosh", { volume: 0.7 });
          haptic(12);
        }
        return;
      }
      d.held = false;
      const tr = d.trail;
      if (tr.length >= 2) {
        const a = tr[0];
        const z = tr[tr.length - 1];
        const dt = Math.max(0.016, (z.t - a.t) / 1000);
        d.vx = CLAMP((z.x - a.x) / dt, -900, 900);
        d.vy = CLAMP((z.y - a.y) / dt, -900, 900);
      }
      if (overBasket(X, Y)) {
        w.stowBalloon(d);
        play("whoosh", { volume: 0.6 });
        haptic(6);
        return;
      }
      if (Math.hypot(d.vx, d.vy) > 400) play("whoosh", { volume: 0.5 });
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", () => (s.hover = null));

    /* ---------- رسم العالم ---------- */
    function drawCharges(g2, L, w, mode) {
      const { cx, cy } = L.sweater;
      const t = performance.now() / 1000;
      // السترة
      for (const e of w.electrons) {
        const plusX = cx + e.slot.x - 7;
        const plusY = cy + e.slot.y;
        const missing = e.state !== "home";
        if (mode === "all") {
          drawCharge(g2, "plus", plusX, plusY, missing ? 19 : 17, missing ? 1 : 0.9);
          if (!missing) drawCharge(g2, "minus", e.hx, e.hy, 17, 0.92);
        } else if (missing) {
          drawCharge(g2, "plus", plusX, plusY, 19, 1);
        }
        if (missing) {
          g2.strokeStyle = `rgba(255,110,100,${0.35 + 0.25 * Math.sin(t * 4 + e.id)})`;
          g2.lineWidth = 2;
          g2.beginPath();
          g2.arc(plusX, plusY, 14, 0, Math.PI * 2);
          g2.stroke();
        }
      }
      // البالونات
      for (const b of w.balloons) {
        if (!b.out) continue;
        if (mode === "all") {
          for (let k = 0; k < 7; k++) {
            const a = -2.3 + k * 0.62;
            const rr2 = b.r * (0.35 + (k % 2) * 0.28);
            const bx = b.x + Math.cos(a) * rr2;
            const by = b.y - 10 + Math.sin(a) * rr2 * 0.9 - 8;
            drawCharge(g2, "plus", bx - 6, by, 14, 0.75);
            drawCharge(g2, "minus", bx + 6, by, 14, 0.75);
          }
        }
      }
      for (const e of w.electrons) {
        if (e.state === "home") continue;
        // أثر متوهج للإلكترون المتحرك
        if (e.state === "flying") {
          g2.fillStyle = "rgba(110,180,255,0.25)";
          g2.beginPath();
          g2.arc(e.x - e.vx * 0.02, e.y - e.vy * 0.02, 11, 0, Math.PI * 2);
          g2.fill();
        }
        drawCharge(g2, "minus", e.x, e.y, 17, 1);
      }
      // الجدار المتعادل (استقطاب)
      if (w.wallOn && mode === "all") {
        for (const row of w.wallRows) {
          const infl = row.infl;
          const x = L.pillarX + 22;
          drawCharge(g2, "plus", x, row.y, 15, 0.7 + infl * 0.3);
          drawCharge(g2, "minus", x + 22 + infl * 20, row.y, 15, 0.85);
        }
      }
    }

    function drawWorld(g2, L, withCharges, mode, time) {
      const w = s.world;
      g2.drawImage(s.bg, 0, 0, L.dW, L.dH);

      // لوح الجدار المنزلق + ظله على الجدار
      const px = L.pillarX + (1 - w.wall.p) * WALL_SLIDE(L);
      const sh = g2.createLinearGradient(px - 90, 0, px, 0);
      sh.addColorStop(0, "rgba(40,28,8,0)");
      sh.addColorStop(1, "rgba(40,28,8,0.3)");
      g2.fillStyle = sh;
      g2.fillRect(px - 90, 24, 90, L.floorY - 24);
      g2.drawImage(s.panel, px, -10, L.pillarW + 90, L.floorY + 30);

      // السترة
      const sp = SWEATER_SPRITE;
      g2.drawImage(s.sweater, L.sweater.cx - sp.ox, L.sweater.cy - sp.oy, sp.w, sp.h);

      // قصاصات الورق على الأرض
      for (const c of w.confetti) if (c.attached < 0) drawPaper(g2, c);

      // السلّة وما فيها
      const k = L.basket;
      const bp = s.basket;
      const bx = k.cx - k.w / 2 - bp.pad;
      const by = k.base - k.h - bp.pad;
      g2.fillStyle = "rgba(25,12,0,0.28)";
      g2.beginPath();
      g2.ellipse(k.cx + 8, k.base + 4, k.w * 0.46, 13, 0, 0, Math.PI * 2);
      g2.fill();
      g2.drawImage(bp.back, bx, by, bp.back.width / bp.scale, bp.back.height / bp.scale);
      for (const b of w.balloons) if (!b.out) {
        drawString(g2, b);
        drawBalloon(g2, b);
      }
      g2.drawImage(bp.front, bx, by, bp.front.width / bp.scale, bp.front.height / bp.scale);

      // البالونات في الغرفة
      const outs = w.balloons.filter((b) => b.out);
      for (const b of outs) drawString(g2, b);
      for (const b of outs) drawBalloon(g2, b);
      for (const c of w.confetti) if (c.attached >= 0) drawPaper(g2, c);

      if (withCharges) drawCharges(g2, L, w, mode);

      // شرارات
      for (const sp2 of w.sparks) {
        const t = 1 - sp2.age / sp2.life;
        if (sp2.bolt) {
          g2.strokeStyle = `rgba(255,252,220,${t})`;
          g2.shadowColor = "rgba(150,200,255,0.9)";
          g2.shadowBlur = 14;
          g2.lineWidth = 2.4;
          g2.beginPath();
          let x = sp2.x;
          let y = sp2.y;
          g2.moveTo(x, y);
          const rnd = ((sp2.ang * 9301) % 1) || 0.3;
          for (let i = 0; i < 5; i++) {
            x += Math.cos(sp2.ang) * 11 + (rnd - 0.5) * 12 * (i % 2 ? 1 : -1);
            y += Math.sin(sp2.ang) * 11 + (i % 2 ? 7 : -7);
            g2.lineTo(x, y);
          }
          g2.stroke();
          g2.shadowBlur = 0;
        } else {
          g2.fillStyle = sp2.kind === "elec" ? `rgba(140,200,255,${t})` : `rgba(255,246,200,${t})`;
          g2.beginPath();
          g2.arc(sp2.x, sp2.y, 2.4 * t + 0.6, 0, Math.PI * 2);
          g2.fill();
        }
      }
      void time;
    }

    function drawPaper(g2, c) {
      g2.save();
      g2.translate(c.x, c.y);
      g2.rotate(c.rot + (c.attached >= 0 ? Math.sin(c.wob) * 0.12 : 0));
      g2.shadowColor = "rgba(30,20,10,0.3)";
      g2.shadowBlur = 4;
      g2.shadowOffsetY = 2;
      g2.fillStyle = c.color;
      g2.beginPath();
      g2.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 2);
      g2.fill();
      g2.shadowBlur = 0;
      g2.fillStyle = "rgba(255,255,255,0.35)";
      g2.fillRect(-c.w / 2 + 2, -c.h / 2 + 1, c.w - 4, 1.6);
      g2.restore();
    }

    /* ---------- العدسة ---------- */
    function drawLens(g2, L) {
      const lens = s.lens;
      const { R, th } = lensGeometry(lens);
      const w = s.world;
      const resting = lens.scale <= 0.64 && !lens.held;
      g2.save();
      // ظل
      g2.fillStyle = "rgba(25,14,0,0.22)";
      g2.beginPath();
      g2.ellipse(lens.x + 10, lens.y + R + 10, R * 0.8, 10, 0, 0, Math.PI * 2);
      g2.fill();
      g2.translate(lens.x, lens.y);

      // المقبض
      g2.save();
      g2.rotate(th);
      const hl = 108 * lens.scale;
      const hw = 17 * lens.scale;
      const wood = g2.createLinearGradient(0, -hw, 0, hw);
      wood.addColorStop(0, "#d9a768");
      wood.addColorStop(0.5, "#f0c78a");
      wood.addColorStop(1, "#8a5a2a");
      g2.fillStyle = "rgba(25,12,0,0.35)";
      g2.beginPath();
      g2.roundRect(R - 2 + 3, -hw + 4, hl, hw * 2, hw);
      g2.fill();
      g2.fillStyle = wood;
      g2.beginPath();
      g2.roundRect(R - 2, -hw, hl, hw * 2, hw);
      g2.fill();
      // طوق نحاسي + قرص المؤشر
      const brass = g2.createLinearGradient(0, -hw, 0, hw);
      brass.addColorStop(0, "#fff0b0");
      brass.addColorStop(0.5, "#c89a38");
      brass.addColorStop(1, "#7a5518");
      g2.fillStyle = brass;
      g2.fillRect(R + 8 * lens.scale, -hw - 2, 20 * lens.scale, hw * 2 + 4);
      const kx = R + 62 * lens.scale;
      g2.fillStyle = "#2b2015";
      g2.beginPath();
      g2.arc(kx, 0, 15 * lens.scale, 0, Math.PI * 2);
      g2.fill();
      g2.strokeStyle = brass;
      g2.lineWidth = 3 * lens.scale;
      g2.stroke();
      g2.rotate(-th);
      // أيقونة الوضع (تدور مع الشاشة لتبقى مقروءة)
      const kxx = Math.cos(th) * kx;
      const kyy = Math.sin(th) * kx;
      const ds = lens.scale * 0.8;
      drawCharge(g2, "minus", kxx + (lens.mode === "all" ? 7 * ds : 0), kyy, 15 * ds, 1);
      if (lens.mode === "all") drawCharge(g2, "plus", kxx - 7 * ds, kyy, 15 * ds, 1);
      g2.restore();

      g2.restore();

      // المحتوى المكبّر داخل الزجاج
      g2.save();
      g2.beginPath();
      g2.arc(lens.x, lens.y, R, 0, Math.PI * 2);
      g2.clip();
      g2.translate(lens.x, lens.y);
      g2.scale(LENS_ZOOM, LENS_ZOOM);
      g2.translate(-lens.x, -lens.y);
      drawWorld(g2, L, true, lens.mode, 0);
      g2.restore();

      // الزجاج: صبغة + انعكاسات + قراءة
      g2.save();
      g2.beginPath();
      g2.arc(lens.x, lens.y, R, 0, Math.PI * 2);
      g2.clip();
      const tint = g2.createRadialGradient(lens.x - R * 0.3, lens.y - R * 0.3, R * 0.1, lens.x, lens.y, R);
      tint.addColorStop(0, "rgba(220,240,255,0.18)");
      tint.addColorStop(0.7, "rgba(190,225,250,0.06)");
      tint.addColorStop(1, "rgba(120,170,210,0.28)");
      g2.fillStyle = tint;
      g2.fillRect(lens.x - R, lens.y - R, R * 2, R * 2);
      g2.strokeStyle = "rgba(255,255,255,0.8)";
      g2.lineWidth = 5 * lens.scale;
      g2.lineCap = "round";
      g2.beginPath();
      g2.arc(lens.x, lens.y, R * 0.8, Math.PI * 1.08, Math.PI * 1.42);
      g2.stroke();
      g2.lineWidth = 2.5 * lens.scale;
      g2.beginPath();
      g2.arc(lens.x, lens.y, R * 0.8, Math.PI * 1.5, Math.PI * 1.58);
      g2.stroke();
      g2.restore();

      // الحلقة النحاسية
      const ring = g2.createLinearGradient(lens.x - R, lens.y - R, lens.x + R, lens.y + R);
      ring.addColorStop(0, "#fff0b0");
      ring.addColorStop(0.35, "#c89a38");
      ring.addColorStop(0.7, "#7a5518");
      ring.addColorStop(1, "#d9b05a");
      g2.strokeStyle = "rgba(25,12,0,0.45)";
      g2.lineWidth = 16 * lens.scale;
      g2.beginPath();
      g2.arc(lens.x, lens.y, R + 4, 0, Math.PI * 2);
      g2.stroke();
      g2.strokeStyle = ring;
      g2.lineWidth = 12 * lens.scale;
      g2.beginPath();
      g2.arc(lens.x, lens.y, R + 4, 0, Math.PI * 2);
      g2.stroke();
      g2.strokeStyle = "rgba(255,255,255,0.45)";
      g2.lineWidth = 2;
      g2.beginPath();
      g2.arc(lens.x, lens.y, R + 8, Math.PI * 1.05, Math.PI * 1.45);
      g2.stroke();

      // قراءة الشحنة الصافية للجسم تحت العدسة
      let label = null;
      const lx = lens.x;
      const ly = lens.y;
      for (const b of w.balloons) {
        if (b.out && Math.hypot(b.x - lx, b.y - ly) < b.r * 0.9 + R * 0.35) label = { sign: "−", n: b.q };
      }
      if (!label) {
        const { lx: sx, ly: sy } = w.sweaterLocal(lx, ly);
        if (insideSweater(sx, sy, 20)) label = { sign: "+", n: w.sweaterCharge };
      }
      if (!label && w.wallOn && lx > L.pillarX - R * 0.4) label = { sign: "", n: 0 };
      if (label && !resting) {
        const text = label.n === 0 ? "متعادل" : `⁦${label.sign}${ar(label.n)}⁩`;
        const size = fsz(16);
        g2.font = `700 ${size}px ${FONT}`;
        const tw = g2.measureText(text).width + 20;
        const cxx = lx;
        const cyy = ly + R * 0.62;
        g2.fillStyle = "rgba(20,24,30,0.78)";
        g2.beginPath();
        g2.roundRect(cxx - tw / 2, cyy - size * 0.9, tw, size * 1.8, size * 0.9);
        g2.fill();
        g2.fillStyle = label.sign === "+" ? "#ff8d86" : label.sign === "−" ? "#8cc4ff" : "#cfd8cf";
        g2.textAlign = "center";
        g2.textBaseline = "middle";
        g2.fillText(text, cxx, cyy + 1);
        g2.textBaseline = "alphabetic";
      }
    }

    /* ---------- التلميح الأولي: سهم متحرك ---------- */
    function drawHint(g2, L, time) {
      const w = s.world;
      const b = w.balloons[0];
      if (s.hintDone || !b.out || b.q > 0 || b.held) return;
      const a = Math.min(1, (time - 0.8) / 0.8);
      if (a <= 0) return;
      const tx = L.sweater.cx + 70;
      const ty = L.sweater.cy + 10;
      const sx = b.x - b.r - 8;
      const sy = b.y;
      g2.save();
      g2.globalAlpha = 0.9 * a;
      g2.strokeStyle = "#fff";
      g2.lineWidth = 5;
      g2.lineCap = "round";
      g2.setLineDash([2, 14]);
      g2.lineDashOffset = -time * 40;
      g2.shadowColor = "rgba(0,0,0,0.35)";
      g2.shadowBlur = 6;
      g2.beginPath();
      g2.moveTo(sx, sy);
      g2.bezierCurveTo(sx - 80, sy - 90, tx + 90, ty - 70, tx, ty);
      g2.stroke();
      g2.setLineDash([]);
      // سهمان صغيران للفرك
      const k = (Math.sin(time * 4) + 1) / 2;
      g2.beginPath();
      g2.moveTo(tx - 30 + k * 26, ty - 4);
      g2.lineTo(tx - 10 + k * 26, ty - 4);
      g2.moveTo(tx - 16 + k * 26, ty - 12);
      g2.lineTo(tx - 8 + k * 26, ty - 4);
      g2.lineTo(tx - 16 + k * 26, ty + 4);
      g2.stroke();
      g2.restore();
    }

    /* ---------- الحلقة ---------- */
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = s.L;
      const w = s.world;
      const time = (now - s.t0) / 1000;
      UI_S = L.s;

      // سحب البالونات والعدسة
      for (const b of w.balloons) {
        if (b.held && b.target) {
          const k = Math.min(1, dt * 20);
          b.x += (b.target.x - b.x) * k;
          b.y += (b.target.y - b.y) * k;
          b.trail.push({ x: b.target.x, y: b.target.y, t: now });
          if (b.trail.length > 6) b.trail.shift();
        }
      }
      const lens = s.lens;
      if (lens.target) {
        const k = Math.min(1, dt * 18);
        lens.x += (lens.target.x - lens.x) * k;
        lens.y += (lens.target.y - lens.y) * k;
        if (!lens.held && Math.hypot(lens.target.x - lens.x, lens.target.y - lens.y) < 0.6) lens.target = null;
      }
      const atRest = !lens.held && lens.snap;
      const goalScale = lens.held ? 1 : atRest ? 0.62 : lens.scale > 0.7 ? 1 : 0.62;
      lens.scale += (goalScale - lens.scale) * Math.min(1, dt * 9);
      if (!lens.held && lens.snap && Math.abs(lens.scale - 0.62) < 0.01) lens.snap = false;

      w.step(dt, {});

      // أحداث الصوت
      for (const ev of w.drain()) {
        if (ev.type === "transfer") {
          play("tick", { volume: 0.5, rate: 1.4 + ev.q * 0.03, throttle: 120 });
          haptic(4);
        } else if (ev.type === "zap") {
          play("zap", { volume: 0.6, throttle: 200, jitter: 0.12 });
          haptic(10);
        } else if (ev.type === "stick") {
          play("grab", { volume: 0.9 });
          play("sparkle", { volume: 0.5, delay: 0.05 });
          haptic([10, 20]);
        } else if (ev.type === "paper") play("tick", { volume: 0.6, rate: 1.8, throttle: 90 });
        else if (ev.type === "stow") haptic(6);
        else if (ev.type === "wall") play("grab", { volume: 0.7, delay: 0.25 });
      }

      // صوت الفرك
      let rubSpeed = 0;
      for (const b of w.balloons) if (b.rubbing) rubSpeed = Math.max(rubSpeed, b.speed);
      if (rubSpeed > 0) {
        if (!s.rubLoop && s.props.soundEnabled) s.rubLoop = loop("rub_loop", { volume: 0.25 });
        s.rubLoop?.setVolume(CLAMP(rubSpeed / 650, 0.25, 1));
        if (rubSpeed > 520 && now - (s.lastSqueak || 0) > 420) {
          s.lastSqueak = now;
          play("squeak", { volume: 0.4, jitter: 0.15, throttle: 200 });
        }
      } else if (s.rubLoop) {
        s.rubLoop.stop();
        s.rubLoop = null;
      }

      // ---- رسم ----
      const { dpr } = s;
      g.setTransform(dpr * L.s, 0, 0, dpr * L.s, 0, 0);
      g.clearRect(0, 0, L.dW, L.dH);
      drawWorld(g, L, false, "net", time);
      drawHint(g, L, time);
      drawLens(g, L);

      // تلميحات اللمس/التمرير
      let t = null;
      if (s.pressTip && now < s.pressTip.until) t = s.pressTip;
      else if (s.hover === "basket") t = { text: "بالونات", x: L.basket.cx, y: L.floorY - 190 };
      else if (s.hover === "wall") t = { text: "الجدار", x: L.pillarX + (1 - w.wall.p) * WALL_SLIDE(L) + 40, y: L.floorY - 310 };
      else if (s.hover === "lens" && !lens.held) t = { text: "عدسة الشحنات", x: lens.x, y: lens.y - LENS_R * lens.scale - 34 };
      else if (s.hover === "lensHandle" && !lens.held) t = { text: lens.mode === "all" ? "كل الشحنات" : "الشحنة الصافية", x: lens.x, y: lens.y - LENS_R * lens.scale - 34 };
      if (t) tip(g, t.text, t.x, t.y);
      // نبضة تلميح للعدسة بعد فترة من اللعب
      if (!lens.used && time > 7 && !lens.held && lens.scale < 0.7) {
        g.save();
        g.strokeStyle = `rgba(255,236,170,${0.5 + 0.4 * Math.sin(time * 3)})`;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(lens.x, lens.y, LENS_R * 0.62 + 12 + Math.sin(time * 3) * 4, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      if (lens.held) lens.used = true;
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
      s.rubLoop?.stop();
      s.rubLoop = null;
      if (import.meta.env.DEV && window.__st === s) delete window.__st;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="ss-canvas-wrap">
      <canvas ref={canvasRef} className="ss-canvas" />
    </div>
  );
});

export default StaticScene;
