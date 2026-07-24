/**
 * MiniStats.jsx — نسخة مصغّرة من القياسات تُعرض دوماً على مقبض الورقة
 * السفلية المطوية على الجوال.
 */
import { useSnapshot } from "../simulation/useSnapshot.js";
import { formatNumber, formatMass } from "../physics/snapshot.js";

export default function MiniStats({ stateRef }) {
  const snapshot = useSnapshot(stateRef);

  const stats = [
    { id: "mini-mass", label: "كتلة", value: snapshot ? formatMass(snapshot.mass) : "—" },
    { id: "mini-weight", label: "وزن", value: snapshot ? formatNumber(snapshot.weight, 0) + "N" : "—" },
    { id: "mini-buoyant", label: "طفو", value: snapshot ? formatNumber(snapshot.buoyantForce, 0) + "N" : "—" },
    { id: "mini-submerged", label: "غمر", value: snapshot ? formatNumber(snapshot.submergedPercent, 0) + "٪" : "—" },
  ];

  return (
    <span className="dock-mini">
      {stats.map((s) => (
        <span className="dock-stat" key={s.id}>
          <span className="dock-stat-val" id={s.id}>
            {s.value}
          </span>
          <span className="dock-stat-label">{s.label}</span>
        </span>
      ))}
    </span>
  );
}
