/**
 * ForcesPanel.jsx — مفاتيح إظهار الجاذبية/الطفو/القيم/خطوط العمق
 */
const FLAGS = [
  { key: "showGravity", label: "الجاذبية" },
  { key: "showBuoyancy", label: "الطفو" },
  { key: "showValues", label: "القيم" },
  { key: "showDepthLines", label: "خطوط العمق" },
];

export default function ForcesPanel({ stateRef, actions }) {
  const state = stateRef.current;
  return (
    <div className="hud hud-forces">
      <div className="hud-heading">القوى</div>
      {FLAGS.map((f) => (
        <label key={f.key} className="hud-check">
          <input type="checkbox" checked={state[f.key]} onChange={() => actions.toggleFlag(f.key)} />
          {f.label}
        </label>
      ))}
    </div>
  );
}
