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
    StaticSound.stopFloat();
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

    // صوت الطيران: بالون مشحون حرّ في الهواء أثناء انجذابه
    let floatingNow = false;
    for (const b of sim.balloons) {
      if (!b.held && !b.stuck && b.grabbed.length > 0) floatingNow = true;
    }
    if (sound && floatingNow) StaticSound.startFloat();
    else StaticSound.stopFloat();

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
      // جذب نحو السترة: شحنة حقيقية صافية (تجاذب كولوم مباشر) — قويّة وتسقط
      // كـ ١/د². هذه القوّة هي المهيمنة فيزيائياً.
      const sy = CLAMP(b.y, SWEATER.y + 40, SWEATER.y + SWEATER.h - 40);
      const dsx = SWEATER_RIGHT - b.x;
      const dsy = sy - b.y;
      const ds = Math.hypot(dsx, dsy) + 1;
      const fS = Math.min(0.85, (q * 3000) / (ds * ds));
      ax += (dsx / ds) * fS;
      ay += (dsy / ds) * fS;
      // جذب نحو الجدار: شحنة مُستحَثّة (استقطاب) فقط — أضعف بكثير وتسقط أسرع
      // (١/د³)، فلا يفوز الجدار إلا حين يكون البالون ملاصقاً له تقريباً. هكذا
      // قد يكون البالون أقرب للجدار ومع ذلك ينجذب إلى السترة — وهو الصحيح فيزيائياً.
      if (wall) {
        const dwx = WALL.x - b.x;
        if (dwx > 0) {
          const dw = dwx + 1;
          const fW = Math.min(0.7, (q * 60000) / (dw * dw * dw));
          ax += fW;
          ay += (b.y < WALL.y + 40 ? 1 : b.y > WALL.y + WALL.h - 40 ? -1 : 0) * 0.04;
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
    const cx = x + w / 2;
    const inkColor = "#26190C";
    const inkWidth = 3;

    ctx.save();

    // 1. إسقاط ظل ناعم مجسّم خلف السترة الكاملة
    ctx.shadowColor = "rgba(30, 12, 0, 0.28)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 18;

    const neckY = y + 24;
    const collarRx = 58;
    const collarRy = 22;

    // --- 2. رسم الهيكل والمتنسق الرئيسي للسترة (Organic Knit Sweater Silhouette) ---
    ctx.beginPath();
    ctx.moveTo(cx - collarRx, neckY + 4);
    // كتف أيسر منسدل لطيف
    ctx.quadraticCurveTo(x + 20, y + 32, x - 26, y + 75);
    // كم أيسر انسيابي
    ctx.lineTo(x - 28, y + 238);
    // إسورة أكمام أيسر
    ctx.quadraticCurveTo(x - 6, y + 246, x + 16, y + 240);
    // خصر وجانب أيسر مائل لطيف
    ctx.quadraticCurveTo(x + 18, y + 160, x + 4, y + h - 22);
    // انحناءة حاشية السترة السفلية
    ctx.quadraticCurveTo(cx, y + h - 14, x + w - 4, y + h - 22);
    // خصر وجانب أيمن
    ctx.quadraticCurveTo(x + w - 18, y + 160, x + w - 16, y + 240);
    // إسورة أكمام أيمن
    ctx.quadraticCurveTo(x + w + 6, y + 246, x + w + 28, y + 238);
    // كم أيمن انسيابي
    ctx.lineTo(x + w + 26, y + 75);
    // كتف أيمن منسدل لطيف
    ctx.quadraticCurveTo(x + w - 20, y + 32, cx + collarRx, neckY + 4);
    // الانحناءة الخلفية للياقة
    ctx.quadraticCurveTo(cx, neckY - 14, cx - collarRx, neckY + 4);
    ctx.closePath();

    // لون السترة الصوفي الذهبي الدافئ الفاخر
    const bodyGrad = ctx.createLinearGradient(x - 20, y + 20, x + w + 20, y + h);
    bodyGrad.addColorStop(0, "#F7DC6F");
    bodyGrad.addColorStop(0.2, "#F5B041");
    bodyGrad.addColorStop(0.65, "#F39C12");
    bodyGrad.addColorStop(0.9, "#E67E22");
    bodyGrad.addColorStop(1, "#CA6F1E");
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // إيقاف الظل لرسم التفاصيل واللمعات
    ctx.shadowColor = "transparent";

    // إضاءة كروية ناعمة بمنتصف السترة تمنحها تجسيماً ثلاثي الأبعاد (3D Volume Highlight)
    const highlightGrad = ctx.createRadialGradient(cx, y + h * 0.45, 10, cx, y + h * 0.45, w * 0.65);
    highlightGrad.addColorStop(0, "rgba(255, 250, 220, 0.28)");
    highlightGrad.addColorStop(0.6, "rgba(255, 240, 190, 0.08)");
    highlightGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = highlightGrad;
    ctx.fill();

    // --- 3. فتحة الرقبة العميقة والبطانة الداكنة (Neck Hole Depth & Lining) ---
    ctx.beginPath();
    ctx.ellipse(cx, neckY + 4, collarRx - 4, collarRy - 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1E0D03";
    ctx.fill();

    // قماش القميص الداخلي بفتحة الرقبة
    ctx.beginPath();
    ctx.ellipse(cx, neckY + 8, collarRx - 14, collarRy - 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FAF5EB";
    ctx.fill();
    ctx.strokeStyle = "rgba(38, 25, 12, 0.2)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // بطاقة المقاس
    ctx.fillStyle = "#C0392B";
    roundRect(ctx, cx - 8, neckY + 7, 16, 9, 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 6.5px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("M", cx, neckY + 14);

    // --- 4. الياقة الصوفية المطوية المضلّعة (Ribbed Crew Neck Collar) ---
    ctx.beginPath();
    ctx.ellipse(cx, neckY + 5, collarRx + 4, collarRy + 4, 0, Math.PI * 0.04, Math.PI * 0.96);
    ctx.lineTo(cx - collarRx + 4, neckY + 3);
    ctx.quadraticCurveTo(cx, neckY + 23, cx + collarRx - 4, neckY + 3);
    ctx.closePath();

    const collarGrad = ctx.createLinearGradient(cx - collarRx, neckY, cx + collarRx, neckY + 25);
    collarGrad.addColorStop(0, "#D35400");
    collarGrad.addColorStop(0.5, "#E65100");
    collarGrad.addColorStop(1, "#A04000");
    ctx.fillStyle = collarGrad;
    ctx.fill();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.stroke();

    // خطوط تضليع الياقة
    ctx.strokeStyle = "rgba(255, 245, 220, 0.7)";
    ctx.lineWidth = 1.6;
    for (let a = 0.11; a <= 0.89; a += 0.075) {
      const angle = Math.PI * a;
      const inX = cx + Math.cos(angle) * (collarRx - 6);
      const inY = neckY + 4 + Math.sin(angle) * (collarRy - 6);
      const outX = cx + Math.cos(angle) * (collarRx + 4);
      const outY = neckY + 5 + Math.sin(angle) * (collarRy + 4);
      ctx.beginPath();
      ctx.moveTo(inX, inY);
      ctx.lineTo(outX, outY);
      ctx.stroke();
    }

    // --- 5. درزات الإبط والأكمام الصوفية المضلعة (Sleeve Seams & Ribbed Cuffs) ---
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;

    // درزات اتصال الأكمام (Armhole Seams)
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 42);
    ctx.quadraticCurveTo(x + 16, y + 110, x + 15, y + 165);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 20, y + 42);
    ctx.quadraticCurveTo(x + w - 16, y + 110, x + w - 15, y + 165);
    ctx.stroke();

    // أساور الأكمام المضلعة
    // كم أيسر
    ctx.beginPath();
    roundRect(ctx, x - 29, y + 236, 46, 18, 5);
    ctx.fillStyle = "#A04000";
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 235, 200, 0.55)";
    ctx.lineWidth = 1.5;
    for (let hx = x - 24; hx < x + 13; hx += 8) {
      ctx.beginPath();
      ctx.moveTo(hx, y + 237);
      ctx.lineTo(hx + 0.5, y + 253);
      ctx.stroke();
    }

    // كم أيمن
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.beginPath();
    roundRect(ctx, x + w - 17, y + 236, 46, 18, 5);
    ctx.fillStyle = "#A04000";
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 235, 200, 0.55)";
    ctx.lineWidth = 1.5;
    for (let hx = x + w - 12; hx < x + w + 25; hx += 8) {
      ctx.beginPath();
      ctx.moveTo(hx, y + 237);
      ctx.lineTo(hx + 0.5, y + 253);
      ctx.stroke();
    }

    // --- 6. حاشية السترة السفلية (Bottom Ribbed Hem) ---
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.beginPath();
    roundRect(ctx, x + 2, y + h - 24, w - 4, 24, 8);
    ctx.fillStyle = "#A04000";
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 235, 200, 0.55)";
    ctx.lineWidth = 1.6;
    for (let hx = x + 12; hx < x + w - 10; hx += 9.5) {
      ctx.beginPath();
      ctx.moveTo(hx, y + h - 23);
      ctx.lineTo(hx + 0.5, y + h - 2);
      ctx.stroke();
    }

    // --- 7. أشرطة الصوف الملونة المزدوجة (Dual Knitted Fair-Isle Accent Bands) ---
    ctx.save();
    ctx.clip(); // القص ضمن حدود شكل السترة

    // الشريط الصوفي العلوي (Emerald Band)
    ctx.fillStyle = "rgba(22, 160, 133, 0.88)";
    ctx.fillRect(x - 30, y + 115, w + 60, 34);

    ctx.strokeStyle = "rgba(244, 208, 63, 0.95)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let px = x - 20; px <= x + w + 20; px += 16) {
      ctx.moveTo(px, y + 121);
      ctx.lineTo(px + 8, y + 132);
      ctx.lineTo(px + 16, y + 121);
      ctx.moveTo(px, y + 143);
      ctx.lineTo(px + 8, y + 132);
      ctx.lineTo(px + 16, y + 143);
    }
    ctx.stroke();

    // الشريط الصوفي السفلي (Burgundy Accent Band)
    ctx.fillStyle = "rgba(144, 12, 63, 0.82)";
    ctx.fillRect(x - 30, y + h - 95, w + 60, 28);

    ctx.strokeStyle = "rgba(255, 240, 210, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = x - 20; px <= x + w + 20; px += 14) {
      ctx.moveTo(px, y + h - 90);
      ctx.lineTo(px + 7, y + h - 81);
      ctx.lineTo(px + 14, y + h - 90);
    }
    ctx.stroke();
    ctx.restore();

    // --- 8. غرز الصوف العمودية (Vertical Knitted Ribs & V-Stitches) ---
    for (let col = 0; col < 11; col++) {
      const rx = x + 24 + col * ((w - 48) / 10);
      ctx.beginPath();
      ctx.moveTo(rx, y + 55);
      for (let sy = y + 55; sy <= y + h - 30; sy += 18) {
        const offset = (col % 2 === 0 ? 1 : -1) * Math.sin((sy + col * 12) * 0.08) * 2.2;
        ctx.lineTo(rx + offset, sy);
      }
      ctx.strokeStyle = col % 2 === 0 ? "rgba(150, 50, 0, 0.28)" : "rgba(255, 240, 200, 0.35)";
      ctx.lineWidth = col % 2 === 0 ? 2 : 1.4;
      ctx.stroke();

      // غرز الصوف الصغير "v"
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
      ctx.lineWidth = 1.3;
      for (let sy = y + 70; sy <= y + h - 45; sy += 36) {
        ctx.beginPath();
        ctx.moveTo(rx - 3.5, sy - 3);
        ctx.lineTo(rx, sy + 3);
        ctx.lineTo(rx + 3.5, sy - 3);
        ctx.stroke();
      }
    }

    // --- 9. ثنيات وظلال الصوف الطبيعية (Soft Fabric Creases) ---
    ctx.strokeStyle = "rgba(80, 30, 0, 0.22)";
    ctx.lineWidth = 2;
    // ثنيات الإبطين
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 165);
    ctx.quadraticCurveTo(x + 48, y + 182, x + 68, y + 177);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 20, y + 165);
    ctx.quadraticCurveTo(x + w - 48, y + 182, x + w - 68, y + 177);
    ctx.stroke();

    // ثنية الانحناءة السفلية
    ctx.beginPath();
    ctx.moveTo(x + 35, y + h - 70);
    ctx.quadraticCurveTo(cx, y + h - 60, x + w - 35, y + h - 70);
    ctx.strokeStyle = "rgba(80, 30, 0, 0.16)";
    ctx.stroke();

    // --- 10. خطوط الحبر الخارجية لجسم السترة الكامل (Outer Ink Outlines) ---
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = inkWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(cx - collarRx, neckY + 4);
    ctx.quadraticCurveTo(x + 20, y + 32, x - 26, y + 75);
    ctx.lineTo(x - 28, y + 238);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + collarRx, neckY + 4);
    ctx.quadraticCurveTo(x + w - 20, y + 32, x + w + 26, y + 75);
    ctx.lineTo(x + w + 28, y + 238);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 4, y + h - 22);
    ctx.quadraticCurveTo(x + 18, y + 160, x + 16, y + 240);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - 4, y + h - 22);
    ctx.quadraticCurveTo(x + w - 18, y + 160, x + w - 16, y + 240);
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
    const bob = b.held || b.stuck ? 0 : Math.sin(sim_t() * 0.04 + b.bobPhase) * 4;
    const knotX = b.x;
    const knotY = b.y + bob + b.r * 1.12;
    // خيط أطول وأكثر واقعية: منحنى مزدوج (S) مع ترهّل بالجاذبية وتمايل حيّ
    const LEN = 158;
    const sway = Math.sin(sim_t() * 0.028 + b.swayPhase) * (b.stuck ? 5 : 20);
    const sway2 = Math.sin(sim_t() * 0.045 + b.swayPhase + 1) * (b.stuck ? 3 : 11);
    const endY = Math.min(SCENE_H - 6, knotY + LEN);
    const midY = knotY + LEN * 0.5;
    const c1x = knotX + sway * 0.5;
    const c2x = knotX + sway;
    const endX = knotX + sway2;
    ctx.save();
    ctx.strokeStyle = "rgba(60,62,72,0.6)";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(knotX, knotY);
    ctx.bezierCurveTo(c1x, midY - LEN * 0.18, c2x, midY + LEN * 0.14, endX, endY);
    ctx.stroke();
    // عقيصة صغيرة في نهاية الخيط
    ctx.fillStyle = "rgba(60,62,72,0.6)";
    ctx.beginPath();
    ctx.arc(endX, endY, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    ctx.shadowColor = "rgba(20,30,40,0.26)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    // تدرّج جسم البالون: فاتح أعلى-يسار إلى غامق أسفل-يمين لإحساس ثلاثي الأبعاد فاخر
    const g = ctx.createRadialGradient(cx - rx * 0.32, cy - ry * 0.42, ry * 0.12, cx, cy, ry * 1.15);
    g.addColorStop(0, b.light);
    g.addColorStop(0.45, b.color);
    g.addColorStop(1, b.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // حافة داخلية غامقة رقيقة تعطي حجماً وعمقاً
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 1, ry - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // عقدة
    ctx.fillStyle = b.dark;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy + ry * 0.99);
    ctx.lineTo(cx + 7, cy + ry * 0.99);
    ctx.lineTo(cx, cy + ry * 1.12);
    ctx.closePath();
    ctx.fill();

    // لمعان راقٍ: هلال ضوئي رفيع منحنٍ (لا بقعة بيضاء) — يُقصّ داخل البالون
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    const sheen = ctx.createLinearGradient(cx - rx, cy - ry, cx - rx * 0.1, cy - ry * 0.1);
    sheen.addColorStop(0, "rgba(255,255,255,0.42)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.36, cy - ry * 0.4, rx * 0.5, ry * 0.62, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // شحنات البالون: في وضع "الكل" يُظهر شحناته الذاتية المتوازنة (٣ موجبة
    // + ٣ سالبة) ثم أيّ إلكترونات مكتسبة إضافية (تجعله سالباً صافياً).
    if (mode === "all") {
      drawInherentCharges(ctx, cx, cy, rx, ry);
    }
    if (mode !== "none") {
      for (const m of b.grabbed) {
        drawCharge(ctx, m.x, m.y, "-", 1);
      }
    }
  }

  function drawInherentCharges(ctx, cx, cy, rx, ry) {
    // ٣ موجبة + ٣ سالبة ثابتة موزّعة بأناقة في أعلى البالون (متعادل تماماً)
    const plusPts = [
      [cx + rx * 0.34, cy - ry * 0.44],
      [cx - rx * 0.02, cy - ry * 0.52],
      [cx + rx * 0.44, cy - ry * 0.08],
    ];
    const minusPts = [
      [cx - rx * 0.4, cy - ry * 0.34],
      [cx - rx * 0.42, cy + ry * 0.06],
      [cx + rx * 0.16, cy - ry * 0.24],
    ];
    for (const [px, py] of plusPts) drawCharge(ctx, px, py, "+", 0.92);
    for (const [px, py] of minusPts) drawCharge(ctx, px, py, "-", 0.92);
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
      StaticSound.stopFloat();
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
