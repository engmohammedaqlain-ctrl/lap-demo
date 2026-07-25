/**
 * ColorScene.jsx — محاكاة رؤية الألوان على صورة تشريحية احترافية للشخص.
 * تُرسم صورة الرأس (دماغ + عين + عصب بصري) في اليسار، وثلاثة كشّافات ملوّنة
 * مائلة على اليمين تتجمّع أشعّتها في العين؛ ثم تسري نبضات عصبية على طول
 * العصب البصري إلى القشرة البصرية التي تتوهّج باللون المُدرَك، ويظهر اسمه
 * في فقاعة تفكير بارزة. كل العناصر التفاعلية تُرسم فوق الصورة بمحاذاتها.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SCENE_W,
  SCENE_H,
  FLASHLIGHTS,
  EYE_CENTER,
  CORTEX_CENTER,
  BUBBLE_CENTER,
  PERSON,
  BULB_LENS_X,
  calculatePerceivedColor,
} from "./colorData.js";
import personUrl from "./assets/person.png";

const EYE = EYE_CENTER;
const CORTEX = CORTEX_CENTER;
const MAX_PARTICLES = 260;
const DEBUG_ALIGN = false; // علامات محاذاة مؤقتة

/* هندسة كلّ شعاع: اتجاهه وزاويته من عدسة الكشّاف إلى العين (ميل + تجمّع).
   محسوبة مرّة واحدة ويستخدمها الرسمُ وتفاعلُ السحب معاً. */
const BEAMS = FLASHLIGHTS.map((fl) => {
  const dx = EYE.x - BULB_LENS_X;
  const dy = EYE.y - fl.y;
  const len = Math.hypot(dx, dy);
  return { ...fl, dirX: dx / len, dirY: dy / len, angle: Math.atan2(dy, dx), len };
});

/* مقياس الشدّة على جسم الكشّاف (إحداثيات محلّية، العمود يمتدّ بعيداً عن العين) */
const TRACK_MIN = -128; // 0%
const TRACK_MAX = -30; // 100%

