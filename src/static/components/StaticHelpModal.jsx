/**
 * StaticHelpModal.jsx — نافذة "شرح الدرس" الكاملة للكهرباء الساكنة:
 * ما هي الشحنة، كيف تنشأ الكهرباء الساكنة بالفرك، قاعدة التجاذب/التنافر،
 * سبب التصاق البالون بالجدار (الاستقطاب)، وطريقة استخدام التجربة، مع
 * أمثلة من الحياة. يعيد استخدام أنماط .help-* العامة.
 */
import { useEffect } from "react";

export default function StaticHelpModal({ open, onClose }) {
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
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="st-help-title">
        <button className="help-close" aria-label="إغلاق" onClick={onClose}>
          ✕
        </button>

        <h2 id="st-help-title">
          الكهرباء الساكنة <span className="help-title-sub">— شرح الدرس</span>
        </h2>
        <p className="help-intro">
          كل الأجسام مكوّنة من ذرّات فيها شحنات <strong>موجبة (+)</strong> في النواة و<strong>سالبة (−)</strong>
          هي الإلكترونات. عادةً يتساوى عددهما فيكون الجسم <strong>متعادلاً</strong>. لكن عند فرك جسمين، تنتقل
          إلكترونات من أحدهما إلى الآخر، فتنشأ <strong>الكهرباء الساكنة</strong>.
        </p>

        <section className="help-section">
          <h3>⚡ كيف يُشحن البالون؟</h3>
          <ul className="help-list">
            <li>
              عند <strong>فرك البالون بالسترة</strong> تنتقل إلكترونات (−) من السترة إلى البالون.
            </li>
            <li>
              البالون يكسب إلكترونات زائدة فيصبح <strong>سالب الشحنة</strong>.
            </li>
            <li>
              السترة تفقد إلكترونات فتصبح <strong>موجبة الشحنة</strong>.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>🧲 قاعدة الشحنات</h3>
          <div className="help-formula">الشحنات المتشابهة تتنافر — والمتعاكسة تتجاذب</div>
          <ul className="help-list">
            <li>
              <strong>سالب + موجب</strong> ← تجاذب (لذلك يلتصق البالون بالسترة).
            </li>
            <li>
              <strong>سالب + سالب</strong> أو <strong>موجب + موجب</strong> ← تنافر.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>🧱 لماذا يلتصق البالون بالجدار؟</h3>
          <p className="help-intro" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
            الجدار متعادل، لكن عندما يقترب منه البالون السالب فإنه <strong>يدفع إلكترونات الجدار بعيداً</strong>،
            فيبقى قرب سطحه شحنات موجبة تجذب البالون — وهذا ما يُسمّى <strong>الاستقطاب</strong>.
          </p>
        </section>

        <section className="help-section">
          <h3>🎈 طريقة استخدام التجربة</h3>
          <ul className="help-list">
            <li>
              <strong>اسحب البالون</strong> وحرّكه فوق السترة ذهاباً وإياباً <strong>لفركه</strong>.
            </li>
            <li>راقب الإلكترونات (−) وهي تقفز إلى البالون، وشحنته تزداد سلبيةً.</li>
            <li>
              <strong>أفلت البالون</strong> وشاهده ينجذب ويلتصق بالسترة أو بالجدار.
            </li>
            <li>
              بدّل عرض الشحنات: <strong>الكل</strong> / <strong>الفرق فقط</strong> / <strong>بدون</strong>.
            </li>
            <li>
              جرّب <strong>بالونين</strong>، أو <strong>أزل الجدار</strong>، أو <strong>أعد الضبط</strong>.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>🌍 أمثلة من حياتك</h3>
          <ul className="help-list">
            <li>وقوف شعرك عند خلع كنزة صوفية في الشتاء.</li>
            <li>الصعقة الخفيفة عند لمس مقبض باب معدني.</li>
            <li>التصاق قصاصات الورق الصغيرة بمسطرة بلاستيكية فُركت بقماش.</li>
            <li>البرق: كهرباء ساكنة عملاقة تتفرّغ بين الغيوم والأرض.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
