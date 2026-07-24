/**
 * StaticInfoPanel.jsx — اللوحة التفسيرية الحيّة: تحوّل حالة التجربة الحالية
 * (متعادل / يُفرك / منجذب / ملتصق...) إلى شرح عربي مبسّط مع مؤشّر شحنة
 * البالون، فيفهم الطالب "ماذا يحدث ولماذا" لحظة بلحظة.
 */
const PHASES = {
  neutral: {
    tone: "neutral",
    emoji: "⚖️",
    title: "البالون متعادل",
    text: "عدد الشحنات الموجبة (+) يساوي السالبة (−). افرك البالون بالسترة لتنقل إليه إلكترونات!",
  },
  rubbing: {
    tone: "spark",
    emoji: "✨",
    title: "يتم الفرك الآن!",
    text: "إلكترونات سالبة (−) تقفز من السترة إلى البالون. السترة تفقدها فتصبح موجبة.",
  },
  charged: {
    tone: "charge",
    emoji: "⚡",
    title: "البالون أصبح سالباً",
    text: "اكتسب البالون إلكترونات زائدة فصار شحنته سالبة. أفلته وشاهد ماذا يحدث!",
  },
  attracting: {
    tone: "charge",
    emoji: "🧲",
    title: "انجذاب كهربائي!",
    text: "البالون السالب ينجذب نحو الشحنات الموجبة — الشحنات المتعاكسة تتجاذب.",
  },
  stuckSweater: {
    tone: "stick",
    emoji: "🧷",
    title: "التصق بالسترة!",
    text: "البالون سالب والسترة موجبة، والمتعاكسان يتجاذبان — فالتصق البالون بالسترة.",
  },
  stuckWall: {
    tone: "stick",
    emoji: "🧱",
    title: "التصق بالجدار!",
    text: "البالون السالب دفع إلكترونات الجدار بعيداً، فاقترب سطحه الموجب وجذب البالون فالتصق.",
  },
};

const AR = (n) => n.toLocaleString("ar-EG");

export default function StaticInfoPanel({ status }) {
  const phase = PHASES[status.phase] || PHASES.neutral;
  const charge = status.charge || 0;
  return (
    <div className="st-info">
      <div className={`st-info-status tone-${phase.tone}`}>
        <span className="st-info-emoji" key={status.phase}>
          {phase.emoji}
        </span>
        <div className="st-info-text">
          <span className="st-info-title">{phase.title}</span>
          <span className="st-info-desc">{phase.text}</span>
        </div>
      </div>

      <div className="st-charge-card">
        <span className="st-charge-head">شحنة البالون</span>
        <span className={`st-charge-value ${charge > 0 ? "neg" : "zero"}`}>
          {charge > 0 ? `−${AR(charge)}` : "٠"}
        </span>
        <span className="st-charge-sub">{charge > 0 ? `اكتسب ${AR(charge)} إلكترون` : "متعادل تماماً"}</span>
      </div>

      <div className="st-legend">
        <span className="st-legend-item">
          <span className="st-legend-dot plus">+</span> شحنة موجبة (بروتون)
        </span>
        <span className="st-legend-item">
          <span className="st-legend-dot minus">−</span> شحنة سالبة (إلكترون)
        </span>
      </div>
    </div>
  );
}
