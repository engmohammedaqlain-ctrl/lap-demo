/**
 * HomeScreen.jsx — شاشة اختيار التجربة، منقولة من القائمة الرئيسية في لعبة
 * "مختبري" (lab-game: src/ui/main_menu) بنفس العناصر والحركات: الشعار
 * والشريط، الولد العالِم والوحش البنفسجي، لوحة زجاجية بشبكة ٣×٢ من
 * البطاقات، وأزرار (سجل التجارب / اختر تجربة / إنجازاتي).
 *
 * الألوان بثيم المختبر التفاعلي: خلفية الكريم والكوفية، وألوان التجارب
 * المعتمدة، وأزرار بألوان العلم (أحمر / أخضر / أسود).
 *
 * ثلاثة ترتيبات لمسرح يُكبَّر كاملاً بـ transform (كما يفعل Godot):
 *  - portrait  720×1280 : تصميم اللعبة كما هو (الجوال الطولي).
 *  - landscape 1280×720 : نفس العناصر للشاشات العرضية القصيرة (جوال أفقي).
 *  - desktop   1800×900 : عرض الويب — لوحة "التجربة المختارة" بجانب الشبكة،
 *    مع خلفية علمية متحركة، ميلان ثلاثي الأبعاد للبطاقات، وتنقّل بالأسهم.
 *
 * السلوك كما في اللعبة: لمسة على بطاقة تحدّدها، ولمسة ثانية (أو الزر
 * الأخضر) تفتحها.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./home.css";
import { play, setMuted } from "./audio/sfx.js";
import { canFullscreen, toggleFullscreen } from "./mobile/device.js";

import logoImg from "./assets/home/logo.webp";
import ribbonImg from "./assets/home/ribbon.webp";
import boyImg from "./assets/home/boy.webp";
import monsterImg from "./assets/home/monster.webp";
import btnSettings from "./assets/home/btn_settings.webp";
import btnTrophy from "./assets/home/btn_trophy.webp";
import btnLog from "./assets/home/btn_log.webp";
import btnMain from "./assets/home/btn_main.webp";
import btnAch from "./assets/home/btn_ach.webp";
import iconBook from "./assets/home/icon_book.webp";
import iconFlask from "./assets/home/icon_flask.webp";
import iconStar from "./assets/home/icon_star.webp";
import cardBuoyancy from "./assets/home/card_buoyancy.webp";
import cardPh from "./assets/home/card_ph.webp";
import cardStatic from "./assets/home/card_static.webp";
import cardColor from "./assets/home/card_color.webp";
import cardCell from "./assets/home/card_cell.webp";
import cardCircuits from "./assets/home/card_circuits.webp";
import iconBuoyancy from "./assets/home/icon_buoyancy.webp";
import iconPh from "./assets/home/icon_ph.webp";
import iconStatic from "./assets/home/icon_static.webp";
import iconColor from "./assets/home/icon_color.webp";
import iconCell from "./assets/home/icon_cell.webp";
import iconCircuits from "./assets/home/icon_circuits.webp";

/* ink: لون حدّ العنوان ورقم الشارة، glow: توهّج التحديد، ring: إطار التحديد */
const EXPERIMENTS = [
  {
    key: "buoyancy", n: 1, title: "الطفو", card: cardBuoyancy, icon: iconBuoyancy,
    ink: "#0b3d20", glow: "rgba(52, 199, 112, 0.9)", ring: "#d9f7e5",
    subtitle: "تجربة أرخميدس",
    desc: "اسحب الأجسام إلى البركة وشاهد متى تطفو ومتى تغرق، مع قياس القوى الحقيقية.",
    tip: "لماذا تطفو السفينة الحديدية وتغرق الحصاة الصغيرة؟ هيا نكتشف!",
  },
  {
    key: "ph", n: 2, title: "الأس الهيدروجيني", card: cardPh, icon: iconPh,
    ink: "#2c1466", glow: "rgba(160, 110, 255, 0.9)", ring: "#e9e0ff",
    subtitle: "حمضي · متعادل · قاعدي",
    desc: "اختبر سوائل من حياتك اليومية، خفّفها بالماء، وحضّر محلولك وشاهد اللون يتغيّر.",
    tip: "الليمون حمضي والصابون قاعدي… فماذا عن الحليب؟",
  },
  {
    key: "static", n: 3, title: "الكهرباء الساكنة", card: cardStatic, icon: iconStatic,
    ink: "#663c00", glow: "rgba(255, 190, 60, 0.9)", ring: "#fff1cc",
    subtitle: "البالونات والشحنات",
    desc: "افرك البالون بالسترة لتنقل إلكترونات، ثم أفلته وشاهده يلتصق بالسترة أو الجدار.",
    tip: "افرك البالون جيداً… وشاهد السحر بعينيك!",
  },
  {
    key: "color", n: 4, title: "رؤية الألوان", card: cardColor, icon: iconColor,
    ink: "#0a3570", glow: "rgba(70, 160, 255, 0.9)", ring: "#d8eaff",
    subtitle: "كيف يراها الدماغ",
    desc: "امزج أضواء RGB الثلاثية، وشاهد مسار الجسيمات الضوئية واستجابة خلايا العين وإدراك الدماغ.",
    tip: "عيناك ترى ملايين الألوان بثلاثة أنواع من الخلايا فقط!",
  },
  {
    key: "cell", n: 5, title: "رحلة داخل الخلية", card: cardCell, icon: iconCell,
    ink: "#6e0b33", glow: "rgba(255, 90, 160, 0.9)", ring: "#ffd9e9",
    subtitle: "من نقطة ماء إلى العضيّات",
    desc: "كبّر من قطرة ماء حتى داخل خلية حيّة مزدحمة، تجاوز حدّ المجهر المدرسي، واضغط العضيّات لتراها تعمل.",
    tip: "في جسمك مليارات الخلايا… تعال ندخل إحداها!",
  },
  {
    key: "circuits", n: 6, title: "الدوائر الكهربائية", card: cardCircuits, icon: iconCircuits,
    ink: "#5e2510", glow: "rgba(255, 140, 90, 0.9)", ring: "#ffe2d4", soon: true,
    subtitle: "التوالي والتوازي",
    desc: "ركّب دوائر بسيطة، وصِل المصابيح على التوالي والتوازي، وشاهد كيف يتوزّع التيار.",
    tip: "قريباً… سنضيء المصابيح معاً!",
  },
];
const byKey = (key) => EXPERIMENTS.find((e) => e.key === key) || EXPERIMENTS[0];

