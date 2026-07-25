/**
 * ColorScene.jsx — لوحة رسم تفاعلية (HTML5 Canvas) بسرعة 60 إطاراً/ثانية
 * لتجربة رؤية الألوان ومزجها وإدراك الدماغ لها.
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
  { rVal, gVal, bVal, isPlaying, beamMode, viewMode, onStatus },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const nervePulsesRef = useRef([]);

  const propsRef = useRef({ rVal, gVal, bVal, isPlaying, beamMode, viewMode, onStatus });
  propsRef.current = { rVal, gVal, bVal, isPlaying, beamMode, viewMode, onStatus };

  // إمكانيات التحكم الخارجي
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
      const { rVal: r, gVal: g, bVal: b, isPlaying: playing, beamMode: bMode, viewMode: vMode, onStatus: cb } =
        propsRef.current;

      if (playing) animTime += 0.03;

      // 1. حساب اللون الناتج واستجابة المخاريط
      const colorInfo = calculatePerceivedColor(r, g, b);
      cb && cb(colorInfo);

      // 2. مسح اللوحة بخلفية داكنة راقية
      ctx.fillStyle = "#0A0D14";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);

      // 3. رسم خلفية الشبكة الفنية
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < SCENE_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, SCENE_H);
        ctx.stroke();
      }
      for (let y = 0; y < SCENE_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SCENE_W, y);
        ctx.stroke();
      }

      // 4. تحديث وإنشاء جسيمات الضوء (Photons)
      const flashlights = [
        { ...FLASHLIGHTS[0], val: r },
        { ...FLASHLIGHTS[1], val: g },
        { ...FLASHLIGHTS[2], val: b },
      ];

      if (playing) {
        flashlights.forEach((fl) => {
          if (fl.val > 0) {
            // توليد جسيمات بناءً على النسبة
            const count = Math.ceil((fl.val / 100) * 3);
            for (let i = 0; i < count; i++) {
              if (Math.random() < 0.6) {
                particlesRef.current.push({
                  x: 750,
                  y: fl.y + (Math.random() - 0.5) * 16,
                  vx: - (3.5 + Math.random() * 2.5),
                  vy: (EYE_CENTER.y - fl.y) * 0.004 + (Math.random() - 0.5) * 0.3,
                  size: 2.5 + Math.random() * 2,
                  color: fl.particleColor,
                  rgb: fl.rgb,
                  life: 1,
                  type: fl.id,
                });
              }
            }
          }
        });
      }

      // 5. رسم حزم الضوء المستمرة (Solid Beams) إن كان النمط مستمراً
      flashlights.forEach((fl) => {
        if (fl.val > 0) {
          const alpha = (fl.val / 100) * 0.45;
          const grad = ctx.createLinearGradient(760, fl.y, EYE_CENTER.x, EYE_CENTER.y);
          grad.addColorStop(0, `rgba(${fl.rgb.join(",")}, ${alpha * 0.9})`);
          grad.addColorStop(1, `rgba(${fl.rgb.join(",")}, ${alpha * 0.3})`);

          ctx.beginPath();
          ctx.moveTo(760, fl.y - 15);
          ctx.lineTo(760, fl.y + 15);
          ctx.lineTo(EYE_CENTER.x + 8, EYE_CENTER.y + 12);
          ctx.lineTo(EYE_CENTER.x + 8, EYE_CENTER.y - 12);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          // إشعاع الكشاف
          ctx.shadowColor = fl.color;
          ctx.shadowBlur = (fl.val / 100) * 20;
          ctx.strokeStyle = `rgba(${fl.rgb.join(",")}, ${alpha * 0.8})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // 6. رسم وتحديث جسيمات الضوء (Photons)
      particlesRef.current.forEach((p, idx) => {
        if (playing) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.008;
        }

        // إخفاء عند الوصول إلى العين
        if (p.x <= EYE_CENTER.x + 5) {
          p.life = 0;
          // توليد نبضة عصبية إلكترونية نحو الدماغ
          if (playing && Math.random() < 0.25) {
            nervePulsesRef.current.push({
              progress: 0,
              color: p.color,
              speed: 0.02 + Math.random() * 0.015,
            });
          }
        }

        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // 7. رسم الرأس والعين والدماغ
      drawHeadAndBrain(ctx, animTime, colorInfo, vMode);

      // 8. رسم النبضات العصبية داخل العصب البصري إلى الفص البصري في الدماغ
      drawNervePulses(ctx, playing, colorInfo);

      // 9. رسم الكشافات الثلاثة (RGB Flashlights)
      drawFlashlights(ctx, flashlights, animTime);

      // 10. رسم سحابة التفكير (Thought Bubble) واللون المدرَك
      drawThoughtCloud(ctx, colorInfo, animTime, vMode);

      rafRef.current = requestAnimationFrame(renderFrame);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ===== رسم الرأس والدماغ والعين ===== */
  function drawHeadAndBrain(ctx, t, colorInfo, vMode) {
    ctx.save();

    // ظلال خفيفة للرأس
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 15;

    // --- الصورة الظلية للرأس (Head Silhouette) ---
    ctx.beginPath();
    ctx.fillStyle = "#3A3F4D";
    // رسم منحنيات الوجه والرأس
    ctx.moveTo(HEAD_CENTER.x - 140, HEAD_CENTER.y + 200); // العنق من الخلف
    ctx.lineTo(HEAD_CENTER.x - 140, HEAD_CENTER.y - 100);
    ctx.quadraticCurveTo(HEAD_CENTER.x - 130, HEAD_CENTER.y - 200, HEAD_CENTER.x - 20, HEAD_CENTER.y - 210); // القمة
    ctx.quadraticCurveTo(HEAD_CENTER.x + 90, HEAD_CENTER.y - 200, HEAD_CENTER.x + 110, HEAD_CENTER.y - 100); // الجبهة
    ctx.quadraticCurveTo(HEAD_CENTER.x + 125, HEAD_CENTER.y - 40, HEAD_CENTER.x + 140, HEAD_CENTER.y - 10); // الأنف
    ctx.lineTo(HEAD_CENTER.x + 115, HEAD_CENTER.y + 10); // الفم
    ctx.quadraticCurveTo(HEAD_CENTER.x + 130, HEAD_CENTER.y + 40, HEAD_CENTER.x + 115, HEAD_CENTER.y + 70); // الذقن
    ctx.quadraticCurveTo(HEAD_CENTER.x + 40, HEAD_CENTER.y + 160, HEAD_CENTER.x + 40, HEAD_CENTER.y + 200); // العنق من الأمام
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // --- الدماغ التفصيلي (Brain & Visual Cortex) ---
    const brainX = HEAD_CENTER.x - 30;
    const brainY = HEAD_CENTER.y - 80;

    // تجويف الجمجمة الداخلي
    ctx.beginPath();
    ctx.ellipse(brainX, brainY, 95, 75, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#1E222D";
    ctx.fill();
    ctx.strokeStyle = "#4A5164";
    ctx.lineWidth = 3;
    ctx.stroke();

    // مادة الدماغ الوردي الفني
    ctx.beginPath();
    ctx.ellipse(brainX, brainY, 90, 70, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#E49AB0";
    ctx.fill();

    // تلافيف الدماغ (Sulci & Gyri)
    ctx.strokeStyle = "#A45C72";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const convolutions = [
      { start: [-60, -30], c1: [-40, -50], c2: [0, -50], end: [30, -30] },
      { start: [-70, 0], c1: [-40, -20], c2: [10, -10], end: [50, 0] },
      { start: [-55, 30], c1: [-30, 10], c2: [20, 20], end: [45, 25] },
      { start: [-30, -55], c1: [-10, -20], c2: [-10, 20], end: [-25, 45] },
      { start: [10, -55], c1: [25, -20], c2: [25, 20], end: [15, 45] },
    ];

    convolutions.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(brainX + c.start[0], brainY + c.start[1]);
      ctx.bezierCurveTo(
        brainX + c.c1[0],
        brainY + c.c1[1],
        brainX + c.c2[0],
        brainY + c.c2[1],
        brainX + c.end[0],
        brainY + c.end[1]
      );
      ctx.stroke();
    });

    // توهج الفص البصري الخلفي (Visual Cortex Glow) عند إدراك الألوان
    if (colorInfo.total > 15) {
      const vcX = brainX - 65;
      const vcY = brainY + 15;

      ctx.beginPath();
      ctx.arc(vcX, vcY, 22, 0, Math.PI * 2);
      ctx.fillStyle = colorInfo.hex;
      ctx.shadowColor = colorInfo.hex;
      ctx.shadowBlur = 25;
      ctx.globalAlpha = 0.65;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // نص توضيحي للفص البصري
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("الفص البصري", vcX, vcY + 34);
    }

    // --- العين والعدسة والشبكية (Eye, Lens & Retina) ---
    // حدقة العين والكرة
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

    // حدقة العين الداخلية (Pupil)
    ctx.beginPath();
    ctx.ellipse(EYE_CENTER.x + 10, EYE_CENTER.y, 2.5, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // الشبكية والخلايا المخروطية (Retina Back Wall)
    ctx.beginPath();
    ctx.arc(EYE_CENTER.x, EYE_CENTER.y, 18, Math.PI * 0.6, Math.PI * 1.4);
    ctx.strokeStyle = "#E74C3C"; // شبكية حمراء غنية بالشرايين
    ctx.lineWidth = 4;
    ctx.stroke();

    // --- العصب البصري (Optic Nerve Pathway) ---
    const vcX = brainX - 60;
    const vcY = brainY + 20;

    ctx.beginPath();
    ctx.moveTo(EYE_CENTER.x - 16, EYE_CENTER.y);
    ctx.quadraticCurveTo(EYE_CENTER.x - 70, EYE_CENTER.y + 10, vcX, vcY);
    ctx.strokeStyle = "#F1C40F"; // عصب بصري أصفر ممتد
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /* ===== رسم النبضات العصبية البصرية ===== */
  function drawNervePulses(ctx, playing, colorInfo) {
    if (colorInfo.total <= 15) return;

    const brainX = HEAD_CENTER.x - 30;
    const brainY = HEAD_CENTER.y - 80;
    const vcX = brainX - 60;
    const vcY = brainY + 20;

    nervePulsesRef.current.forEach((np) => {
      if (playing) np.progress += np.speed;

      if (np.progress <= 1) {
        // حساب الإحداثيات على طول المنحنى التكعيبي للعصب البصري
        const t = np.progress;
        const p0 = { x: EYE_CENTER.x - 16, y: EYE_CENTER.y };
        const p1 = { x: EYE_CENTER.x - 70, y: EYE_CENTER.y + 10 };
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

  /* ===== رسم الكشافات الثلاثة (RGB Flashlights) ===== */
  function drawFlashlights(ctx, flashlights, t) {
    flashlights.forEach((fl) => {
      const fx = 820;
      const fy = fl.y;

      ctx.save();

      // هيكل الكشاف المعدني الفاخر
      const bodyGrad = ctx.createLinearGradient(fx, fy - 22, fx, fy + 22);
      bodyGrad.addColorStop(0, "#6E778A");
      bodyGrad.addColorStop(0.5, "#A1A9BC");
      bodyGrad.addColorStop(1, "#485061");

      // مقبض الكشاف (Handle)
      ctx.beginPath();
      ctx.roundRect(fx, fy - 18, 120, 36, 6);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = "#2C3240";
      ctx.lineWidth = 2;
      ctx.stroke();

      // خطوط القبضة (Grip Texture)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 2;
      for (let gx = fx + 25; gx <= fx + 95; gx += 10) {
        ctx.beginPath();
        ctx.moveTo(gx, fy - 14);
        ctx.lineTo(gx, fy + 14);
        ctx.stroke();
      }

      // رأس الكشاف المخروطي (Head Cone)
      ctx.beginPath();
      ctx.moveTo(fx, fy - 20);
      ctx.lineTo(fx - 35, fy - 28);
      ctx.lineTo(fx - 35, fy + 28);
      ctx.lineTo(fx, fy + 20);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = "#2C3240";
      ctx.stroke();

      // عدسة الكشاف المضيئة (Lens Emission)
      ctx.beginPath();
      ctx.ellipse(fx - 35, fy, 5, 27, 0, 0, Math.PI * 2);
      if (fl.val > 0) {
        ctx.fillStyle = fl.color;
        ctx.shadowColor = fl.color;
        ctx.shadowBlur = (fl.val / 100) * 25;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#222733";
        ctx.fill();
      }
      ctx.strokeStyle = "#EAEFF9";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // اسم الكشاف والنسبة المؤية
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${fl.name} (${fl.val}%)`, fx + 60, fy + 5);

      ctx.restore();
    });
  }

  /* ===== رسم سحابة التفكير (Thought Cloud) ===== */
  function drawThoughtCloud(ctx, colorInfo, t, vMode) {
    const cloudX = HEAD_CENTER.x - 20;
    const cloudY = HEAD_CENTER.y - 200;

    // دوائر الفكّر الصغيرة المتصاعدة من الدماغ
    const bubbles = [
      { x: HEAD_CENTER.x - 10, y: HEAD_CENTER.y - 110, r: 8 },
      { x: HEAD_CENTER.x - 20, y: HEAD_CENTER.y - 130, r: 13 },
      { x: HEAD_CENTER.x - 25, y: HEAD_CENTER.y - 155, r: 19 },
    ];

    ctx.save();

    bubbles.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235, 240, 255, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "#4A5164";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // السحابة الرئيسية الكبيرة
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, 110, 55, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245, 247, 255, 0.96)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.strokeStyle = "#3B4254";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // إظهار اللون المدرك داخل سحابة التفكير
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY - 6, 85, 32, 0, 0, Math.PI * 2);
    ctx.fillStyle = colorInfo.hex;
    ctx.shadowColor = colorInfo.hex;
    ctx.shadowBlur = colorInfo.total > 15 ? 18 : 0;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // نص اللون واسمه بالعربية
    ctx.fillStyle = colorInfo.total > 380 ? "#111111" : "#FFFFFF";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(colorInfo.arabicName, cloudX, cloudY - 2);

    ctx.font = "11px monospace";
    ctx.fillText(colorInfo.hex.toUpperCase(), cloudX, cloudY + 16);

    ctx.restore();
  }

  return (
    <div className="color-scene-wrapper">
      <canvas
        ref={canvasRef}
        width={SCENE_W}
        height={SCENE_H}
        className="color-canvas"
      />
    </div>
  );
});

export default ColorScene;
