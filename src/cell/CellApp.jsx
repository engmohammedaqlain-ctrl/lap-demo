/**
 * CellApp.jsx — تجربة «رحلة داخل الخلية».
 *
 * القشرة العليا بطابع الموقع: شريط علوي (رئيسية/عنوان/؟+🔊)، شريط أدوات
 * (حيواني↔نباتي، استكشاف↔تحدٍّ، إعادة الرحلة)، المشهد (canvas)، واللوحة
 * التفسيرية. إدارة الحالة هنا؛ المشهد يبثّ الزووم/الأداء/النقر للأعلى، ويتلقّى
 * أوامر التأثيرات عبر مرجع أمري.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import CellScene from "./CellScene.jsx";
import CellControls from "./components/CellControls.jsx";
import CellInfoPanel from "./components/CellInfoPanel.jsx";
import CellChallenge from "./components/CellChallenge.jsx";
import CellHelpModal from "./components/CellHelpModal.jsx";
import { challengePool, CROWD, interiorFor, INTERIORS, organelleKind } from "./cellData.js";
import { CellSound } from "./cellAudio.js";
import "./cell.css";

const INTERIOR_TITLE = (id) => (INTERIORS[organelleKind(id)] ? INTERIORS[organelleKind(id)].title : "");

const ORG_NAME = {};
for (const o of challengePool("plant")) ORG_NAME[o.id] = o.name;

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export default function CellApp({ onHome }) {
  const [cellType, setCellType] = useState("animal");
  const [mode, setMode] = useState("explore");
  const [selectedId, setSelectedId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reducedMotion] = useState(prefersReduced);

  const [zoom, setZoom] = useState({ stage: "نقطة ماء", mag: "×1", pct: 0, atLimit: false });
  const [particleCount, setParticleCount] = useState(CROWD.target);

  const [challenge, setChallenge] = useState({ target: null, feedback: null, attempts: 0, score: 0 });
  const [focus, setFocus] = useState({ focusId: null, inside: false });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const advanceTimer = useRef(0);

  const onFocus = useCallback((f) => setFocus(f), []);

  /* ملء الشاشة */
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  function toggleFullscreen() {
    const el = stageRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
    click();
  }

  const click = useCallback(() => {
    if (soundEnabled) CellSound.playClick();
  }, [soundEnabled]);

  /* ===== callbacks من المشهد ===== */
  const onZoom = useCallback((z) => setZoom(z), []);
  const onPerf = useCallback((n) => setParticleCount(n), []);

  const pickChallenge = useCallback(
    (type, avoidId) => {
      const pool = challengePool(type).filter((o) => o.id !== avoidId && o.id !== "cytoplasm");
      return pool[(Math.random() * pool.length) | 0];
    },
    []
  );

  const onPick = useCallback(
    (id) => {
      if (mode === "explore") {
        setSelectedId(id && id !== "cytoplasm" ? id : id === "cytoplasm" ? "cytoplasm" : null);
        return;
      }
      // وضع التحدّي — الغلط مجاني
      setChallenge((ch) => {
        if (!ch.target) return ch;
        if (!id) return ch;
        const tappedName = ORG_NAME[id] || (id === "membrane" ? "الغشاء البلازمي" : id === "wall" ? "الجدار الخلوي" : id === "cytoplasm" ? "السيتوبلازم" : "");
        const isCorrect = tappedName && tappedName === ch.target.name;
        if (isCorrect) {
          setSelectedId(ch.target.id);
          if (soundEnabled) CellSound.playCorrect();
          sceneRef.current?.celebrate();
          clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => {
            setSelectedId(null);
            setChallenge((c) => ({ ...c, target: pickChallenge(cellType, c.target?.id), feedback: null, attempts: 0 }));
          }, 1700);
          return { ...ch, feedback: { tone: "correct", text: `أحسنت! هذا هو ${ch.target.name}.` }, score: ch.score + 1 };
        }
        // خطأ: تلميح لطيف بلا عقاب
        if (soundEnabled) CellSound.playWrong();
        sceneRef.current?.hintWrong(id);
        const hint = tappedName
          ? `هذا هو ${tappedName}. ليس المطلوب — جرّب عضيّاً آخر!`
          : "اضغط عضيّاً محدّداً داخل الخلية.";
        return { ...ch, feedback: { tone: "wrong", text: hint }, attempts: ch.attempts + 1 };
      });
    },
    [mode, cellType, soundEnabled, pickChallenge]
  );

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  /* ===== أفعال الأدوات ===== */
  function changeCellType(next) {
    if (next === cellType) return;
    setCellType(next);
    setSelectedId(null);
    sceneRef.current?.flashDifferences();
    if (mode === "challenge") {
      setChallenge((c) => ({ ...c, target: pickChallenge(next, null), feedback: null, attempts: 0 }));
    }
    click();
  }

  function changeMode(next) {
    if (next === mode) return;
    setMode(next);
    setSelectedId(null);
    if (next === "challenge") {
      setChallenge({ target: pickChallenge(cellType, null), feedback: null, attempts: 0, score: 0 });
    }
    click();
  }

  function skipQuestion() {
    setSelectedId(null);
    setChallenge((c) => ({ ...c, target: pickChallenge(cellType, c.target?.id), feedback: null, attempts: 0 }));
    click();
  }

  function reset() {
    sceneRef.current?.resetView();
    setSelectedId(null);
    click();
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      CellSound.setMuted(!next);
      return next;
    });
  }

  return (
    <div className="cl-stage" ref={stageRef}>
      <header className="cl-topbar">
        <button type="button" className="cl-home-btn" onClick={onHome} title="الرئيسية">
          🏠 <span className="cl-home-text">الرئيسية</span>
        </button>
        <div className="cl-title">
          <span className="cl-title-main">رحلة داخل الخلية</span>
        </div>
        <div className="cl-topbar-actions">
          <button
            type="button"
            className="cl-fs-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
            title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? "🗗" : "⛶"}
          </button>
          <button
            type="button"
            className="cl-help-btn"
            onClick={() => {
              setHelpOpen(true);
              click();
            }}
            aria-label="شرح الدرس"
            title="شرح الدرس"
          >
            ؟
          </button>
          <button
            type="button"
            className="cl-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <CellHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <CellControls
        cellType={cellType}
        onCellType={changeCellType}
        mode={mode}
        onMode={changeMode}
        onReset={reset}
      />

      <div className="cl-experiment">
        <div className="cl-scene-col">
          <div className="cl-scene-card">
            <CellScene
              ref={sceneRef}
              cellType={cellType}
              mode={mode}
              selectedId={selectedId}
              reducedMotion={reducedMotion}
              soundEnabled={soundEnabled}
              onPick={onPick}
              onZoom={onZoom}
              onPerf={onPerf}
              onFocus={onFocus}
            />

            {/* زر الغوص داخل العضي المحدّد */}
            {mode === "explore" && !focus.focusId && selectedId && interiorFor(selectedId) && (
              <button
                type="button"
                className="cl-dive-btn"
                onClick={() => {
                  sceneRef.current?.diveInto(selectedId);
                  click();
                }}
              >
                🔬 اغطس داخل {INTERIOR_TITLE(selectedId).replace("داخل ", "")} ⤵
              </button>
            )}

            {/* زر الرجوع من داخل العضي */}
            {focus.focusId && (
              <button
                type="button"
                className="cl-back-btn"
                onClick={() => {
                  sceneRef.current?.exitDive();
                  click();
                }}
              >
                ⤴ رجوع إلى الخلية
              </button>
            )}

            {mode === "challenge" && (
              <CellChallenge
                target={challenge.target}
                feedback={challenge.feedback}
                attempts={challenge.attempts}
                score={challenge.score}
                onSkip={skipQuestion}
              />
            )}
          </div>
          <span className="cl-scene-hint">
            💡 كبّر بعجلة الماوس أو بإصبعين — وتجاوز حدّ المجهر المدرسي!
          </span>
        </div>

        <CellInfoPanel
          selectedId={selectedId}
          cellType={cellType}
          zoom={zoom}
          particleCount={particleCount}
          perfReduced={particleCount < CROWD.target}
        />
      </div>
    </div>
  );
}
