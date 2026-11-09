/**
 * Hud.jsx — أزرار الواجهة المشتركة لكل التجارب (رئيسية / شرح / صوت / إعادة).
 * أيقونات خطّية بلا إيموجي، أهداف لمس ٤٦px، وتلميح عند الحاجة.
 */
import { IconHome, IconHelp, IconSound, IconReset } from "./icons.jsx";

export default function Hud({ onHome, onHelp, sound, onSound, onReset, children }) {
  return (
    <div className="lab-cluster">
      {onHome && (
        <button type="button" className="lab-btn" aria-label="الرئيسية" title="الرئيسية" onClick={onHome}>
          <IconHome />
        </button>
      )}
      {onHelp && (
        <button type="button" className="lab-btn" aria-label="شرح" title="شرح" onClick={onHelp}>
          <IconHelp />
        </button>
      )}
      {onSound && (
        <button
          type="button"
          className="lab-btn"
          aria-label={sound ? "إيقاف الصوت" : "تشغيل الصوت"}
          title={sound ? "إيقاف الصوت" : "تشغيل الصوت"}
          onClick={onSound}
        >
          <IconSound muted={!sound} />
        </button>
      )}
      {onReset && (
        <button type="button" className="lab-btn" aria-label="إعادة الضبط" title="إعادة الضبط" onClick={onReset}>
          <IconReset />
        </button>
      )}
      {children}
    </div>
  );
}
