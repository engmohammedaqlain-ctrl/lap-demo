/**
 * HelpModal.jsx — نافذة "عن التجربة": تعريف، مبدأ أرخميدس، طريقة الاستخدام،
 * وجدولا كثافة المواد/السوائل المبنيان من MATERIALS/LIQUIDS مباشرة حتى لا
 * تتكرر الأرقام في مصدرين قد يختلفان لاحقاً.
 */
import { useEffect } from "react";
import { MATERIALS, LIQUIDS } from "../data/simulationData.js";

function densityTable(source) {
  return Object.values(source).sort((a, b) => a.density - b.density);
}

function HelpTable({ source }) {
  const entries = densityTable(source);
  return (
    <div className="help-table">
      {entries.map((item) => {
        const rgb = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
        const density = Math.round(item.density).toLocaleString("ar-EG");
        return (
          <div className="help-table-row" key={item.nameAr}>
            <span className="ht-name">
              <span className="help-table-swatch" style={{ background: rgb }}></span>
              {item.nameAr}
            </span>
            <span className="ht-density">{density}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function HelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      id="help-overlay"
      className="help-overlay"
      hidden={!open}
      onClick={(e) => {
        if (e.target.id === "help-overlay") onClose();
      }}
    >
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button id="help-close" className="help-close" aria-label="إغلاق" onClick={onClose}>
          ✕
        </button>

        <h2 id="help-title">
          الطفو <span className="help-title-sub">— تجربة أرخميدس</span>
        </h2>
        <p className="help-intro">
          محاكاة تفاعلية لمبدأ أرخميدس: ضع جسماً (أو حتى ٣ أجسام معاً) من مادة مختلفة داخل سائل مختلف، وشاهد متى
          يطفو ومتى يغرق ولماذا، مع قياس القوى الفعلية المؤثّرة عليه لحظة بلحظة.
        </p>

        <section className="help-section">
          <h3>📐 القانون الأساسي — مبدأ أرخميدس</h3>
          <div className="help-formula">قوة الطفو = كثافة السائل × الحجم المغمور × ٩٫٨١ (الجاذبية)</div>
          <div className="help-formula">الوزن = كثافة الجسم × حجمه الكامل × ٩٫٨١</div>
          <ul className="help-list">
            <li>
              الجسم <strong>يطفو</strong> إذا كانت <strong>كثافته أقل</strong> من كثافة السائل.
            </li>
            <li>
              الجسم <strong>يغرق</strong> إذا كانت <strong>كثافته أكبر</strong> من كثافة السائل.
            </li>
            <li>يتوازن الجسم مغموراً جزئياً عندما تتساوى قوة الطفو مع وزنه تماماً.</li>
            <li>
              نفس الجسم قد يطفو بسائل ويغرق بآخر — الطفو خاصية تعتمد على <strong>السائل أيضاً</strong>، لا الجسم
              وحده.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>🧩 طريقة الاستخدام</h3>
          <ul className="help-list">
            <li>
              <strong>اسحب</strong> مادة من الشريط وأفلتها فوق البركة لإضافة جسم (حتى ٣ أجسام معاً).
            </li>
            <li>
              <strong>اضغط</strong> على شريحة مادة (بدون سحب) لتغيير مادة الجسم المحدَّد.
            </li>
            <li>
              <strong>اضغط</strong> على أي جسم داخل البركة لتحديده — تظهر عليه حلقة خضراء وأسهم القوى وقياساته.
            </li>
            <li>
              <strong>اسحب</strong> الجسم المحدَّد يمين/يسار/فوق/تحت لتحريكه بحرية.
            </li>
            <li>
              زر <strong>"✕ حذف"</strong> يحذف الجسم المحدَّد (لا يمكن حذف آخر جسم متبقٍ).
            </li>
            <li>
              اختر <strong>الشكل</strong> (مكعب/كرة) و<strong>الحجم</strong> من الأزرار والشريط.
            </li>
            <li>غيّر <strong>السائل</strong> من القائمة، وتحكّم بعرض الجاذبية/الطفو/القيم/خطوط العمق من خانات الاختيار.</li>
            <li>زر 🔊 يشغّل أو يوقف المؤثرات الصوتية.</li>
          </ul>
        </section>

        <section className="help-section">
          <h3>⚖️ كثافة المواد (كغم/م³)</h3>
          <HelpTable source={MATERIALS} />
        </section>

        <section className="help-section">
          <h3>🌊 كثافة السوائل (كغم/م³)</h3>
          <HelpTable source={LIQUIDS} />
        </section>
      </div>
    </div>
  );
}
