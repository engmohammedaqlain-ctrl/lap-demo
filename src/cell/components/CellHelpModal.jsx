/**
 * CellHelpModal.jsx — نافذة "عن التجربة": شرح الدرس بلغة صف سابع، ملاحظة الدقّة
 * العلمية (الخلية مزدحمة)، وكيفية التنقّل (زووم/لمس/ماوس).
 */
export default function CellHelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="cl-help-overlay" onClick={onClose}>
      <div className="cl-help-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cl-help-close" onClick={onClose} aria-label="إغلاق">
          ✕
        </button>
        <h2 className="cl-help-title">رحلة داخل الخلية</h2>
        <span className="cl-help-sub">من نقطة ماء… إلى داخل الخلية الحيّة</span>

        <p className="cl-help-intro">
          الخلية هي وحدة بناء كل الكائنات الحيّة. في هذه الرحلة نكبّر من نقطة ماء حتى
          نغوص داخل خليّة واحدة، نتجاوز حدّ المجهر المدرسي، ونرى عضيّاتها تعمل وتتنفّس
          كما في الحقيقة.
        </p>

        <div className="cl-help-section">
          <h3>كيف أتنقّل؟</h3>
          <ul className="cl-help-list">
            <li>كبّر/صغّر بعجلة الماوس، أو بإصبعين (pinch) على الجوال.</li>
            <li>اسحب داخل الخلية للتنقّل بين العضيّات.</li>
            <li>اضغط أيّ عضيّ لتعرف اسمه ووظيفته وتراه يعمل.</li>
            <li>مرّر المؤشّر (hover) فوق عضيّ لتنكشف مكوّناته بأنيميشن.</li>
            <li>بعد اختيار عضيّ، اضغط «🔬 اغطس داخله» لترى تركيبه الداخلي.</li>
            <li>زر ⛶ لملء الشاشة والغوص بلا تشتيت.</li>
          </ul>
        </div>

        <div className="cl-help-section">
          <h3>معلومة علمية 🔬</h3>
          <p className="cl-help-note">
            رسوم الكتب المدرسية تُظهر الخلية شبه فارغة، لكن الخلية الحقيقية <b>مزدحمة
            جداً</b>: مئات الآلاف من الجزيئات تتحرّك في كل لحظة. أظهرنا هذا الازدحام عمداً
            لأنه الأقرب للحقيقة.
          </p>
        </div>

        <div className="cl-help-section">
          <h3>جرّب</h3>
          <ul className="cl-help-list">
            <li>بدّل بين الخلية الحيوانية والنباتية ولاحظ الفروق (جدار، بلاستيدات، فجوة).</li>
            <li>ادخل وضع التحدّي: نصف لك وظيفة، وتضغط أنت العضيّ الصحيح. الخطأ مجاني!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
