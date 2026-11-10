/**
 * ColorApp.jsx — رؤية الألوان كغرفة بصريات تفاعلية: كل التحكّم عناصر داخل المشهد
 * (فيدرات، مفتاح، زرّ، صورتا الشخصيتين، نظّارات، شفّافات، لوحة ألوان)، والأزرار
 * الموحّدة الأربعة فقط (رئيسية/شرح/صوت/إعادة) فوق المشهد. الأصوات من مكتبة SFX.
 */
import { useCallback, useRef, useState } from "react";
import ColorScene from "./ColorScene.jsx";
import ColorHelpModal from "./ColorHelpModal.jsx";
import Hud from "../ui/Hud.jsx";
import { play, setMuted } from "../audio/sfx.js";
import "./color.css";

const INITIAL_STATUS = { arabicName: "أبيض", total: 765, wavelengthNm: null };

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // الشدة (0-100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  const [beamMode, setBeamMode] = useState("particles");
  const [visionMode, setVisionMode] = useState("normal");
  const [filter, setFilter] = useState(null);
  const [character, setCharacter] = useState("boy");
  const [sound, setSound] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  const stepRef = useRef({ red: 20, green: 20, blue: 20 });
  const lastNameRef = useRef(INITIAL_STATUS.arabicName);

  /* الشدة: خطوة صوتية كل ٥٪ مع نغمة ترتفع بارتفاع الشدة */
  const handleValChange = useCallback((id, val) => {
    if (id === "red") setRVal(val);
    if (id === "green") setGVal(val);
    if (id === "blue") setBVal(val);
    const step = Math.round(val / 5);
    if (step !== stepRef.current[id]) {
      stepRef.current[id] = step;
      play("tick", { rate: 0.8 + (val / 100) * 0.55, jitter: 0.01, throttle: 35, volume: 0.8 });
    }
  }, []);

  /* نغمة ناعمة عند تبدّل اسم اللون المُدرَك (بنبرة تتبع الطول الموجي) */
  const handleStatus = useCallback((info) => {
    if (lastNameRef.current !== info.arabicName && info.total > 15) {
      const rate = 0.85 + ((750 - (info.wavelengthNm ?? 550)) / 370) * 0.5;
      play("color_twinkle", { rate, throttle: 300, jitter: 0.02, volume: 0.7 });
    }
    lastNameRef.current = info.arabicName;
  }, []);

  function handleReset() {
    play("back");
    setRVal(100);
    setGVal(100);
    setBVal(100);
    stepRef.current = { red: 20, green: 20, blue: 20 };
    setBeamMode("particles");
    setVisionMode("normal");
    setFilter(null);
    sceneRef.current?.reset();
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setMuted(!next);
    if (next) play("click");
  }

  return (
    <div className="color-app">
      <ColorScene
        ref={sceneRef}
        rVal={rVal}
        gVal={gVal}
        bVal={bVal}
        beamMode={beamMode}
        visionMode={visionMode}
        filter={filter}
        character={character}
        onValChange={handleValChange}
        onStatus={handleStatus}
        onBeamMode={(m) => {
          play("select");
          play("tick", { delay: 0.05, rate: 1.2 });
          setBeamMode(m);
        }}
        onVision={(id) => {
          if (id === visionMode) return;
          play("grab");
          play("color_on", { delay: 0.08, volume: 0.7 });
          setVisionMode(id);
        }}
        onFilter={(id) => {
          play("whoosh", { volume: 0.7 });
          play(id ? "color_on" : "color_off", { delay: 0.1, volume: 0.8 });
          setFilter(id);
        }}
        onCharacter={(id) => {
          if (id === character) return;
          play("select");
          setCharacter(id);
        }}
        onMatch={() => {
          play("success", { volume: 0.9 });
          play("sparkle", { volume: 0.6, delay: 0.1 });
        }}
        onTarget={() => play("select", { volume: 0.7 })}
      />

      <div className="co-hud">
        <Hud
          onHome={() => (play("click"), onHome())}
          onHelp={() => (play("click"), setHelpOpen(true))}
          sound={sound}
          onSound={toggleSound}
          onReset={handleReset}
        />
      </div>

      <ColorHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
