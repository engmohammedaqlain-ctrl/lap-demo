/**
 * CellControls.jsx — شريط أدوات التجربة: تبديل خلية حيوانية/نباتية، وضع
 * (استكشاف/تحدٍّ)، وإعادة ضبط المشهد. تصميم موحّد مع بقيّة الموقع.
 */
export default function CellControls({ cellType, onCellType, mode, onMode, onReset }) {
  return (
    <div className="cl-controls">
      <div className="cl-seg" role="group" aria-label="نوع الخلية">
        <button
          type="button"
          className={`cl-seg-btn${cellType === "animal" ? " active" : ""}`}
          onClick={() => onCellType("animal")}
        >
          🐾 خلية حيوانية
        </button>
        <button
          type="button"
          className={`cl-seg-btn${cellType === "plant" ? " active" : ""}`}
          onClick={() => onCellType("plant")}
        >
          🌿 خلية نباتية
        </button>
      </div>

      <div className="cl-seg" role="group" aria-label="الوضع">
        <button
          type="button"
          className={`cl-seg-btn${mode === "explore" ? " active" : ""}`}
          onClick={() => onMode("explore")}
        >
          🔍 استكشاف
        </button>
        <button
          type="button"
          className={`cl-seg-btn${mode === "challenge" ? " active" : ""}`}
          onClick={() => onMode("challenge")}
        >
          🎯 تحدٍّ
        </button>
      </div>

      <button type="button" className="cl-reset" onClick={onReset}>
        ↺ أعِد الرحلة
      </button>
    </div>
  );
}
