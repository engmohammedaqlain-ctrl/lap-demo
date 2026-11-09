/**
 * ColorApp.jsx — رؤية الألوان: المشهد هو البطل؛ عمود أدوات زجاجي صغير فيه كل
 * الخيارات (الشخصية، نمط الضوء، الرؤية/عمى الألوان، المرشّح، أمزجة جاهزة).
 * التحكم بالشدّة مباشرة من الكشّافات داخل المشهد. أصوات من مكتبة SFX.
 */
import { useCallback, useRef, useState } from "react";
import ColorScene from "./ColorScene.jsx";
import ColorHelpModal from "./ColorHelpModal.jsx";
import Hud from "../ui/Hud.jsx";
import { IconPlay, IconPause } from "../ui/icons.jsx";
import { play, setMuted } from "../audio/sfx.js";
import { VISION_MODES } from "./colorData.js";
import "./color.css";

const BEAM_MODES = [
  { id: "particles", name: "فوتونات" },
  { id: "waves", name: "موجات" },
  { id: "solid", name: "شعاع" },
];

const VISION_SHORT = {
  normal: "طبيعية",
  protanopia: "عمى الأحمر",
  deuteranopia: "عمى الأخضر",
  tritanopia: "عمى الأزرق",
};

const FILTERS = [
  { id: "red", name: "أحمر", color: "#E23B3B" },
  { id: "green", name: "أخضر", color: "#22B04B" },
  { id: "blue", name: "أزرق", color: "#2F6FE0" },
  { id: "yellow", name: "أصفر", color: "#EAB308" },
];

/* أمزجة جاهزة: تعرض أن مزج الأضواء جمعيّ (أحمر + أخضر = أصفر ...) */
const MIXES = [
  { id: "yellow", name: "أحمر + أخضر = أصفر", rgb: [100, 100, 0], color: "#F2D21B" },
  { id: "cyan", name: "أخضر + أزرق = سماوي", rgb: [0, 100, 100], color: "#16BFD0" },
  { id: "magenta", name: "أحمر + أزرق = أرجواني", rgb: [100, 0, 100], color: "#C43AA3" },
  { id: "white", name: "الثلاثة = أبيض", rgb: [100, 100, 100], color: "#F4F4F0" },
  { id: "black", name: "بلا ضوء = أسود", rgb: [0, 0, 0], color: "#262b30" },
];

