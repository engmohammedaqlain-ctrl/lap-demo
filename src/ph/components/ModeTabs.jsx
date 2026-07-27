/**
 * ModeTabs.jsx — تبديل بين وضعَي التجربة: "استكشف" (اختيار سوائل جاهزة
 * وتخفيفها) و"حضّر محلولك" (ضبط pH يدوياً بشريط تمرير).
 */
const MODES = [
  { key: "explore", label: "استكشف", emoji: "🧪" },
  { key: "custom", label: "حضّر محاليلك", emoji: "🧴" },
];

export default function ModeTabs({ mode, onChange }) {
  return (
    <div className="ph-mode-tabs" role="tablist">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={mode === m.key}
          className={`ph-mode-tab${mode === m.key ? " active" : ""}`}
          onClick={() => onChange(m.key)}
        >
          <span className="ph-mode-emoji">{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
