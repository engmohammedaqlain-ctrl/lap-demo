/**
 * ColorApp.jsx — الواجهة الرئيسية والتفاعلية لتجربة "رؤية الألوان وكيف يراها الدماغ"
 */
import { useState, useRef } from "react";
import ColorScene from "./ColorScene.jsx";
import { ColorSound } from "./colorAudio.js";
import "./color.css";

export default function ColorApp({ onHome }) {
  const sceneRef = useRef(null);

  // شواخص شدة الألوان الثلاثة (0% إلى 100%)
  const [rVal, setRVal] = useState(100);
  const [gVal, setGVal] = useState(100);
  const [bVal, setBVal] = useState(100);

  // حالة التشغيل والأنماط
  const [isPlaying, setIsPlaying] = useState(true);
  const [beamMode, setBeamMode] = useState("both"); // "both" | "particles" | "solid"
  const [soundOn, setSoundOn] = useState(true);

  // حالة النتيجة المرتجعة من المشهد
  const [statusInfo, setStatusInfo] = useState({
    r: 255,
    g: 255,
    b: 255,
    hex: "#FFFFFF",
    arabicName: "أبيض (ضوء مركب كامل)",
    lCone: 100,
    mCone: 100,
    sCone: 100,
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
          <h1>رؤية الألوان وكيف يراها الدماغ</h1>
          <span className="color-header-badge">مختبر الفيزياء والحواس</span>
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
            🔄 إعادة ضبط
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
            onStatus={setStatusInfo}
          />

          {/* شريط التحكم السفلي بالتشغيل والأزياء */}
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
                {isPlaying ? "⏸️ إيقاف مؤقت" : "▶️ تشغيل المحاكاة"}
              </button>
            </div>

            {/* اختصارات سريعة للألوان الأساسية والثانوية */}
            <div className="color-toolbar-group">
              <span style={{ fontSize: 13, color: "#a0aec0", fontWeight: 600 }}>خلط سريع:</span>
              <button
                type="button"
                className="color-control-btn"
                onClick={() => presetColor(100, 100, 100)}
                title="أبيض"
              >
                ⚪ أبيض
              </button>
              <button
                type="button"
                className="color-control-btn"
                onClick={() => presetColor(100, 100, 0)}
                title="أصفر"
              >
                🟡 أصفر
              </button>
              <button
                type="button"
                className="color-control-btn"
                onClick={() => presetColor(100, 0, 100)}
                title="أرجواني"
              >
                🟣 ماجنتا
              </button>
              <button
                type="button"
                className="color-control-btn"
                onClick={() => presetColor(0, 100, 100)}
                title="سماوي"
              >
                🔵 سايان
              </button>
              <button
                type="button"
                className="color-control-btn"
                onClick={() => presetColor(100, 50, 0)}
                title="برتقالي"
              >
                🟠 برتقالي
              </button>
            </div>
          </div>

          {/* لوحة التفسير العلمي */}
          <div className="color-info-box">
            <h3>💡 كيف يدرك الدماغ الألوان؟</h3>
            <p>
              تحتوي شبكية عين الإنسان على 3 أنواع من الخلايا المخروطية (Cones) الحساسة للأطوال الموجية:
              الخلايا <strong>L (الأحمر)</strong>، والخلايا <strong>M (الأخضر)</strong>، والخلايا <strong>S (الأزرق)</strong>.
              عندما يسقط الضوء المركب على الشبكية، تُحفّز هذه الخلايا بدرجات تفاوتية، وترسل نبضات عصبية كهرومغناطيسية عبر
              العصب البصري إلى <strong>الفص البصري (Visual Cortex)</strong> في الدماغ، ليقوم الدماغ بتركيب هذه الإشارات ودمجها لترجمة اللون المدرك (المعروض في سحابة التفكير).
            </p>
          </div>
        </div>

        {/* الشريط الجانبي: السلايدرات واستجابة الخلايا */}
        <aside className="color-sidebar">
          {/* بطاقة التحكم في الكشافات RGB */}
          <div className="color-card">
            <h2 className="color-card-title">
              <span>🔦 كشافات الضوء RGB</span>
            </h2>

            {/* كشاف أحمر */}
            <div className="color-slider-item">
              <div className="color-slider-header">
                <span className="color-slider-label">
                  <span className="color-dot" style={{ background: "#FF0000", boxShadow: "0 0 8px #FF0000" }} />
                  الكشاف الأحمر (Red)
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
                  الكشاف الأخضر (Green)
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
                  الكشاف الأزرق (Blue)
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
              <span>👁️ تحفيز خلايا الشبكية (Cones)</span>
            </h2>

            <div className="cone-meter">
              <div className="cone-meter-info">
                <span>المخاريط الطويلة L (حساسية للأحمر)</span>
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
                <span>المخاريط المتوسطة M (حساسية للأخضر)</span>
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
                <span>المخاريط القصيرة S (حساسية للأزرق)</span>
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
