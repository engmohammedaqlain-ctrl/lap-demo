/**
 * HomeScreen.jsx — شاشة اختيار التجربة، منقولة من القائمة الرئيسية في لعبة
 * "مختبري" (lab-game: src/ui/main_menu) بنفس العناصر والحركات: الشعار
 * والشريط، الولد العالِم والوحش البنفسجي، لوحة زجاجية ببطاقات التجارب
 * الخمس (٣ فوق و٢ في المنتصف)، وأزرار (سجل التجارب / اختر تجربة / إنجازاتي).
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
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./home.css";
import { play, setMuted } from "./audio/sfx.js";
import { canFullscreen, toggleFullscreen } from "./mobile/device.js";
import { emit, set as bfSet } from "./banfoush/store.js";
import BanfoushEyes from "./banfoush/BanfoushEyes.jsx";

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
import iconBuoyancy from "./assets/home/icon_buoyancy.webp";
import iconPh from "./assets/home/icon_ph.webp";
import iconStatic from "./assets/home/icon_static.webp";
import iconColor from "./assets/home/icon_color.webp";
import iconCell from "./assets/home/icon_cell.webp";

/* ink: لون حدّ العنوان ورقم الشارة، glow: توهّج التحديد، ring: إطار التحديد */
const EXPERIMENTS = [
  {
    key: "buoyancy", n: 1, title: "الطفو", card: cardBuoyancy, icon: iconBuoyancy,
    ink: "#0b3d20", glow: "rgba(52, 199, 112, 0.9)", ring: "#d9f7e5",
    subtitle: "تجربة أرخميدس",
    desc: "اسحب الأجسام إلى البركة وشاهد متى تطفو ومتى تغرق، مع قياس القوى الحقيقية.",
  },
  {
    key: "ph", n: 2, title: "الأس الهيدروجيني", card: cardPh, icon: iconPh,
    ink: "#2c1466", glow: "rgba(160, 110, 255, 0.9)", ring: "#e9e0ff",
    subtitle: "حمضي · متعادل · قاعدي",
    desc: "اختبر سوائل من حياتك اليومية، خفّفها بالماء، وحضّر محلولك وشاهد اللون يتغيّر.",
  },
  {
    key: "static", n: 3, title: "الكهرباء الساكنة", card: cardStatic, icon: iconStatic,
    ink: "#663c00", glow: "rgba(255, 190, 60, 0.9)", ring: "#fff1cc",
    subtitle: "البالونات والشحنات",
    desc: "افرك البالون بالسترة لتنقل إلكترونات، ثم أفلته وشاهده يلتصق بالسترة أو الجدار.",
  },
  {
    key: "color", n: 4, title: "رؤية الألوان", card: cardColor, icon: iconColor,
    ink: "#0a3570", glow: "rgba(70, 160, 255, 0.9)", ring: "#d8eaff",
    subtitle: "كيف يراها الدماغ",
    desc: "امزج أضواء RGB الثلاثية، وشاهد مسار الجسيمات الضوئية واستجابة خلايا العين وإدراك الدماغ.",
  },
  {
    key: "cell", n: 5, title: "رحلة داخل الخلية", card: cardCell, icon: iconCell,
    ink: "#6e0b33", glow: "rgba(255, 90, 160, 0.9)", ring: "#ffd9e9",
    subtitle: "من نقطة ماء إلى العضيّات",
    desc: "كبّر من قطرة ماء حتى داخل خلية حيّة مزدحمة، تجاوز حدّ المجهر المدرسي، واضغط العضيّات لتراها تعمل.",
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
        const height = h / s;
        setStage({ mode, s, W, height, top: 0, shift: Math.max(0, (height - H) / 2) });
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

function Mascot({ src, className, react, onTap, label, children }) {
  const body = useRef(null);
  useEffect(() => {
    if (react) body.current?.animate(BOUNCE, { duration: 260, easing: "ease-out" });
  }, [react]);
  return (
    <div className={`hm-mascot ${className}`}>
      <div
        ref={body}
        className="hm-mascot-body"
        role={onTap ? "button" : undefined}
        aria-label={label}
        onPointerDown={() => {
          play("boing", { volume: 0.9, jitter: 0.08 });
          body.current?.animate(SQUASH, { duration: 380, easing: "ease-out" });
          onTap?.();
        }}
      >
        <img src={src} alt="" draggable={false} />
        {children}
      </div>
    </div>
  );
}

/* الوحش البنفسجي = بنفوش: عيناه تلاحقان المؤشر، والضغط عليه يفتح المحادثة */
function MonsterBanfoush({ react }) {
  return (
    <Mascot src={monsterImg} className="hm-monster" react={react} onTap={() => emit("monster")} label="بنفوش — احكي معي">
      <BanfoushEyes />
    </Mascot>
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
      className={`hm-card${selected ? " is-selected" : ""}`}
      style={{ "--ink": exp.ink, "--glow": exp.glow, "--ring": exp.ring }}
      aria-pressed={selected}
      aria-label={`${exp.n}. ${exp.title}`}
      onClick={() => onPick(exp.key)}
      onPointerEnter={(e) => {
        hoverSfx();
        if (e.pointerType === "mouse") emit("hover", exp.key);
      }}
      onPointerMove={tilt ? tiltMove : undefined}
      onPointerLeave={(e) => {
        if (tilt) tiltLeave(e);
        emit("hoverEnd", exp.key);
      }}
    >
      <span className="hm-card-tilt">
        <img className="hm-card-bg" src={exp.card} alt="" draggable={false} />
        <span className="hm-card-ring" aria-hidden="true" />
        <img className="hm-card-icon" src={exp.icon} alt="" draggable={false} />
        <span className="hm-card-badge" aria-hidden="true">{exp.n}</span>
        <span className="hm-card-title" aria-hidden="true">{exp.title}</span>
        {tilt && <span className="hm-card-gloss" aria-hidden="true" />}
      </span>
    </button>
  );
}

/* ---------------- ترتيب "الذرّة" للبطاقات ---------------- */
/*
 * البطاقات الخمس إلكترونات على مدار إهليلجي حول نواة متوهّجة. لكل ترتيب
 * هندسته الخاصة (بوحدات المحتوى الداخلي للوحة) حتى لا تتداخل البطاقات:
 * W×H مساحة المحتوى، (cx,cy) مركز النواة، rx/ry نصفا قطر المدار،
 * cw×ch مقاس البطاقة، start زاوية البطاقة الأولى، nr نصف قطر النواة.
 * الترقيم عكس عقارب الساعة (من اليمين لليسار) كما يُقرأ بالعربي.
 */
const ORBIT = {
  portrait: { W: 662, H: 558, cx: 331, cy: 296, rx: 245, ry: 180, cw: 176, ch: 196, start: -90, nr: 54 },
  landscape: { W: 678, H: 366, cx: 314, cy: 183, rx: 255, ry: 122, cw: 150, ch: 130, start: 0, nr: 44 },
};
const ellipsePath = (cx, cy, rx, ry) => `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
const NUCLEUS = [
  [0, 0, "k"],
  [1, 0, "r"],
  [0.5, 0.87, "g"],
  [-0.5, 0.87, "w"],
  [-1, 0, "r"],
  [-0.5, -0.87, "g"],
  [0.5, -0.87, "w"],
];
const SPHERE = { r: ["#ff5a6a", "#CE1126", "#8a0a19"], g: ["#4cc27f", "#1B7340", "#0c3d22"], w: ["#ffffff", "#efe6d2", "#b9ad94"], k: ["#5a5a5a", "#1A1A1A", "#000"] };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ExperimentOrbit({ mode, selected, onPick, tilt, action }) {
  const g = ORBIT[mode] || ORBIT.portrait;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const sel = EXPERIMENTS.find((e) => e.key === selected) || EXPERIMENTS[0];
  const still = reducedMotion();
  const pts = EXPERIMENTS.map((_, i) => {
    const a = ((g.start - i * 72) * Math.PI) / 180;
    return [g.cx + g.rx * Math.cos(a), g.cy + g.ry * Math.sin(a)];
  });
  const s = g.nr * 0.36; // نصف قطر كرة النواة
  const rings = g.rings || [
    { rot: 58, rx: g.rx * 0.6, ry: g.ry * 0.42, dur: 5.5 },
    { rot: -58, rx: g.rx * 0.6, ry: g.ry * 0.42, dur: 7 },
  ];
  const ncy = g.cy + (g.ny || 0); // مركز النواة

  return (
    <div className="hm-orbit" style={{ "--cur": sel.glow }}>
      <svg className="hm-orbit-svg" viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden="true">
        <defs>
          <radialGradient id={`${uid}halo`}>
            <stop offset="0" style={{ stopColor: "var(--cur)" }} stopOpacity="0.75" />
            <stop offset="0.55" style={{ stopColor: "var(--cur)" }} stopOpacity="0.22" />
            <stop offset="1" style={{ stopColor: "var(--cur)" }} stopOpacity="0" />
          </radialGradient>
          {Object.entries(SPHERE).map(([k, [hi, mid, lo]]) => (
            <radialGradient key={k} id={`${uid}${k}`} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor={hi} />
              <stop offset="0.55" stopColor={mid} />
              <stop offset="1" stopColor={lo} />
            </radialGradient>
          ))}
        </defs>

        {/* المدار الرئيسي يمر بمراكز البطاقات + مداران متقاطعان (رمز الذرّة) */}
        <ellipse className="hm-ring hm-ring-main" cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} />
        {rings.map((r, i) => (
          <g key={i} transform={`rotate(${r.rot} ${g.cx} ${g.cy})`}>
            <ellipse className="hm-ring" cx={g.cx} cy={g.cy} rx={r.rx} ry={r.ry} />
            {!still && (
              <circle className="hm-electron" r="5.5">
                <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" path={ellipsePath(g.cx, g.cy, r.rx, r.ry)} />
              </circle>
            )}
          </g>
        ))}
        {!still && (
          <circle className="hm-electron is-big" r="7">
            <animateMotion dur="14s" repeatCount="indefinite" path={ellipsePath(g.cx, g.cy, g.rx, g.ry)} />
          </circle>
        )}

        {/* روابط من النواة لكل بطاقة؛ رابط المختارة يتوهّج وتجري فيه الطاقة */}
        {pts.map(([x, y], i) => (
          <line key={i} className={`hm-bond${EXPERIMENTS[i].key === selected ? " is-on" : ""}`} x1={g.cx} y1={ncy} x2={x} y2={y} />
        ))}

        <g className="hm-nucleus" style={{ transformOrigin: `${g.cx}px ${ncy}px` }}>
          <circle cx={g.cx} cy={ncy} r={g.nr * 1.9} fill={`url(#${uid}halo)`} className="hm-nucleus-halo" />
          <g className="hm-nucleus-core" style={{ transformOrigin: `${g.cx}px ${ncy}px` }}>
            {NUCLEUS.map(([dx, dy, c], i) => (
              <circle key={i} cx={g.cx + dx * s * 1.55} cy={ncy + dy * s * 1.55} r={s} fill={`url(#${uid}${c})`} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
            ))}
          </g>
        </g>
      </svg>

      {EXPERIMENTS.map((exp, i) => (
        <div
          key={exp.key}
          className={`hm-orbit-slot${exp.key === selected ? " is-sel" : ""}`}
          style={{ left: pts[i][0] - g.cw / 2, top: pts[i][1] - g.ch / 2, width: g.cw, height: g.ch, animationDelay: `${-i * 0.9}s` }}
        >
          <ExperimentCard exp={exp} selected={exp.key === selected} onPick={onPick} tilt={tilt} />
        </div>
      ))}

      {action && g.action && (
        <div className="hm-orbit-action" style={{ left: g.action.x, top: g.action.y }}>
          {action}
        </div>
      )}
    </div>
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

/* ---------------- ترتيب الجوال (طولي / عرضي) — تصميم اللعبة ---------------- */
function MobileStage({ stage, selected, react, onPick, onLaunch, onSettings, onSoon }) {
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
        <MonsterBanfoush react={react} />

        <div className="hm-panel">
          <ExperimentOrbit mode={stage.mode} selected={selected} onPick={onPick} />
        </div>
      </div>

      <div className="hm-bottom">
        <LogButton onSoon={onSoon} />
        <MainButton label="اختر تجربة" onClick={() => onLaunch(selected)} />
        <AchButton onSoon={onSoon} />
      </div>
    </div>
  );
}

/* ---------------- ترتيب سطح المكتب ---------------- */

/* ---------------- المدار ثلاثي الأبعاد (سطح المكتب) ---------------- */
/*
 * البطاقات الخمس تدور على مدار مائل حول النواة: التجربة المختارة في
 * المقدمة كبيرة ومضيئة، والباقي يبتعد للخلف أصغر وأبهت. الضغط على أي
 * بطاقة يدوّر المدار (على المسار الإهليلجي نفسه) حتى تصل للمقدمة.
 * الترتيب من اليمين لليسار: التالية دائماً على يسار المختارة.
 */
const CAROUSEL = { W: 1400, H: 700, cx: 700, cy: 250, rx: 520, ry: 160, cw: 270, ch: 290, nr: 54, ny: -42, btnY: 652 };

function OrbitCarousel({ selected, onPick, onLaunch }) {
  const g = CAROUSEL;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const sel = Math.max(0, EXPERIMENTS.findIndex((e) => e.key === selected));
  const exp = EXPERIMENTS[sel];
  const slots = useRef([]);
  const rot = useRef(sel * 72);
  const raf = useRef(0);
  const still = reducedMotion();
  const ncy = g.cy + g.ny;
  const s = g.nr * 0.36;

  const place = useCallback((R) => {
    EXPERIMENTS.forEach((_, i) => {
      const el = slots.current[i];
      if (!el) return;
      const th = ((90 + i * 72 - R) * Math.PI) / 180;
      const x = g.cx + g.rx * Math.cos(th);
      const y = g.cy + g.ry * Math.sin(th);
      const depth = (Math.sin(th) + 1) / 2; // ٠ = الخلف، ١ = المقدمة
      el.style.transform = `translate(${(x - g.cw / 2).toFixed(1)}px, ${(y - g.ch / 2).toFixed(1)}px) scale(${(0.58 + 0.42 * depth).toFixed(3)})`;
      el.style.zIndex = String(Math.round(depth * 100));
      el.style.setProperty("--depth", depth.toFixed(3));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => place(rot.current), [place]);

  useEffect(() => {
    const target = sel * 72;
    const from = rot.current;
    const diff = ((((target - from) % 360) + 540) % 360) - 180;
    if (Math.abs(diff) < 0.01 || still) {
      rot.current = target;
      place(target);
      return undefined;
    }
    const t0 = performance.now();
    const dur = 650 + Math.abs(diff) * 1.6;
    const ease = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // انطلاق مع ارتداد خفيف
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      rot.current = from + diff * ease(k);
      place(rot.current);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [sel, place, still]);

  return (
    <div className="hm-carousel" style={{ "--cur": exp.glow }}>
      {/* المدارات والإلكترونات خلف كل شيء */}
      <svg className="hm-orbit-svg" viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden="true">
        <ellipse className="hm-ring hm-ring-glow" cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} />
        <ellipse className="hm-ring hm-ring-main" cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} />
        {[22, -22].map((rotDeg, i) => (
          <g key={i} transform={`rotate(${rotDeg} ${g.cx} ${ncy})`}>
            <ellipse className="hm-ring" cx={g.cx} cy={ncy} rx={g.rx * 0.62} ry={g.ry * 0.5} />
            {!still && (
              <circle className="hm-electron" r="6">
                <animateMotion dur={`${6 + i * 1.5}s`} repeatCount="indefinite" path={ellipsePath(g.cx, ncy, g.rx * 0.62, g.ry * 0.5)} />
              </circle>
            )}
          </g>
        ))}
        {!still && (
          <circle className="hm-electron is-big" r="8">
            <animateMotion dur="16s" repeatCount="indefinite" path={ellipsePath(g.cx, g.cy, g.rx, g.ry)} />
          </circle>
        )}
        <line className="hm-bond is-on" x1={g.cx} y1={ncy} x2={g.cx} y2={g.cy + g.ry - g.ch * 0.3} />
      </svg>

      {/* النواة بين البطاقات الخلفية والأمامية */}
      <svg
        className="hm-carousel-nucleus"
        viewBox={`${g.cx - g.nr * 2} ${ncy - g.nr * 2} ${g.nr * 4} ${g.nr * 4}`}
        style={{ left: g.cx - g.nr * 2, top: ncy - g.nr * 2, width: g.nr * 4, height: g.nr * 4 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${uid}halo`}>
            <stop offset="0" style={{ stopColor: "var(--cur)" }} stopOpacity="0.8" />
            <stop offset="0.55" style={{ stopColor: "var(--cur)" }} stopOpacity="0.25" />
            <stop offset="1" style={{ stopColor: "var(--cur)" }} stopOpacity="0" />
          </radialGradient>
          {Object.entries(SPHERE).map(([k, [hi, mid, lo]]) => (
            <radialGradient key={k} id={`${uid}${k}`} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor={hi} />
              <stop offset="0.55" stopColor={mid} />
              <stop offset="1" stopColor={lo} />
            </radialGradient>
          ))}
        </defs>
        <circle cx={g.cx} cy={ncy} r={g.nr * 1.95} fill={`url(#${uid}halo)`} className="hm-nucleus-halo" />
        <g className="hm-nucleus-core" style={{ transformOrigin: `${g.cx}px ${ncy}px` }}>
          {NUCLEUS.map(([dx, dy, c], i) => (
            <circle key={i} cx={g.cx + dx * s * 1.55} cy={ncy + dy * s * 1.55} r={s} fill={`url(#${uid}${c})`} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          ))}
        </g>
      </svg>

      {EXPERIMENTS.map((e, i) => (
        <div key={e.key} ref={(n) => (slots.current[i] = n)} className={`hm-carousel-slot${i === sel ? " is-front" : ""}`} style={{ width: g.cw, height: g.ch }}>
          <div className="hm-carousel-bob" style={{ animationDelay: `${-i * 0.8}s` }}>
            <ExperimentCard exp={e} selected={i === sel} onPick={onPick} tilt />
          </div>
        </div>
      ))}

      <div className="hm-orbit-action" style={{ left: g.cx, top: g.btnY }}>
        <MainButton
          key={exp.key}
          className={`hm-orbit-go${exp.title.length > 8 ? " is-long" : ""}`}
          label={`ابدأ ${exp.title}`}
          onClick={() => onLaunch(exp.key)}
        />
      </div>
    </div>
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

function DesktopStage({ stage, selected, react, onPick, onLaunch, onSettings, onSoon }) {
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

      <OrbitCarousel selected={selected} onPick={onPick} onLaunch={onLaunch} />

      <Mascot src={boyImg} className="hm-boy" react={react} />
      <MonsterBanfoush react={react} />

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
  const [settings, setSettings] = useState(false);
  const [sound, setSound] = useState(soundOn);

  useEffect(() => {
    setMuted(!sound);
    soundOn = sound;
  }, [sound]);

  function launch(key) {
    play("whoosh", { volume: 0.8 });
    emit("launch", key);
    onOpen(key);
  }

  function select(key) {
    lastSelected = key;
    setSelected(key);
    setReact((r) => r + 1);
    play("select", { volume: 0.8 });
    emit("select", key);
  }

  // بنفوش يعرف التجربة المحددة حالياً (للاقتراحات وزر "ابدأ")
  useEffect(() => {
    bfSet({ selected });
  }, [selected]);

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

  // الأقسام غير الجاهزة: بنفوش هو اللي بيعلّق عليها
  function comingSoon(what) {
    play("click", { volume: 0.8 });
    emit("soon", what);
  }

  // سطح المكتب: الأسهم تنقل التحديد في الشبكة (من اليمين لليسار)، و Enter يبدأ التجربة
  const keyState = useRef({});
  keyState.current = { selected, select, launch, settings };
  useEffect(() => {
    if (!desktop) return undefined;
    const onKey = (e) => {
      const st = keyState.current;
      if (st.settings || e.altKey || e.ctrlKey || e.metaKey) return;
      // الكتابة في محادثة بنفوش أو أي حقل نصي لا تحرّك البطاقات
      if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable], .bf-root")) return;
      const i = EXPERIMENTS.findIndex((x) => x.key === st.selected);
      // البطاقات على مدار دائري (عكس عقارب الساعة): اليسار/الأسفل = التالية، مع الالتفاف
      const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[e.key];
      if (step) {
        e.preventDefault();
        emit("nav");
        const n = EXPERIMENTS.length;
        st.select(EXPERIMENTS[(i + step + n) % n].key);
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
  const props = { stage, selected, react, onPick: pick, onLaunch: launch, onSettings: openSettings, onSoon: comingSoon };

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
