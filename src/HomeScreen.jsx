/**
 * HomeScreen.jsx — الشاشة الرئيسية لاختيار التجربة. بطاقتان كبيرتان
 * (الطفو / الأس الهيدروجيني) بطابع بصري مرح يشجّع الطالب على الاستكشاف.
 */
import "./home.css";

const EXPERIMENTS = [
  {
    key: "buoyancy",
    title: "الطفو",
    subtitle: "تجربة أرخميدس",
    desc: "اسحب الأجسام إلى البركة وشاهد متى تطفو ومتى تغرق، مع قياس القوى الحقيقية.",
    emoji: "🛟",
    accent: "green",
  },
  {
    key: "ph",
    title: "الأس الهيدروجيني",
    subtitle: "حمضي · متعادل · قاعدي",
    desc: "اختبر سوائل من حياتك اليومية، خفّفها بالماء، وحضّر محلولك وشاهد اللون يتغيّر.",
    emoji: "🧪",
    accent: "violet",
  },
  {
    key: "static",
    title: "الكهرباء الساكنة",
    subtitle: "البالونات والشحنات",
    desc: "افرك البالون بالسترة لتنقل إلكترونات، ثم أفلته وشاهده يلتصق بالسترة أو الجدار.",
    emoji: "🎈",
    accent: "amber",
  },
  {
    key: "color",
    title: "رؤية الألوان",
    subtitle: "كيف يراها الدماغ",
    desc: "امزج أضواء RGB الثلاثية، وشاهد مسار الجسيمات الضوئية واستجابة خلايا العين وإدراك الدماغ.",
    emoji: "👁️",
    accent: "blue",
  },
];

export default function HomeScreen({ onOpen }) {
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-header">
          <div className="home-flag" aria-hidden="true" />
          <h1 className="home-title">المختبر التفاعلي</h1>
          <p className="home-tagline">تجارب علمية عربية — تعلّم وأنت تلعب</p>
        </header>

        <div className="home-cards">
          {EXPERIMENTS.map((exp) => (
            <button
              key={exp.key}
              type="button"
              className={`home-card accent-${exp.accent}`}
              onClick={() => onOpen(exp.key)}
            >
              <span className="home-card-emoji" aria-hidden="true">
                {exp.emoji}
              </span>
              <span className="home-card-title">{exp.title}</span>
              <span className="home-card-subtitle">{exp.subtitle}</span>
              <span className="home-card-desc">{exp.desc}</span>
              <span className="home-card-cta">ابدأ التجربة ←</span>
            </button>
          ))}
        </div>

        <footer className="home-footer">يعمل دون اتصال بالإنترنت — ثبّته على جهازك واستخدمه في أي وقت.</footer>
      </div>
    </div>
  );
}