const STAGES = {
  portrait: { W: 720, H: 1280 },
  landscape: { W: 1280, H: 720 },
  desktop: { W: 1800, H: 900 },
};

// تبقى بين الزيارات داخل الجلسة: الرجوع من تجربة يُبقي آخر بطاقة محدّدة
let lastSelected = EXPERIMENTS[0].key;
let soundOn = true;

/** يقيس المساحة المتاحة ويختار الترتيب ومعامل التكبير. */
function useStage(ref) {
  const [stage, setStage] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      let mode = "portrait";
      if (w >= 1100 && h >= 560 && w / h >= 1.3) mode = "desktop";
      else if (w > h && h < 800) mode = "landscape";
      const { W, H } = STAGES[mode];
      const s = Math.min(w / W, h / H);
      if (mode === "desktop") {
        // مسرح ثابت 1800×900 في منتصف الشاشة
        setStage({ mode, s, W, height: H, top: (h - H * s) / 2, shift: 0 });
      } else {
        const height = h / s;
        // المساحة الزائدة عمودياً تُقسم بين الأعلى وما فوق الشريط السفلي
        setStage({ mode, s, W, height, top: 0, shift: Math.max(0, (height - H) / 2) });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return stage;
}

/** صوت المرور يُشغَّل فقط بعد أول تفاعل (سياسة التشغيل التلقائي في المتصفحات). */
function hoverSfx() {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  play("hover", { volume: 0.45, throttle: 70 });
}

const SQUASH = [
  { transform: "scale(1, 1)" },
  { transform: "scale(1.22, 0.82)", offset: 0.23 },
  { transform: "scale(0.92, 1.15)", offset: 0.57 },
  { transform: "scale(1.03, 0.98)", offset: 0.8 },
  { transform: "scale(1, 1)" },
];
const BOUNCE = [{ transform: "scale(1)" }, { transform: "scale(1.1)", offset: 0.38 }, { transform: "scale(1)" }];

function Mascot({ src, className, react }) {
  const img = useRef(null);
  useEffect(() => {
    if (react) img.current?.animate(BOUNCE, { duration: 260, easing: "ease-out" });
  }, [react]);
  return (
    <div className={`hm-mascot ${className}`}>
      <img
        ref={img}
        src={src}
        alt=""
        draggable={false}
        onPointerDown={() => {
          play("boing", { volume: 0.9, jitter: 0.08 });
          img.current?.animate(SQUASH, { duration: 380, easing: "ease-out" });
        }}
      />
    </div>
  );
}

/** ميلان ثلاثي الأبعاد يتبع مؤشر الفأرة (سطح المكتب فقط). */
function tiltMove(e) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--ry", `${((x - 0.5) * 18).toFixed(2)}deg`);
  el.style.setProperty("--rx", `${((0.5 - y) * 16).toFixed(2)}deg`);
  el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
}
function tiltLeave(e) {
  const s = e.currentTarget.style;
  ["--rx", "--ry", "--gx", "--gy"].forEach((p) => s.removeProperty(p));
}

