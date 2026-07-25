/**
 * ColorScene.jsx — لوحة التفاعل الفيزيائي والرسومي بـ HTML5 Canvas بسرعة 60fps
 * مع دعم الموجات الضوئية، الفلتر الضوئي، ومجهر الشبكية المكبر لقمع/تحفيز المخاريط.
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
    isPlaying,
    beamMode,
    visionMode,
    showConesZoom,
    filterColor,
    filterEnabled,
    onStatus,
  },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const nervePulsesRef = useRef([]);

  const propsRef = useRef({
    rVal,
    gVal,
    bVal,
    isPlaying,
    beamMode,
    visionMode,
    showConesZoom,
    filterColor,
    filterEnabled,
    onStatus,
  });
  propsRef.current = {
    rVal,
    gVal,
    bVal,
    isPlaying,
    beamMode,
    visionMode,
    showConesZoom,
    filterColor,
    filterEnabled,
    onStatus,
  };

  useImperativeHandle(ref, () => ({
    reset: () => {
      particlesRef.current = [];
      nervePulsesRef.current = [];
    },
  }));

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
        showConesZoom: conesZoom,
        filterColor: fColor,
        filterEnabled: fOn,
        onStatus: cb,
      } = propsRef.current;

      if (playing) animTime += 0.04;

      // 1. تطبيق تصفية الفلتر الضوئي إن كان مفعلاً
      let effR = r, effG = g, effB = b;
      if (fOn) {
        if (fColor === "red") { effG *= 0.1; effB *= 0.1; }
        if (fColor === "green") { effR *= 0.1; effB *= 0.1; }
        if (fColor === "blue") { effR *= 0.1; effG *= 0.1; }
        if (fColor === "yellow") { effB *= 0.1; }
      }

      // 2. حساب اللون المدرَك لدى الدماغ وفق النمط الحسي وعمى الألوان
      const colorInfo = calculatePerceivedColor(effR, effG, effB, vMode);
      cb && cb(colorInfo);

      // 3. خلفية داكنة مع شبكة فيزيائية
      ctx.fillStyle = "#070A10";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);

      // رسم الشبكة
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      ctx.lineWidth = 1;
      for (let x = 0; x < SCENE_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, SCENE_H); ctx.stroke();
      }
      for (let y = 0; y < SCENE_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(SCENE_W, y); ctx.stroke();
      }

      // 4. رسم الفلتر الضوئي المنفذ (Color Filter Barrier) إن كان مفعلاً
      const filterX = 640;
      if (fOn) {
        drawColorFilter(ctx, filterX, fColor, animTime);
      }

      // 5. توليد الجسيمات الضوئية
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
              if (Math.random() < 0.65) {
                particlesRef.current.push({
                  x: 750,
                  y: fl.y + (Math.random() - 0.5) * 18,
                  vx: -(3.8 + Math.random() * 2.2),
                  vy: (EYE_CENTER.y - fl.y) * 0.0035 + (Math.random() - 0.5) * 0.3,
                  size: 3 + Math.random() * 2,
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

      // 6. رسم حزم الأشعة أو موجات الأطوال الموجية
      flashlights.forEach((fl) => {
        if (fl.val > 0) {
          const alpha = (fl.val / 100) * 0.4;

          if (bMode === "waves") {
            // رسم الموجات الكهرومغناطيسية (Electromagnetic Sine Waves)
            ctx.strokeStyle = `rgba(${fl.rgb.join(",")}, ${alpha * 1.2})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            const startX = 750;
            const targetX = EYE_CENTER.x;
            const freq = fl.wavelength / 120;
            for (let x = startX; x >= targetX; x -= 3) {
              const progress = (startX - x) / (startX - targetX);
              const curY = fl.y + (EYE_CENTER.y - fl.y) * progress;
              const waveY = curY + Math.sin(x * 0.08 + animTime * 6) * 12 * (1 - progress * 0.5);
              if (x === startX) ctx.moveTo(x, waveY);
              else ctx.lineTo(x, waveY);
            }
            ctx.stroke();
          } else {
            // رسم الشعاع المستمر
            const grad = ctx.createLinearGradient(750, fl.y, EYE_CENTER.x, EYE_CENTER.y);
            grad.addColorStop(0, `rgba(${fl.rgb.join(",")}, ${alpha * 0.95})`);
            grad.addColorStop(1, `rgba(${fl.rgb.join(",")}, ${alpha * 0.2})`);

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

      // 7. تحديث ورسم الجسيمات (Photons) وتفاعل الفلتر
      particlesRef.current.forEach((p) => {
        if (playing) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.008;

          // الفلترة عند المرور بالحاجز
          if (fOn && p.x <= filterX && !p.passedFilter) {
            p.passedFilter = true;
            let blocked = false;
            if (fColor === "red" && p.type !== "red") blocked = Math.random() < 0.9;
            if (fColor === "green" && p.type !== "green") blocked = Math.random() < 0.9;
            if (fColor === "blue" && p.type !== "blue") blocked = Math.random() < 0.9;
            if (blocked) p.life = 0;
          }
        }

        // الوصول إلى العين
        if (p.x <= EYE_CENTER.x + 5) {
          p.life = 0;
          if (playing && Math.random() < 0.28) {
            nervePulsesRef.current.push({
              progress: 0,
              color: p.color,
              speed: 0.022 + Math.random() * 0.015,
            });
          }
        }

        if (p.life > 0 && bMode !== "solid") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // 8. رسم الرأس والعين والدماغ
      drawHeadAndBrain(ctx, animTime, colorInfo, vMode);

      // 9. رسم النبضات العصبية داخل العصب البصري
      drawNervePulses(ctx, playing, colorInfo);

      // 10. رسم الكشافات الثلاثة
      drawFlashlights(ctx, flashlights, animTime);

      // 11. رسم سحابة التفكير
      drawThoughtCloud(ctx, colorInfo, animTime);

      // 12. تراكب مجهر الشبكية والخلايا المخروطية (Retina Cones Zoom Overlay)
      if (conesZoom) {
        drawConesMicroscope(ctx, colorInfo, animTime);
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ===== رسم حاجز الفلتر الضوئي ===== */
  function drawColorFilter(ctx, filterX, fColor, t) {
    const colorsMap = {
      red: "rgba(255, 0, 0, 0.55)",
      green: "rgba(0, 255, 0, 0.55)",
      blue: "rgba(0, 100, 255, 0.55)",
      yellow: "rgba(255, 230, 0, 0.55)",
    };

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(filterX - 8, 40, 16, SCENE_H - 80, 8);
    ctx.fillStyle = colorsMap[fColor] || "rgba(255, 255, 255, 0.5)";
    ctx.shadowColor = colorsMap[fColor] || "#FFF";
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ملصق الفلتر
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`مرشح ضوئي: ${fColor.toUpperCase()}`, filterX, 30);
    ctx.restore();
  }

  /* ===== رسم الرأس والدماغ والعين ===== */
  function drawHeadAndBrain(ctx, t, colorInfo, vMode) {
    ctx.save();

    // الرأس الظلي
    ctx.beginPath();
    ctx.fillStyle = "#323745";
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
    ctx.ellipse(brainX, brainY, 90, 70, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1E29";
    ctx.fill();
    ctx.strokeStyle = "#40485C";
    ctx.lineWidth = 3;
    ctx.stroke();

    // مادة الدماغ الوردي
    ctx.beginPath();
    ctx.ellipse(brainX, brainY, 85, 65, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#D88EA4";
    ctx.fill();

    // تلافيف
    ctx.strokeStyle = "#9E4F66";
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.arc(brainX - 20, brainY - 15, 30, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(brainX + 20, brainY - 10, 25, 0.2, Math.PI * 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(brainX - 10, brainY + 20, 25, Math.PI, Math.PI * 2); ctx.stroke();

    // الفص البصري وتوهجه
    if (colorInfo.total > 15) {
      const vcX = brainX - 60;
      const vcY = brainY + 15;
      ctx.beginPath();
      ctx.arc(vcX, vcY, 22, 0, Math.PI * 2);
      ctx.fillStyle = colorInfo.hex;
      ctx.shadowColor = colorInfo.hex;
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("الفص البصري", vcX, vcY + 34);
    }

    // العين
    ctx.beginPath();
    ctx.arc(EYE_CENTER.x, EYE_CENTER.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#EAEFF9";
    ctx.fill();
    ctx.strokeStyle = "#2A303F";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // القزحية والعدسة
    ctx.beginPath();
    ctx.ellipse(EYE_CENTER.x + 8, EYE_CENTER.y, 5, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4A90E2";
    ctx.fill();

    // العصب البصري
    const vcX = brainX - 55;
    const vcY = brainY + 20;

    ctx.beginPath();
    ctx.moveTo(EYE_CENTER.x - 16, EYE_CENTER.y);
    ctx.quadraticCurveTo(EYE_CENTER.x - 65, EYE_CENTER.y + 10, vcX, vcY);
    ctx.strokeStyle = "#F1C40F";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.restore();
  }

  /* ===== رسم النبضات العصبية ===== */
  function drawNervePulses(ctx, playing, colorInfo) {
    if (colorInfo.total <= 15) return;
    const brainX = HEAD_CENTER.x - 20;
    const brainY = HEAD_CENTER.y - 75;
    const vcX = brainX - 55;
    const vcY = brainY + 20;

    nervePulsesRef.current.forEach((np) => {
      if (playing) np.progress += np.speed;
      if (np.progress <= 1) {
        const t = np.progress;
        const p0 = { x: EYE_CENTER.x - 16, y: EYE_CENTER.y };
        const p1 = { x: EYE_CENTER.x - 65, y: EYE_CENTER.y + 10 };
        const p2 = { x: vcX, y: vcY };

        const nx = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
        const ny = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fillStyle = np.color || "#FFF";
        ctx.shadowColor = np.color || "#FFF";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
    nervePulsesRef.current = nervePulsesRef.current.filter((np) => np.progress <= 1);
  }

  /* ===== رسم الكشافات الثلاثة ===== */
  function drawFlashlights(ctx, flashlights, t) {
    flashlights.forEach((fl) => {
      const fx = 810;
      const fy = fl.y;
      ctx.save();

      const bodyGrad = ctx.createLinearGradient(fx, fy - 22, fx, fy + 22);
      bodyGrad.addColorStop(0, "#6A7387");
      bodyGrad.addColorStop(0.5, "#9EA7BC");
      bodyGrad.addColorStop(1, "#444B5C");

      ctx.beginPath();
      ctx.roundRect(fx, fy - 18, 125, 36, 6);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = "#222733";
      ctx.lineWidth = 2;
      ctx.stroke();

      // مقبض
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 2;
      for (let gx = fx + 25; gx <= fx + 100; gx += 10) {
        ctx.beginPath(); ctx.moveTo(gx, fy - 14); ctx.lineTo(gx, fy + 14); ctx.stroke();
      }

      // رأس الكشاف
      ctx.beginPath();
      ctx.moveTo(fx, fy - 20);
      ctx.lineTo(fx - 35, fy - 28);
      ctx.lineTo(fx - 35, fy + 28);
      ctx.lineTo(fx, fy + 20);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = "#222733";
      ctx.stroke();

      // العدسة
      ctx.beginPath();
      ctx.ellipse(fx - 35, fy, 5, 27, 0, 0, Math.PI * 2);
      if (fl.val > 0) {
        ctx.fillStyle = fl.color;
        ctx.shadowColor = fl.color;
        ctx.shadowBlur = (fl.val / 100) * 25;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#1E222D";
        ctx.fill();
      }
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${fl.name} (${fl.val}%)`, fx + 65, fy + 5);
      ctx.restore();
    });
  }

  /* ===== رسم سحابة التفكير ===== */
  function drawThoughtCloud(ctx, colorInfo, t) {
    const cloudX = HEAD_CENTER.x - 10;
    const cloudY = HEAD_CENTER.y - 205;

    ctx.save();
    const bubbles = [
      { x: HEAD_CENTER.x - 5, y: HEAD_CENTER.y - 115, r: 8 },
      { x: HEAD_CENTER.x - 15, y: HEAD_CENTER.y - 135, r: 13 },
      { x: HEAD_CENTER.x - 20, y: HEAD_CENTER.y - 160, r: 19 },
    ];

    bubbles.forEach((b) => {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240, 244, 255, 0.94)"; ctx.fill();
      ctx.strokeStyle = "#3B4254"; ctx.lineWidth = 2; ctx.stroke();
    });

    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, 115, 55, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(248, 250, 255, 0.96)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)"; ctx.shadowBlur = 20; ctx.fill();
    ctx.strokeStyle = "#333A4A"; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY - 6, 90, 32, 0, 0, Math.PI * 2);
    ctx.fillStyle = colorInfo.hex;
    ctx.shadowColor = colorInfo.hex;
    ctx.shadowBlur = colorInfo.total > 15 ? 18 : 0;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = colorInfo.total > 380 ? "#111111" : "#FFFFFF";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(colorInfo.arabicName, cloudX, cloudY - 2);

    ctx.font = "11px monospace";
    ctx.fillText(`${colorInfo.hex.toUpperCase()} • ${colorInfo.wavelengthNm}nm`, cloudX, cloudY + 16);
    ctx.restore();
  }

  /* ===== مجهر الشبكية المكبر (Retina Cones Microscope) ===== */
  function drawConesMicroscope(ctx, colorInfo, t) {
    const mx = 160;
    const my = 400;
    const mr = 100;

    ctx.save();
    // نافذة المجهر الدائرية
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = "#0A0F1A";
    ctx.fill();
    ctx.strokeStyle = "#4A90E2";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#4A90E2";
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // العنوان
    ctx.fillStyle = "#60A5FA";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🔬 مجهر الخلايا المخروطية (Retina Cones)", mx, my - mr + 18);

    // رسم 3 مخاريط ثلاثية الأبعاد اهتزازية
    const cones = [
      { name: "L-Cone (Red)", val: colorInfo.lCone, color: "#FF4444", x: mx - 50 },
      { name: "M-Cone (Green)", val: colorInfo.mCone, color: "#44FF44", x: mx },
      { name: "S-Cone (Blue)", val: colorInfo.sCone, color: "#4488FF", x: mx + 50 },
    ];

    cones.forEach((cone) => {
      const cy = my + 30;
      const h = 20 + (cone.val / 100) * 50;
      const vib = (cone.val / 100) * Math.sin(t * 15) * 3;

      // المخروط المخروطي
      ctx.beginPath();
      ctx.moveTo(cone.x + vib, cy - h);
      ctx.lineTo(cone.x - 12 + vib, cy);
      ctx.lineTo(cone.x + 12 + vib, cy);
      ctx.closePath();
      ctx.fillStyle = cone.color;
      ctx.shadowColor = cone.color;
      ctx.shadowBlur = cone.val > 10 ? 12 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;

      // نسبة الاهتزاز والتحفيز
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(`${Math.round(cone.val)}%`, cone.x, cy + 14);
    });

    ctx.restore();
  }

  return (
    <div className="color-scene-wrapper">
      <canvas ref={canvasRef} width={SCENE_W} height={SCENE_H} className="color-canvas" />
    </div>
  );
});

export default ColorScene;
