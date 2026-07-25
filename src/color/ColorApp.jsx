/**
 * ColorApp.jsx — واجهة مينيمال حديثة وممركّزة لتجربة رؤية الألوان (Minimal Focused UI)
 */
import { useState, useRef } from "react";
import ColorScene from "./ColorScene.jsx";
import { ColorSound } from "./colorAudio.js";
import "./color.css";

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // الشدة (0-100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  // حالات العرض المينيمال
  const [isPlaying, setIsPlaying] = useState(true);
  const [beamMode, setBeamMode] = useState("particles"); // "particles" | "waves" | "solid"
  const [visionMode, setVisionMode] = useState("normal"); // "normal" | "protanopia" | "deuteranopia" | "tritanopia"
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterColor, setFilterColor] = useState("red");

  const [statusInfo, setStatusInfo] = useState({
    hex: "#FFFFFF",
    arabicName: "أبيض ناصع",
    wavelengthNm: 550,
    r: 255,
    g: 255,
    b: 255,
  });

  const handleSlider = (type, val) => {
    const num = Number(val);
    if (type === "r") setRVal(num);
    if (type === "g") setGVal(num);
    if (type === "b") setBVal(num);
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
      {/* Header — مينيمال أنيق */}
      <header className="color-header">
        <button type="button" className="color-btn-home" onClick={onHome}>
          ← الرئيسية
        </button>
        <div className="color-header-title">
          <h1>رؤية الألوان وكيف يراها الدماغ</h1>
        </div>
        <button type="button" className="color-btn-home" onClick={handleReset}>
          🔄 إعادة ضبط
        </button>
      </header>

      {/* Main Container — مُمَركَز بدون تشتيت */}
      <main className="color-body-minimal">
        {/* اللوحة الرئيسية (Canvas Centerpiece) */}
        <ColorScene
          ref={sceneRef}
          rVal={rVal}
          gVal={gVal}
          bVal={bVal}
          isPlaying={isPlaying}
          beamMode={beamMode}
          visionMode={visionMode}
          showConesZoom={false}
          filterEnabled={filterEnabled}
          filterColor={filterColor}
          onStatus={setStatusInfo}
        />

        {/* Sliders Compact Panel — تحكم مبسط بكشافات الضوء الثلاثية */}
        <div className="color-minimal-controls">
          {/* أحمر */}
          <div className="color-slider-minimal">
            <div className="color-slider-top">
              <span>🔴 كشاف أحمر</span>
              <span style={{ color: "#ef4444" }}>{rVal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={rVal}
              onChange={(e) => handleSlider("r", e.target.value)}
              className="color-range"
              style={{ accentColor: "#ef4444" }}
            />
          </div>

          {/* أخضر */}
          <div className="color-slider-minimal">
            <div className="color-slider-top">
              <span>🟢 كشاف أخضر</span>
              <span style={{ color: "#22c55e" }}>{gVal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={gVal}
              onChange={(e) => handleSlider("g", e.target.value)}
              className="color-range"
              style={{ accentColor: "#22c55e" }}
            />
          </div>

          {/* أزرق */}
          <div className="color-slider-minimal">
            <div className="color-slider-top">
              <span>🔵 كشاف أزرق</span>
              <span style={{ color: "#3b82f6" }}>{bVal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={bVal}
              onChange={(e) => handleSlider("b", e.target.value)}
              className="color-range"
              style={{ accentColor: "#3b82f6" }}
            />
          </div>
        </div>

        {/* Minimal Toolbar — خيارات العرض بحبوب أنيقة (Pill Group) */}
        <div className="color-minimal-toolbar">
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
            className="color-select-minimal"
          >
            <option value="normal">👁️ رؤية طبيعية</option>
            <option value="protanopia">👁️ عمى الأحمر (Protanopia)</option>
            <option value="deuteranopia">👁️ عمى الأخضر (Deuteranopia)</option>
            <option value="tritanopia">👁️ عمى الأزرق (Tritanopia)</option>
          </select>

          {/* الفلتر الضوئي */}
          <div className="color-pill-group">
            <button
              type="button"
              className={`color-pill-btn ${filterEnabled ? "active" : ""}`}
              onClick={() => setFilterEnabled(!filterEnabled)}
            >
              {filterEnabled ? "🛡️ الفلتر مفعل" : "🛡️ تفعيل مرشح ضوئي"}
            </button>
            {filterEnabled && (
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="color-select-minimal"
                style={{ border: "none", background: "transparent" }}
              >
                <option value="red">مرشح أحمر</option>
                <option value="green">مرشح أخضر</option>
                <option value="blue">مرشح أزرق</option>
                <option value="yellow">مرشح أصفر</option>
              </select>
            )}
          </div>

          {/* زر التشغيل والإيقاف */}
          <button
            type="button"
            className={`color-pill-btn ${isPlaying ? "active" : ""}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? "⏸️ إيقاف" : "▶️ تشغيل"}
          </button>
        </div>

        {/* Minimal Status Strip — نتائج مركزة وموجزة */}
        <div className="color-status-strip">
          <span>اللون المدرك: <strong style={{ color: statusInfo.hex }}>{statusInfo.arabicName}</strong></span>
          <span>رمز HEX: <strong>{statusInfo.hex.toUpperCase()}</strong></span>
          <span>الطول الموجي: <strong>{statusInfo.wavelengthNm}nm</strong></span>
          <span>شفرة RGB: <strong>({statusInfo.r}, {statusInfo.g}, {statusInfo.b})</strong></span>
        </div>
      </main>
    </div>
  );
}