function ExperimentCard({ exp, selected, onPick, tilt }) {
  return (
    <button
      type="button"
      className={`hm-card${selected ? " is-selected" : ""}${exp.soon ? " is-soon" : ""}`}
      style={{ "--ink": exp.ink, "--glow": exp.glow, "--ring": exp.ring }}
      aria-pressed={selected}
      aria-label={`${exp.n}. ${exp.title}${exp.soon ? " — قريباً" : ""}`}
      onClick={() => onPick(exp.key)}
      onPointerEnter={hoverSfx}
      onPointerMove={tilt ? tiltMove : undefined}
      onPointerLeave={tilt ? tiltLeave : undefined}
    >
      <span className="hm-card-tilt">
        <img className="hm-card-bg" src={exp.card} alt="" draggable={false} />
        <span className="hm-card-ring" aria-hidden="true" />
        <img className="hm-card-icon" src={exp.icon} alt="" draggable={false} />
        <span className="hm-card-badge" aria-hidden="true">{exp.n}</span>
        <span className="hm-card-title" aria-hidden="true">{exp.title}</span>
        {exp.soon && <span className="hm-card-soon" aria-hidden="true">قريباً</span>}
        {tilt && <span className="hm-card-gloss" aria-hidden="true" />}
      </span>
    </button>
  );
}

function SettingsDialog({ open, onClose, sound, onSound }) {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [open, onClose]);

  return (
    <div className="help-overlay" hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="help-modal hm-settings" role="dialog" aria-modal="true" aria-labelledby="hm-settings-title">
        <button type="button" className="help-close" aria-label="إغلاق" onClick={onClose}>
          ✕
        </button>
        <h2 id="hm-settings-title" className="hm-settings-title">الإعدادات</h2>
        <label className="hm-setting">
          <span>المؤثرات الصوتية</span>
          <input type="checkbox" role="switch" checked={sound} onChange={(e) => onSound(e.target.checked)} />
        </label>
        {canFullscreen() && (
          <label className="hm-setting">
            <span>ملء الشاشة</span>
            <input type="checkbox" role="switch" checked={full} onChange={() => toggleFullscreen()} />
          </label>
        )}
      </div>
    </div>
  );
}

