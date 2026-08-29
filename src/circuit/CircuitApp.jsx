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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState("components"); // 'components' | 'presets' | 'settings'
  const [presetSearch, setPresetSearch] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  const [isShortCircuit, setIsShortCircuit] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [metrics, setMetrics] = useState({
    totalCurrent: 0,
    totalPower: 0,
    hasBattery: false,
    openSwitches: 0,
    isShortCircuit: false,
    compCount: 0,
    wireCount: 0,
  });

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

  // Filter presets based on search query
  const filteredPresets = Object.entries(EXPERIMENT_PRESETS).filter(([key, preset]) => {
    if (!presetSearch.trim()) return true;
    const q = presetSearch.toLowerCase();
    return preset.title.toLowerCase().includes(q) || preset.desc.toLowerCase().includes(q);
  });

  // Compute live circuit state for HUD
  let statusTone = "idle";
  let statusEmoji = "🔌";
  let statusTitle = "الدائرة جاهزة";
  let statusDesc = "اسحب المكونات وصِل بينها بالأسلاك لبناء دائرتك.";

  if (isShortCircuit || metrics.isShortCircuit) {
    statusTone = "danger";
    statusEmoji = "🔥";
    statusTitle = "ماس كهربائي (Short Circuit)!";
    statusDesc = "مسار منعدم المقاومة يسبب تدفق تيار هائل وخطير.";
  } else if (!metrics.hasBattery && metrics.compCount > 0) {
    statusTone = "warn";
    statusEmoji = "🔋";
    statusTitle = "لا يوجد مصدر جهد";
    statusDesc = "أضف بطارية لتزويد الدائرة بالطاقة وفرق الجهد.";
  } else if (metrics.openSwitches > 0) {
    statusTone = "warn";
    statusEmoji = "🔘";
    statusTitle = "المفتاح مفتوح";
    statusDesc = "اضغط على المفتاح لغلقه وإكمال مسار التيار.";
  } else if (metrics.totalCurrent > 0.001) {
    statusTone = "success";
    statusEmoji = "⚡";
    statusTitle = "دائرة مغلقة وتعمل بنجاح";
    statusDesc = `التيار الكلي: ${metrics.totalCurrent.toFixed(2)}A · القدرة المستهلكة: ${metrics.totalPower.toFixed(2)}W`;
  } else if (metrics.compCount > 0) {
    statusTone = "idle";
    statusEmoji = "📐";
    statusTitle = "دائرة غير مكتملة";
    statusDesc = "صِل الأسلاك بين أطراف المكونات لتكوين حلقة مغلقة.";
  }

  return (
    <div className="circuit-app">
      {/* الشريط العلوي الموحّد والمنظّم */}
      <header className="circuit-topbar">
        <div className="cir-topbar-left">
          <PlatformBrand onClick={onHome} />
          <div className="circuit-title">
            <span className="circuit-title-bolt" aria-hidden="true">
              ⚡
            </span>
            <span className="circuit-title-main">الدوائر الكهربائية</span>
          </div>
        </div>

        {/* أدوات التحكم والخيارات السريعة */}
        <div className="circuit-topbar-tools">
          {/* زر فتح/إغلاق حقيبة المكونات والتجارب */}
          <button
            type="button"
            className={`cir-btn-ui cir-btn-drawer-toggle ${drawerOpen ? "active" : ""}`}
            onClick={() => {
              setDrawerOpen((v) => !v);
              CircuitSound.playClick();
            }}
            title="فتح/إغلاق حقيبة الأدوات والتجارب"
          >
            <span>🧰</span>
            <span>الأدوات والتجارب</span>
          </button>

          <div className="cir-divider" />

          {/* دليل التجربة */}
          <button
            type="button"
            className={`cir-btn-ui ${showBanner ? "active" : ""}`}
            onClick={() => {
              setShowBanner((v) => !v);
              CircuitSound.playClick();
            }}
            title="إظهار/إخفاء دليل التجربة الحالية"
          >
            <span>💡</span> الدليل
          </button>

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

          <button
            type="button"
            className="cir-btn-ui cir-btn-danger"
            onClick={() => sceneRef.current?.clearAll()}
            title="مسح كامل عناصر اللوحة"
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
            title="دليل الدرس والقوانين التعليمية"
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
        {/* دليل التجربة التفسيري العائم */}
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

        {/* لوحة التحليل اللحظي الذكية (Live Circuit HUD) */}
        <div className={`cir-status-hud tone-${statusTone}`}>
          <span className="cir-status-emoji">{statusEmoji}</span>
          <div className="cir-status-text">
            <span className="cir-status-title">{statusTitle}</span>
            <span className="cir-status-desc">{statusDesc}</span>
          </div>
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
          onMetricsChange={setMetrics}
        />

        {/* مقبض سحب وطي القائمة من اليمين */}
        <button
          type="button"
          className={`cir-drawer-toggle-tab ${drawerOpen ? "open" : ""}`}
          onClick={() => {
            setDrawerOpen((v) => !v);
            CircuitSound.playClick();
          }}
          title={drawerOpen ? "إخفاء القائمة (تمرير لليمين)" : "إظهار القائمة (تمرير من اليمين)"}
        >
          {drawerOpen ? "❯" : "❮"}
        </button>

        {/* القائمة الجانبية المنظمة المنزلقة من اليمين (Drawer Panel) */}
        <aside className={`circuit-sidebar-drawer ${drawerOpen ? "open" : "collapsed"}`}>
          {/* تبويبات القائمة */}
          <div className="cir-drawer-tabs">
            <button
              type="button"
              className={`cir-drawer-tab ${drawerTab === "components" ? "active" : ""}`}
              onClick={() => setDrawerTab("components")}
            >
              <span>⚡ المكونات</span>
            </button>
            <button
              type="button"
              className={`cir-drawer-tab ${drawerTab === "presets" ? "active" : ""}`}
              onClick={() => setDrawerTab("presets")}
            >
              <span>📚 التجارب</span>
            </button>
            <button
              type="button"
              className={`cir-drawer-tab ${drawerTab === "settings" ? "active" : ""}`}
              onClick={() => setDrawerTab("settings")}
            >
              <span>⚙️ الضبط</span>
            </button>
          </div>

          <div className="cir-drawer-content">
            {/* تبويب 1: المكونات والمصادر بشبكة منظمة */}
            {drawerTab === "components" && (
              <div className="cir-components-section">
                <span className="cir-section-heading">⚡ مصادر الجهد والأحمال</span>
                <div className="cir-palette-grid">
                  {/* بطارية */}
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
                    <span className="circuit-palette-label">بطارية DC (9V)</span>
                  </div>

                  {/* مصباح */}
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
                    <span className="circuit-palette-label">مصباح (10Ω)</span>
                  </div>

                  {/* مقاومة ثابتة */}
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

                  {/* مقاومة متغيرة */}
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

                  {/* LED */}
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
                    <span className="circuit-palette-label">دايود مشع LED</span>
                  </div>

                  {/* مكثف */}
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
                    <span className="circuit-palette-label">مكثف كهربائي</span>
                  </div>

                  {/* مفتاح */}
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
                    <span className="circuit-palette-label">مفتاح كهربائي</span>
                  </div>

                  {/* أميتر */}
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
                    <span className="circuit-palette-label">أميتر للتيار</span>
                  </div>
                </div>

                <span className="cir-section-heading" style={{ marginTop: 14 }}>
                  🔬 أجهزة القياس المنضدية
                </span>
                <div
                  className={`cir-dmm-toggle-card ${dmmVisible ? "active" : ""}`}
                  onClick={() => {
                    setDmmVisible((v) => !v);
                    CircuitSound.playClick();
                  }}
                >
                  <div className="cir-dmm-toggle-icon">
                    <svg width="34" height="24" viewBox="0 0 34 24">
                      <rect x="2" y="2" width="30" height="20" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                      <rect x="6" y="5" width="22" height="7" rx="1" fill="#0f172a" />
                      <text x="17" y="11" fill="#38bdf8" fontSize="6" fontFamily="monospace" textAnchor="middle">
                        V / CONT
                      </text>
                    </svg>
                  </div>
                  <div className="cir-dmm-toggle-info">
                    <span className="cir-dmm-toggle-title">الفولتميتر الرقمي (DMM)</span>
                    <span className="cir-dmm-toggle-sub">
                      {dmmVisible ? "🟢 معروض على اللوحة (انقر للإخفاء)" : "⚪ مخفي (انقر للإظهار)"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* تبويب 2: تجارب المنهج مع فلتر البحث */}
            {drawerTab === "presets" && (
              <div className="cir-presets-section">
                {/* حقل البحث والفلترة */}
                <div className="cir-search-wrapper">
                  <input
                    type="text"
                    className="cir-search-input"
                    placeholder="🔍 ابحث في تجارب المنهج..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                  />
                  {presetSearch && (
                    <button
                      type="button"
                      className="cir-search-clear"
                      onClick={() => setPresetSearch("")}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* قائمة بطاقات التجارب */}
                <div className="cir-presets-list">
                  {filteredPresets.map(([key, preset]) => (
                    <div
                      key={key}
                      className={`cir-preset-card ${activePreset === key ? "active" : ""}`}
                      onClick={() => handlePresetSelect(key)}
                    >
                      <div className="cir-preset-card-head">
                        <span className="cir-preset-card-title">{preset.title}</span>
                        {activePreset === key && <span className="cir-active-badge">نشط الآن</span>}
                      </div>
                      <p className="cir-preset-card-desc">{preset.desc}</p>
                      <button
                        type="button"
                        className="cir-preset-load-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePresetSelect(key);
                        }}
                      >
                        ⚡ تحميل التجربة
                      </button>
                    </div>
                  ))}

                  {filteredPresets.length === 0 && (
                    <div className="cir-empty-search">
                      <span>🔍 لم يتم العثور على تجربة مطابقة للبحث</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* تبويب 3: خيارات العرض والضبط */}
            {drawerTab === "settings" && (
              <div className="cir-settings-section">
                <span className="cir-section-heading">🎨 لون أسلاك التوصيل</span>
                <div className="cir-swatch-picker">
                  {WIRE_COLORS.map((swatch) => (
                    <div
                      key={swatch.hex}
                      className={`cir-swatch-item ${activeWireColor === swatch.hex ? "active" : ""}`}
                      onClick={() => {
                        setActiveWireColor(swatch.hex);
                        CircuitSound.playClick();
                      }}
                    >
                      <span className="cir-swatch-circle" style={{ backgroundColor: swatch.hex }} />
                      <span className="cir-swatch-text">{swatch.label}</span>
                    </div>
                  ))}
                </div>

                <span className="cir-section-heading" style={{ marginTop: 16 }}>
                  📐 خيارات المحاكاة والمحاذاة
                </span>

                <div className="cir-settings-toggles">
                  <div
                    className={`cir-setting-row ${snapToGrid ? "on" : ""}`}
                    onClick={() => {
                      setSnapToGrid((v) => !v);
                      CircuitSound.playClick();
                    }}
                  >
                    <div className="cir-setting-label">
                      <span>🧲 المحاذاة المغناطيسية</span>
                      <small>محاذاة العناصر تلقائياً على نقاط الشبكة</small>
                    </div>
                    <span className="cir-toggle-switch">{snapToGrid ? "مفعّل" : "معطل"}</span>
                  </div>

                  <div
                    className={`cir-setting-row ${showValues ? "on" : ""}`}
                    onClick={() => {
                      setShowValues((v) => !v);
                      CircuitSound.playClick();
                    }}
                  >
                    <div className="cir-setting-label">
                      <span>🏷️ عرض القيم القياسية</span>
                      <small>إظهار الأوم والفولت والسعة فوق كل عنصر</small>
                    </div>
                    <span className="cir-toggle-switch">{showValues ? "مفعّل" : "معطل"}</span>
                  </div>

                  <div
                    className="cir-setting-row"
                    onClick={handleToggleFlowMode}
                  >
                    <div className="cir-setting-label">
                      <span>🔄 نمط حركة التيار</span>
                      <small>
                        {flowMode === "electrons"
                          ? "تدفق الإلكترونات الحقيقية (من − إلى +)"
                          : flowMode === "conventional"
                          ? "التيار الاصطلاحي التقليدي (من + إلى −)"
                          : "إيقاف الرسوم المتحركة للتيار"}
                      </small>
                    </div>
                    <span className="cir-toggle-switch mode">
                      {flowMode === "electrons"
                        ? "إلكترونات"
                        : flowMode === "conventional"
                        ? "اصطلاحي"
                        : "متوقف"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* نافذة المساعدة والشرح */}
      <CircuitHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
