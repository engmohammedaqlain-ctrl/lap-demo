/**
 * SoundToggle.jsx — يشغّل/يوقف كل المؤثرات الصوتية
 */
import { SoundEngine } from "../audio/soundEngine.js";

export default function SoundToggle({ stateRef, actions }) {
  const enabled = stateRef.current.soundEnabled;

  function handleClick() {
    const next = !enabled;
    actions.setSoundEnabled(next);
    SoundEngine.setMuted(!next);
  }

  return (
    <button
      id="sound-toggle"
      className="hud-sound"
      aria-label={enabled ? "إيقاف الصوت" : "تشغيل الصوت"}
      onClick={handleClick}
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}
