/**
 * StaticControls.jsx — شريط أدوات التجربة: وضع عرض الشحنات (الكل/الفرق/
 * بدون)، تبديل الجدار، عدد البالونات، وزر إعادة الضبط. تصميم موحّد مع
 * تبويبات بقيّة الموقع.
 */
const MODES = [
  { key: "all", label: "كل الشحنات", emoji: "⊕⊖" },
  { key: "diff", label: "الفرق فقط", emoji: "±" },
  { key: "none", label: "بدون شحنات", emoji: "🚫" },
];

export default function StaticControls({
  displayMode,
  onModeChange,
  wallOn,
  onToggleWall,
  balloonCount,
  onBalloonCount,
  onReset,
}) {
  return (
    <div className="st-controls">
      <div className="st-seg" role="group" aria-label="عرض الشحنات">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`st-seg-btn${displayMode === m.key ? " active" : ""}`}
            onClick={() => onModeChange(m.key)}
          >
            <span className="st-seg-emoji" aria-hidden="true">
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="st-ctrl-group">
        <button
          type="button"
          className={`st-toggle${balloonCount === 2 ? " on" : ""}`}
          onClick={() => onBalloonCount(balloonCount === 2 ? 1 : 2)}
          title="عدد البالونات"
        >
          🎈 {balloonCount === 2 ? "بالونان" : "بالون واحد"}
        </button>

        <button
          type="button"
          className={`st-toggle${wallOn ? " on" : ""}`}
          onClick={onToggleWall}
          title="إظهار/إزالة الجدار"
        >
          🧱 {wallOn ? "الجدار ظاهر" : "أضف الجدار"}
        </button>

        <button type="button" className="st-reset" onClick={onReset}>
          ↺ إعادة الضبط
        </button>
      </div>
    </div>
  );
}