/* ---------------- أزرار مشتركة بين الترتيبات ---------------- */
const hb = { onPointerEnter: hoverSfx };

function TopButtons({ onSettings, onSoon }) {
  return (
    <>
      <button type="button" className="hm-btn hm-settings-btn" aria-label="الإعدادات" onClick={onSettings} {...hb}>
        <img src={btnSettings} alt="" draggable={false} />
      </button>
      <button type="button" className="hm-btn hm-trophy-btn" aria-label="الكؤوس" onClick={() => onSoon("الكؤوس")} {...hb}>
        <img src={btnTrophy} alt="" draggable={false} />
      </button>
    </>
  );
}

function LogButton({ onSoon }) {
  return (
    <button type="button" className="hm-btn hm-log-btn" onClick={() => onSoon("سجل التجارب")} {...hb}>
      <img className="hm-btn-img" src={btnLog} alt="" draggable={false} />
      <img className="hm-log-icon" src={iconBook} alt="" draggable={false} />
      <span className="hm-label">سجل التجارب</span>
    </button>
  );
}

function AchButton({ onSoon }) {
  return (
    <button type="button" className="hm-btn hm-ach-btn" onClick={() => onSoon("إنجازاتي")} {...hb}>
      <img className="hm-btn-img" src={btnAch} alt="" draggable={false} />
      <img className="hm-ach-icon" src={iconStar} alt="" draggable={false} />
      <span className="hm-label">إنجازاتي</span>
    </button>
  );
}

function MainButton({ label, className = "", onClick }) {
  return (
    <button type="button" className={`hm-btn hm-main-btn ${className}`} onClick={onClick} {...hb}>
      <img className="hm-btn-img" src={btnMain} alt="" draggable={false} />
      <span className="hm-main-label">{label}</span>
      <span className="hm-flask" aria-hidden="true">
        <img src={iconFlask} alt="" draggable={false} />
      </span>
    </button>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className="hm-toast" role="status">
      {toast.text}
    </div>
  );
}

