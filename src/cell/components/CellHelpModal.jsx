/**
 * CellHelpModal.jsx — نافذة "عن التجربة": شرح الدرس بلغة صف سابع، ملاحظة الدقّة
 * العلمية (الخلية مزدحمة)، وكيفية التنقّل (زووم/لمس/ماوس).
 */
import { IconClose } from "../../ui/icons.jsx";

export default function CellHelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="cl-help-overlay" onClick={onClose}>
      <div className="cl-help-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cl-help-close" onClick={onClose} aria-label="إغلاق">
          <IconClose width="18" height="18" />
        </button>
        <h2 className="cl-help-title">رحلة داخل الخلية</h2>
        <span className="cl-help-sub">من نقطة ماء… إلى داخل الخلية الحيّة</span>

        <p className="cl-help-intro">
          الخلية هي وحدة بناء كل الكائنات الحيّة. في هذه الرحلة نكبّر من نقطة ماء حتى
          نغوص داخل خليّة واحدة، نتجاوز حدّ المجهر المدرسي، ونرى عضيّاتها تعمل وتتنفّس
          كما في الحقيقة.
        </p>

        <div className="cl-help-section">
          <h3>كيف أستعمل المجهر؟</h3>
          <ul className="cl-help-list">
            <li>اسحب مقبض التركيز رأسياً لتكبّر وتصغّر (الخشن للسرعة، والدقيق للتفاصيل) — أو استعمل عجلة الماوس / إصبعين.</li>
            <li>المس عدسة في برج العدسات لتقفز إلى تكبيرها: ×٤ ثم ×١٠ ثم ×٤٠ ثم ×١٠٠ (حدّ المجهر المدرسي).</li>
            <li>المس الشريحة الأخرى (أو اسحبها إلى طاولة العيّنة) لتبدّل بين الخلية الحيوانية والنباتية.</li>
            <li>اضغط أي عضيّ لتقرأ اسمه ووظيفته، ثم المس الرافعة الحمراء لتغوص داخله.</li>
            <li>اسحب داخل المجال للتنقّل، ومرّر المؤشّر فوق عضيّ لتنكشف مكوّناته.</li>
          </ul>
        </div>

        <div className="cl-help-section">
          <h3>معلومة علمية</h3>
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
            <li>اقلب بطاقة الدفتر بشريط الإشارة لتبدأ التحدّي: نصف لك وظيفة وتضغط أنت العضيّ الصحيح. الخطأ مجاني!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
