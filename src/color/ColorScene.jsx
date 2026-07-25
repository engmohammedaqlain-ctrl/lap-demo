/**
 * ColorScene.jsx — محاكاة رؤية الألوان بأسلوب PhET: رأس جانبي بعين واقعية،
 * ثلاثة كشّافات ملوّنة مائلة على اليمين تتجمّع أشعّتها في العين، ثم إشارة
 * عصبية تسري عبر العصب البصري إلى القشرة البصرية في الدماغ التي تتوهّج
 * باللون المُدرَك — ويظهر الاسم في فقاعة تفكير بارزة فوق الرأس.
 *
 * الرسم كلّه على canvas في حلقة requestAnimationFrame. التحكّم بالشدّة صار
 * من منزلقات HTML أسفل المشهد (ColorApp) لا على العرض.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SCENE_W,
  SCENE_H,
  FLASHLIGHTS,
  EYE_CENTER,
  HEAD_CENTER,
  BULB_LENS_X,
  calculatePerceivedColor,
} from "./colorData.js";

const EYE = EYE_CENTER;
const MAX_PARTICLES = 260;

/* مركز القشرة البصرية (مؤخّرة الدماغ) — تتوهّج باللون المُدرَك */
const CORTEX = { x: HEAD_CENTER.x - 96, y: HEAD_CENTER.y - 40 };

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

      // 1) الأشعّة خلف الرأس/العين
      drawBeams(ctx, beams, vals, t, p.beamMode);

      // 2) الفوتونات
      if (p.beamMode === "particles") {
        spawnPhotons(beams, vals, p.isPlaying);
        updateAndDrawPhotons(ctx, p, effVals);
      } else if (p.isPlaying) {
        // في وضعَي الموجات/الشعاع نحدّث النبضات دون رسم فوتونات
        maybeEmitPulses(beams, effVals, info);
      }

      // 3) المرشّح الضوئي (إن فُعّل)
      if (p.filterEnabled) drawFilter(ctx, filterColorRGB(p.filterColor), p.filterColor);

      // 4) الكشّافات المائلة
      drawBulbs(ctx, beams, vals);

      // 5) الرأس والعين والدماغ
      drawHead(ctx);
      drawBrain(ctx, info, t);
      drawOpticNerve(ctx, info);
      updateAndDrawPulses(ctx, p.isPlaying, info);
      drawEye(ctx, info);

      // 6) فقاعة الإدراك البارزة
      drawThoughtBubble(ctx, info, t);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ================= الخلفية ================= */
  function drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, "#fbfdff");
    g.addColorStop(1, "#eef4f8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    // شبكة نقطية خفيفة
    ctx.fillStyle = "rgba(70,120,160,0.10)";
    for (let x = 20; x < SCENE_W; x += 30) {
      for (let y = 20; y < SCENE_H; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // أرضية خفيفة
    ctx.fillStyle = "rgba(120,150,120,0.08)";
    ctx.fillRect(0, SCENE_H - 40, SCENE_W, 40);
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
    const p1 = { x: (EYE.x + CORTEX.x) / 2 - 6, y: EYE.y + 46 };
    const p2 = { x: CORTEX.x, y: CORTEX.y };
    for (const np of pulsesRef.current) {
      if (playing) np.progress += np.speed;
      const s = np.progress;
      if (s > 1) continue;
      const x = (1 - s) * (1 - s) * p0.x + 2 * (1 - s) * s * p1.x + s * s * p2.x;
      const y = (1 - s) * (1 - s) * p0.y + 2 * (1 - s) * s * p1.y + s * s * p2.y;
      ctx.save();
      ctx.shadowColor = np.color;
      ctx.shadowBlur = 9;
      ctx.fillStyle = np.color;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    pulsesRef.current = pulsesRef.current.filter((np) => np.progress <= 1);
  }

  /* ================= الرأس الجانبي + الكتف ================= */
  function drawHead(ctx) {
    const cx = HEAD_CENTER.x;
    const cy = HEAD_CENTER.y;

    // ---- القميص/الكتفان (خلف الرقبة، ليبدو كشخص) ----
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 156, SCENE_H);
    ctx.lineTo(cx - 156, cy + 182);
    ctx.quadraticCurveTo(cx - 122, cy + 150, cx - 70, cy + 150);
    ctx.quadraticCurveTo(cx - 34, cy + 150, cx - 16, cy + 178);
    ctx.quadraticCurveTo(cx - 6, cy + 196, cx + 4, cy + 178);
    ctx.quadraticCurveTo(cx + 22, cy + 150, cx + 66, cy + 150);
    ctx.quadraticCurveTo(cx + 120, cy + 152, cx + 152, cy + 186);
    ctx.lineTo(cx + 152, SCENE_H);
    ctx.closePath();
    const shirt = ctx.createLinearGradient(0, cy + 150, 0, SCENE_H);
    shirt.addColorStop(0, "#3E9E97");
    shirt.addColorStop(1, "#2C746F");
    ctx.fillStyle = shirt;
    ctx.fill();
    // طيّة ياقة
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 178);
    ctx.quadraticCurveTo(cx - 6, cy + 196, cx + 4, cy + 178);
    ctx.stroke();
    ctx.restore();

    // ---- الرأس (بشرة) ----
    ctx.save();
    ctx.shadowColor = "rgba(30,40,60,0.16)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;

    ctx.beginPath();
    ctx.moveTo(cx + 62, cy - 114); // أعلى الجبهة
    ctx.quadraticCurveTo(cx + 96, cy - 66, cx + 98, cy - 20); // الجبهة نازلة
    ctx.quadraticCurveTo(cx + 99, cy - 6, cx + 88, cy + 2); // جسر الأنف
    ctx.quadraticCurveTo(cx + 120, cy + 20, cx + 124, cy + 34); // ظهر الأنف والأرنبة
    ctx.quadraticCurveTo(cx + 125, cy + 45, cx + 98, cy + 48); // قاعدة الأنف
    ctx.quadraticCurveTo(cx + 89, cy + 50, cx + 94, cy + 60); // الشفة العليا
    ctx.quadraticCurveTo(cx + 103, cy + 65, cx + 91, cy + 75); // الفم
    ctx.quadraticCurveTo(cx + 85, cy + 83, cx + 99, cy + 101); // الشفة السفلى والذقن
    ctx.quadraticCurveTo(cx + 95, cy + 121, cx + 56, cy + 127); // الذقن
    ctx.quadraticCurveTo(cx + 14, cy + 129, cx - 22, cy + 118); // خطّ الفكّ للخلف
    ctx.quadraticCurveTo(cx - 16, cy + 150, cx - 14, cy + 184); // مقدّمة الرقبة
    ctx.lineTo(cx - 92, cy + 184); // أسفل الرقبة
    ctx.quadraticCurveTo(cx - 98, cy + 118, cx - 100, cy + 58); // مؤخّرة الرقبة والنقرة
    ctx.quadraticCurveTo(cx - 110, cy + 8, cx - 104, cy - 44); // مؤخّرة الرأس
    ctx.quadraticCurveTo(cx - 96, cy - 104, cx - 36, cy - 126); // أعلى الجمجمة الخلفي
    ctx.quadraticCurveTo(cx + 8, cy - 140, cx + 62, cy - 114); // إلى أعلى الجبهة
    ctx.closePath();

    const skin = ctx.createLinearGradient(cx - 96, cy - 120, cx + 120, cy + 180);
    skin.addColorStop(0, "#FDE3C6");
    skin.addColorStop(0.55, "#F7CDA3");
    skin.addColorStop(1, "#ECBB8C");
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(120,80,50,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- الشعر (غطاء ممتلئ على القمّة والمؤخّرة، والدماغ يظهر كمقطع تحته) ----
    ctx.beginPath();
    ctx.moveTo(cx + 70, cy - 96); // خطّ الشعر عند الجبهة
    ctx.quadraticCurveTo(cx + 84, cy - 156, cx + 16, cy - 168); // القمّة الأمامية
    ctx.quadraticCurveTo(cx - 66, cy - 180, cx - 110, cy - 120); // القمّة الخلفية
    ctx.quadraticCurveTo(cx - 128, cy - 84, cx - 106, cy - 36); // المؤخّرة نازلة
    ctx.quadraticCurveTo(cx - 78, cy - 48, cx - 60, cy - 30); // أسفل المؤخّرة
    ctx.quadraticCurveTo(cx - 20, cy - 66, cx + 20, cy - 74); // القاعدة الداخلية
    ctx.quadraticCurveTo(cx + 56, cy - 80, cx + 66, cy - 96); // إلى خطّ الشعر
    ctx.closePath();
    const hair = ctx.createLinearGradient(cx - 110, cy - 176, cx + 70, cy - 70);
    hair.addColorStop(0, "#4A3728");
    hair.addColorStop(1, "#2C2015");
    ctx.fillStyle = hair;
    ctx.fill();
    // خصلات خفيفة
    ctx.strokeStyle = "rgba(20,14,8,0.35)";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const sx = cx + 30 - i * 34;
      ctx.beginPath();
      ctx.moveTo(sx, cy - 150 + i * 4);
      ctx.quadraticCurveTo(sx - 14, cy - 120, sx - 6, cy - 92);
      ctx.stroke();
    }

    // خدّ خفيف
    ctx.fillStyle = "rgba(232,140,120,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx + 48, cy + 62, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // الأذن
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 24, 13, 19, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#F1C199";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,80,50,0.4)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 24, 6, 10, -0.2, -0.4, Math.PI);
    ctx.stroke();

    // حاجب
    ctx.strokeStyle = "#3E2E20";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 62, cy + 6);
    ctx.quadraticCurveTo(cx + 80, cy - 1, cx + 95, cy + 7);
    ctx.stroke();

    ctx.restore();
  }

  /* ================= العين ================= */
  function drawEye(ctx, info) {
    const ex = EYE.x;
    const ey = EYE.y;
    ctx.save();

    // بياض العين (لوز)
    ctx.beginPath();
    ctx.moveTo(ex - 22, ey);
    ctx.quadraticCurveTo(ex, ey - 15, ex + 22, ey);
    ctx.quadraticCurveTo(ex, ey + 15, ex - 22, ey);
    ctx.closePath();
    ctx.fillStyle = "#FDFEFF";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,50,45,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // القزحية (تلتقط انعكاس اللون المُدرَك)
    const irisX = ex + 8;
    ctx.beginPath();
    ctx.arc(irisX, ey, 10.5, 0, Math.PI * 2);
    const iris = ctx.createRadialGradient(irisX, ey, 1, irisX, ey, 10.5);
    const glow = info.total > 15 ? info.hex : "#5B7A99";
    iris.addColorStop(0, glow);
    iris.addColorStop(0.7, "#3C5A78");
    iris.addColorStop(1, "#22364a");
    ctx.fillStyle = iris;
    ctx.fill();

    // بؤبؤ
    ctx.beginPath();
    ctx.arc(irisX, ey, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = "#12181f";
    ctx.fill();

    // بريق
    ctx.beginPath();
    ctx.arc(irisX + 3, ey - 3, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    // جفن علوي رفيع
    ctx.beginPath();
    ctx.moveTo(ex - 22, ey);
    ctx.quadraticCurveTo(ex, ey - 16, ex + 22, ey);
    ctx.strokeStyle = "rgba(80,55,40,0.6)";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.restore();
  }

  /* ================= الدماغ + القشرة البصرية ================= */
  function drawBrain(ctx, info, t) {
    const bx = HEAD_CENTER.x - 40;
    const by = HEAD_CENTER.y - 58;
    ctx.save();

    // كتلة الدماغ
    ctx.beginPath();
    ctx.ellipse(bx, by, 66, 50, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#F7B7C6";
    ctx.fill();
    ctx.strokeStyle = "rgba(150,60,80,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // تلافيف (gyri) — منحنيات متعرّجة
    ctx.strokeStyle = "rgba(197,74,103,0.75)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const folds = [
      [-46, -8, -20, -26, 6, -12],
      [-40, 14, -14, 2, 12, 16],
      [4, -24, 26, -8, 44, -20],
      [8, 8, 30, 22, 50, 8],
      [-24, 30, 0, 20, 24, 32],
    ];
    for (const f of folds) {
      ctx.beginPath();
      ctx.moveTo(bx + f[0], by + f[1]);
      ctx.quadraticCurveTo(bx + f[2], by + f[3], bx + f[4], by + f[5]);
      ctx.stroke();
    }
    // شقّ منتصف الدماغ
    ctx.strokeStyle = "rgba(150,60,80,0.4)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx - 2, by - 46);
    ctx.quadraticCurveTo(bx + 6, by, bx - 4, by + 46);
    ctx.stroke();

    // المُخيخ الصغير (مؤخّرة سفلية)
    ctx.beginPath();
    ctx.ellipse(bx - 52, by + 34, 18, 14, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#EFA6B7";
    ctx.fill();
    ctx.strokeStyle = "rgba(150,60,80,0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // القشرة البصرية (مؤخّرة الدماغ) تتوهّج باللون المُدرَك
    if (info.total > 15) {
      const pulse = 0.6 + Math.sin(t * 4) * 0.12;
      ctx.save();
      ctx.shadowColor = info.hex;
      ctx.shadowBlur = 26 * pulse;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(CORTEX.x, CORTEX.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = info.hex;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(40,30,40,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(CORTEX.x, CORTEX.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(CORTEX.x, CORTEX.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#E79FB0";
      ctx.fill();
    }

    // تسمية القشرة البصرية
    ctx.fillStyle = "#5A3B46";
    ctx.font = "700 12px 'IBM Plex Sans Arabic', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("القشرة البصرية", CORTEX.x - 2, CORTEX.y + 34);

    ctx.restore();
  }

  /* ================= العصب البصري ================= */
  function drawOpticNerve(ctx, info) {
    const active = info.total > 15;
    ctx.save();
    ctx.strokeStyle = active ? "#EAB308" : "#C9B48A";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(EYE.x - 6, EYE.y + 6);
    ctx.quadraticCurveTo((EYE.x + CORTEX.x) / 2 - 6, EYE.y + 46, CORTEX.x, CORTEX.y);
    ctx.stroke();
    // غلاف أفتح
    ctx.strokeStyle = active ? "rgba(250,220,120,0.55)" : "rgba(220,205,170,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
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
    const cx = HEAD_CENTER.x + 12;
    const cy = 82;
    const active = info.total > 15;
    ctx.save();
    ctx.textBaseline = "alphabetic";

    // نقاط التفكير الصاعدة من الرأس إلى السحابة (تكبر تدريجياً)
    const dots = [
      { x: HEAD_CENTER.x - 26, y: HEAD_CENTER.y - 118, r: 5 },
      { x: HEAD_CENTER.x - 14, y: HEAD_CENTER.y - 140, r: 8 },
      { x: HEAD_CENTER.x - 4, y: HEAD_CENTER.y - 164, r: 12 },
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
