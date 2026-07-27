/**
 * SolutionPicker.jsx — شبكة اختيار السائل: أيقونات SVG موحّدة النسبة
 * داخل بطاقات مربّعة، تبقى متناسقة عند تكبير/تصغير الصفحة.
 */
import { SOLUTIONS, SOLUTION_ORDER } from "../phData.js";
import SolutionIcon from "./SolutionIcon.jsx";

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
              <span className="ph-pick-icon-wrap">
                <SolutionIcon id={key} />
              </span>
              <span className="ph-pick-name">{s.nameAr}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
