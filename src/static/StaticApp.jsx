/**
 * StaticApp.jsx — تجربة "الكهرباء الساكنة" داخل غرفة جلوس.
 * الواجهة: أزرار Hud الموحّدة فقط (رئيسية/شرح/صوت/إعادة). كل ما عداها أدوات
 * داخل الغرفة: سلّة البالونات، لوح الجدار المنزلق، العدسة الكاشفة للشحنات.
 */
import { useEffect, useRef, useState } from "react";
import StaticScene from "./StaticScene.jsx";
import StaticHelpModal from "./components/StaticHelpModal.jsx";
import Hud from "../ui/Hud.jsx";
import { play, setMuted } from "../audio/sfx.js";
import "./static.css";

export default function StaticApp({ onHome }) {
  const [sound, setSound] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const sceneRef = useRef(null);

  // ابدأ دائماً غير مكتوم
  useEffect(() => {
    setMuted(false);
  }, []);

  return (
    <div className="ss-stage">
      <StaticScene ref={sceneRef} soundEnabled={sound} />

      <header className="ss-topbar">
        <Hud
          onHome={() => {
            play("click");
            onHome();
          }}
          onHelp={() => {
            play("click");
            setHelpOpen(true);
          }}
          sound={sound}
          onSound={() => {
            const next = !sound;
            setSound(next);
            setMuted(!next);
            if (next) play("click");
          }}
          onReset={() => {
            play("back");
            sceneRef.current?.reset();
          }}
        />
      </header>

      <StaticHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
