/**
 * CircuitApp.jsx — التطبيق الرئيسي لمختبر الدوائر الكهربائية
 * مصمم ليتطابق مع مظهر وهوية باقي تجارب المنصة (PlatformBrand، IBM Plex Sans Arabic،
 * أزرار ناعمة متناسقة، نظام صوتي متكامل، وتجربة مستخدم تفاعلية متقدمة).
 */
import { useState, useRef, useEffect } from "react";
import PlatformBrand from "../components/PlatformBrand.jsx";
import CircuitScene from "./CircuitScene.jsx";
import CircuitHelpModal from "./components/CircuitHelpModal.jsx";
import { EXPERIMENT_PRESETS } from "./circuitEngine.js";
import { CircuitSound } from "./circuitAudio.js";
import "./circuit.css";

const WIRE_COLORS = [
  { label: "أخضر", hex: "#1B7340" },
  { label: "أحمر", hex: "#CE1126" },
  { label: "أزرق", hex: "#0284c7" },
  { label: "ذهبي", hex: "#f59e0b" },
  { label: "أسود", hex: "#1A1A1A" },
];

export default function CircuitApp({ onHome }) {
  const sceneRef = useRef(null);

  // States
  const [activePreset, setActivePreset] = useState("series");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [flowMode, setFlowMode] = useState("electrons"); // 'electrons' | 'conventional' | 'none'
  const [activeWireColor, setActiveWireColor] = useState("#1B7340");
  const [dmmVisible, setDmmVisible] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [isShortCircuit, setIsShortCircuit] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  // Keyboard Shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        sceneRef.current?.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        sceneRef.current?.redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePresetSelect = (presetKey) => {
    setActivePreset(presetKey);
    setShowBanner(true);
    sceneRef.current?.loadPreset(presetKey);
    CircuitSound.playClick();
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      CircuitSound.setMuted(!next);
      return next;
    });
  };

  const handleToggleFlowMode = () => {
    setFlowMode((prev) => {
      if (prev === "electrons") return "conventional";
      if (prev === "conventional") return "none";
      return "electrons";
    });
    CircuitSound.playClick();
  };

  const currentPresetInfo = EXPERIMENT_PRESETS[activePreset] || EXPERIMENT_PRESETS.series;

  return (
    <div className="circuit-app">
      {/* الشريط العلوي الموحّد للمنصة */}
      <header className="circuit-topbar">
        <PlatformBrand onClick={onHome} />

        <div className="circuit-title">
          <span className="circuit-title-bolt" aria-hidden="true">
            ⚡
          </span>
          <span className="circuit-title-main">الدوائر الكهربائية</span>
        </div>

        {/* أزرار اختيار التجارب المنهجية الجاهزة */}
        <div className="cir-preset-pills">
          {Object.entries(EXPERIMENT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`cir-preset-btn ${activePreset === key ? "active" : ""}`}
              onClick={() => handlePresetSelect(key)}
            >
              {preset.title.split("(")[0].trim()}
            </button>
          ))}
        </div>

        {/* أدوات التحكم والخيارات */}
        <div className="circuit-topbar-tools">
          {/* Undo / Redo */}
          <button
            type="button"
            className="cir-btn-ui cir-round-btn"
            disabled={!historyState.canUndo}
            onClick={() => sceneRef.current?.undo()}
            title="تراجع (Ctrl+Z)"
          >
            ↩️
          </button>
          <button
            type="button"
            className="cir-btn-ui cir-round-btn"
            disabled={!historyState.canRedo}
            onClick={() => sceneRef.current?.redo()}
            title="إعادة (Ctrl+Y)"
          >
            ↪️
          </button>

          <div className="cir-divider" />

          {/* ألوان الأسلاك */}
          <div className="cir-swatch-group">
            {WIRE_COLORS.map((swatch) => (
              <div
                key={swatch.hex}
                className={`cir-color-dot ${activeWireColor === swatch.hex ? "active" : ""}`}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => {
                  setActiveWireColor(swatch.hex);
                  CircuitSound.playClick();
                }}
                title={`لون السلك: ${swatch.label}`}
              />
            ))}
          </div>

          <div className="cir-divider" />

          {/* خيارات المحاكاة */}
          <button
            type="button"
            className={`cir-btn-ui ${snapToGrid ? "active" : ""}`}
            onClick={() => {
              setSnapToGrid((v) => !v);
              CircuitSound.playClick();
            }}
            title="محاذاة العناصر على شبكة مغناطيسية"
          >
            <span>🧲</span> محاذاة
          </button>

          <button
            type="button"
            className={`cir-btn-ui ${showValues ? "active" : ""}`}
            onClick={() => {
              setShowValues((v) => !v);
              CircuitSound.playClick();
            }}
            title="إظهار قيم الجهد والمقاومة والسعة"
          >
            <span>🏷️</span> القيم
          </button>

          <button
            type="button"
            className={`cir-btn-ui ${flowMode !== "none" ? "active" : ""}`}
            onClick={handleToggleFlowMode}
            title="تغيير نمط تدفق التيار"
          >
            <span>🔄</span>{" "}
            {flowMode === "electrons"
              ? "الإلكترونات"
              : flowMode === "conventional"
              ? "التيار الاصطلاحي"
              : "تدفق متوقف"}
          </button>

          <div className="cir-divider" />

          <button
            type="button"
            className="cir-btn-ui"
            onClick={() => sceneRef.current?.exportPNG()}
            title="تصدير كصورة PNG"
          >
            📷 صورة
          </button>

          <button
            type="button"
            className="cir-btn-ui cir-btn-danger"
            onClick={() => sceneRef.current?.clearAll()}
            title="مسح اللوحة"
          >
            🗑️ تفريغ
          </button>

          <div className="cir-divider" />

          {/* مساعدة وصوت */}
          <button
            type="button"
            className="cir-btn-ui cir-round-btn"
            onClick={() => {
              setHelpOpen(true);
              CircuitSound.playClick();
            }}
            title="دليل الدرس والقوانين"
          >
            ؟
          </button>

          <button
            type="button"
            className="cir-btn-ui cir-round-btn"
            onClick={handleToggleSound}
            title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {/* مساحة التجربة */}
      <div className="circuit-workspace">
        {/* دليل التجربة التفسيري */}
        {showBanner && currentPresetInfo && (
          <div className="cir-edu-banner">
            <div className="cir-edu-content">
              <span className="cir-edu-title">💡 {currentPresetInfo.title}</span>
              <span className="cir-edu-desc">{currentPresetInfo.desc}</span>
            </div>
            <button
              type="button"
              className="cir-edu-close"
              onClick={() => setShowBanner(false)}
              title="إخفاء الدليل"
            >
              ✕
            </button>
          </div>
        )}

        {/* تنبيه الماس الكهربائي */}
        <div className={`cir-toast-danger ${isShortCircuit ? "show" : ""}`}>
          <span>🔥</span>
          <span>تحذير: ماس كهربائي (Short Circuit)! مسار منعدم المقاومة يسبب تياراً خطيراً.</span>
        </div>

        {/* مشهد المحاكاة التفاعلي */}
        <CircuitScene
          ref={sceneRef}
          snapToGrid={snapToGrid}
          showValues={showValues}
          flowMode={flowMode}
          activeWireColor={activeWireColor}
          dmmVisible={dmmVisible}
          activePresetKey={activePreset}
          onHistoryChange={setHistoryState}
          onShortCircuitChange={setIsShortCircuit}
        />

        {/* درج المكونات التفاعلي */}
        <aside className="circuit-sidebar">
          <span className="circuit-sidebar-title">المصادر</span>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "battery")}
            onClick={() => sceneRef.current?.spawnComponent("battery")}
          >
            <div className="circuit-palette-preview">
              <svg width="40" height="18" viewBox="0 0 40 18">
                <rect x="2" y="2" width="32" height="14" rx="2" fill="#0284c7" />
                <rect x="2" y="2" width="8" height="14" fill="#f59e0b" />
                <rect x="34" y="5" width="4" height="8" rx="1" fill="#cbd5e1" />
              </svg>
            </div>
            <span className="circuit-palette-label">بطارية DC</span>
          </div>

          <span className="circuit-sidebar-title" style={{ marginTop: 4 }}>
            المكونات والأحمال
          </span>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "bulb")}
            onClick={() => sceneRef.current?.spawnComponent("bulb")}
          >
            <div className="circuit-palette-preview">
              <svg width="22" height="26" viewBox="0 0 22 26">
                <circle cx="11" cy="10" r="8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
                <rect x="7" y="18" width="8" height="6" rx="1" fill="#64748b" />
              </svg>
            </div>
            <span className="circuit-palette-label">مصباح</span>
          </div>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "resistor")}
            onClick={() => sceneRef.current?.spawnComponent("resistor")}
          >
            <div className="circuit-palette-preview">
              <svg width="42" height="14" viewBox="0 0 42 14">
                <rect x="6" y="2" width="30" height="10" rx="2" fill="#fed7aa" stroke="#ea580c" strokeWidth="1" />
                <line x1="12" y1="2" x2="12" y2="12" stroke="#78350f" strokeWidth="2" />
                <line x1="18" y1="2" x2="18" y2="12" stroke="#000000" strokeWidth="2" />
                <line x1="24" y1="2" x2="24" y2="12" stroke="#78350f" strokeWidth="2" />
                <line x1="30" y1="2" x2="30" y2="12" stroke="#eab308" strokeWidth="2" />
              </svg>
            </div>
            <span className="circuit-palette-label">مقاومة ثابتة</span>
          </div>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "potentiometer")}
            onClick={() => sceneRef.current?.spawnComponent("potentiometer")}
          >
            <div className="circuit-palette-preview">
              <svg width="42" height="22" viewBox="0 0 42 22">
                <rect x="6" y="2" width="30" height="12" rx="3" fill="#cbd5e1" />
                <circle cx="21" cy="8" r="4" fill="#1B7340" />
                <line x1="10" y1="14" x2="10" y2="20" stroke="#64748b" strokeWidth="1.5" />
                <line x1="21" y1="14" x2="21" y2="20" stroke="#1B7340" strokeWidth="1.5" />
                <line x1="32" y1="14" x2="32" y2="20" stroke="#64748b" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="circuit-palette-label">مقاومة متغيرة</span>
          </div>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "led")}
            onClick={() => sceneRef.current?.spawnComponent("led")}
          >
            <div className="circuit-palette-preview">
              <svg width="24" height="26" viewBox="0 0 24 26">
                <path d="M6 13 C6 6, 18 6, 18 13 Z" fill="#ef4444" />
                <rect x="5" y="13" width="14" height="3" fill="#dc2626" />
                <line x1="9" y1="16" x2="9" y2="23" stroke="#94a3b8" strokeWidth="2" />
                <line x1="15" y1="16" x2="15" y2="23" stroke="#94a3b8" strokeWidth="2" />
              </svg>
            </div>
            <span className="circuit-palette-label">دايود LED</span>
          </div>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "capacitor")}
            onClick={() => sceneRef.current?.spawnComponent("capacitor")}
          >
            <div className="circuit-palette-preview">
              <svg width="34" height="20" viewBox="0 0 34 20">
                <line x1="2" y1="10" x2="14" y2="10" stroke="#64748b" strokeWidth="2" />
                <line x1="14" y1="2" x2="14" y2="18" stroke="#0284c7" strokeWidth="2.5" />
                <line x1="20" y1="2" x2="20" y2="18" stroke="#0284c7" strokeWidth="2.5" />
                <line x1="20" y1="10" x2="32" y2="10" stroke="#64748b" strokeWidth="2" />
              </svg>
            </div>
            <span className="circuit-palette-label">مكثف</span>
          </div>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "switch")}
            onClick={() => sceneRef.current?.spawnComponent("switch")}
          >
            <div className="circuit-palette-preview">
              <svg width="34" height="16" viewBox="0 0 34 16">
                <circle cx="6" cy="11" r="3" fill="#64748b" />
                <circle cx="28" cy="11" r="3" fill="#64748b" />
                <line x1="6" y1="11" x2="24" y2="3" stroke="#0284c7" strokeWidth="2" />
              </svg>
            </div>
            <span className="circuit-palette-label">مفتاح</span>
          </div>

          <span className="circuit-sidebar-title" style={{ marginTop: 4 }}>
            أجهزة القياس
          </span>

          <div
            className="circuit-palette-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("type", "ammeter")}
            onClick={() => sceneRef.current?.spawnComponent("ammeter")}
          >
            <div className="circuit-palette-preview">
              <svg width="28" height="22" viewBox="0 0 28 22">
                <rect x="2" y="2" width="24" height="18" rx="3" fill="#ffffff" stroke="#1B7340" strokeWidth="1.5" />
                <text x="14" y="15" fill="#1B7340" fontSize="10" fontWeight="bold" textAnchor="middle">
                  A
                </text>
              </svg>
            </div>
            <span className="circuit-palette-label">أميتر (التيار)</span>
          </div>

          <div
            className="circuit-palette-card"
            onClick={() => {
              setDmmVisible((v) => !v);
              CircuitSound.playClick();
            }}
          >
            <div className="circuit-palette-preview">
              <svg width="34" height="24" viewBox="0 0 34 24">
                <rect x="2" y="2" width="30" height="20" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                <rect x="6" y="5" width="22" height="7" rx="1" fill="#0f172a" />
                <text x="17" y="11" fill="#38bdf8" fontSize="6" fontFamily="monospace" textAnchor="middle">
                  فولتميتر
                </text>
              </svg>
            </div>
            <span className="circuit-palette-label">{dmmVisible ? "إخفاء الفولتميتر" : "فولتميتر منضدي"}</span>
          </div>
        </aside>
      </div>

      {/* نافذة المساعدة والشرح */}
      <CircuitHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
