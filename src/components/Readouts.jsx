/**
 * Readouts.jsx — الكتلة/الوزن/الطفو/نسبة الغمر للجسم الفعّال
 */
import { useSnapshot } from "../simulation/useSnapshot.js";
import { formatNumber, formatMass } from "../physics/snapshot.js";

export default function Readouts({ stateRef }) {
  const snapshot = useSnapshot(stateRef);

  const rows = [
    { id: "tag-mass", label: "الكتلة", value: snapshot ? formatMass(snapshot.mass) : "—" },
    { id: "tag-weight", label: "الوزن", value: snapshot ? formatNumber(snapshot.weight, 1) + " N" : "—", cls: "val-weight" },
    { id: "tag-buoyant", label: "الطفو", value: snapshot ? formatNumber(snapshot.buoyantForce, 1) + " N" : "—", cls: "val-buoyant" },
    { id: "tag-submerged", label: "الغمر", value: snapshot ? formatNumber(snapshot.submergedPercent, 0) + "٪" : "—" },
  ];

  return (
    <div className="hud hud-readouts">
      <div className="hud-heading">القياسات</div>
      <div className="readouts-list">
        {rows.map((row) => (
          <div className="readout-row" key={row.id}>
            <span className="readout-label">{row.label}</span>
            <span className={`readout-value${row.cls ? " " + row.cls : ""}`} id={row.id}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