/* ---------------- ترتيب الجوال (طولي / عرضي) — تصميم اللعبة ---------------- */
function MobileStage({ stage, selected, react, toast, onPick, onLaunch, onSettings, onSoon }) {
  return (
    <div
      className="hm-stage"
      data-mode={stage.mode}
      data-small={stage.s < 0.62 ? "" : undefined}
      style={{ width: stage.W, height: stage.height, transform: `scale(${stage.s}) translateX(-50%)` }}
    >
      <TopButtons onSettings={onSettings} onSoon={onSoon} />

      <div className="hm-group" style={{ top: stage.shift }}>
        <img className="hm-logo" src={logoImg} alt="مختبري" draggable={false} />
        <img className="hm-ribbon" src={ribbonImg} alt="تجربة. اكتشف. افهم!" draggable={false} />
        <Mascot src={boyImg} className="hm-boy" react={react} />
        <Mascot src={monsterImg} className="hm-monster" react={react} />

        <div className="hm-panel">
          <div className="hm-grid">
            {EXPERIMENTS.map((exp) => (
              <ExperimentCard key={exp.key} exp={exp} selected={exp.key === selected} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>

      <Toast toast={toast} />

      <div className="hm-bottom">
        <LogButton onSoon={onSoon} />
        <MainButton label="اختر تجربة" onClick={() => onLaunch(selected)} />
        <AchButton onSoon={onSoon} />
      </div>
    </div>
  );
}

/* ---------------- ترتيب سطح المكتب ---------------- */

/**
 * مسار المراحل: ست عُقد بألوان التجارب يصلها خط يمتلئ حتى التجربة الحالية،
 * ودورق صغير "يقفز" من عقدة إلى أخرى. العقد قابلة للنقر للتحديد.
 */
function Stepper({ exp, onSelect }) {
  const total = EXPERIMENTS.length;
  return (
    <div className="hm-steps" style={{ "--p": (exp.n - 1) / (total - 1), "--cur": exp.glow }}>
      <div className="hm-steps-track">
        <span className="hm-steps-line" />
        <span className="hm-steps-fill" />
        {EXPERIMENTS.map((e) => (
          <button
            key={e.key}
            type="button"
            className={`hm-step${e.n === exp.n ? " is-on" : ""}${e.n < exp.n ? " is-done" : ""}`}
            style={{ "--c": e.glow, "--ink": e.ink }}
            aria-label={`${e.n}. ${e.title}`}
            aria-current={e.n === exp.n ? "step" : undefined}
            onClick={() => e.n !== exp.n && onSelect(e.key)}
            onPointerEnter={hoverSfx}
          >
            {e.n}
          </button>
        ))}
        <span className="hm-steps-marker" aria-hidden="true">
          <img key={exp.key} src={iconFlask} alt="" draggable={false} />
        </span>
      </div>
      <span className="hm-steps-label">
        التجربة
        <span className="hm-steps-num">
          <b key={exp.key}>{exp.n}</b>
        </span>
        من {total}
      </span>
    </div>
  );
}

function Spotlight({ exp, onLaunch, onSelect }) {
  return (
    <section
      className={`hm-spot${exp.soon ? " is-soon" : ""}`}
      style={{ "--ink": exp.ink, "--glow": exp.glow, "--ring": exp.ring }}
      aria-live="polite"
    >
      <div className="hm-spot-art" key={`a-${exp.key}`} aria-hidden="true">
        <span className="hm-spot-num">{String(exp.n).padStart(2, "0")}</span>
        <span className="hm-spot-glow" />
        <svg className="hm-spot-orbit" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="176" />
          <circle className="dot" cx="200" cy="24" r="9" />
          <circle className="dot small" cx="376" cy="200" r="6" />
          <circle className="dot" cx="70" cy="320" r="7" />
        </svg>
        <span className="hm-spot-pedestal" />
        <img className="hm-spot-icon" src={exp.icon} alt="" draggable={false} />
      </div>

      <div className="hm-spot-text">
        <p className="hm-spot-tip" key={`tip-${exp.key}`}>{exp.tip}</p>
        <Stepper exp={exp} onSelect={onSelect} />
        <div className="hm-spot-body" key={`b-${exp.key}`}>
          <h2 className={`hm-spot-title${exp.title.length > 10 ? " is-long" : ""}`}>{exp.title}</h2>
          <p className="hm-spot-sub">{exp.subtitle}</p>
          <p className="hm-spot-desc">{exp.desc}</p>
        </div>
      </div>

      <MainButton
        className={`hm-spot-go${exp.soon ? " is-soon" : ""}`}
        label={exp.soon ? "قريباً" : "ابدأ التجربة"}
        onClick={() => onLaunch(exp.key)}
      />
    </section>
  );
}

/* رسومات علمية خفيفة تطفو في الخلفية (خطّية بألوان الثيم) */
const DOODLES = [
  { k: "flask", x: 3, y: 18, s: 70, c: "g", d: 9 },
  { k: "atom", x: 11, y: 74, s: 96, c: "o", d: 13 },
  { k: "bubble", x: 22, y: 6, s: 34, c: "g", d: 7 },
  { k: "spark", x: 33, y: 93, s: 36, c: "y", d: 8 },
  { k: "hex", x: 46, y: 4, s: 64, c: "o", d: 12 },
  { k: "bubble", x: 49, y: 90, s: 46, c: "g", d: 10 },
  { k: "tube", x: 58, y: 12, s: 62, c: "r", d: 11 },
  { k: "spark", x: 64, y: 3, s: 30, c: "y", d: 6 },
  { k: "bulb", x: 74, y: 92, s: 64, c: "y", d: 12 },
  { k: "atom", x: 88, y: 6, s: 80, c: "g", d: 14 },
  { k: "bubble", x: 95, y: 40, s: 40, c: "o", d: 9 },
  { k: "flask", x: 96, y: 80, s: 66, c: "o", d: 10 },
  { k: "spark", x: 1, y: 52, s: 32, c: "y", d: 7 },
  { k: "hex", x: 89, y: 64, s: 50, c: "r", d: 13 },
  { k: "bubble", x: 6, y: 92, s: 28, c: "g", d: 8 },
  { k: "tube", x: 36, y: 2, s: 48, c: "g", d: 10 },
];
function Doodle({ k }) {
  switch (k) {
    case "flask":
      return <path d="M18 5h12M20 5v13L10 38a4 4 0 0 0 3.6 6h20.8a4 4 0 0 0 3.6-6L28 18V5M14 30h20" />;
    case "atom":
      return (
        <>
          <ellipse cx="24" cy="24" rx="21" ry="8" />
          <ellipse cx="24" cy="24" rx="21" ry="8" transform="rotate(60 24 24)" />
          <ellipse cx="24" cy="24" rx="21" ry="8" transform="rotate(120 24 24)" />
          <circle cx="24" cy="24" r="3" fill="currentColor" />
        </>
      );
    case "bubble":
      return (
        <>
          <circle cx="24" cy="24" r="18" />
          <path d="M14 20a10 10 0 0 1 8-8" />
        </>
      );
    case "spark":
      return <path d="M24 4l4 16 16 4-16 4-4 16-4-16-16-4 16-4z" fill="currentColor" stroke="none" />;
    case "hex":
      return (
        <>
          <path d="M24 6l15 9v18l-15 9-15-9V15z" />
          <circle cx="24" cy="6" r="3" fill="currentColor" />
          <circle cx="39" cy="33" r="3" fill="currentColor" />
          <circle cx="9" cy="33" r="3" fill="currentColor" />
        </>
      );
    case "tube":
      return <path d="M19 4h10M21 4v32a3 3 0 0 0 6 0V4M21 24h6" />;
    case "bulb":
      return <path d="M18 31a11 11 0 1 1 12 0v5H18zM19 41h10M24 22v9" />;
    default:
      return null;
  }
}
function Doodles() {
  return (
    <div className="hm-doodles" aria-hidden="true">
      {DOODLES.map((d, i) => (
        <svg
          key={i}
          className={`hm-doodle c-${d.c}`}
          viewBox="0 0 48 48"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, animationDuration: `${d.d}s`, animationDelay: `${-i * 1.3}s` }}
        >
          <Doodle k={d.k} />
        </svg>
      ))}
    </div>
  );
}

function DesktopStage({ stage, selected, react, toast, onPick, onSelect, onLaunch, onSettings, onSoon }) {
  const exp = byKey(selected);
  return (
    <div
      className="hm-stage"
      data-mode="desktop"
      style={{ width: stage.W, height: stage.height, top: stage.top, transform: `scale(${stage.s}) translateX(-50%)` }}
    >
      <TopButtons onSettings={onSettings} onSoon={onSoon} />
      <AchButton onSoon={onSoon} />
      <LogButton onSoon={onSoon} />

      <img className="hm-logo" src={logoImg} alt="مختبري" draggable={false} />
      <img className="hm-ribbon" src={ribbonImg} alt="تجربة. اكتشف. افهم!" draggable={false} />

      <Mascot src={boyImg} className="hm-boy" react={react} />
      <Mascot src={monsterImg} className="hm-monster" react={react} />

      <Spotlight exp={exp} onLaunch={onLaunch} onSelect={onSelect} />

      <div className="hm-panel">
        <div className="hm-grid">
          {EXPERIMENTS.map((e) => (
            <ExperimentCard key={e.key} exp={e} selected={e.key === selected} onPick={onPick} tilt />
          ))}
        </div>
      </div>
      <p className="hm-hint">
        اضغط البطاقة مرتين أو <kbd>Enter</kbd> للبدء · الأسهم <kbd>→</kbd> <kbd>←</kbd> للتنقّل
      </p>

      <Toast toast={toast} />
    </div>
  );
}

/* ---------------- الشاشة ---------------- */
export default function HomeScreen({ onOpen }) {
  const viewport = useRef(null);
  const home = useRef(null);
  const stage = useStage(viewport);
  const desktop = stage?.mode === "desktop";
  const [selected, setSelected] = useState(lastSelected);
  const [react, setReact] = useState(0);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const toastTimer = useRef(0);

  useEffect(() => {
    setMuted(!sound);
    soundOn = sound;
  }, [sound]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function say(text) {
    clearTimeout(toastTimer.current);
    setToast({ text, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function launch(key) {
    const exp = byKey(key);
    if (exp.soon) {
      play("pop", { volume: 0.7 });
      say(`تجربة ${exp.title} قريباً!`);
      return;
    }
    play("whoosh", { volume: 0.8 });
    onOpen(key);
  }

  function select(key) {
    lastSelected = key;
    setSelected(key);
    setReact((r) => r + 1);
    play("select", { volume: 0.8 });
  }

  function pick(key) {
    if (key === selected) launch(key);
    else select(key);
  }

  const openSettings = () => {
    play("click", { volume: 0.8 });
    setSettings(true);
  };
  const closeSettings = useCallback(() => {
    play("back", { volume: 0.8 });
    setSettings(false);
  }, []);

  function comingSoon(what) {
    play("click", { volume: 0.8 });
    say(`${what} — قريباً!`);
  }

  // سطح المكتب: الأسهم تنقل التحديد في الشبكة (من اليمين لليسار)، و Enter يبدأ التجربة
  const keyState = useRef({});
  keyState.current = { selected, select, launch, settings };
  useEffect(() => {
    if (!desktop) return undefined;
    const onKey = (e) => {
      const st = keyState.current;
      if (st.settings || e.altKey || e.ctrlKey || e.metaKey) return;
      const i = EXPERIMENTS.findIndex((x) => x.key === st.selected);
      const step = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
      if (step) {
        e.preventDefault();
        const j = Math.min(EXPERIMENTS.length - 1, Math.max(0, i + step));
        if (j !== i) st.select(EXPERIMENTS[j].key);
      } else if (e.key === "Enter" && !(document.activeElement instanceof HTMLButtonElement)) {
        st.launch(st.selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop]);

  // حركة parallax خفيفة تتبع الفأرة (بلا إعادة رسم React)
  const raf = useRef(0);
  function onParallax(e) {
    if (e.pointerType !== "mouse" || raf.current) return;
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = home.current;
      if (!el) return;
      el.style.setProperty("--px", ((clientX / window.innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty("--py", ((clientY / window.innerHeight) * 2 - 1).toFixed(3));
    });
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const sel = byKey(selected);
  const props = { stage, selected, react, toast, onPick: pick, onSelect: select, onLaunch: launch, onSettings: openSettings, onSoon: comingSoon };

  return (
    <div
      ref={home}
      className={`home${desktop ? " is-desktop" : ""}`}
      style={desktop ? { "--aura": sel.glow.replace(/[\d.]+\)$/, "0.26)") } : undefined}
      onPointerMove={desktop ? onParallax : undefined}
    >
      {desktop && <div className="hm-aura" aria-hidden="true" />}
      {desktop && <Doodles />}
      <div className="home-viewport" ref={viewport}>
        {stage && (desktop ? <DesktopStage {...props} /> : <MobileStage {...props} />)}
      </div>

      <SettingsDialog open={settings} onClose={closeSettings} sound={sound} onSound={setSound} />
    </div>
  );
}
