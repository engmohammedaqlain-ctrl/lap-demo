/**
 * PhHelpModal.jsx — نافذة "شرح الدرس": ما هو الأس الهيدروجيني، الأحماض
 * والقواعد والتعادل، طريقة استخدام التجربة، وجدول أمثلة السوائل بقيمها
 * وألوانها الحقيقية (مبني من SOLUTIONS). يعيد استخدام أنماط .help-* العامة.
 */
import { useEffect } from "react";
import { SOLUTIONS, SOLUTION_ORDER, solutionColorSolid } from "../phData.js";
import { formatAr } from "../phModel.js";

export default function PhHelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className="help-overlay"
      hidden={!open}
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="ph-help-title">
        <button className="help-close" aria-label="إغلاق" onClick={onClose}>
          ✕
        </button>

        <h2 id="ph-help-title">
          الأس الهيدروجيني <span className="help-title-sub">— شرح الدرس</span>
        </h2>
        <p className="help-intro">
          الأس الهيدروجيني (pH) مقياس يخبرنا كم السائل حمضي أو قاعدي، من ٠ إلى ١٤. كلما قلّت القيمة زادت الحموضة،
          وكلما زادت اقتربنا من القاعدية، والرقم ٧ هو التعادل التام (مثل الماء النقي).
        </p>

        <section className="help-section">
          <h3>🔬 ما معنى pH؟</h3>
          <div className="help-formula">pH = −لو₁₀ [تركيز أيونات الهيدروجين ⁺H]</div>
          <ul className="help-list">
            <li>
              <strong>حمضي</strong> (٠–٦): كثير من أيونات ⁺H — مثل الليمون والخل.
            </li>
            <li>
              <strong>متعادل</strong> (٧): متوازن تماماً — مثل الماء النقي.
            </li>
            <li>
              <strong>قاعدي</strong> (٨–١٤): قليل من أيونات ⁺H — مثل الصابون والمبيّض.
            </li>
            <li>كل درجة على المقياس تعني تغيّراً بـ <strong>عشرة أضعاف</strong> في الحموضة (مقياس لوغاريتمي).</li>
          </ul>
        </section>

        <section className="help-section">
          <h3>🧪 طريقة استخدام التجربة</h3>
          <ul className="help-list">
            <li>
              <strong>اختر سائلاً</strong> من الشرائح في الأسفل.
            </li>
            <li>
              <strong>اضغط باستمرار على القطّارة</strong> لإضافة المزيد من السائل المركّز.
            </li>
            <li>
              <strong>اضغط باستمرار على حنفية الماء</strong> لتخفيف السائل — راقب اقتراب الـ pH من ٧.
            </li>
            <li>
              <strong>اضغط باستمرار على صنبور التصريف</strong> لتفريغ الكأس تدريجياً.
            </li>
            <li>
              في وضع <strong>"حضّر محلولك"</strong> تضبط قيمة pH بنفسك وتشاهد اللون والوصف يتغيّران.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>💡 لماذا يقترب الـ pH من ٧ عند إضافة الماء؟</h3>
          <p className="help-intro" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
            الماء النقي متعادل، فإضافته تُخفّف تركيز الأيونات الحمضية أو القاعدية، فيتحرّك الـ pH تدريجياً نحو
            التعادل — تماماً كما يحدث في الطبيعة.
          </p>
        </section>

        <section className="help-section">
          <h3>⚗️ أمثلة من حياتك (قيمة pH)</h3>
          <div className="help-table">
            {SOLUTION_ORDER.map((key) => {
              const s = SOLUTIONS[key];
              return (
                <div className="help-table-row" key={key}>
                  <span className="ht-name">
                    <span className="help-table-swatch" style={{ background: solutionColorSolid(key) }} />
                    {s.emoji} {s.nameAr}
                  </span>
                  <span className="ht-density">{formatAr(s.pH, 1)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
