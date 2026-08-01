/**
 * ColorApp.jsx — واجهة فاتحة أنيقة، التحكم المباشر من العرض بدون محددات أسفله وبدون إيموجي.
 */
import { useState, useRef } from "react";
import PlatformBrand from "../components/PlatformBrand.jsx";
import ColorScene from "./ColorScene.jsx";
import { ColorSound } from "./colorAudio.js";
import "./color.css";

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // الشدة (0-100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  // حالات العرض
  const [isPlaying, setIsPlaying] = useState(true);
  const [beamMode, setBeamMode] = useState("particles"); // "particles" | "waves" | "solid"
  const [visionMode, setVisionMode] = useState("normal"); // "normal" | "protanopia" | "deuteranopia" | "tritanopia"
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterColor, setFilterColor] = useState("red");
  const [character, setCharacter] = useState("boy"); // "boy" | "girl"

  const [statusInfo, setStatusInfo] = useState({
    hex: "#FFFFFF",
    arabicName: "أبيض",
    wavelengthNm: 550,
    r: 255,
    g: 255,
    b: 255,
  });

  const handleValChange = (id, val) => {
    if (id === "red") setRVal(val);
    if (id === "green") setGVal(val);
    if (id === "blue") setBVal(val);
  };

  const handleReset = () => {
    ColorSound.playClick();
    setRVal(100);
    setGVal(100);
    setBVal(100);
    setBeamMode("particles");
    setVisionMode("normal");
    setFilterEnabled(false);
    setIsPlaying(true);
    if (sceneRef.current) sceneRef.current.reset();
  };

  return (
    <div className="color-app">
      {/* Header — ستايل فاتح أنيق بدون إيموجي */}
      <header className="color-header">
        <PlatformBrand onClick={onHome} />
        <div className="color-header-title">
          <h1>رؤية الألوان وكيف يراها الدماغ</h1>
        </div>
        <button type="button" className="color-btn-reset" onClick={handleReset}>
          إعادة ضبط
        </button>
      </header>

      {/* Main Container — التحكم المباشر من العرض نفسه */}
      <main className="color-body-light">
        <div className="color-scene-container">
          <ColorScene
            ref={sceneRef}
            rVal={rVal}
            gVal={gVal}
            bVal={bVal}
            onValChange={handleValChange}
            isPlaying={isPlaying}
            beamMode={beamMode}
            visionMode={visionMode}
            filterEnabled={filterEnabled}
            filterColor={filterColor}
            character={character}
            onStatus={setStatusInfo}
          />
          <div className="color-canvas-hint">
            اسحب مقياس الشدّة على كلّ كشّاف للتحكّم بكمّية الضوء
          </div>
        </div>

        {/* أدوات التحكم العلوية والخيارات (Pills & Controls) بدون إيموجي */}
        <div className="color-toolbar-light">
          {/* اختيار الشخصية */}
          <div className="color-pill-group">
            <button
              type="button"
              className={`color-pill-btn ${character === "boy" ? "active" : ""}`}
              onClick={() => { setCharacter("boy"); ColorSound.playClick(); }}
            >
              ولد
            </button>
            <button
              type="button"
              className={`color-pill-btn ${character === "girl" ? "active" : ""}`}
              onClick={() => { setCharacter("girl"); ColorSound.playClick(); }}
            >
              بنت
            </button>
          </div>

          {/* نمط الضوء */}
          <div className="color-pill-group">
            <button
              type="button"
              className={`color-pill-btn ${beamMode === "particles" ? "active" : ""}`}
              onClick={() => setBeamMode("particles")}
            >
              فوتونات
            </button>
            <button
              type="button"
              className={`color-pill-btn ${beamMode === "waves" ? "active" : ""}`}
              onClick={() => setBeamMode("waves")}
            >
              موجات
            </button>
            <button
              type="button"
              className={`color-pill-btn ${beamMode === "solid" ? "active" : ""}`}
              onClick={() => setBeamMode("solid")}
            >
              شعاع
            </button>
          </div>

          {/* محاكاة الرؤية وعمى الألوان */}
          <select
            value={visionMode}
            onChange={(e) => setVisionMode(e.target.value)}
            className="color-select-light"
          >
            <option value="normal">رؤية طبيعية</option>
            <option value="protanopia">عمى الأحمر (Protanopia)</option>
            <option value="deuteranopia">عمى الأخضر (Deuteranopia)</option>
            <option value="tritanopia">عمى الأزرق (Tritanopia)</option>
          </select>

          {/* المرشح الضوئي */}
          <div className="color-pill-group">
            <button
              type="button"
              className={`color-pill-btn ${filterEnabled ? "active" : ""}`}
              onClick={() => setFilterEnabled(!filterEnabled)}
            >
              {filterEnabled ? "المرشح مفعل" : "تفعيل مرشح ضوئي"}
            </button>
            {filterEnabled && (
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="color-select-light"
                style={{ border: "none", background: "transparent" }}
              >
                <option value="red">أحمر</option>
                <option value="green">أخضر</option>
                <option value="blue">أزرق</option>
                <option value="yellow">أصفر</option>
              </select>
            )}
          </div>

          {/* زر التشغيل والإيقاف */}
          <button
            type="button"
            className={`color-pill-btn ${isPlaying ? "active" : ""}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? "إيقاف" : "تشغيل"}
          </button>
        </div>

        {/* شريط نتائج رفيع وناصع */}
        <div className="color-status-strip-light">
          <span>اللون المدرك: <strong style={{ color: statusInfo.hex }}>{statusInfo.arabicName}</strong></span>
          <span>HEX: <strong>{statusInfo.hex.toUpperCase()}</strong></span>
          <span>الطول الموجي: <strong>{statusInfo.wavelengthNm}nm</strong></span>
          <span>RGB: <strong>({statusInfo.r}, {statusInfo.g}, {statusInfo.b})</strong></span>
        </div>
      </main>
    </div>
  );
}
