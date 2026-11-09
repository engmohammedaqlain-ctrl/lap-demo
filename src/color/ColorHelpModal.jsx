/**
 * ColorHelpModal.jsx — شرح موجز لرؤية الألوان: مزج الأضواء، مخاريط العين،
 * عمى الألوان، والمرشّحات. يعيد استخدام أنماط .help-* العامة.
 */
import { useEffect } from "react";
import { IconClose } from "../ui/icons.jsx";

export default function ColorHelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
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
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="co-help-title">
        <button className="help-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose width="16" height="16" />
        </button>

        <h2 id="co-help-title">
          رؤية الألوان <span className="help-title-sub">— شرح الدرس</span>
        </h2>
        <p className="help-intro">
          في عينك ثلاثة أنواع من <strong>المخاريط</strong> تستجيب للأحمر والأخضر والأزرق. الدماغ يقارن
          إشاراتها ويقرّر أي لون تراه.
        </p>

        <section className="help-section">
          <h3>مزج الأضواء</h3>
          <ul className="help-list">
            <li>أحمر + أخضر = <strong>أصفر</strong></li>
            <li>أخضر + أزرق = <strong>سماوي</strong></li>
            <li>أحمر + أزرق = <strong>أرجواني</strong></li>
            <li>الثلاثة معاً = <strong>أبيض</strong>، وبلا ضوء = <strong>أسود</strong></li>
          </ul>
          <p className="help-intro" style={{ marginTop: 8, borderBottom: "none", paddingBottom: 0 }}>
            مزج الضوء يجمع الألوان، أما مزج الدهان فيطرحها.
          </p>
        </section>

        <section className="help-section">
          <h3>عمى الألوان</h3>
          <ul className="help-list">
            <li>عمى الأحمر: مخاريط الأحمر ضعيفة فيختلط الأحمر بالأخضر.</li>
            <li>عمى الأخضر: مخاريط الأخضر ضعيفة بنفس الأثر تقريباً.</li>
            <li>عمى الأزرق: نادر، فيصعب التمييز بين الأزرق والأخضر.</li>
          </ul>
        </section>

        <section className="help-section">
          <h3>طريقة الاستخدام</h3>
          <ul className="help-list">
            <li>
              <strong>اسحب</strong> فيدرات المنصّة لتغيير شدّة كل كشّاف.
            </li>
            <li>
              <strong>المس</strong> نظّارة على اللوحة لتلبسها الشخصية فترى عمى الألوان.
            </li>
            <li>
              <strong>المس</strong> شفّافاً ملوّناً ليدخل أمام الأشعّة ويحجب الألوان الأخرى.
            </li>
            <li>
              <strong>المس</strong> بقعة على لوحة الرسّام لتجربة مزج جاهز، وصورة على الحائط لتبديل الشخصية.
            </li>
            <li>المفتاح الدوّار يبدّل نمط الضوء (فوتونات / موجات / شعاع)، والزرّ يوقف الحركة مؤقتاً.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
