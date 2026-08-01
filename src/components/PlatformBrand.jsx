/**
 * PlatformBrand.jsx — توقيع المنصة الموحّد. يظهر بنفس الشكل تماماً في
 * أعلى كل تجربة (بدل زر "🏠" العادي المختلف شكله في كل تجربة سابقاً)،
 * ليذكّر الطالب أنه لا يزال داخل "المختبر التفاعلي" مهما كانت التجربة
 * التي يخوضها. الشعار الدائري بألوان العلم هو نفسه المستخدم في شاشة
 * التحميل، فيربط بصرياً بين لحظة الإقلاع وكل تجربة لاحقة. يعمل كزر عودة
 * للرئيسية.
 */
export default function PlatformBrand({ onClick }) {
  return (
    <button
      type="button"
      className="platform-brand"
      onClick={onClick}
      aria-label="الرئيسية — المختبر التفاعلي"
      title="الرئيسية — المختبر التفاعلي"
    >
      <span className="platform-brand-mark" aria-hidden="true" />
      <span className="platform-brand-name">المختبر التفاعلي</span>
    </button>
  );
}
