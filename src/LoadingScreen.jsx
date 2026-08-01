/**
 * LoadingScreen.jsx — شاشة تحميل تُعرض لحظة إقلاع التطبيق قبل الشاشة
 * الرئيسية، بنفس الهوية البصرية (ألوان العلم، خلفية الكشمير، خط IBM Plex
 * Sans Arabic). شريط تقدّم زمني بسيط (لا ينتظر تحميل موارد فعلية) مع
 * رسائل متبدّلة تمنح إحساساً بالتجهيز، ثم يتلاشى ليكشف الشاشة الرئيسية.
 */
import { useEffect, useState } from "react";
import "./home.css";
import "./loading.css";

const DURATION = 1500; // مدة شريط التقدم بالمللي ثانية
const FADE_OUT = 380; // مدة تلاشي الخروج، يجب أن تطابق loading.css

const MESSAGES = [
  { at: 0, text: "جارٍ تجهيز المختبر…" },
  { at: 25, text: "جارٍ ضبط الأنابيب…" },
  { at: 50, text: "جارٍ خلط الألوان…" },
  { at: 75, text: "جارٍ شحن البالونات…" },
  { at: 92, text: "على وشك الانطلاق…" },
];

export default function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf;

    function tick(now) {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / DURATION) * 100));
      setProgress(pct);
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        setTimeout(onDone, FADE_OUT);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const message = [...MESSAGES].reverse().find((m) => progress >= m.at)?.text ?? MESSAGES[0].text;

  return (
    <div className={`loading${leaving ? " loading-leave" : ""}`} role="status" aria-live="polite">
      <div className="loading-inner">
        <div className="home-flag" aria-hidden="true" />

        <div className="loading-ring-outer" aria-hidden="true">
          <div className="loading-ring-inner">
            <span className="loading-ring-emoji">🧪</span>
          </div>
        </div>

        <h1 className="home-title">المختبر التفاعلي</h1>
        <p className="home-tagline">تجارب علمية عربية — تعلّم وأنت تلعب</p>

        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-status-row">
          <span className="loading-status">{message}</span>
          <span className="loading-percent">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
