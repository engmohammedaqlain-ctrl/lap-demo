/**
 * ColorScene.jsx — رسم وتفاعل مباشر على العرض نفسه (On-Canvas Interactive Controls)
 * ستايل فاتح ناصع بدون إيموجيات.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SCENE_W,
  SCENE_H,
  FLASHLIGHTS,
  EYE_CENTER,
  HEAD_CENTER,
  calculatePerceivedColor,
} from "./colorData.js";

const ColorScene = forwardRef(function ColorScene(
  {
    rVal,
    gVal,
    bVal,
    onValChange,
    isPlaying,
    beamMode,
    visionMode,
    filterEnabled,
    filterColor,
    onStatus,
  },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const nervePulsesRef = useRef([]);
  const draggingRef = useRef(null); // 'red' | 'green' | 'blue' | null

  const propsRef = useRef({
    rVal,
    gVal,
    bVal,
    onValChange,
    isPlaying,
    beamMode,
    visionMode,
    filterEnabled,
    filterColor,
    onStatus,
  });
  propsRef.current = {
    rVal,
    gVal,
    bVal,
    onValChange,
    isPlaying,
    beamMode,
    visionMode,
    filterEnabled,
    filterColor,
    onStatus,
  };

  useImperativeHandle(ref, () => ({
    reset: () => {
      particlesRef.current = [];
      nervePulsesRef.current = [];
    },
  }));

  // تفاعل مباشر بالسحب والتغيير من العرض مباشرة
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = SCENE_W / rect.width;
    const scaleY = SCENE_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e) => {
    const { x, y } = getCanvasCoords(e);
    // كشافات الضوء ومقابض التحكم
    const flashlights = [
      { id: "red", y: FLASHLIGHTS[0].y },
      { id: "green", y: FLASHLIGHTS[1].y },
      { id: "blue", y: FLASHLIGHTS[2].y },
    ];

    for (const fl of flashlights) {
      // منطقة مقبض السلايدر على الكشاف (من x=740 إلى x=960)
      if (x >= 740 && x <= 960 && Math.abs(y - fl.y) <= 30) {
        draggingRef.current = fl.id;
        updateValueFromX(fl.id, x);
        break;
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const { x } = getCanvasCoords(e);
    updateValueFromX(draggingRef.current, x);
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const updateValueFromX = (id, x) => {
    const minX = 780;
    const maxX = 940;
    const percent = Math.round(Math.max(0, Math.min(100, ((x - minX) / (maxX - minX)) * 100)));
    const { onValChange: cb } = propsRef.current;
    cb && cb(id, percent);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animTime = 0;

    function renderFrame() {
      const {
        rVal: r,
        gVal: g,
        bVal: b,
        isPlaying: playing,
        beamMode: bMode,
        visionMode: vMode,
        filterColor: fColor,
        filterEnabled: fOn,
        onStatus: cb,
      } = propsRef.current;

      if (playing) animTime += 0.04;

      let effR = r, effG = g, effB = b;
      if (fOn) {
        if (fColor === "red") { effG *= 0.1; effB *= 0.1; }
        if (fColor === "green") { effR *= 0.1; effB *= 0.1; }
        if (fColor === "blue") { effR *= 0.1; effG *= 0.1; }
        if (fColor === "yellow") { effB *= 0.1; }
      }

      const colorInfo = calculatePerceivedColor(effR, effG, effB, vMode);
      cb && cb(colorInfo);

      // --- خلفية نمط فاتح (Light Mode Canvas) ---
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);

      // شبكة رمادية خفيفة جداً
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      for (let x = 0; x < SCENE_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SCENE_H); ctx.stroke();
      }
      for (let y = 0; y < SCENE_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SCENE_W, y); ctx.stroke();
      }

      // الفلتر الضوئي
      const filterX = 640;
      if (fOn) {
        drawColorFilter(ctx, filterX, fColor);
      }

      // الجسيمات
      const flashlights = [
        { ...FLASHLIGHTS[0], val: r, effVal: effR },
        { ...FLASHLIGHTS[1], val: g, effVal: effG },
        { ...FLASHLIGHTS[2], val: b, effVal: effB },
      ];

      if (playing) {
        flashlights.forEach((fl) => {
          if (fl.val > 0) {
            const count = Math.ceil((fl.val / 100) * 3);
            for (let i = 0; i < count; i++) {
              if (Math.random() < 0.6) {
                particlesRef.current.push({
                  x: 750,
                  y: fl.y + (Math.random() - 0.5) * 16,
                  vx: -(3.8 + Math.random() * 2.2),
                  vy: (EYE_CENTER.y - fl.y) * 0.0035 + (Math.random() - 0.5) * 0.3,
                  size: 3.5,
                  color: fl.particleColor,
                  rgb: fl.rgb,
                  life: 1,
                  type: fl.id,
                  passedFilter: false,
                });
              }
            }
          }
        });
      }

      // الأشعة الضوئية
      flashlights.forEach((fl) => {
        if (fl.val > 0) {
          const alpha = (fl.val / 100) * 0.35;
          if (bMode === "waves") {
            ctx.strokeStyle = `rgba(${fl.rgb.join(",")}, ${alpha * 1.5})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let x = 750; x >= EYE_CENTER.x; x -= 3) {
              const progress = (750 - x) / (750 - EYE_CENTER.x);
              const curY = fl.y + (EYE_CENTER.y - fl.y) * progress;
              const waveY = curY + Math.sin(x * 0.08 + animTime * 6) * 10;
              if (x === 750) ctx.moveTo(x, waveY);
              else ctx.lineTo(x, waveY);
            }
            ctx.stroke();
          } else {
            const grad = ctx.createLinearGradient(750, fl.y, EYE_CENTER.x, EYE_CENTER.y);
            grad.addColorStop(0, `rgba(${fl.rgb.join(",")}, ${alpha * 0.85})`);
            grad.addColorStop(1, `rgba(${fl.rgb.join(",")}, ${alpha * 0.15})`);

            ctx.beginPath();
            ctx.moveTo(750, fl.y - 14);
            ctx.lineTo(750, fl.y + 14);
            ctx.lineTo(EYE_CENTER.x + 8, EYE_CENTER.y + 10);
            ctx.lineTo(EYE_CENTER.x + 8, EYE_CENTER.y - 10);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
          }
        }
      });

      // حركة وتحديث الجسيمات
      particlesRef.current.forEach((p) => {
        if (playing) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.008;

          if (fOn && p.x <= filterX && !p.passedFilter) {
            p.passedFilter = true;
            let blocked = false;
            if (fColor === "red" && p.type !== "red") blocked = Math.random() < 0.9;
            if (fColor === "green" && p.type !== "green") blocked = Math.random() < 0.9;
            if (fColor === "blue" && p.type !== "blue") blocked = Math.random() < 0.9;
            if (blocked) p.life = 0;
          }
        }

        if (p.x <= EYE_CENTER.x + 5) {
          p.life = 0;
          if (playing && Math.random() < 0.28) {
            nervePulsesRef.current.push({
              progress: 0,
              color: p.color,
              speed: 0.025,
            });
          }
        }

        if (p.life > 0 && bMode !== "solid") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // رسم الرأس والدماغ
      drawHeadAndBrain(ctx, animTime, colorInfo);

      // النبضات العصبية
      drawNervePulses(ctx, playing, colorInfo);

      // الكشافات وعناصر التحكم المباشرة عليها
      drawInteractiveFlashlights(ctx, flashlights);

      // سحابة التفكير
      drawThoughtCloud(ctx, colorInfo);

      rafRef.current = requestAnimationFrame(renderFrame);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ===== رسم الرأس والدماغ لستايل فاتح ===== */
  function drawHeadAndBrain(ctx, t, colorInfo) {
    ctx.save();
    // الرأس الظلي الداكن الأنيق
    ctx.beginPath();
    ctx.fillStyle = "#1E293B";
    ctx.moveTo(HEAD_CENTER.x - 130, HEAD_CENTER.y + 200);
    ctx.lineTo(HEAD_CENTER.x - 130, HEAD_CENTER.y - 90);
    ctx.quadraticCurveTo(HEAD_CENTER.x - 120, HEAD_CENTER.y - 190, HEAD_CENTER.x - 10, HEAD_CENTER.y - 200);
    ctx.quadraticCurveTo(HEAD_CENTER.x + 90, HEAD_CENTER.y - 190, HEAD_CENTER.x + 110, HEAD_CENTER.y - 90);
    ctx.quadraticCurveTo(HEAD_CENTER.x + 125, HEAD_CENTER.y - 30, HEAD_CENTER.x + 140, HEAD_CENTER.y);
    ctx.lineTo(HEAD_CENTER.x + 115, HEAD_CENTER.y + 20);
    ctx.quadraticCurveTo(HEAD_CENTER.x + 130, HEAD_CENTER.y + 50, HEAD_CENTER.x + 115, HEAD_CENTER.y + 80);
    ctx.quadraticCurveTo(HEAD_CENTER.x + 40, HEAD_CENTER.y + 160, HEAD_CENTER.x + 40, HEAD_CENTER.y + 200);
    ctx.closePath();
    ctx.fill();

    // تجويف الدماغ
    const brainX = HEAD_CENTER.x - 20;
    const brainY = HEAD_CENTER.y - 75;

    ctx.beginPath();
    ctx.ellipse(brainX, brainY, 85, 65, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // مادة الدماغ الوردي الفاتح
    ctx.beginPath();
    ctx.ellipse(brainX, brainY, 80, 60, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#F472B6";
    ctx.fill();

    // تلافيف
    ctx.strokeStyle = "#DB2777";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(brainX - 20, brainY - 15, 28, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(brainX + 20, brainY - 10, 22, 0.2, Math.PI * 1.2); ctx.stroke();

    // الفص البصري وتوهجه
    if (colorInfo.total > 15) {
      const vcX = brainX - 55;
      const vcY = brainY + 15;
      ctx.beginPath();
      ctx.arc(vcX, vcY, 20, 0, Math.PI * 2);
      ctx.fillStyle = colorInfo.hex;
      ctx.fill();
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#0F172A";
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("الفص البصري", vcX, vcY + 32);
    }

    // العين
    ctx.beginPath();
    ctx.arc(EYE_CENTER.x, EYE_CENTER.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2;
    ctx.stroke();

    // القزحية والعدسة
    ctx.beginPath();
    ctx.ellipse(EYE_CENTER.x + 6, EYE_CENTER.y, 4, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2563EB";
    ctx.fill();

    // العصب البصري
    const vcX = brainX - 50;
    const vcY = brainY + 20;

    ctx.beginPath();
    ctx.moveTo(EYE_CENTER.x - 14, EYE_CENTER.y);
    ctx.quadraticCurveTo(EYE_CENTER.x - 60, EYE_CENTER.y + 10, vcX, vcY);
    ctx.strokeStyle = "#EAB308";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  /* ===== رسم النبضات العصبية ===== */
  function drawNervePulses(ctx, playing, colorInfo) {
    if (colorInfo.total <= 15) return;
    const brainX = HEAD_CENTER.x - 20;
    const brainY = HEAD_CENTER.y - 75;
    const vcX = brainX - 50;
    const vcY = brainY + 20;

    nervePulsesRef.current.forEach((np) => {
      if (playing) np.progress += np.speed;
      if (np.progress <= 1) {
        const t = np.progress;
        const p0 = { x: EYE_CENTER.x - 14, y: EYE_CENTER.y };
        const p1 = { x: EYE_CENTER.x - 60, y: EYE_CENTER.y + 10 };
        const p2 = { x: vcX, y: vcY };

        const nx = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
        const ny = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = np.color || "#000";
        ctx.fill();
      }
    });
    nervePulsesRef.current = nervePulsesRef.current.filter((np) => np.progress <= 1);
  }

  /* ===== الكشافات والمقابض التفاعلية المباشرة على العرض ===== */
  function drawInteractiveFlashlights(ctx, flashlights) {
    flashlights.forEach((fl) => {
      const fx = 780;
      const fy = fl.y;
      const val = fl.val;

      ctx.save();

      // جسم الكشاف الأبيض الفاخر
      ctx.beginPath();
      ctx.roundRect(fx, fy - 16, 170, 32, 8);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // رأس الكشاف
      ctx.beginPath();
      ctx.moveTo(fx, fy - 18);
      ctx.lineTo(fx - 28, fy - 24);
      ctx.lineTo(fx - 28, fy + 24);
      ctx.lineTo(fx, fy + 18);
      ctx.closePath();
      ctx.fillStyle = "#F1F5F9";
      ctx.fill();
      ctx.strokeStyle = "#CBD5E1";
      ctx.stroke();

      // عدسة الكشاف
      ctx.beginPath();
      ctx.ellipse(fx - 28, fy, 4, 23, 0, 0, Math.PI * 2);
      ctx.fillStyle = val > 0 ? fl.color : "#E2E8F0";
      ctx.fill();
      ctx.stroke();

      // مسار السلايدر التفاعلي على الكشاف (Direct On-Canvas Rail)
      const railMinX = fx + 60;
      const railMaxX = fx + 150;
      const handleX = railMinX + (val / 100) * (railMaxX - railMinX);

      // مجرى السلايدر
      ctx.beginPath();
      ctx.moveTo(railMinX, fy);
      ctx.lineTo(railMaxX, fy);
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(railMinX, fy);
      ctx.lineTo(handleX, fy);
      ctx.strokeStyle = fl.color;
      ctx.lineWidth = 6;
      ctx.stroke();

      // مقبض التحكم التفاعلي (Interactive Handle Knob)
      ctx.beginPath();
      ctx.arc(handleX, fy, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = fl.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // عنوان الكشاف والنسبة
      ctx.fillStyle = "#0F172A";
      ctx.font = "600 12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${fl.name}: ${val}%`, fx + 50, fy + 4);

      ctx.restore();
    });
  }

  /* ===== حاجز الفلتر الضوئي ===== */
  function drawColorFilter(ctx, filterX, fColor) {
    const colorsMap = {
      red: "rgba(220, 38, 38, 0.4)",
      green: "rgba(22, 163, 74, 0.4)",
      blue: "rgba(37, 99, 235, 0.4)",
      yellow: "rgba(234, 179, 8, 0.4)",
    };

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(filterX - 6, 40, 12, SCENE_H - 80, 6);
    ctx.fillStyle = colorsMap[fColor] || "rgba(0, 0, 0, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("مرشح ضوئي", filterX, 30);
    ctx.restore();
  }

  /* ===== سحابة التفكير ===== */
  function drawThoughtCloud(ctx, colorInfo) {
    const cloudX = HEAD_CENTER.x - 10;
    const cloudY = HEAD_CENTER.y - 200;

    ctx.save();
    const bubbles = [
      { x: HEAD_CENTER.x - 5, y: HEAD_CENTER.y - 115, r: 7 },
      { x: HEAD_CENTER.x - 15, y: HEAD_CENTER.y - 135, r: 11 },
      { x: HEAD_CENTER.x - 20, y: HEAD_CENTER.y - 160, r: 16 },
    ];

    bubbles.forEach((b) => {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF"; ctx.fill();
      ctx.strokeStyle = "#CBD5E1"; ctx.lineWidth = 1.5; ctx.stroke();
    });

    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, 100, 48, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#94A3B8"; ctx.lineWidth = 2; ctx.stroke();

    // دائرة اللون الناتج
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY - 4, 78, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = colorInfo.hex;
    ctx.fill();
    ctx.strokeStyle = "#CBD5E1"; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = colorInfo.total > 380 ? "#0F172A" : "#FFFFFF";
    ctx.font = "600 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(colorInfo.arabicName, cloudX, cloudY);

    ctx.font = "500 10px monospace";
    ctx.fillText(`${colorInfo.hex.toUpperCase()}`, cloudX, cloudY + 14);
    ctx.restore();
  }

  return (
    <div className="color-scene-wrapper">
      <canvas
        ref={canvasRef}
        width={SCENE_W}
        height={SCENE_H}
        className="color-canvas"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
    </div>
  );
});

export default ColorScene;
