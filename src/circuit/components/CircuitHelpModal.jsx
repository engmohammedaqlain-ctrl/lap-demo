/**
 * CircuitHelpModal.jsx — نافذة الشرح التعليمي لمختبر الدوائر الكهربائية
 */
import { useEffect } from "react";

export default function CircuitHelpModal({ open, onClose }) {
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
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="cir-help-title">
        <button className="help-close" aria-label="إغلاق" onClick={onClose}>
          ✕
        </button>

        <h2 id="cir-help-title">
          مختبر الدوائر الكهربائية <span className="help-title-sub">— دليل الاستكشاف والقوانين</span>
        </h2>

        <p className="help-intro">
          الدائرة الكهربائية هي مسار مغلق يتيح للشحنات الكهربائية (الإلكترونات) التدفق من القطب السالب
          إلى القطب الموجب لمصدر الطاقة بفعل <strong>فرق الجهد (الفولتية)</strong>.
        </p>

        <section className="help-section">
          <h3>📐 قانون أوم الأساسي</h3>
          <div className="help-formula">V = I × R &nbsp; (الجهد = التيار × المقاومة)</div>
          <ul className="help-list">
            <li>
              <strong>الجهد (V):</strong> يُقاس بالفولت، وهو القوة الدافعة الكهربائية التي تدفع الشحنات.
            </li>
            <li>
              <strong>التيار (I):</strong> يُقاس بالأمبير (A) أو الملي أمبير (mA)، وهو معدل تدفق الشحنات.
            </li>
            <li>
              <strong>المقاومة (R):</strong> تُقاس بالأوم (Ω)، وتحدد مدى ممانعة المكون لمرور التيار.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>💡 التوصيل على التوالي والتوازي</h3>
          <ul className="help-list">
            <li>
              <strong>التوالي (Series):</strong> مسار واحد متصل. يمر نفس التيار في جميع العناصر، ويتوزع
              الجهد بينها (يقل سطوع المصابيح). إذا انقطع مسار ينطفئ الجميع.
            </li>
            <li>
              <strong>التوازي (Parallel):</strong> مسارات متعددة متفرعة. يحصل كل فرع على الجهد الكامل
              للمصدر، وإذا انقطع فرع تستمر باقي الفروع بالعمل بشكل مستقل.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>⏱️ المكثفات والدايودات المشعة (LED)</h3>
          <ul className="help-list">
            <li>
              <strong>المكثف (Capacitor):</strong> يخزن طاقة كهربائية في مجاله الداخلي ويفرغها تدريجياً
              بشكل عابر وفق الثابت الزمني τ = R × C.
            </li>
            <li>
              <strong>الدايود (LED):</strong> يسمح بمرور التيار باتجاه واحد فقط (انحياز أمامي)، ولا يضيء إذا
              عُكست قطبيته.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>📟 أدوات التحكم والفحص</h3>
          <ul className="help-list">
            <li>
              <strong>رسم الأسلاك:</strong> اضغط على طرف أي عنصر واسحب للطرف الآخر. اضغط على المساحة الفارغة
              لإضافة زاوية (Waypoint) للسلك.
            </li>
            <li>
              <strong>الفولتميتر المنضدي:</strong> اسحب المجسّ الأحمر والمجسّ الأسود وضعهما على أي نقطتين
              لقياس فرق الجهد الفعلي بينهما.
            </li>
            <li>
              <strong>لوحة الخصائص:</strong> اضغط على أي عنصر لتعديل قيمته بالفولت أو الأوم أو تدويره أو حذفه.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
