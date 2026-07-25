/**
 * ColorApp.jsx — الواجهة الشاملة واللوحة المتقدمة للتحكم في تجربة رؤية الألوان وعمى الألوان والأطوال الموجية.
 */
import { useState, useRef } from "react";
import ColorScene from "./ColorScene.jsx";
import { ColorSound } from "./colorAudio.js";
import { VISION_MODES } from "./colorData.js";
import "./color.css";

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // شواخص شدة الألوان الثلاثة (0% إلى 100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  // حالة التشغيل والأنماط المتقدمة
  const [isPlaying, setIsPlaying] = useState(true);
  const [beamMode, setBeamMode] = useState("particles"); // "particles" | "solid" | "waves"
  const [visionMode, setVisionMode] = useState("normal"); // "normal" | "protanopia" | "deuteranopia" | "tritanopia"
  const [showConesZoom, setShowConesZoom] = useState(true);
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterColor, setFilterColor] = useState("red"); // "red" | "green" | "blue" | "yellow"
  const [soundOn, setSoundOn] = useState(true);

  // حالة النتيجة المرتجعة من المشهد
  const [statusInfo, setStatusInfo] = useState({
    r: 255,
    g: 255,
    b: 255,
    hex: "#FFFFFF",
    arabicName: "أبيض ناصع",
    lCone: 100,
    mCone: 100,
    sCone: 100,
    hueDegrees: 0,
    satPercent: 0,
    lightPercent: 100,
    wavelengthNm: 550,
  });

  const handleSlider = (type, val) => {
    const num = Number(val);
    if (type === "r") setRVal(num);
    if (type === "g") setGVal(num);
    if (type === "b") setBVal(num);

    if (soundOn && Math.abs(num % 20) < 5) {
      const freqs = { r: 520, g: 650, b: 780 };
      ColorSound.playBeamTone(freqs[type]);
    }
  };

  const handleReset = () => {
    soundOn && ColorSound.playClick();
    setRVal(100);
    setGVal(100);
    setBVal(100);
    setBeamMode("particles");
    setVisionMode("normal");
    setShowConesZoom(true);
    setFilterEnabled(false);
    setIsPlaying(true);
    if (sceneRef.current) sceneRef.current.reset();
  };

  const presetColor = (r, g, b) => {
    soundOn && ColorSound.playClick();
    setRVal(r);
    setGVal(g);
    setBVal(b);
  };

  return (
    <div className="color-app">
      {/* الشريط العلوي (Navbar) */}
      <header className="color-header">
        <div className="color-header-title">
          <button type="button" className="color-btn-home" onClick={onHome}>
            ← الشاشة الرئيسية
          </button>
          <h1>مختبر رؤية الألوان وإدراك الدماغ والأطوال الموجية</h1>
          <span className="color-header-badge">متقدم v2.0</span>
        </div>
        <div className="color-toolbar-group">
          <button
            type="button"
            className="color-control-btn"
            onClick={() => {
              setSoundOn(!soundOn);
              ColorSound.playClick();
            }}
          >
            {soundOn ? "🔊 الصوت مفعل" : "🔇 مكتوم"}
          </button>
          <button type="button" className="color-control-btn" onClick={handleReset}>
            🔄 إعادة ضبط كاملة
          </button>
        </div>
      </header>

      {/* مساحة العمل والتجربة */}
      <main className="color-body">
        <div className="color-main-area">
          {/* لوحة الرسم T60fps */}
          <ColorScene
            ref={sceneRef}
            rVal={rVal}
            gVal={gVal}
            bVal={bVal}
            isPlaying={isPlaying}
            beamMode={beamMode}
            visionMode={visionMode}
            showConesZoom={showConesZoom}
            filterEnabled={filterEnabled}
            filterColor={filterColor}
            onStatus={setStatusInfo}
          />

          {/* شريط التحكم المتقدم بالأشعة والأنماط */}
          <div className="color-toolbar">
            <div className="color-toolbar-group">
              <button
                type="button"
                className={`color-control-btn ${isPlaying ? "active" : ""}`}
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  soundOn && ColorSound.playClick();
                }}
              >
                {isPlaying ? "⏸️ إيقاف" : "▶️ تشغيل"}
              </button>

              <button
                type="button"
                className={`color-control-btn ${showConesZoom ? "active" : ""}`}
                onClick={() => {
                  setShowConesZoom(!showConesZoom);
                  soundOn && ColorSound.playClick();
                }}
              >
                🔬 {showConesZoom ? "إخفاء مجهر الشبكية" : "عرض مجهر الشبكية"}
              </button>
            </div>

            {/* تمثيل الشعاع */}
            <div className="color-toolbar-group">
              <span className="color-mode-label">عرض الضوء:</span>
              <button
                type="button"
                className={`color-control-btn ${beamMode === "particles" ? "active" : ""}`}
                onClick={() => setBeamMode("particles")}
              >
                ✨ فوتونات
              </button>
              <button
                type="button"
                className={`color-control-btn ${beamMode === "waves" ? "active" : ""}`}
                onClick={() => setBeamMode("waves")}
              >
                〰️ أطوال موجية
              </button>
              <button
                type="button"
                className={`color-control-btn ${beamMode === "solid" ? "active" : ""}`}
                onClick={() => setBeamMode("solid")}
              >
                🔦 شعاع مستمر
              </button>
            </div>
          </div>

          {/* شريط الألوان السريعة والفلتر */}
          <div className="color-toolbar">
            <div className="color-toolbar-group">
              <span className="color-mode-label">خلط سريع:</span>
              <button type="button" className="color-control-btn" onClick={() => presetColor(100, 100, 100)}>
                ⚪ أبيض
              </button>
              <button type="button" className="color-control-btn" onClick={() => presetColor(100, 100, 0)}>
                🟡 أصفر
              </button>
              <button type="button" className="color-control-btn" onClick={() => presetColor(100, 0, 100)}>
                🟣 ماجنتا
              </button>
              <button type="button" className="color-control-btn" onClick={() => presetColor(0, 100, 100)}>
                🔵 سايان
              </button>
              <button type="button" className="color-control-btn" onClick={() => presetColor(100, 50, 0)}>
                🟠 برتقالي
              </button>
            </div>

            {/* المرشح الضوئي */}
            <div className="color-toolbar-group">
              <button
                type="button"
                className={`color-control-btn ${filterEnabled ? "active" : ""}`}
                onClick={() => setFilterEnabled(!filterEnabled)}
              >
                🛡️ {filterEnabled ? "إلغاء الفلتر" : "تفعيل المرشح الضوئي"}
              </button>
              {filterEnabled && (
                <select
                  value={filterColor}
                  onChange={(e) => setFilterColor(e.target.value)}
                  className="color-select"
                >
                  <option value="red">فلتر أحمر (يمرر الأحمر فقط)</option>
                  <option value="green">فلتر أخضر (يمرر الأخضر فقط)</option>
                  <option value="blue">فلتر أزرق (يمرر الأزرق فقط)</option>
                  <option value="yellow">فلتر أصفر</option>
                </select>
              )}
            </div>
          </div>

          {/* لوحة التحليلات الرقمية الشاملة */}
          <div className="color-analytics-panel">
            <div className="color-analytics-box">
              <span className="color-analytics-title">كود اللون HEX</span>
              <span className="color-analytics-val">{statusInfo.hex.toUpperCase()}</span>
            </div>
            <div className="color-analytics-box">
              <span className="color-analytics-title">قيم RGB الرقمية</span>
              <span className="color-analytics-val">R:{statusInfo.r} G:{statusInfo.g} B:{statusInfo.b}</span>
            </div>
            <div className="color-analytics-box">
              <span className="color-analytics-title">الطول الموجي المهيمن</span>
              <span className="color-analytics-val" style={{ color: "#60a5fa" }}>
                {statusInfo.wavelengthNm} نانومتر (nm)
              </span>
            </div>
            <div className="color-analytics-box">
              <span className="color-analytics-title">درجة التدرّج HSL</span>
              <span className="color-analytics-val">H:{statusInfo.hueDegrees}° S:{statusInfo.satPercent}% L:{statusInfo.lightPercent}%</span>
            </div>
          </div>

          {/* اللوحة التفسيرية العلمية */}
          <div className="color-info-box">
            <h3>💡 كيف يترجم الدماغ الألوان والأطوال الموجية؟</h3>
            <p>
              يتكون الضوء المرئي من موجات كهرومغناطيسية تتراوح أطوالها بين <strong>380 نانومتر (بنفسجي)</strong> و
              <strong>750 نانومتر (أحمر)</strong>. تعمل الخلايا المخروطية في الشبكية كأجهزة استقبال حساسة للأطوال الموجية،
              وترسل نبضات عصبية سريعة عبر العصب البصري إلى الفص البصري بالدماغ، حيث يتحدّث إدراك الدماغ وفقاً للخلط التكاملي المترجم في سحابة التفكير.
            </p>
          </div>
        </div>

        {/* الشريط الجانبي: السلايدرات وعمى الألوان والمخاريط */}
        <aside className="color-sidebar">
          {/* محاكاة رؤية عمى الألوان */}
          <div className="color-card">
            <h2 className="color-card-title">
              <span>👁️ محاكاة رؤية عمى الألوان</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VISION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`color-vision-btn ${visionMode === mode.id ? "active" : ""}`}
                  onClick={() => {
                    setVisionMode(mode.id);
                    soundOn && ColorSound.playClick();
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{mode.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* بطاقة التحكم في الكشافات RGB */}
          <div className="color-card">
            <h2 className="color-card-title">
              <span>🔦 كشافات الضوء RGB (الشدة 0-100%)</span>
            </h2>

            {/* كشاف أحمر */}
            <div className="color-slider-item">
              <div className="color-slider-header">
                <span className="color-slider-label">
                  <span className="color-dot" style={{ background: "#FF0000", boxShadow: "0 0 8px #FF0000" }} />
                  أحمر (700nm)
                </span>
                <span style={{ color: "#ff6666" }}>{rVal}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={rVal}
                onChange={(e) => handleSlider("r", e.target.value)}
                className="color-slider-input"
                style={{ accentColor: "#FF0000" }}
              />
            </div>

            {/* كشاف أخضر */}
            <div className="color-slider-item">
              <div className="color-slider-header">
                <span className="color-slider-label">
                  <span className="color-dot" style={{ background: "#00FF00", boxShadow: "0 0 8px #00FF00" }} />
                  أخضر (530nm)
                </span>
                <span style={{ color: "#66ff66" }}>{gVal}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={gVal}
                onChange={(e) => handleSlider("g", e.target.value)}
                className="color-slider-input"
                style={{ accentColor: "#00FF00" }}
              />
            </div>

            {/* كشاف أزرق */}
            <div className="color-slider-item">
              <div className="color-slider-header">
                <span className="color-slider-label">
                  <span className="color-dot" style={{ background: "#0088FF", boxShadow: "0 0 8px #0088FF" }} />
                  أزرق (470nm)
                </span>
                <span style={{ color: "#66a3ff" }}>{bVal}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={bVal}
                onChange={(e) => handleSlider("b", e.target.value)}
                className="color-slider-input"
                style={{ accentColor: "#0088FF" }}
              />
            </div>
          </div>

          {/* بطاقة استجابة الخلايا المخروطية بالشبكية */}
          <div className="color-card">
            <h2 className="color-card-title">
              <span>📊 تحفيز خلايا الشبكية (Retina Cones)</span>
            </h2>

            <div className="cone-meter">
              <div className="cone-meter-info">
                <span>المخاريط الطويلة L (أحمر)</span>
                <span style={{ color: "#ff6666" }}>{Math.round(statusInfo.lCone)}%</span>
              </div>
              <div className="cone-bar-bg">
                <div
                  className="cone-bar-fill"
                  style={{ width: `${statusInfo.lCone}%`, background: "linear-gradient(90deg, #880000, #ff4444)" }}
                />
              </div>
            </div>

            <div className="cone-meter">
              <div className="cone-meter-info">
                <span>المخاريط المتوسطة M (أخضر)</span>
                <span style={{ color: "#66ff66" }}>{Math.round(statusInfo.mCone)}%</span>
              </div>
              <div className="cone-bar-bg">
                <div
                  className="cone-bar-fill"
                  style={{ width: `${statusInfo.mCone}%`, background: "linear-gradient(90deg, #008800, #44ff44)" }}
                />
              </div>
            </div>

            <div className="cone-meter">
              <div className="cone-meter-info">
                <span>المخاريط القصيرة S (أزرق)</span>
                <span style={{ color: "#66a3ff" }}>{Math.round(statusInfo.sCone)}%</span>
              </div>
              <div className="cone-bar-bg">
                <div
                  className="cone-bar-fill"
                  style={{ width: `${statusInfo.sCone}%`, background: "linear-gradient(90deg, #004488, #4488ff)" }}
                />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
