/**
 * BanfoushEyes.jsx — عينا بنفوش الحيّتان: طبقة SVG فوق صورة الوحش بنفس
 * إحداثياتها (489×413) ترسم بياض العين وبؤبؤاً جديداً يلاحق مؤشر الفأرة
 * أو اللمس، يرمش من وقت لآخر، ويتغيّر مع المزاج (يفكّر، ينعس، يندهش).
 */
import { useEffect, useId, useRef } from "react";
import { useBf } from "./store.js";

const VB = { w: 489, h: 413 };
// مراكز بياض العينين في الصورة الأصلية (مائلة ٢٠°) + وضع الراحة ومدى الحركة
const EYES = [
  { cx: 182, cy: 159, rx: 41, ry: 45, rest: [10, 6], max: [17, 21] },
  { cx: 282, cy: 170, rx: 41, ry: 48, rest: [-9, 6], max: [17, 24] },
];
const TILT = 20;

export default function BanfoushEyes() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svg = useRef(null);
  const pupils = useRef([]);
  const kickRef = useRef(() => {});
  const mood = useBf((s) => s.mood);
  const talk = useBf((s) => s.talk);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  // ملاحقة المؤشر بحركة ناعمة (rAF فقط أثناء الحركة)
  useEffect(() => {
    let raf = 0;
    let target = null;
    const cur = EYES.map((e) => [...e.rest]);
    const step = () => {
      raf = 0;
      const el = svg.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const k = Math.min(r.width / VB.w, r.height / VB.h) || 1;
      const ox = r.left + (r.width - VB.w * k) / 2;
      const oy = r.top + (r.height - VB.h * k) / 2;
      let moving = false;
      EYES.forEach((e, i) => {
        let [tx, ty] = e.rest;
        const m = moodRef.current;
        if (m === "think") [tx, ty] = [-12, -17];
        else if (m === "sleepy") [tx, ty] = [0, 15];
        else if (target) {
          const dx = target[0] - (ox + e.cx * k);
          const dy = target[1] - (oy + e.cy * k);
          const d = Math.hypot(dx, dy) || 1;
          const f = Math.min(1, d / 240);
          tx = (dx / d) * e.max[0] * f;
          ty = (dy / d) * e.max[1] * f;
        }
        const c = cur[i];
        c[0] += (tx - c[0]) * 0.22;
        c[1] += (ty - c[1]) * 0.22;
        if (Math.abs(tx - c[0]) > 0.25 || Math.abs(ty - c[1]) > 0.25) moving = true;
        pupils.current[i]?.setAttribute("transform", `translate(${(e.cx + c[0]).toFixed(2)} ${(e.cy + c[1]).toFixed(2)})`);
      });
      if (moving) raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    kickRef.current = kick;
    const onMove = (ev) => {
      target = [ev.clientX, ev.clientY];
      kick();
    };
    const onLeave = () => {
      target = null;
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", kick);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", kick);
    };
  }, []);

  useEffect(() => {
    kickRef.current();
    // تنفّس عميق بطيء للجسم كله وهو نايم
    svg.current?.parentElement?.classList.toggle("bf-asleep", mood === "sleepy");
  }, [mood]);

  // رمش عشوائي
  useEffect(() => {
    let t;
    const loop = () => {
      t = setTimeout(() => {
        const el = svg.current;
        if (el && moodRef.current !== "sleepy") {
          el.classList.add("is-blink");
          setTimeout(() => el.classList.remove("is-blink"), 150);
        }
        loop();
      }, 2400 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // هزّة خفيفة للجسم مع كل جملة يقولها
  useEffect(() => {
    if (!talk) return;
    svg.current?.parentElement?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.05, 0.95)", offset: 0.3 },
        { transform: "scale(0.97, 1.04)", offset: 0.65 },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }, [talk]);

  return (
    <svg ref={svg} className={`bf-eyes mood-${mood}`} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}w`} cx="45%" cy="38%" r="65%">
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6def5" />
        </radialGradient>
        <radialGradient id={`${uid}i`}>
          <stop offset="0" stopColor="#3a1a06" />
          <stop offset="0.45" stopColor="#7a3f0b" />
          <stop offset="0.82" stopColor="#bd6c10" />
          <stop offset="1" stopColor="#8a4a0a" />
        </radialGradient>
        <linearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c255fd" />
          <stop offset="0.6" stopColor="#a843f8" />
          <stop offset="1" stopColor="#9a3cf2" />
        </linearGradient>
        {EYES.map((e, i) => (
          <clipPath key={i} id={`${uid}c${i}`}>
            <ellipse cx={e.cx} cy={e.cy} rx={e.rx + 2} ry={e.ry + 2} transform={`rotate(${TILT} ${e.cx} ${e.cy})`} />
          </clipPath>
        ))}
      </defs>
      {EYES.map((e, i) => (
        <g key={i} clipPath={`url(#${uid}c${i})`}>
          <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={`url(#${uid}w)`} transform={`rotate(${TILT} ${e.cx} ${e.cy})`} />
          <g ref={(n) => (pupils.current[i] = n)} transform={`translate(${e.cx + e.rest[0]} ${e.cy + e.rest[1]})`}>
            <g className="bf-iris">
              <circle r="20.5" fill={`url(#${uid}i)`} stroke="#1e0d03" strokeWidth="2" />
              <circle r="10" fill="#120803" />
              <circle cx="-6.5" cy="-7.5" r="5" fill="#fff" />
              <circle cx="6" cy="6.5" r="2.2" fill="#fff" opacity="0.85" />
            </g>
          </g>
        </g>
      ))}
      {/* الجفون خارج القص حتى تغطي بياض العين وحدوده كاملة (عين مغمضة على الفرو) */}
      {EYES.map((e, i) => (
        <g key={`lid${i}`}>
          <g transform={`rotate(${TILT} ${e.cx} ${e.cy})`}>
            <ellipse className="bf-lid" cx={e.cx + 2} cy={e.cy + 2} rx={e.rx + 15} ry={e.ry + 14} fill={`url(#${uid}l)`} />
            {/* خط العين المغمضة (نوم/رمش): قوس ناعم مع رموش صغيرة */}
            <g className="bf-closed" fill="none" stroke="#2a0b52" strokeLinecap="round">
              <path d={`M ${e.cx - e.rx * 0.8} ${e.cy + e.ry * 0.02} Q ${e.cx} ${e.cy + e.ry * 0.55} ${e.cx + e.rx * 0.8} ${e.cy + e.ry * 0.02}`} strokeWidth="5.5" />
              <path d={`M ${e.cx - e.rx * 0.45} ${e.cy + e.ry * 0.3} l -6 9 M ${e.cx} ${e.cy + e.ry * 0.38} l 0 10 M ${e.cx + e.rx * 0.45} ${e.cy + e.ry * 0.3} l 6 9`} strokeWidth="3.5" />
            </g>
          </g>
        </g>
      ))}

      {/* فقاعة النوم من الأنف + حروف Z تطفو (تظهر فقط وهو نايم) */}
      <g className="bf-sleep" aria-hidden="true">
        <g className="bf-snot">
          <circle cx="226" cy="224" r="15" fill="rgba(200,228,255,0.55)" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" />
          <circle cx="221" cy="218" r="4" fill="#fff" opacity="0.9" />
        </g>
        {[
          [345, 60, 30, 0],
          [372, 30, 40, 0.8],
          [404, -6, 52, 1.6],
        ].map(([x, y, size, d], i) => (
          <text key={i} className="bf-z" x={x} y={y} fontSize={size} style={{ animationDelay: `${d}s` }}>
            Z
          </text>
        ))}
      </g>
    </svg>
  );
}
