/**
 * StaticApp.jsx — تجربة "البالونات والكهرباء الساكنة". اسحب البالون وافركه
 * بالسترة لتنقل إلكترونات فيصبح سالباً، ثم أفلته ليلتصق بالسترة أو الجدار.
 * الشريط العلوي والأدوات واللوحة التفسيرية بطابع الموقع نفسه وباللغة العربية.
 */
import { useCallback, useRef, useState } from "react";
import StaticScene from "./StaticScene.jsx";
import StaticControls from "./components/StaticControls.jsx";
import StaticInfoPanel from "./components/StaticInfoPanel.jsx";
import StaticHelpModal from "./components/StaticHelpModal.jsx";
import { StaticSound } from "./staticAudio.js";
import "./static.css";

export default function StaticApp({ onHome }) {
  const [displayMode, setDisplayMode] = useState("all");
  const [wallOn, setWallOn] = useState(true);
  const [balloonCount, setBalloonCount] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [status, setStatus] = useState({ phase: "neutral", charge: 0 });

  const sceneRef = useRef(null);

  const onStatus = useCallback((s) => setStatus(s), []);

  function click() {
    if (soundEnabled) StaticSound.playClick();
  }
  function changeMode(m) {
    setDisplayMode(m);
    click();
  }
  function toggleWall() {
    setWallOn((v) => !v);
    click();
  }
  function changeCount(n) {
    setBalloonCount(n);
    click();
  }
  function reset() {
    sceneRef.current?.reset();
    click();
  }
  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      StaticSound.setMuted(!next);
      return next;
    });
  }

  return (
    <div className="st-stage">
      <header className="st-topbar">
        <button type="button" className="st-home-btn" onClick={onHome} title="الرئيسية">
          🏠 <span className="st-home-text">الرئيسية</span>
        </button>
        <div className="st-title">
          <span className="st-title-main">الكهرباء الساكنة</span>
        </div>
        <div className="st-topbar-actions">
          <button
            type="button"
            className="st-help-btn"
            onClick={() => {
              setHelpOpen(true);
              click();
            }}
            aria-label="شرح الدرس"
            title="شرح الدرس"
          >
            ؟
          </button>
          <button
            type="button"
            className="st-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <StaticHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <StaticControls
        displayMode={displayMode}
        onModeChange={changeMode}
        wallOn={wallOn}
        onToggleWall={toggleWall}
        balloonCount={balloonCount}
        onBalloonCount={changeCount}
        onReset={reset}
      />

      <div className="st-experiment">
        <div className="st-scene-col">
          <div className="st-scene-card">
            <StaticScene
              ref={sceneRef}
              displayMode={displayMode}
              wallOn={wallOn}
              balloonCount={balloonCount}
              soundEnabled={soundEnabled}
              onStatus={onStatus}
            />
          </div>
          <span className="st-scene-hint">💡 اسحب البالون وافركه بالسترة… ثم أفلته!</span>
        </div>

        <StaticInfoPanel status={status} />
      </div>
    </div>
  );
}
