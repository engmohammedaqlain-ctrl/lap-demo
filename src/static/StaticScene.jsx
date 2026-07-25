/**
 * StaticScene.jsx — لوحة (canvas) تفاعلية عالية الحركة لتجربة الكهرباء
 * الساكنة. تُدار الفيزياء والرسم في حلقة requestAnimationFrame على مرجع
 * واحد (simRef) لأداء ٦٠ إطاراً/ثانية دون إعادة تصيير React. تتلقّى وضع
 * عرض الشحنات ووجود الجدار وعدد البالونات من الأعلى، وتُبلّغ حالة الدرس
 * الحيّة عبر onStatus لتحديث اللوحة التفسيرية.
 *
 * الفكرة العلمية: فرك البالون بالسترة ينقل إلكترونات (−) من السترة إليه،
 * فيصبح البالون سالباً والسترة موجبة، فينجذب البالون للسترة. وقرب الجدار
 * المتعادل، تتباعد إلكتروناته فيقترب سطحه الموجب فيلتصق به البالون.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SCENE_W,
  SCENE_H,
  SWEATER,
  WALL,
  BALLOON_SPECS,
  BALLOON_R,
  CHARGE,
  buildSweaterCharges,
  buildWallCharges,
  CLAMP,
} from "./staticData.js";
import { StaticSound } from "./staticAudio.js";

const SWEATER_RIGHT = SWEATER.x + SWEATER.w;

function makeBalloon(i) {
  const spec = BALLOON_SPECS[i];
  return {
    i,
    x: spec.start.x,
    y: spec.start.y,
    px: spec.start.x,
    py: spec.start.y,
    vx: 0,
    vy: 0,
    r: BALLOON_R,
    color: spec.color,
    dark: spec.dark,
    light: spec.light,
    held: false,
    stuck: null, // null | 'sweater' | 'wall'
    grabbed: [], // مراجع إلكترونات (من minus)
    stickFlash: 0,
    bobPhase: i * 1.7,
    swayPhase: i * 0.9,
  };
}

function makeSim(balloonCount) {
  const { plus, minus } = buildSweaterCharges();
  const balloons = [];
  for (let i = 0; i < balloonCount; i++) balloons.push(makeBalloon(i));
  return {
    plus,
    minus,
    wall: buildWallCharges(),
    balloons,
    sparks: [],
    t: 0,
  };
}

const StaticScene = forwardRef(function StaticScene(
  { displayMode, wallOn, balloonCount, soundEnabled, onStatus },
  ref
) {
  const canvasRef = useRef(null);
  const simRef = useRef(makeSim(balloonCount));
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const dragRef = useRef(null); // {balloon, dx, dy}

  // مرايا للـ props تُقرأ داخل الحلقة دون إعادة تشغيلها
  const propsRef = useRef({ displayMode, wallOn, balloonCount, soundEnabled, onStatus });
  propsRef.current = { displayMode, wallOn, balloonCount, soundEnabled, onStatus };
  const statusSigRef = useRef("");

  /* ===== إعادة الضبط ===== */
  const reset = () => {
    const count = propsRef.current.balloonCount;
    simRef.current = makeSim(count);
    StaticSound.stopRub();
    emitStatus(true);
  };
  useImperativeHandle(ref, () => ({ reset }));

  /* ===== توليد شرارات ===== */
  function spawnSparks(x, y, n, hue) {
    const sp = simRef.current.sparks;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 2.4;
      sp.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 0.6,
        life: 1,
        max: 22 + Math.random() * 14,
        age: 0,
        hue,
      });
    }
  }

  /* ===== حالة الدرس للّوحة التفسيرية ===== */
  function emitStatus(force) {
    const sim = simRef.current;
    const { onStatus: cb } = propsRef.current;
    let charge = 0;
    let phase = "neutral";
    let anyRub = false;
    let stuckSweater = false;
    let stuckWall = false;
    let attracting = false;
    for (const b of sim.balloons) {
      charge = Math.max(charge, b.grabbed.length);
      if (b.held && b._rubbing) anyRub = true;
      if (b.stuck === "sweater") stuckSweater = true;
      if (b.stuck === "wall") stuckWall = true;
      if (!b.held && !b.stuck && b.grabbed.length > 0) attracting = true;
    }
    if (anyRub) phase = "rubbing";
    else if (stuckWall) phase = "stuckWall";
    else if (stuckSweater) phase = "stuckSweater";
    else if (attracting) phase = "attracting";
    else if (charge > 0) phase = "charged";
    else phase = "neutral";
    const sig = `${phase}:${charge}`;
    if (!force && sig === statusSigRef.current) return;
    statusSigRef.current = sig;
    cb && cb({ phase, charge });
  }

  /* ===== الفيزياء ===== */
  function step(dt) {
    const sim = simRef.current;
    const { wallOn: wall, soundEnabled: sound } = propsRef.current;
    sim.t += dt;
    let rubbingNow = false;

    for (const b of sim.balloons) {
      b._rubbing = false;
      if (b.held) {
        // السرعة من فرق الموضع (للكشف عن الفرك)
        const speed = Math.hypot(b.x - b.px, b.y - b.py);
        const overSweater =
          b.x - b.r * 0.5 < SWEATER_RIGHT &&
          b.x > SWEATER.x - 20 &&
          b.y > SWEATER.y - 30 &&
          b.y < SWEATER.y + SWEATER.h + 30;
        if (overSweater && speed > 1.4) {
          b._rubbing = true;
          rubbingNow = true;
          grabElectron(b, sound);
        }
        b.px = b.x;
        b.py = b.y;
      } else if (b.stuck) {
        // ملتصق: اهتزاز ساكن طفيف
        b.stickFlash = Math.max(0, b.stickFlash - dt);
      } else {
        applyForces(b, wall, dt);
      }
    }

    // إلكترونات مسحوبة تتبع بالونها بنابض
    for (const m of sim.minus) {
      if (m.owner == null) continue;
      const b = sim.balloons[m.owner];
      if (!b) {
        m.owner = null;
        continue;
      }
      const tx = b.x + m.ox;
      const ty = b.y + m.oy;
      m.vx += (tx - m.x) * 0.22;
      m.vy += (ty - m.y) * 0.22;
      m.vx *= 0.72;
      m.vy *= 0.72;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }

    // استقطاب الجدار: إزاحة الإلكترونات بعيداً عن أقرب بالون سالب
    for (const row of sim.wall) {
      let infl = 0;
      for (const b of sim.balloons) {
        const q = b.grabbed.length;
        if (q <= 0) continue;
        const dx = row.minusHome.x - b.x;
        if (dx < 0) continue; // البالون يمين الجدار؟ تجاهل
        const dy = row.minusHome.y - b.y;
        const d = Math.hypot(dx, dy) + 1;
        infl = Math.max(infl, CLAMP((q * 26) / d, 0, 1));
      }
      const targetX = row.minusHome.x + infl * 12;
      row.minus.x += (targetX - row.minus.x) * 0.15 * dt;
      row._plusShift = infl; // لتوهّج السطح الموجب
    }

    // شرارات
    for (let k = sim.sparks.length - 1; k >= 0; k--) {
      const s = sim.sparks[k];
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 0.05 * dt;
      s.vx *= 0.96;
      s.life = 1 - s.age / s.max;
      if (s.life <= 0) sim.sparks.splice(k, 1);
    }

    // صوت الفرك
    if (sound && rubbingNow) StaticSound.startRub();
    else StaticSound.stopRub();

    emitStatus(false);
  }

  function grabElectron(b, sound) {
    const sim = simRef.current;
    // فترة بين عمليات السحب حتى تبدو تدريجية
    b._grabT = (b._grabT || 0) + 1;
    if (b._grabT < 5) return;
    b._grabT = 0;
    // أقرب إلكترون حرّ على السترة ضمن نطاق البالون
    let best = null;
    let bestD = (b.r + 26) * (b.r + 26);
    for (const m of sim.minus) {
      if (m.owner != null) continue;
      const dx = m.x - b.x;
      const dy = m.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = m;
      }
    }
    if (!best) return;
    best.owner = b.i;
    const gi = b.grabbed.length;
    // ترتيب أنيق داخل النصف السفلي للبالون
    const perRow = 4;
    const rr = Math.floor(gi / perRow);
    const cc = gi % perRow;
    best.ox = -24 + cc * 16;
    best.oy = 2 + rr * 15;
    b.grabbed.push(best);
    spawnSparks(best.x, best.y, 5, "elec");
    if (sound) StaticSound.playZap();
  }

  function applyForces(b, wall, dt) {
    const q = b.grabbed.length;
    if (q === 0) {
      // متعادل: يبقى مكانه (لا قوة صافية) ويهدأ تدريجياً — سلوك متوقّع للطالب
      b.vx *= 0.85;
      b.vy *= 0.85;
    } else {
      let ax = 0;
      let ay = 0;
      // جذب نحو السترة (سطحها الأيمن). سقوط ١/د² حادّ حتى يفوز الأقرب —
      // وإلا تساوت القوّتان عند السقف فتلاشى الصافي وتجمّد البالون.
      const sy = CLAMP(b.y, SWEATER.y + 40, SWEATER.y + SWEATER.h - 40);
      const dsx = SWEATER_RIGHT - b.x;
      const dsy = sy - b.y;
      const ds = Math.hypot(dsx, dsy) + 1;
      const fS = Math.min(0.85, (q * 1400) / (ds * ds));
      ax += (dsx / ds) * fS;
      ay += (dsy / ds) * fS;
      // جذب نحو الجدار
      if (wall) {
        const dwx = WALL.x - b.x;
        if (dwx > 0) {
          const dw = dwx + 1;
          const fW = Math.min(0.85, (q * 1300) / (dw * dw));
          ax += fW;
          ay += (b.y < WALL.y + 40 ? 1 : b.y > WALL.y + WALL.h - 40 ? -1 : 0) * 0.05;
        }
      }
      b.vx += ax * dt;
      b.vy += ay * dt;
      b.vx *= 0.9;
      b.vy *= 0.9;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // حدود المشهد
    b.x = CLAMP(b.x, b.r * 0.5, SCENE_W - b.r * 0.5);
    b.y = CLAMP(b.y, b.r + 8, SCENE_H - b.r * 0.6);

    // التصاق بالسترة
    if (q > 0 && b.x - b.r * 0.55 <= SWEATER_RIGHT && b.y < SWEATER.y + SWEATER.h && b.y > SWEATER.y) {
      b.x = SWEATER_RIGHT + b.r * 0.5;
      b.vx = 0;
      b.vy = 0;
      setStuck(b, "sweater");
    }
    // التصاق بالجدار
    if (wall && q > 0 && b.x + b.r * 0.55 >= WALL.x) {
      b.x = WALL.x - b.r * 0.5;
      b.vx = 0;
      b.vy = 0;
      setStuck(b, "wall");
    }
  }

  function setStuck(b, where) {
    if (b.stuck === where) return;
    b.stuck = where;
    b.stickFlash = 16;
    spawnSparks(b.x + (where === "wall" ? b.r * 0.5 : -b.r * 0.5), b.y, 14, "bolt");
    if (propsRef.current.soundEnabled) StaticSound.playStick();
  }

  function sim_t() {
    return simRef.current.t;
  }

  /* ===== الرسم ===== */
  function render(ctx) {
    const sim = simRef.current;
    const { displayMode: mode, wallOn: wall } = propsRef.current;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    drawBackdrop(ctx);
    drawSweater(ctx, sim, mode);
    if (wall) drawWall(ctx, sim, mode);
    for (const b of sim.balloons) drawBalloonString(ctx, b);
    for (const b of sim.balloons) drawBalloon(ctx, b, mode);
    drawSparks(ctx, sim);
  }

  function drawBackdrop(ctx) {
    // جوّ ناعم: أعلى فاتح إلى أرضية دافئة، مع خط أفق لطيف
    const g = ctx.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, "#eef6fc");
    g.addColorStop(0.7, "#f6fbfe");
    g.addColorStop(1, "#eaf3ee");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    // أرضية
    ctx.fillStyle = "rgba(120,150,120,0.10)";
    ctx.fillRect(0, SCENE_H - 46, SCENE_W, 46);
    ctx.strokeStyle = "rgba(90,120,95,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, SCENE_H - 46);
    ctx.lineTo(SCENE_W, SCENE_H - 46);
    ctx.stroke();
  }

  function drawSweater(ctx, sim, mode) {
    const { x, y, w, h } = SWEATER;
    ctx.save();

    // 1. ظل ناعم ممتد تحت السترة
    ctx.shadowColor = "rgba(45, 30, 15, 0.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;

    // أسلوب الخط المرسوم بالحبر (Hand-drawn Ink Outline)
    const inkColor = "#3E3023";
    const inkWidth = 3;

    // --- الكم الأيسر (Left Sleeve) ---
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 60);
    ctx.quadraticCurveTo(x - 22, y + 70, x - 32, y + 120);
    ctx.lineTo(x - 32, y + 240);
    ctx.quadraticCurveTo(x - 10, y + 246, x + 15, y + 242);
    ctx.lineTo(x + 20, y + 170);
    ctx.closePath();

    const sleeveGradL = ctx.createLinearGradient(x - 35, y + 60, x + 20, y + 240);
    sleeveGradL.addColorStop(0, "#D9C9AD");
    sleeveGradL.addColorStop(1, "#C7B496");
    ctx.fillStyle = sleeveGradL;
    ctx.fill();

    // إسورة الكم الأيسر (Left Sleeve Ribbed Cuff)
    ctx.beginPath();
    ctx.moveTo(x - 33, y + 240);
    ctx.lineTo(x - 34, y + 258);
    ctx.quadraticCurveTo(x - 9, y + 264, x + 16, y + 260);
    ctx.lineTo(x + 15, y + 242);
    ctx.closePath();
    ctx.fillStyle = "#BAA78A";
    ctx.fill();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.stroke();

    // خطوط الحياكة على إسورة الكم
    ctx.strokeStyle = "rgba(62, 48, 35, 0.4)";
    ctx.lineWidth = 1.8;
    for (let c = 0; c <= 4; c++) {
      const cx = x - 28 + c * 10;
      ctx.beginPath();
      ctx.moveTo(cx, y + 241);
      ctx.lineTo(cx + 1, y + 258);
      ctx.stroke();
    }

    // الحدود الخارجية للكم الأيسر (Hand-drawn Ink Stroke)
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 62);
    ctx.quadraticCurveTo(x - 22, y + 70, x - 32, y + 120);
    ctx.lineTo(x - 32, y + 240);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 16, y + 242);
    ctx.quadraticCurveTo(x + 18, y + 200, x + 19, y + 172);
    ctx.stroke();

    // --- الكم الأيمن (Right Sleeve) ---
    ctx.beginPath();
    ctx.moveTo(x + w - 20, y + 60);
    ctx.quadraticCurveTo(x + w + 22, y + 70, x + w + 32, y + 120);
    ctx.lineTo(x + w + 32, y + 240);
    ctx.quadraticCurveTo(x + w + 10, y + 246, x + w - 15, y + 242);
    ctx.lineTo(x + w - 20, y + 170);
    ctx.closePath();

    const sleeveGradR = ctx.createLinearGradient(x + w - 20, y + 60, x + w + 35, y + 240);
    sleeveGradR.addColorStop(0, "#D9C9AD");
    sleeveGradR.addColorStop(1, "#C7B496");
    ctx.fillStyle = sleeveGradR;
    ctx.fill();

    // إسورة الكم الأيمن (Right Sleeve Ribbed Cuff)
    ctx.beginPath();
    ctx.moveTo(x + w + 33, y + 240);
    ctx.lineTo(x + w + 34, y + 258);
    ctx.quadraticCurveTo(x + w + 9, y + 264, x + w - 16, y + 260);
    ctx.lineTo(x + w - 15, y + 242);
    ctx.closePath();
    ctx.fillStyle = "#BAA78A";
    ctx.fill();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.stroke();

    // خطوط الحياكة على إسورة الكم
    ctx.strokeStyle = "rgba(62, 48, 35, 0.4)";
    ctx.lineWidth = 1.8;
    for (let c = 0; c <= 4; c++) {
      const cx = x + w - 10 + c * 10;
      ctx.beginPath();
      ctx.moveTo(cx, y + 241);
      ctx.lineTo(cx + 1, y + 258);
      ctx.stroke();
    }

    // الحدود الخارجية للكم الأيمن
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.beginPath();
    ctx.moveTo(x + w - 18, y + 62);
    ctx.quadraticCurveTo(x + w + 22, y + 70, x + w + 32, y + 120);
    ctx.lineTo(x + w + 32, y + 240);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 16, y + 242);
    ctx.quadraticCurveTo(x + w - 18, y + 200, x + w - 19, y + 172);
    ctx.stroke();

    // --- جسم السترة (Main Sweater Torso) ---
    ctx.beginPath();
    ctx.moveTo(x + 45, y + 36);
    ctx.quadraticCurveTo(x + w / 2, y + 52, x + w - 45, y + 36);
    ctx.quadraticCurveTo(x + w - 12, y + 42, x + w, y + 75);
    ctx.quadraticCurveTo(x + w + 6, y + 220, x + w, y + h - 22);
    ctx.quadraticCurveTo(x + w / 2, y + h - 18, x, y + h - 22);
    ctx.quadraticCurveTo(x - 6, y + 220, x, y + 75);
    ctx.quadraticCurveTo(x + 12, y + 42, x + 45, y + 36);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(x, y + 30, x, y + h);
    bodyGrad.addColorStop(0, "#DFCFB3");
    bodyGrad.addColorStop(0.5, "#D5C3A5");
    bodyGrad.addColorStop(1, "#C4B294");
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // إيقاف الظل لرسم التفاصيل
    ctx.shadowColor = "transparent";

    // --- نسيج الصوف المرسوم (Hand-Drawn Knitted Ribs & Stitches) ---
    for (let col = 0; col < 11; col++) {
      const rx = x + 24 + col * ((w - 48) / 10);
      ctx.beginPath();
      ctx.moveTo(rx, y + 60);
      for (let sy = y + 60; sy <= y + h - 30; sy += 18) {
        const offset = (col % 2 === 0 ? 1 : -1) * Math.sin((sy + col * 12) * 0.08) * 2.5;
        ctx.lineTo(rx + offset, sy);
      }
      ctx.strokeStyle = col % 2 === 0 ? "rgba(168, 150, 122, 0.45)" : "rgba(235, 222, 200, 0.4)";
      ctx.lineWidth = col % 2 === 0 ? 2.2 : 1.5;
      ctx.stroke();

      // غرز الصوف الصغيرة "v" على امتداد الأضلاع
      ctx.strokeStyle = "rgba(145, 128, 102, 0.35)";
      ctx.lineWidth = 1.4;
      for (let sy = y + 80; sy <= y + h - 45; sy += 36) {
        ctx.beginPath();
        ctx.moveTo(rx - 4, sy - 3);
        ctx.lineTo(rx, sy + 3);
        ctx.lineTo(rx + 4, sy - 3);
        ctx.stroke();
      }
    }

    // --- ثنيات وتغضّنات القماش الفنية (Illustration Creases) ---
    ctx.strokeStyle = "rgba(75, 58, 40, 0.22)";
    ctx.lineWidth = 2;
    // ثنية الإبط الأيسر
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 165);
    ctx.quadraticCurveTo(x + 45, y + 185, x + 65, y + 180);
    ctx.stroke();
    // ثنية الإبط الأيمن
    ctx.beginPath();
    ctx.moveTo(x + w - 15, y + 165);
    ctx.quadraticCurveTo(x + w - 45, y + 185, x + w - 65, y + 180);
    ctx.stroke();
    // انحناءة الخصر
    ctx.beginPath();
    ctx.moveTo(x + 35, y + h - 85);
    ctx.quadraticCurveTo(x + w / 2, y + h - 75, x + w - 35, y + h - 85);
    ctx.strokeStyle = "rgba(75, 58, 40, 0.15)";
    ctx.stroke();

    // --- الياقة الداخلية وفتحة الرقبة (Inner Neck & Collar) ---
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 36, w * 0.23, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4A3B2C";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 40, w * 0.2, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#F5EFE3";
    ctx.fill();

    // بطاقة المقاس (Tag)
    ctx.fillStyle = "#D35400";
    ctx.fillRect(x + w / 2 - 8, y + 42, 16, 10);
    ctx.fillStyle = "#FFF";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("M", x + w / 2, y + 49);

    // الياقة المحبوكة الخارجية
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 36, w * 0.25, 26, 0, 0, Math.PI);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 36, w * 0.26, 28, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.fillStyle = "#C8B699";
    ctx.fill();
    ctx.stroke();

    // خطوط الياقة
    ctx.strokeStyle = "rgba(62, 48, 35, 0.4)";
    ctx.lineWidth = 1.6;
    for (let a = 0.2; a < 0.85; a += 0.08) {
      const angle = Math.PI * a;
      const cx1 = x + w / 2 + Math.cos(angle) * (w * 0.2);
      const cy1 = y + 36 + Math.sin(angle) * 20;
      const cx2 = x + w / 2 + Math.cos(angle) * (w * 0.26);
      const cy2 = y + 36 + Math.sin(angle) * 28;
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }

    // --- الحواشي السفلية الصوفية (Bottom Ribbed Hem) ---
    ctx.beginPath();
    roundRect(ctx, x - 2, y + h - 24, w + 4, 24, 8);
    ctx.fillStyle = "#BDAB8E";
    ctx.fill();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.stroke();

    // خطوط الحواشي السفلية العمودية
    ctx.strokeStyle = "rgba(62, 48, 35, 0.4)";
    ctx.lineWidth = 1.8;
    for (let hx = x + 6; hx < x + w - 4; hx += 10) {
      ctx.beginPath();
      ctx.moveTo(hx, y + h - 23);
      ctx.lineTo(hx + 0.5, y + h - 2);
      ctx.stroke();
    }

    // --- خطوط الحبر الخارجية لجسم السترة ---
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(x + 45, y + 36);
    ctx.quadraticCurveTo(x + 12, y + 42, x, y + 75);
    ctx.quadraticCurveTo(x - 6, y + 220, x, y + h - 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 45, y + 36);
    ctx.quadraticCurveTo(x + w - 12, y + 42, x + w, y + 75);
    ctx.quadraticCurveTo(x + w + 6, y + 220, x + w, y + h - 24);
    ctx.stroke();

    // خطوط تعبيرية مرسومة في الزوايا
    ctx.strokeStyle = "rgba(62, 48, 35, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 78);
    ctx.quadraticCurveTo(x + 2, y + 215, x + 6, y + h - 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 16, y + 78);
    ctx.quadraticCurveTo(x + w - 2, y + 215, x + w - 6, y + h - 30);
    ctx.stroke();

    ctx.restore();

    // الشحنات
    for (let i = 0; i < sim.plus.length; i++) {
      const p = sim.plus[i];
      const m = sim.minus[i];
      const removed = m.owner != null;
      if (mode === "none") continue;
      if (mode === "diff") {
        // أظهر فقط الشحنة الموجبة الصافية (حيث غادر الإلكترون)
        if (removed) drawCharge(ctx, p.x + 9, p.y, "+", 1);
        continue;
      }
      // all
      drawCharge(ctx, p.x, p.y, "+", 1);
      if (m.owner == null) drawCharge(ctx, m.x, m.y, "-", 1);
    }
  }

  function drawWall(ctx, sim, mode) {
    const { x, y, w, h } = WALL;
    ctx.save();
    ctx.shadowColor = "rgba(30,50,40,0.14)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = -6;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#dfe7ee");
    g.addColorStop(1, "#c4d0da");
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.shadowColor = "transparent";
    // خطوط ألواح خفيفة
    ctx.strokeStyle = "rgba(120,140,155,0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < WALL.h / 60; i++) {
      const ly = y + i * 60;
      ctx.beginPath();
      ctx.moveTo(x + 4, ly);
      ctx.lineTo(x + w - 4, ly);
      ctx.stroke();
    }
    ctx.restore();

    if (mode === "none") return;
    for (const row of sim.wall) {
      if (mode === "diff") {
        // الجدار متعادل؛ في وضع "الفرق" يظهر الاستقطاب فقط إن كان مؤثراً
        if (row._plusShift > 0.08) {
          drawCharge(ctx, row.plus.x, row.plus.y, "+", 0.55 + row._plusShift * 0.45);
        }
        continue;
      }
      drawCharge(ctx, row.plus.x, row.plus.y, "+", 1);
      drawCharge(ctx, row.minus.x, row.minus.y, "-", 1);
    }
  }

  function drawBalloonString(ctx, b) {
    const knotX = b.x;
    const knotY = b.y + b.r * 1.02;
    const sway = Math.sin(sim_t() * 0.03 + b.swayPhase) * (b.stuck ? 4 : 14);
    const endX = knotX + sway;
    const endY = Math.min(SCENE_H - 8, knotY + 92);
    ctx.strokeStyle = "rgba(70,70,80,0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(knotX, knotY);
    ctx.quadraticCurveTo(knotX + sway * 0.6, (knotY + endY) / 2, endX, endY);
    ctx.stroke();
  }

  function drawBalloon(ctx, b, mode) {
    const bob = b.held || b.stuck ? 0 : Math.sin(sim_t() * 0.04 + b.bobPhase) * 4;
    const cx = b.x;
    const cy = b.y + bob;
    const rx = b.r * 0.9;
    const ry = b.r;

    // وهج التصاق (برق)
    if (b.stickFlash > 0 && b.stuck) {
      drawLightning(ctx, b);
    }

    ctx.save();
    ctx.shadowColor = "rgba(20,30,40,0.22)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    const g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, ry * 0.15, cx, cy, ry * 1.1);
    g.addColorStop(0, b.light);
    g.addColorStop(0.5, b.color);
    g.addColorStop(1, b.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // عقدة
    ctx.fillStyle = b.dark;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy + ry * 0.99);
    ctx.lineTo(cx + 7, cy + ry * 0.99);
    ctx.lineTo(cx, cy + ry * 1.12);
    ctx.closePath();
    ctx.fill();

    // لمعان زجاجي
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.34, cy - ry * 0.4, rx * 0.22, ry * 0.32, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.05, cy - ry * 0.15, rx * 0.1, ry * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // شحنات البالون (الإلكترونات المكتسبة) + موجباته الذاتية في وضع all
    if (mode !== "none") {
      const q = b.grabbed.length;
      if (mode === "all") {
        // موجبات ذاتية ثابتة (متوازنة مع سالبه الأصلي) — تُرسم كنقاط خفيفة
        drawInherentPlus(ctx, cx, cy, rx, ry);
      }
      for (const m of b.grabbed) {
        drawCharge(ctx, m.x, m.y - (b.held || b.stuck ? 0 : 0), "-", 1);
      }
      // في وضع "الفرق": الإلكترونات المكتسبة تُظهر الشحنة السالبة الصافية (مرسومة أصلاً)
      void q;
    }
  }

  function drawInherentPlus(ctx, cx, cy, rx, ry) {
    // ثلاث موجبات ذاتية موزّعة أعلى البالون (زينة توضيحية ثابتة)
    const pts = [
      [cx + rx * 0.32, cy - ry * 0.28],
      [cx + rx * 0.1, cy + ry * 0.34],
      [cx - rx * 0.34, cy + ry * 0.12],
    ];
    for (const [px, py] of pts) drawCharge(ctx, px, py, "+", 0.85);
  }

  function drawCharge(ctx, x, y, sign, alpha) {
    const r = CHARGE.r;
    const isPlus = sign === "+";
    ctx.save();
    ctx.globalAlpha = alpha;
    // هالة ناعمة
    const halo = ctx.createRadialGradient(x, y, 1, x, y, r * 1.9);
    halo.addColorStop(0, isPlus ? "rgba(217,59,59,0.35)" : "rgba(47,111,176,0.35)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    // القرص
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, isPlus ? "#ff6b6b" : "#5a9bd8");
    g.addColorStop(1, isPlus ? CHARGE.plusDark : CHARGE.minusDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // العلامة
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y);
    ctx.lineTo(x + r * 0.5, y);
    if (isPlus) {
      ctx.moveTo(x, y - r * 0.5);
      ctx.lineTo(x, y + r * 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLightning(ctx, b) {
    const x0 = b.x + (b.stuck === "wall" ? b.r * 0.5 : -b.r * 0.5);
    const y0 = b.y;
    const x1 = b.stuck === "wall" ? WALL.x : SWEATER_RIGHT;
    const seg = 5;
    ctx.save();
    ctx.strokeStyle = `rgba(255,238,140,${CLAMP(b.stickFlash / 16, 0, 1)})`;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = "rgba(255,220,80,0.9)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i <= seg; i++) {
      const tx = x0 + ((x1 - x0) * i) / seg;
      const ty = y0 + (Math.random() - 0.5) * 22;
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSparks(ctx, sim) {
    for (const s of sim.sparks) {
      const a = CLAMP(s.life, 0, 1);
      if (s.hue === "bolt") {
        ctx.fillStyle = `rgba(255,220,90,${a})`;
      } else {
        ctx.fillStyle = `rgba(90,155,216,${a})`;
      }
      const rad = 1.5 + a * 2.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SCENE_W * dpr;
    canvas.height = SCENE_H * dpr;
    ctx.scale(dpr, dpr);

    const loop = (ts) => {
      const last = lastTsRef.current || ts;
      const dt = CLAMP((ts - last) / 16.667, 0, 2.5);
      lastTsRef.current = ts;
      step(dt);
      render(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    emitStatus(true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      StaticSound.stopRub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== توفيق عدد البالونات ===== */
  useEffect(() => {
    const sim = simRef.current;
    if (balloonCount === sim.balloons.length) return;
    if (balloonCount > sim.balloons.length) {
      sim.balloons.push(makeBalloon(sim.balloons.length));
    } else {
      // أزل البالون الأخير وأعد إلكتروناته إلى السترة
      const removed = sim.balloons.pop();
      for (const m of sim.minus) {
        if (m.owner === removed.i) {
          m.owner = null;
          m.x = m.homeX;
          m.y = m.homeY;
          m.vx = m.vy = 0;
        }
      }
    }
    emitStatus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balloonCount]);

  /* ===== إزالة الجدار تُحرّر بالوناً ملتصقاً به ===== */
  useEffect(() => {
    if (wallOn) return;
    for (const b of simRef.current.balloons) {
      if (b.stuck === "wall") {
        b.stuck = null;
        b.vx = -1.5;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallOn]);

  /* ===== كتم الصوت ===== */
  useEffect(() => {
    StaticSound.setMuted(!soundEnabled);
  }, [soundEnabled]);

  /* ===== تفاعل السحب ===== */
  function toLocal(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SCENE_W;
    const y = ((e.clientY - rect.top) / rect.height) * SCENE_H;
    return { x, y };
  }

  function onPointerDown(e) {
    const { x, y } = toLocal(e);
    const sim = simRef.current;
    // اختر أقرب بالون تحت المؤشّر
    let picked = null;
    for (const b of sim.balloons) {
      const dx = (x - b.x) / (b.r * 0.9);
      const dy = (y - b.y) / b.r;
      if (dx * dx + dy * dy <= 1.15) picked = b;
    }
    if (!picked) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    picked.held = true;
    picked.stuck = null;
    picked.vx = picked.vy = 0;
    picked.px = picked.x;
    picked.py = picked.y;
    dragRef.current = { b: picked, dx: x - picked.x, dy: y - picked.y };
    if (propsRef.current.soundEnabled) StaticSound.playClick();
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = toLocal(e);
    drag.b.x = CLAMP(x - drag.dx, drag.b.r * 0.5, SCENE_W - drag.b.r * 0.5);
    drag.b.y = CLAMP(y - drag.dy, drag.b.r + 8, SCENE_H - drag.b.r * 0.6);
  }

  function onPointerUp(e) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.b.held = false;
    dragRef.current = null;
    StaticSound.stopRub();
    if (drag.b.grabbed.length > 0 && propsRef.current.soundEnabled) StaticSound.playWhoosh();
    try {
      canvasRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="st-canvas"
      style={{ aspectRatio: `${SCENE_W} / ${SCENE_H}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
});

export default StaticScene;
