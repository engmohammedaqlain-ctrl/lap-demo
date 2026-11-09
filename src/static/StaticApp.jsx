/**
 * StaticApp.jsx — تجربة "البالونات والكهرباء الساكنة". اسحب البالون وافركه
 * بالسترة لتنقل إلكترونات فيصبح سالباً، ثم أفلته ليلتصق بالسترة أو الجدار.
 * الشريط العلوي والأدوات واللوحة التفسيرية بطابع الموقع نفسه وباللغة العربية.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import StaticScene from "./StaticScene.jsx";
import StaticControls from "./components/StaticControls.jsx";
import StaticInfoPanel from "./components/StaticInfoPanel.jsx";
import StaticHelpModal from "./components/StaticHelpModal.jsx";
import { StaticSound } from "./staticAudio.js";
import "./static.css";

import { InfoDrawer } from "../mobile/GameChrome.jsx";
import Hud from "../ui/Hud.jsx";
import { SCENE_W, SCENE_H } from "./staticData.js";
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
  useEffect(() => {
    StaticSound.setMuted(false);
  }, []);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      StaticSound.setMuted(!next);
      return next;
    });
  }

  return (
    <div className="st-stage g-stage">
      <header className="g-topbar">
        <Hud
          onHome={onHome}
          onHelp={() => {
            setHelpOpen(true);
            click();
          }}
          sound={soundEnabled}
          onSound={toggleSound}
        />
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

      <div className="st-experiment g-experiment">
        <div className="st-scene-col g-scene-col">
          <div className="st-scene-card g-scene-card" style={{ "--ratio": SCENE_W / SCENE_H }}>
            <StaticScene
              ref={sceneRef}
              displayMode={displayMode}
              wallOn={wallOn}
              balloonCount={balloonCount}
              soundEnabled={soundEnabled}
              onStatus={onStatus}
            />
          </div>
          <span className="st-scene-hint g-hint">اسحب البالون وافركه بالسترة… ثم أفلته</span>
        </div>

        <InfoDrawer label="معلومات">
          <StaticInfoPanel status={status} />
        </InfoDrawer>
      </div>
    </div>
  );
}
