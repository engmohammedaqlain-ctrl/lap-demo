/**
 * CellApp.jsx — تجربة «رحلة داخل الخلية».
 *
 * القشرة العليا بنفس لغة تصميم المختبر: أزرار الواجهة المشتركة (Hud)، عمود أدوات
 * زجاجي (حيواني↔نباتي، استكشاف↔تحدٍّ، إعادة الرحلة)، المشهد (canvas) بملء
 * المساحة، واللوحة التفسيرية في دُرج. إدارة الحالة هنا؛ المشهد يبثّ
 * الزووم/الأداء/النقر للأعلى، ويتلقّى أوامر التأثيرات عبر مرجع أمري.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import CellScene from "./CellScene.jsx";
import CellControls from "./components/CellControls.jsx";
import CellInfoPanel from "./components/CellInfoPanel.jsx";
import CellChallenge from "./components/CellChallenge.jsx";
import CellHelpModal from "./components/CellHelpModal.jsx";
import { challengePool, CROWD, interiorFor, INTERIORS, organelleKind, ORGANELLES, ENVELOPE } from "./cellData.js";
import { CellSound } from "./cellAudio.js";
import "./cell.css";

import { InfoDrawer } from "../mobile/GameChrome.jsx";
import Hud from "../ui/Hud.jsx";
import { IconDive, IconBack } from "../ui/icons.jsx";

const INTERIOR_TITLE = (id) => (INTERIORS[organelleKind(id)] ? INTERIORS[organelleKind(id)].title : "");

const BY_ID = {};
for (const o of ORGANELLES) BY_ID[o.id] = o;
for (const k in ENVELOPE) BY_ID[ENVELOPE[k].id] = ENVELOPE[k];

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

  const [hinted, setHinted] = useState(false);
  const sceneRef = useRef(null);
  const advanceTimer = useRef(0);

  // التلميح العابر يكفي مرة واحدة: يختفي نهائياً بعد أول اختيار
  useEffect(() => {
    if (selectedId) setHinted(true);
  }, [selectedId]);

  const onFocus = useCallback((f) => setFocus(f), []);

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
    <div className="cl-stage g-stage g-fill">
      <header className="g-topbar">
        <Hud
          onHome={onHome}
          onHelp={() => {
            setHelpOpen(true);
            click();
          }}
          sound={soundEnabled}
          onSound={toggleSound}
        />
      </header>

      <CellHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <CellControls
        cellType={cellType}
        onCellType={changeCellType}
        mode={mode}
        onMode={changeMode}
        onReset={reset}
      />

      <div className="cl-experiment g-experiment">
        <div className="cl-scene-col g-scene-col">
          <div className="cl-scene-card g-scene-card">
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

            {/* مؤشّر الرحلة: أين أنا الآن ومقدار التكبير */}
            <div className="cl-zoom-chip" aria-live="polite">
              <span className="cl-zoom-chip-stage">{zoom.stage}</span>
              <span className="cl-zoom-chip-mag">{zoom.mag}</span>
              <span className="cl-zoom-chip-bar">
                <i style={{ width: `${zoom.pct}%` }} />
              </span>
            </div>

            {/* بطاقة العضيّ المحدّد: الاسم + الوظيفة بلا فتح الدُرج */}
            {mode === "explore" && selectedId && !focus.focusId && BY_ID[selectedId] && (
              <div className="cl-pick-card" key={selectedId}>
                <b>{BY_ID[selectedId].name}</b>
                <span>{BY_ID[selectedId].func}</span>
              </div>
            )}

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
                <IconDive width="20" height="20" />
                <span>اغطس داخل {INTERIOR_TITLE(selectedId).replace("داخل ", "")}</span>
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
                <IconBack width="20" height="20" />
                <span>رجوع إلى الخلية</span>
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
          {mode === "explore" && !hinted && !selectedId && (
            <span className="cl-scene-hint g-hint">كبّر بإصبعين أو بعجلة الماوس، ثم اضغط أي عضيّ</span>
          )}
        </div>

        <InfoDrawer label="معلومات">
          <CellInfoPanel
            selectedId={selectedId}
            cellType={cellType}
            zoom={zoom}
            particleCount={particleCount}
            perfReduced={particleCount < CROWD.target}
          />
        </InfoDrawer>
      </div>
    </div>
  );
}