const ColorScene = forwardRef(function ColorScene(
  { rVal, gVal, bVal, onValChange, isPlaying, beamMode, visionMode, filterEnabled, filterColor, onStatus },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const pulsesRef = useRef([]);
  const draggingRef = useRef(null); // 'red' | 'green' | 'blue'
  const imgRef = useRef(null); // صورة الشخص التشريحية

  const propsRef = useRef({});
  propsRef.current = { rVal, gVal, bVal, onValChange, isPlaying, beamMode, visionMode, filterEnabled, filterColor, onStatus };

  useImperativeHandle(ref, () => ({
    reset: () => {
      particlesRef.current = [];
      pulsesRef.current = [];
    },
  }));

  /* ===== تفاعل: سحب مقياس الشدّة على كلّ كشّاف ===== */
  function getCanvasCoords(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (SCENE_W / rect.width),
      y: (clientY - rect.top) * (SCENE_H / rect.height),
    };
  }
  // يحوّل نقطة الشاشة إلى الإطار المحلّي للكشّاف (محور +x نحو العين)
  function toLocal(bm, x, y) {
    const ex = x - BULB_LENS_X;
    const ey = y - bm.y;
    return {
      lx: ex * Math.cos(bm.angle) + ey * Math.sin(bm.angle),
      ly: -ex * Math.sin(bm.angle) + ey * Math.cos(bm.angle),
    };
  }
  function setFromLocal(bm, lx) {
    const pct = Math.round(((lx - TRACK_MIN) / (TRACK_MAX - TRACK_MIN)) * 100);
    const clamped = Math.max(0, Math.min(100, pct));
    const cb = propsRef.current.onValChange;
    cb && cb(bm.id, clamped);
  }
  function handleDown(e) {
    const { x, y } = getCanvasCoords(e);
    for (const bm of BEAMS) {
      const { lx, ly } = toLocal(bm, x, y);
      if (lx >= TRACK_MIN - 16 && lx <= TRACK_MAX + 16 && Math.abs(ly) <= 22) {
        draggingRef.current = bm.id;
        setFromLocal(bm, lx);
        e.preventDefault();
        return;
      }
    }
  }
  function handleMove(e) {
    const id = draggingRef.current;
    if (!id) return;
    const bm = BEAMS.find((b) => b.id === id);
    const { x, y } = getCanvasCoords(e);
    const { lx } = toLocal(bm, x, y);
    setFromLocal(bm, lx);
    e.preventDefault();
  }
  function handleUp() {
    draggingRef.current = null;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let t = 0;
    const beams = BEAMS;

    // تحميل صورة الشخص (مضمّنة في الحزمة، تعمل دون اتصال)
    if (!imgRef.current) {
      const image = new Image();
      image.src = personUrl;
      image.onload = () => {
        imgRef.current = image;
      };
    }

    function frame() {
      const p = propsRef.current;
      if (p.isPlaying) t += 0.04;

      // شدّة فعّالة بعد المرشّح
      let effR = p.rVal, effG = p.gVal, effB = p.bVal;
      if (p.filterEnabled) {
        if (p.filterColor === "red") { effG *= 0.08; effB *= 0.08; }
        if (p.filterColor === "green") { effR *= 0.08; effB *= 0.08; }
        if (p.filterColor === "blue") { effR *= 0.08; effG *= 0.08; }
        if (p.filterColor === "yellow") { effB *= 0.08; }
      }

      const info = calculatePerceivedColor(effR, effG, effB, p.visionMode);
      p.onStatus && p.onStatus(info);

      ctx.clearRect(0, 0, SCENE_W, SCENE_H);
      drawBackground(ctx);

      const vals = [p.rVal, p.gVal, p.bVal];
      const effVals = [effR, effG, effB];

      // 1) صورة الشخص التشريحية (الخلفية الحيّة)
      drawPerson(ctx);

      // 2) الأشعّة فوق الصورة (تنتهي عند العين)
      drawBeams(ctx, beams, vals, t, p.beamMode);

      // 3) الفوتونات
      if (p.beamMode === "particles") {
        spawnPhotons(beams, vals, p.isPlaying);
        updateAndDrawPhotons(ctx, p, effVals);
      } else if (p.isPlaying) {
        maybeEmitPulses(beams, effVals, info);
      }

      // 4) المرشّح الضوئي
      if (p.filterEnabled) drawFilter(ctx, filterColorRGB(p.filterColor), p.filterColor);

      // 5) الكشّافات المائلة
      drawBulbs(ctx, beams, vals);

      // 6) توهّج القشرة البصرية + النبضات العصبية على العصب البصري
      drawCortexGlow(ctx, info, t);
      updateAndDrawPulses(ctx, p.isPlaying, info);

      // 7) فقاعة الإدراك البارزة
      drawThoughtBubble(ctx, info, t);

      if (DEBUG_ALIGN) drawDebugMarkers(ctx);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ================= الخلفية (بيضاء لتندمج مع خلفية الصورة) ================= */
  function drawBackground(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }

  /* ================= صورة الشخص التشريحية ================= */
  function drawPerson(ctx) {
    const img = imgRef.current;
    if (!img) return;
    ctx.drawImage(img, PERSON.dx, PERSON.dy, img.width * PERSON.scale, img.height * PERSON.scale);
  }

  /* ================= توهّج القشرة البصرية ================= */
  function drawCortexGlow(ctx, info, t) {
    if (info.total <= 15) return;
    const pulse = 0.75 + Math.sin(t * 3) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // مزج جمعي فوق الدماغ
    const r = 46 * pulse;
    const g = ctx.createRadialGradient(CORTEX.x, CORTEX.y, 2, CORTEX.x, CORTEX.y, r);
    const a = Math.min(0.9, 0.25 + (info.total / 765) * 0.7);
    g.addColorStop(0, hexToRgba(info.hex, a));
    g.addColorStop(0.5, hexToRgba(info.hex, a * 0.45));
    g.addColorStop(1, hexToRgba(info.hex, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CORTEX.x, CORTEX.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawDebugMarkers(ctx) {
    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    for (const pt of [EYE, CORTEX, BUBBLE_CENTER]) {
      ctx.beginPath();
      ctx.moveTo(pt.x - 12, pt.y);
      ctx.lineTo(pt.x + 12, pt.y);
      ctx.moveTo(pt.x, pt.y - 12);
      ctx.lineTo(pt.x, pt.y + 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ================= الأشعّة المائلة ================= */
  function drawBeams(ctx, beams, vals, t, mode) {
    beams.forEach((bm, i) => {
      const val = vals[i];
      if (val <= 0) return;
      const a = val / 100;
      const sx = BULB_LENS_X;
      const sy = bm.y;
      const ex = EYE.x;
      const ey = EYE.y;

      if (mode === "waves") {
        // موجة جيبيّة على امتداد الشعاع — ترددها من الطول الموجي
        const freq = bm.wavelength > 600 ? 0.5 : bm.wavelength > 500 ? 0.7 : 0.95;
        const amp = 9 * a + 3;
        const nx = -bm.dirY, ny = bm.dirX; // متجه عمودي
        ctx.strokeStyle = `rgba(${bm.rgb.join(",")},${0.35 + a * 0.5})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let s = 0; s <= 1.001; s += 0.02) {
          const px = sx + (ex - sx) * s;
          const py = sy + (ey - sy) * s;
          const off = Math.sin(s * bm.len * freq * 0.1 - t * 7) * amp * (0.4 + s * 0.6);
          const wx = px + nx * off;
          const wy = py + ny * off;
          if (s === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      } else {
        // شعاع مخروطي متدرّج يتلاشى عند العين
        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, `rgba(${bm.rgb.join(",")},${0.05 + a * 0.5})`);
        grad.addColorStop(1, `rgba(${bm.rgb.join(",")},0.04)`);
        const nx = -bm.dirY, ny = bm.dirX;
        const wStart = 20 * (0.5 + a * 0.5);
        const wEnd = 14;
        ctx.beginPath();
        ctx.moveTo(sx + nx * wStart, sy + ny * wStart);
        ctx.lineTo(ex + nx * wEnd, ey + ny * wEnd);
        ctx.lineTo(ex - nx * wEnd, ey - ny * wEnd);
        ctx.lineTo(sx - nx * wStart, sy - ny * wStart);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
    });
  }

  /* ================= الفوتونات ================= */
  function spawnPhotons(beams, vals, playing) {
    if (!playing) return;
    beams.forEach((bm, i) => {
      const val = vals[i];
      if (val <= 0) return;
      const count = Math.ceil((val / 100) * 2.4);
      for (let k = 0; k < count; k++) {
        if (Math.random() > 0.55) continue;
        if (particlesRef.current.length > MAX_PARTICLES) break;
        const spread = (Math.random() - 0.5) * 14;
        const nx = -bm.dirY, ny = bm.dirX;
        const speed = 4.4 + Math.random() * 1.6;
        particlesRef.current.push({
          x: BULB_LENS_X + nx * spread,
          y: bm.y + ny * spread,
          vx: bm.dirX * speed,
          vy: bm.dirY * speed,
          size: 3.2 + Math.random() * 1.2,
          color: bm.particleColor,
          rgb: bm.rgb,
          type: bm.id,
          life: 1,
          passedFilter: false,
        });
      }
    });
  }

  function updateAndDrawPhotons(ctx, p, effVals) {
    const filterX = 610;
    const arr = particlesRef.current;
    for (const pt of arr) {
      if (p.isPlaying) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        // المرشّح يحجب الألوان غير المطابِقة
        if (p.filterEnabled && pt.x <= filterX && !pt.passedFilter) {
          pt.passedFilter = true;
          let blocked = false;
          if (p.filterColor === "red" && pt.type !== "red") blocked = true;
          if (p.filterColor === "green" && pt.type !== "green") blocked = true;
          if (p.filterColor === "blue" && pt.type !== "blue") blocked = true;
          if (p.filterColor === "yellow" && pt.type === "blue") blocked = true;
          if (blocked && Math.random() < 0.92) pt.life = 0;
        }
      }
      // وصل العين؟ → أطلق نبضة عصبية
      const d = Math.hypot(pt.x - EYE.x, pt.y - EYE.y);
      if (d < 16) {
        pt.life = 0;
        if (p.isPlaying && Math.random() < 0.3) emitPulse(pt.color);
      }
      if (pt.life > 0) {
        ctx.save();
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    particlesRef.current = arr.filter((pt) => pt.life > 0 && pt.x > EYE.x - 30);
  }

  function maybeEmitPulses(beams, effVals, info) {
    if (info.total <= 15) return;
    if (Math.random() < 0.18) {
      emitPulse(info.hex);
    }
  }

  /* ================= النبضات العصبية ================= */
  function emitPulse(color) {
    if (pulsesRef.current.length > 40) return;
    pulsesRef.current.push({ progress: 0, color, speed: 0.02 + Math.random() * 0.01 });
  }

  function updateAndDrawPulses(ctx, playing, info) {
    if (info.total <= 15) {
      pulsesRef.current = [];
      return;
    }
    const p0 = { x: EYE.x - 6, y: EYE.y + 6 };
    const p1 = { x: (EYE.x + CORTEX.x) / 2 - 6, y: EYE.y + 18 };
    const p2 = { x: CORTEX.x, y: CORTEX.y };
    for (const np of pulsesRef.current) {
      if (playing) np.progress += np.speed;
      const s = np.progress;
      if (s > 1) continue;
      const x = (1 - s) * (1 - s) * p0.x + 2 * (1 - s) * s * p1.x + s * s * p2.x;
      const y = (1 - s) * (1 - s) * p0.y + 2 * (1 - s) * s * p1.y + s * s * p2.y;
      const col = np.color && np.color !== "#FFFFFF" && np.color !== "#ffffff" ? np.color : "#FFD54A";
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      // نواة بيضاء تُبرز الإشارة العصبية
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    pulsesRef.current = pulsesRef.current.filter((np) => np.progress <= 1);
  }

  /* ================= الكشّافات المائلة =================
     الاتجاه مصحّح: العاكس والعدسة يواجهان العين (+x محلّياً)، والجسم يمتدّ
     بعيداً عنها (−x). ومقياس الشدّة القابل للسحب مدمج على الجسم. */
  function drawBulbs(ctx, beams, vals) {
    beams.forEach((bm, i) => {
      const val = vals[i];
      ctx.save();
      ctx.translate(BULB_LENS_X, bm.y);
      ctx.rotate(bm.angle);

      // جسم الكشّاف (يمتدّ بعيداً عن العين)
      ctx.beginPath();
      ctx.roundRect(-142, -18, 130, 36, 11);
      const body = ctx.createLinearGradient(0, -18, 0, 18);
      body.addColorStop(0, "#63727f");
      body.addColorStop(0.5, "#3c4956");
      body.addColorStop(1, "#28323b");
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // حلقة زخرفية قرب العاكس
      ctx.fillStyle = "#222b33";
      ctx.beginPath();
      ctx.roundRect(-24, -19, 10, 38, 3);
      ctx.fill();

      // العاكس المخروطي (يتّسع نحو العين)
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.lineTo(12, -30);
      ctx.lineTo(12, 30);
      ctx.lineTo(-12, 18);
      ctx.closePath();
      const refl = ctx.createLinearGradient(-12, 0, 12, 0);
      refl.addColorStop(0, "#4a5763");
      refl.addColorStop(1, "#93a2af");
      ctx.fillStyle = refl;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.stroke();

      // العدسة المتوهّجة (تواجه العين)
      ctx.beginPath();
      ctx.ellipse(12, 0, 6, 29, 0, 0, Math.PI * 2);
      if (val > 0) {
        ctx.save();
        ctx.shadowColor = bm.color;
        ctx.shadowBlur = 20 * (val / 100) + 5;
        const lens = ctx.createLinearGradient(6, 0, 18, 0);
        lens.addColorStop(0, bm.color);
        lens.addColorStop(1, lighten(bm.rgb, 0.35));
        ctx.fillStyle = lens;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = "#5a6673";
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.32)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // ---- مقياس الشدّة على الجسم (قابل للسحب) ----
      const knobX = TRACK_MIN + (val / 100) * (TRACK_MAX - TRACK_MIN);
      // مجرى
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(TRACK_MIN, 0);
      ctx.lineTo(TRACK_MAX, 0);
      ctx.stroke();
      // تعبئة ملوّنة
      ctx.strokeStyle = bm.color;
      ctx.beginPath();
      ctx.moveTo(TRACK_MIN, 0);
      ctx.lineTo(knobX, 0);
      ctx.stroke();
      // مقبض
      ctx.beginPath();
      ctx.arc(knobX, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = bm.color;
      ctx.lineWidth = 3.2;
      ctx.stroke();

      ctx.restore();

      // ---- التسمية والنسبة (قائمة/مقروءة في فضاء الشاشة) ----
      const ax = BULB_LENS_X + Math.cos(bm.angle) * -78;
      const ay = bm.y + Math.sin(bm.angle) * -78;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = bm.color;
      ctx.font = "800 15px 'IBM Plex Sans Arabic', sans-serif";
      ctx.fillText(`${bm.name} ${val}%`, ax, ay - 30);
      ctx.restore();
    });
  }

  function lighten(rgb, f) {
    const r = Math.round(rgb[0] + (255 - rgb[0]) * f);
    const g = Math.round(rgb[1] + (255 - rgb[1]) * f);
    const b = Math.round(rgb[2] + (255 - rgb[2]) * f);
    return `rgb(${r},${g},${b})`;
  }

  /* ================= المرشّح الضوئي ================= */
  function drawFilter(ctx, rgb, name) {
    const fx = 610;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(fx - 7, 60, 14, SCENE_H - 150, 7);
    ctx.fillStyle = `rgba(${rgb.join(",")},0.45)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb.join(",")},0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = "700 12px 'IBM Plex Sans Arabic', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("مرشّح " + name, fx, 48);
    ctx.restore();
  }

  function filterColorRGB(name) {
    if (name === "red") return [226, 59, 59];
    if (name === "green") return [34, 176, 75];
    if (name === "blue") return [47, 111, 224];
    if (name === "yellow") return [234, 179, 8];
    return [120, 120, 120];
  }

  /* ================= فقاعة الإدراك (سحابة تفكير) ================= */
  function drawThoughtBubble(ctx, info, t) {
    const cx = BUBBLE_CENTER.x;
    const cy = BUBBLE_CENTER.y;
    const active = info.total > 15;
    ctx.save();
    ctx.textBaseline = "alphabetic";

    // نقاط التفكير الصاعدة من أعلى الرأس/القشرة البصرية إلى السحابة
    const dots = [
      { x: CORTEX.x - 6, y: CORTEX.y - 70, r: 5 },
      { x: CORTEX.x - 40, y: CORTEX.y - 100, r: 8 },
      { x: cx + 60, y: cy + 48, r: 12 },
    ];
    dots.forEach((d) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120,140,160,0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    });

    // نتوءات السحابة (دوائر متداخلة تُكوّن حافة غيمة)
    const bumps = [
      [-104, 8, 34],
      [-78, -22, 40],
      [-36, -36, 44],
      [8, -34, 46],
      [52, -22, 42],
      [92, 4, 36],
      [64, 30, 38],
      [18, 40, 42],
      [-30, 40, 40],
      [-74, 28, 34],
    ];
    // ظلّ السحابة
    ctx.save();
    ctx.shadowColor = "rgba(30,50,70,0.18)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 120, 66, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    // طبقة الحافة (لون خطّ خلف النتوءات)
    ctx.fillStyle = "rgba(120,140,160,0.5)";
    bumps.forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r + 2, 0, Math.PI * 2);
      ctx.fill();
    });
    // طبقة بيضاء علوية (تُخفي التداخلات وتُبقي حافة نظيفة)
    ctx.fillStyle = "#ffffff";
    bumps.forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.beginPath();
    ctx.ellipse(cx, cy, 108, 54, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // قرص اللون المُدرَك البارز (مع توهّج)
    const swX = cx - 50;
    ctx.save();
    if (active) {
      ctx.shadowColor = info.hex;
      ctx.shadowBlur = 24 + Math.sin(t * 3) * 5;
    }
    ctx.beginPath();
    ctx.arc(swX, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = active ? info.hex : "#1b1b1b";
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(swX, cy, 36, 0, Math.PI * 2);
    ctx.stroke();
    // بريق
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(swX - 12, cy - 13, 11, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // اسم اللون فقط (بلا رمز)
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "800 23px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillText(info.arabicName, cx + 66, cy - 6);
    ctx.font = "600 12px 'IBM Plex Sans Arabic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("ما يراه الدماغ", cx + 66, cy + 18);

    ctx.restore();
  }

  return (
    <div className="color-scene-wrapper">
      <canvas
        ref={canvasRef}
        width={SCENE_W}
        height={SCENE_H}
        className="color-canvas"
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      />
    </div>
  );
});

export default ColorScene;
