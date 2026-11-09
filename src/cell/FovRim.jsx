/**
 * FovRim.jsx — حلقة العدسة العينية فوق مجال الرؤية: كأس مطّاطي مخرّش، حلقة كروم
 * ببريق دائري، إطار داكن، تعتيم أطراف (vignette)، انعكاس زجاجي وعلامات التقاطع
 * الدقيقة. ترسم مرة واحدة عند تغيّر الحجم ولا تلتقط المؤشّر.
 */
import { useEffect, useRef } from "react";

function draw(g, R, rim) {
  const cx = 0;
  const cy = 0;
  const outer = R + rim;

  // كأس مطّاطي
  const rub = g.createRadialGradient(cx, cy, R + rim * 0.34, cx, cy, outer);
  rub.addColorStop(0, "#1a1d20");
  rub.addColorStop(0.55, "#2b3035");
  rub.addColorStop(1, "#0d0f11");
  g.fillStyle = rub;
  g.beginPath();
  g.arc(cx, cy, outer, 0, Math.PI * 2);
  g.arc(cx, cy, R, 0, Math.PI * 2, true);
  g.fill();
  // تخريش الكأس
  g.lineCap = "round";
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const lit = 0.5 + 0.5 * Math.cos(a + 2.4);
    g.strokeStyle = `rgba(255,255,255,${0.025 + 0.11 * lit})`;
    g.lineWidth = Math.max(1.2, rim * 0.05);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R + rim * 0.42), cy + Math.sin(a) * (R + rim * 0.42));
    g.lineTo(cx + Math.cos(a) * (outer - rim * 0.07), cy + Math.sin(a) * (outer - rim * 0.07));
    g.stroke();
  }
  // حافة خارجية لامعة
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, outer - 1, Math.PI * 0.95, Math.PI * 1.7);
  g.stroke();

  // حلقة الكروم
  const c0 = R + rim * 0.14;
  const c1 = R + rim * 0.38;
  let chrome;
  if (g.createConicGradient) {
    chrome = g.createConicGradient(Math.PI * 0.75, cx, cy);
    const stops = [
      [0, "#f7fafc"],
      [0.08, "#7d878f"],
      [0.18, "#e8edf0"],
      [0.3, "#4a525a"],
      [0.42, "#c9d1d6"],
      [0.55, "#2f353b"],
      [0.68, "#d7dde1"],
      [0.82, "#59626a"],
      [1, "#f7fafc"],
    ];
    stops.forEach(([o, c]) => chrome.addColorStop(o, c));
  } else {
    chrome = g.createLinearGradient(-outer, -outer, outer, outer);
    chrome.addColorStop(0, "#f2f5f7");
    chrome.addColorStop(0.5, "#6b747b");
    chrome.addColorStop(1, "#dfe5e9");
  }
  g.fillStyle = chrome;
  g.beginPath();
  g.arc(cx, cy, c1, 0, Math.PI * 2);
  g.arc(cx, cy, c0, 0, Math.PI * 2, true);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, c1, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, c0, 0, Math.PI * 2);
  g.stroke();

  // إطار داخلي أسود
  const bez = g.createRadialGradient(cx, cy, R - 2, cx, cy, c0);
  bez.addColorStop(0, "#000");
  bez.addColorStop(1, "#16191c");
  g.fillStyle = bez;
  g.beginPath();
  g.arc(cx, cy, c0, 0, Math.PI * 2);
  g.arc(cx, cy, R, 0, Math.PI * 2, true);
  g.fill();

  // تعتيم الأطراف داخل المجال
  const vg = g.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.7, "rgba(0,0,0,0.22)");
  vg.addColorStop(1, "rgba(0,0,0,0.78)");
  g.fillStyle = vg;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  // انعكاس زجاجي علوي-أيسر
  const refl = g.createLinearGradient(-R * 0.9, -R * 0.9, R * 0.2, R * 0.1);
  refl.addColorStop(0, "rgba(255,255,255,0.26)");
  refl.addColorStop(0.35, "rgba(255,255,255,0.05)");
  refl.addColorStop(1, "rgba(255,255,255,0)");
  g.save();
  g.beginPath();
  g.arc(cx, cy, R - 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = refl;
  g.beginPath();
  g.ellipse(-R * 0.18, -R * 0.2, R * 0.92, R * 0.62, -0.7, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // لمعة صغيرة
  const sp = g.createRadialGradient(-R * 0.62, -R * 0.58, 0, -R * 0.62, -R * 0.58, R * 0.1);
  sp.addColorStop(0, "rgba(255,255,255,0.8)");
  sp.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sp;
  g.beginPath();
  g.arc(-R * 0.62, -R * 0.58, R * 0.1, 0, Math.PI * 2);
  g.fill();

  // علامات تقاطع دقيقة عند الأرباع
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = Math.max(1.4, R * 0.006);
  for (let q = 0; q < 4; q++) {
    const a = q * (Math.PI / 2);
    g.beginPath();
    g.moveTo(Math.cos(a) * (R - R * 0.05), Math.sin(a) * (R - R * 0.05));
    g.lineTo(Math.cos(a) * (R - R * 0.015), Math.sin(a) * (R - R * 0.015));
    g.stroke();
  }
}

export default function FovRim({ L }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { r, rim } = L.fov;
    const half = r + rim + 6;
    const px = half * 2 * L.s;
    c.width = Math.round(px * dpr);
    c.height = Math.round(px * dpr);
    const g = c.getContext("2d");
    g.setTransform(L.s * dpr, 0, 0, L.s * dpr, (half * L.s * dpr), (half * L.s * dpr));
    draw(g, r, rim);
  }, [L.s, L.fov.r, L.fov.rim]);
  const { cx, cy, r, rim } = L.fov;
  const half = r + rim + 6;
  return (
    <canvas
      ref={ref}
      className="cl-rim"
      style={{
        left: (cx - half) * L.s,
        top: (cy - half) * L.s,
        width: half * 2 * L.s,
        height: half * 2 * L.s,
      }}
    />
  );
}
