/**
 * SolutionPicker.jsx — شريط اختيار السائل بالشرائح (لا قائمة منسدلة): كل
 * شريحة تُظهر إيموجي السائل واسمه ومربّع لونه الحقيقي، والمحدَّدة مميّزة
 * بإطار أخضر. اختيار سائل يبدأ تجربة نظيفة به داخل الكأس.
 */
import { SOLUTIONS, SOLUTION_ORDER, solutionColorSolid } from "../phData.js";

export default function SolutionPicker({ activeKey, onSelect }) {
  return (
    <div className="ph-picker">
      <div className="ph-picker-heading">اختر السائل</div>
      <div className="ph-picker-chips">
        {SOLUTION_ORDER.map((key) => {
          const s = SOLUTIONS[key];
          return (
            <button
              key={key}
              type="button"
              className={`ph-pick-chip${key === activeKey ? " active" : ""}`}
              onClick={() => onSelect(key)}
              title={s.nameAr}
            >
              <span className="ph-pick-swatch" style={{ background: solutionColorSolid(key) }}>
                <span className="ph-pick-emoji">{s.emoji}</span>
              </span>
              <span className="ph-pick-name">{s.nameAr}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
