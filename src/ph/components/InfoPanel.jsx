/**
 * InfoPanel.jsx — الجانب النظري الممتع: بطاقة حالة (وجه + تصنيف + معنى مبسّط)
 * وبطاقة "هل تعلم؟" بمعلومة شيّقة عن السائل الحالي. تجعل التجربة تعليمية
 * وممتعة بدل أرقام جافّة.
 */
import { SOLUTIONS } from "../phData.js";
import { phStatus } from "../phModel.js";

const MEANING = {
  "acid-strong": "الأحماض القوية لاذعة وتتفاعل بشدّة — كن حذراً معها.",
  acid: "الأحماض طعمها حامض وتتفاعل مع المعادن.",
  neutral: "متعادل: لا حمضي ولا قاعدي — مثل الماء النقي تماماً.",
  base: "القواعد ملمسها صابوني وتعادل الأحماض.",
  "base-strong": "القواعد القوية أكّالة وخطرة — لا تلمسها.",
};

export default function InfoPanel({ pH, empty, solutionKey, mode }) {
  const status = empty ? null : phStatus(pH);
  const solution = mode === "explore" ? SOLUTIONS[solutionKey] : null;

  return (
    <div className="ph-info">
      <div className={`ph-info-status${status ? " tone-" + status.tone : " tone-empty"}`}>
        <span className="ph-info-emoji" key={status ? status.emoji : "empty"}>
          {status ? status.emoji : "🫗"}
        </span>
        <div className="ph-info-status-text">
          <span className="ph-info-label">{status ? status.label : "الكأس فارغ"}</span>
          <span className="ph-info-meaning">
            {status ? MEANING[status.tone] : "أضف سائلاً بالقطّارة لتبدأ القياس."}
          </span>
        </div>
      </div>

      {solution && (
        <div className="ph-info-fact">
          <div className="ph-info-fact-head">
            <span className="ph-info-fact-icon">💡</span>
            <span className="ph-info-fact-title">هل تعلم؟</span>
          </div>
          <p className="ph-info-fact-body">
            <span className="ph-info-fact-emoji">{solution.emoji}</span> {solution.fact}
          </p>
        </div>
      )}

      <div className="ph-info-legend">
        <span className="ph-legend-item">
          <span className="ph-legend-dot acid" /> حمضي (٠–٦)
        </span>
        <span className="ph-legend-item">
          <span className="ph-legend-dot neutral" /> متعادل (٧)
        </span>
        <span className="ph-legend-item">
          <span className="ph-legend-dot base" /> قاعدي (٨–١٤)
        </span>
      </div>
    </div>
  );
}