const INITIAL_STATUS = { hex: "#FFFFFF", arabicName: "أبيض", wavelengthNm: null, r: 255, g: 255, b: 255, total: 765 };

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // الشدة (0-100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  // حالات العرض
  const [isPlaying, setIsPlaying] = useState(true);
  const [beamMode, setBeamMode] = useState("particles");
  const [visionMode, setVisionMode] = useState("normal");
  const [filter, setFilter] = useState(null); // null | "red" | "green" | "blue" | "yellow"
  const [character, setCharacter] = useState("boy");
  const [sound, setSound] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusInfo, setStatusInfo] = useState(INITIAL_STATUS);

  const stepRef = useRef({ red: 20, green: 20, blue: 20 });
  const lastNameRef = useRef(null);

  const click = (name = "click", o) => play(name, o);

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

  /* حالة اللون المُدرَك: نغمة ناعمة عند تبدّل اسم اللون (بنبرة تتبع الطول الموجي) */
  const handleStatus = useCallback((info) => {
    setStatusInfo(info);
    if (lastNameRef.current !== null && lastNameRef.current !== info.arabicName && info.total > 15) {
      const rate = 0.85 + ((750 - (info.wavelengthNm ?? 550)) / 370) * 0.5;
      play("color_twinkle", { rate, throttle: 300, jitter: 0.02, volume: 0.7 });
    }
    lastNameRef.current = info.arabicName;
  }, []);

  function applyMix(m) {
    play("color_bright", { rate: 0.9 + m.rgb.filter(Boolean).length * 0.08, volume: 0.8 });
    const [r, g, b] = m.rgb;
    stepRef.current = { red: Math.round(r / 5), green: Math.round(g / 5), blue: Math.round(b / 5) };
    setRVal(r);
    setGVal(g);
    setBVal(b);
  }

  function pickFilter(id) {
    const next = filter === id ? null : id;
    play(next ? "color_on" : "color_off", { volume: 0.8 });
    setFilter(next);
  }

  function handleReset() {
    click("back");
    setRVal(100);
    setGVal(100);
    setBVal(100);
    stepRef.current = { red: 20, green: 20, blue: 20 };
    setBeamMode("particles");
    setVisionMode("normal");
    setFilter(null);
    setIsPlaying(true);
    sceneRef.current?.reset();
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setMuted(!next);
    if (next) play("click");
  }

  const pickVision = (id) => {
    if (id === visionMode) return;
    click("select");
    setVisionMode(id);
  };

  return (
    <div className="color-app g-stage">
      <header className="g-topbar">
        <Hud
          onHome={() => (click(), onHome())}
          onHelp={() => (click(), setHelpOpen(true))}
          sound={sound}
          onSound={toggleSound}
          onReset={handleReset}
        />
      </header>

      <ColorHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <main className="color-body-light g-experiment">
        <div className="color-scene-container g-scene-col" style={{ "--ratio": 1000 / 540 }}>
          <ColorScene
            ref={sceneRef}
            rVal={rVal}
            gVal={gVal}
            bVal={bVal}
            onValChange={handleValChange}
            isPlaying={isPlaying}
            beamMode={beamMode}
            visionMode={visionMode}
            filterEnabled={!!filter}
            filterColor={filter || "red"}
            character={character}
            onStatus={handleStatus}
          />

          <div className="co-readout" aria-live="polite">
            <span className="co-dot" style={{ background: statusInfo.hex }} aria-hidden="true" />
            <b>{statusInfo.arabicName}</b>
            <span className="co-sep" />
            <span dir="ltr">{statusInfo.hex.toUpperCase()}</span>
            <span className="co-sep" />
            <span dir="ltr">{statusInfo.wavelengthNm ? `${statusInfo.wavelengthNm} nm` : "— nm"}</span>
            <span className="co-sep co-hide-sm" />
            <span dir="ltr" className="co-hide-sm">
              {statusInfo.r}, {statusInfo.g}, {statusInfo.b}
            </span>
          </div>
        </div>

        <div className="co-rail g-controls" role="group" aria-label="أدوات التجربة">
          <section className="co-group">
            <h2 className="co-h">الشخصية</h2>
            <div className="co-seg" role="group" aria-label="الشخصية">
              {[
                ["boy", "ولد"],
                ["girl", "بنت"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className={character === id ? "on" : ""}
                  aria-pressed={character === id}
                  onClick={() => {
                    if (character !== id) click("select");
                    setCharacter(id);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section className="co-group">
            <h2 className="co-h">الضوء</h2>
            <div className="co-seg" role="group" aria-label="نمط الضوء">
              {BEAM_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={beamMode === m.id ? "on" : ""}
                  aria-pressed={beamMode === m.id}
                  onClick={() => {
                    if (beamMode !== m.id) click("select");
                    setBeamMode(m.id);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </section>

          <section className="co-group">
            <h2 className="co-h">الرؤية</h2>
            <div className="co-vision" role="radiogroup" aria-label="الرؤية">
              {VISION_MODES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={visionMode === v.id}
                  className={visionMode === v.id ? "on" : ""}
                  onClick={() => pickVision(v.id)}
                  title={v.name}
                >
                  {VISION_SHORT[v.id]}
                </button>
              ))}
            </div>
          </section>

          <section className="co-group">
            <h2 className="co-h">المرشّح</h2>
            <div className="co-dots" role="group" aria-label="المرشّح الضوئي">
              <button
                type="button"
                className={`co-swatch co-none${filter === null ? " on" : ""}`}
                aria-pressed={filter === null}
                aria-label="بلا مرشّح"
                title="بلا مرشّح"
                onClick={() => filter && pickFilter(filter)}
              />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`co-swatch${filter === f.id ? " on" : ""}`}
                  style={{ "--c": f.color }}
                  aria-pressed={filter === f.id}
                  aria-label={`مرشّح ${f.name}`}
                  title={`مرشّح ${f.name}`}
                  onClick={() => pickFilter(f.id)}
                />
              ))}
            </div>
          </section>

          <section className="co-group">
            <h2 className="co-h">امزج</h2>
            <div className="co-dots" role="group" aria-label="أمزجة جاهزة">
              {MIXES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="co-swatch co-mix"
                  style={{ "--c": m.color }}
                  aria-label={m.name}
                  title={m.name}
                  onClick={() => applyMix(m)}
                />
              ))}
            </div>
          </section>

          <button
            type="button"
            className={`co-play${isPlaying ? "" : " paused"}`}
            aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
            title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
            onClick={() => {
              click(isPlaying ? "back" : "select");
              setIsPlaying((v) => !v);
            }}
          >
            {isPlaying ? <IconPause width="20" height="20" /> : <IconPlay width="20" height="20" />}
            <span>{isPlaying ? "إيقاف" : "تشغيل"}</span>
          </button>
        </div>
      </main>
    </div>
  );
}
