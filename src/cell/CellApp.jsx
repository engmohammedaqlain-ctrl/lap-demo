/**
 * CellApp.jsx — تجربة «رحلة داخل الخلية» كمجهر على طاولة معمل.
 *
 * البيئة (MicroscopeBench) تحمل كل أدوات التحكم الماديّة: مقبضا التركيز،
 * برج العدسات، رفّ الشرائح (نوع الخلية)، رافعة الغوص، ولوحة المقياس. مجال رؤية
 * العدسة العينية يعرض المشهد العلمي (CellScene) بإطار FovRim. بطاقة مثبّتة
 * تنقلب بين دفتر الملاحظات (استكشاف) وبطاقة الاختبار (تحدٍّ).
 * الأزرار الموحّدة الأربعة فقط: رئيسية / شرح / صوت / إعادة (Hud).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import CellScene from "./CellScene.jsx";
import MicroscopeBench from "./MicroscopeBench.jsx";
import FovRim from "./FovRim.jsx";
import ScopeView from "./ScopeView.jsx";
import SpecimenCard from "./components/SpecimenCard.jsx";
import CellHelpModal from "./components/CellHelpModal.jsx";
import { challengePool, interiorFor, ORGANELLES, ENVELOPE } from "./cellData.js";
import { CellSound } from "./cellAudio.js";
import { computeLayout, OBJECTIVES } from "./layout.js";
import { scopeLayout } from "./scope.js";
import { play } from "../audio/sfx.js";
import Hud from "../ui/Hud.jsx";
import "./cell.css";

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
  const roomRef = useRef(null);
  const sceneRef = useRef(null);
  const advanceTimer = useRef(0);

  const [size, setSize] = useState({ w: 1024, h: 640 });
  const [cellType, setCellType] = useState("animal");
  const [mode, setMode] = useState("explore");
  const [selectedId, setSelectedId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reducedMotion] = useState(prefersReduced);
  const [zoom, setZoom] = useState({ p: 0, stage: "نقطة ماء", mag: "×1", pct: 0, atLimit: false });
  const [focus, setFocus] = useState({ focusId: null, inside: false });
  const [challenge, setChallenge] = useState({ target: null, feedback: null, attempts: 0, score: 0 });
  const [hinted, setHinted] = useState(false);
  const [view, setView] = useState("scope"); // scope: المجهر كاملاً | fov: النظر من العينية
  const [looked, setLooked] = useState(false);
  const [light, setLight] = useState(0.9);

  /* مقاس الغرفة → تخطيط التصميم */
  useEffect(() => {
    const el = roomRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(200, Math.round(r.width)), h: Math.max(200, Math.round(r.height)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (import.meta.env.DEV) window.__cell = { scene: () => sceneRef.current, setView, setSel: setSelectedId };
  const L = computeLayout(size.w, size.h);
  const SL = scopeLayout(size.w, size.h);

  // التلميح العابر يكفي مرة: يختفي نهائياً بعد أول اختيار
  useEffect(() => {
    if (selectedId) setHinted(true);
  }, [selectedId]);

  const click = useCallback(() => {
    if (soundEnabled) play("click");
  }, [soundEnabled]);

  /* ===== من المشهد ===== */
  const onZoom = useCallback((z) => setZoom(z), []);
  const onFocus = useCallback((f) => setFocus(f), []);
  const onPerf = useCallback(() => {}, []);

  const pickChallenge = useCallback((type, avoidId) => {
    const pool = challengePool(type).filter((o) => o.id !== avoidId && o.id !== "cytoplasm");
    return pool[(Math.random() * pool.length) | 0];
  }, []);

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
        const tappedName =
          ORG_NAME[id] ||
          (id === "membrane" ? "الغشاء البلازمي" : id === "wall" ? "الجدار الخلوي" : id === "cytoplasm" ? "السيتوبلازم" : "");
        const isCorrect = tappedName && tappedName === ch.target.name;
        if (isCorrect) {
          setSelectedId(ch.target.id);
          if (soundEnabled) CellSound.playCorrect();
          sceneRef.current?.celebrate();
          clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => {
            setSelectedId(null);
            setChallenge((c) => ({ ...c, target: pickChallenge(cellType, c.target?.id), feedback: null, attempts: 0 }));
          }, 1900);
          return { ...ch, feedback: { tone: "correct", text: `أحسنت! هذا هو ${ch.target.name}.` }, score: ch.score + 1 };
        }
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

  /* ===== أفعال المجهر ===== */
  function changeCellType(next) {
    if (next === cellType) return;
    setCellType(next);
    setSelectedId(null);
    sceneRef.current?.flashDifferences();
    if (mode === "challenge") {
      setChallenge((c) => ({ ...c, target: pickChallenge(next, null), feedback: null, attempts: 0 }));
    }
    if (soundEnabled) play("select");
  }

  function flipCard() {
    const next = mode === "explore" ? "challenge" : "explore";
    setMode(next);
    setSelectedId(null);
    if (next === "challenge") {
      setChallenge({ target: pickChallenge(cellType, null), feedback: null, attempts: 0, score: 0 });
      // العضيّات لا تُنقر إلا قرب أقصى تكبير وخارج العضيّ: نهيّئ المجال للتحدّي
      const sc = sceneRef.current;
      sc?.exitDive();
      if (sc && sc.getZoom().target < 0.78) sc.setZoom(0.82);
    }
    if (soundEnabled) play("whoosh", { volume: 0.6 });
  }

  function skipQuestion() {
    setSelectedId(null);
    setChallenge((c) => ({ ...c, target: pickChallenge(cellType, c.target?.id), feedback: null, attempts: 0 }));
    click();
  }

  function onObjective(i) {
    sceneRef.current?.setZoom(OBJECTIVES[i].p);
    if (soundEnabled) play("select", { volume: 0.7 });
  }

  function onLever() {
    const sc = sceneRef.current;
    if (!sc) return;
    if (focus.focusId) {
      sc.exitDive();
    } else if (selectedId && interiorFor(selectedId)) {
      sc.diveInto(selectedId);
    } else if (soundEnabled) {
      play("back", { volume: 0.5 });
    }
  }

  function look() {
    setLooked(true);
    setView("fov");
    if (soundEnabled) {
      play("whoosh", { volume: 0.7 });
      play("select", { volume: 0.5, delay: 0.35 });
    }
  }
  function backToScope() {
    setView("scope");
    if (soundEnabled) play("whoosh", { volume: 0.6, rate: 0.85 });
  }
  useEffect(() => {
    if (view !== "fov") return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") backToScope();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, soundEnabled]);

  function reset() {
    sceneRef.current?.resetView();
    setSelectedId(null);
    setCellType("animal");
    setLight(0.9);
    setMode("explore");
    setView("scope");
    click();
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      CellSound.setMuted(!next);
      return next;
    });
  }

  const org = selectedId ? BY_ID[selectedId] : null;
  const canDive = !!(selectedId && interiorFor(selectedId) && !focus.focusId);
  const f = L.fov;

  // مركز العينية ونصف قطرها (px) لحساب مسار الكاميرا بين المشهدين
  const ex = SL.eye.x * SL.s;
  const ey = SL.eye.y * SL.s;
  const er = SL.eye.r * SL.s;
  const fcx = f.cx * L.s;
  const fcy = f.cy * L.s;
  const fr = f.r * L.s;
  const roomVars = {
    "--ex": `${ex}px`,
    "--ey": `${ey}px`,
    "--maxr": `${Math.hypot(size.w, size.h) * 1.08}px`,
  };


  return (
    <div className="cl-room" ref={roomRef} data-view={view} style={roomVars}>
      <div className="cl-view cl-view-scope" aria-hidden={view !== "scope"}>
        <ScopeView
          L={SL}
          type={cellType}
          active={view === "scope"}
          light={light}
          looked={looked}
          sceneRef={sceneRef}
          soundEnabled={soundEnabled}
          onLook={look}
          onObjective={onObjective}
          onType={changeCellType}
          onLight={setLight}
        />
      </div>

      <div className="cl-view cl-view-fov" aria-hidden={view !== "fov"}>
      <MicroscopeBench
        L={L}
        type={cellType}
        zoom={zoom}
        canDive={canDive || !!focus.focusId}
        diving={!!focus.focusId}
        sceneRef={sceneRef}
        soundEnabled={soundEnabled}
        onType={changeCellType}
        onObjective={onObjective}
        onLever={onLever}
      />

      {/* مجال رؤية العدسة العينية: المشهد العلمي */}
      <div
        className="cl-fov"
        style={{
          left: (f.cx - f.r) * L.s,
          top: (f.cy - f.r) * L.s,
          width: f.r * 2 * L.s,
          height: f.r * 2 * L.s,
          filter: `brightness(${0.5 + 0.5 * light})`,
        }}
      >
        <CellScene
          ref={sceneRef}
          cellType={cellType}
          mode={mode}
          selectedId={selectedId}
          reducedMotion={reducedMotion}
          soundEnabled={soundEnabled}
          paused={view !== "fov"}
          onPick={onPick}
          onZoom={onZoom}
          onPerf={onPerf}
          onFocus={onFocus}
        />
      </div>
      <FovRim L={L} />
      <button
        type="button"
        className="cl-back"
        aria-label="العودة إلى المجهر"
        title="العودة إلى المجهر"
        onClick={backToScope}
        style={{ left: fcx - fr * 0.84 - 4, top: fcy + fr * 0.62 }}
      >
        <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
          <path d="M16 6h8v4l8 6v6l-4 2v8l6 4v4H12v-4l6-4v-8l-4-2v-6l6-5z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 12l6-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>

      {/* طبقة عناصر نصّية بإحداثيات التصميم (تتبع مقياس المشهد) */}
      <div className="cl-ui" style={{ width: L.dW, height: L.dH, transform: `scale(${L.s})`, "--s": L.s }}>
        <SpecimenCard
          rect={L.card}
          scale={L.s}
          mode={mode}
          onFlip={flipCard}
          org={org}
          cellType={cellType}
          challenge={challenge}
          onSkip={skipQuestion}
        />

        {org && !focus.focusId && (
          <div className="cl-tag" key={org.id} style={{ left: f.cx, top: f.cy + f.r * 0.7 }}>
            <b>{org.name}</b>
          </div>
        )}
        {!hinted && mode === "explore" && !selectedId && (
          <div className="cl-hint" style={{ left: f.cx - 190, top: f.cy + f.r * 0.7, width: 380 }}>
            دوّر المقبض لتقترب، ثم المس عضيّاً
          </div>
        )}
      </div>


      </div>

      <header className="cl-hud">
        <Hud
          onHome={onHome}
          onHelp={() => {
            setHelpOpen(true);
            click();
          }}
          sound={soundEnabled}
          onSound={toggleSound}
          onReset={reset}
        />
      </header>

      <CellHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
