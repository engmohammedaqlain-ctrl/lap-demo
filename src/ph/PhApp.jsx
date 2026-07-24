/**
 * PhApp.jsx — تجربة الأس الهيدروجيني (pH) بمنضدة مختبر تفاعلية احترافية.
 *
 * وضعان:
 *  - "استكشف": اختر سائلاً من الشرائح، ثم تفاعل مع أدوات المنضدة مباشرة:
 *    القطّارة (استمر بالضغط لإسقاط السائل)، حنفية الماء (تخفيف)، وصنبور
 *    التصريف. السائل يأخذ لون مادته الحقيقي، والـ pH يظهر على المقياس.
 *  - "حضّر محلولك": اضبط pH والحجم بشريطي تمرير (لون الكاشف الشامل).
 *
 * الصبّ/الإسقاط/التصريف مستمرّ طالما الزر مضغوط عبر حلقة requestAnimationFrame
 * تعدّل الحجوم؛ مصدر الحقيقة volumesRef (يُقرأ/يُكتب فوراً) ونعكسه إلى state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import PhScene from "./components/PhScene.jsx";
import PhScaleBar from "./components/PhScaleBar.jsx";
import InfoPanel from "./components/InfoPanel.jsx";
import SolutionPicker from "./components/SolutionPicker.jsx";
import CustomControls from "./components/CustomControls.jsx";
import Beaker from "./components/Beaker.jsx";
import ModeTabs from "./components/ModeTabs.jsx";
import PhHelpModal from "./components/PhHelpModal.jsx";
import { SOLUTIONS, DEFAULT_SOLUTION, blendedColorCSS, solutionColorSolid } from "./phData.js";
import { phColorCSS } from "./phColor.js";
import {
  computePH,
  fillFraction,
  formatAr,
  MAX_VOLUME,
  DEFAULT_SOLUTE_VOLUME,
  NEUTRAL_PH,
} from "./phModel.js";
import { PhSound } from "./phAudio.js";
import "./ph.css";

const WATER_RATE = 0.5; // لتر/ثانية
const SOLUTE_RATE = 0.45; // لتر/ثانية (القطّارة)
const DRAIN_RATE = 0.5; // لتر/ثانية

export default function PhApp({ onHome }) {
  const [mode, setMode] = useState("explore");
  const [solutionKey, setSolutionKey] = useState(DEFAULT_SOLUTION);
  const [volumes, setVolumes] = useState({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
  const [customPH, setCustomPH] = useState(NEUTRAL_PH);
  const [customVolume, setCustomVolume] = useState(0.5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pouringWater, setPouringWater] = useState(false);
  const [dripping, setDripping] = useState(false);
  const [draining, setDraining] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const volumesRef = useRef(volumes);
  const applyVolumes = useCallback((next) => {
    volumesRef.current = next;
    setVolumes(next);
  }, []);

  const solutePH = SOLUTIONS[solutionKey].pH;

  const totalVolume = mode === "explore" ? volumes.solute + volumes.water : customVolume;
  const empty = totalVolume <= 0.001;
  const full = totalVolume >= MAX_VOLUME - 0.001;
  const pH =
    mode === "custom"
      ? customPH
      : empty
      ? NEUTRAL_PH
      : computePH({ soluteVolume: volumes.solute, waterVolume: volumes.water, solutePH });

  const liquidColor = mode === "custom" ? phColorCSS(customPH) : blendedColorCSS(solutionKey, volumes.solute, volumes.water);
  const dropperColor = solutionColorSolid(solutionKey);

  /* ===== حلقة الصبّ/الإسقاط/التصريف ===== */
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const flowsRef = useRef({ water: false, solute: false, drain: false });

  const tick = useCallback(
    (ts) => {
      const flows = flowsRef.current;
      if (!flows.water && !flows.solute && !flows.drain) {
        rafRef.current = 0;
        return;
      }
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;

      let { solute, water } = volumesRef.current;

      if (flows.water) {
        const room = Math.max(0, MAX_VOLUME - (solute + water));
        water += Math.min(room, WATER_RATE * dt);
      }
      if (flows.solute) {
        const room = Math.max(0, MAX_VOLUME - (solute + water));
        solute += Math.min(room, SOLUTE_RATE * dt);
        if (soundEnabled) PhSound.playDrip();
      }
      if (flows.drain) {
        const total = solute + water;
        if (total > 0) {
          const frac = Math.min(1, (DRAIN_RATE * dt) / total);
          solute *= 1 - frac;
          water *= 1 - frac;
          if (solute + water < 0.002) {
            solute = 0;
            water = 0;
          }
        }
      }

      applyVolumes({ solute, water });

      if ((flows.water || flows.solute) && solute + water >= MAX_VOLUME - 0.001) {
        stopWater();
        stopDrip();
      }
      if (flows.drain && solute + water <= 0) stopDrain();

      rafRef.current = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyVolumes, soundEnabled]
  );

  const startFlow = useCallback(
    (kind) => {
      flowsRef.current[kind] = true;
      lastTsRef.current = 0;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    },
    [tick]
  );
  const stopFlowKind = useCallback((kind) => {
    flowsRef.current[kind] = false;
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* ===== نغمة "تعادل" عند بلوغ pH ٧ ===== */
  const wasNeutralRef = useRef(false);
  useEffect(() => {
    const isNeutral = !empty && Math.abs(pH - NEUTRAL_PH) < 0.05;
    if (isNeutral && !wasNeutralRef.current && soundEnabled) PhSound.playNeutralChime();
    wasNeutralRef.current = isNeutral;
  }, [pH, empty, soundEnabled]);

  /* ===== أفعال ===== */
  function selectSolution(key) {
    // إيقاف جميع التدفقات قبل تغيير السائل لمنع تضارب الحالة
    stopWater();
    stopDrip();
    stopDrain();
    setSolutionKey(key);
    applyVolumes({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
    if (soundEnabled) PhSound.playClick();
  }

  function startWater() {
    if (totalVolume >= MAX_VOLUME - 0.001) return;
    setPouringWater(true);
    startFlow("water");
    if (soundEnabled) PhSound.startPour();
  }
  function stopWater() {
    setPouringWater(false);
    stopFlowKind("water");
    PhSound.stopPour();
  }
  function startDrip() {
    if (totalVolume >= MAX_VOLUME - 0.001) return;
    setDripping(true);
    startFlow("solute");
  }
  function stopDrip() {
    setDripping(false);
    stopFlowKind("solute");
  }
  function startDrain() {
    if (empty) return;
    setDraining(true);
    startFlow("drain");
    if (soundEnabled) PhSound.startDrainSound();
  }
  function stopDrain() {
    setDraining(false);
    stopFlowKind("drain");
    PhSound.stopDrainSound();
  }

  function handleEmpty() {
    stopWater();
    stopDrip();
    stopDrain();
    applyVolumes({ solute: 0, water: 0 });
    if (soundEnabled) PhSound.playClick();
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      PhSound.setMuted(!next);
      return next;
    });
  }

  function changeMode(next) {
    if (next === mode) return;
    stopWater();
    stopDrip();
    stopDrain();
    setMode(next);
    if (soundEnabled) PhSound.playClick();
  }

  return (
    <div className="ph-stage">
      <header className="ph-topbar">
        <button type="button" className="ph-home-btn" onClick={onHome} title="الرئيسية">
          🏠 <span className="ph-home-text">الرئيسية</span>
        </button>
        <div className="ph-title">
          <span className="ph-title-main">الأس الهيدروجيني</span>
        </div>
        <div className="ph-topbar-actions">
          <button
            type="button"
            className="ph-help-btn"
            onClick={() => {
              setHelpOpen(true);
              if (soundEnabled) PhSound.playClick();
            }}
            aria-label="شرح الدرس"
            title="شرح الدرس"
          >
            ؟
          </button>
          <button
            type="button"
            className="ph-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <PhHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <ModeTabs mode={mode} onChange={changeMode} />

      {mode === "explore" ? (
        <div className="ph-experiment">
          {/* الصف العلوي: اختيار السائل (يمين) + المشهد والمقياس (الوسط) */}
          <div className="ph-workspace">
            <SolutionPicker activeKey={solutionKey} onSelect={selectSolution} />

            <div className="ph-lab">
              <div className="ph-scene-col">
                <div className="ph-scene-card">
                  <PhScene
                    empty={empty}
                    fillFraction={fillFraction(totalVolume)}
                    liquidColor={liquidColor}
                    dropperColor={dropperColor}
                    volumeLabel={formatAr(totalVolume, 2)}
                    pouringWater={pouringWater}
                    dripping={dripping}
                    draining={draining}
                    onWaterStart={startWater}
                    onWaterStop={stopWater}
                    onDripStart={startDrip}
                    onDripStop={stopDrip}
                    onDrainStart={startDrain}
                    onDrainStop={stopDrain}
                    full={full}
                  />
                </div>
                <div className="ph-bench-footer">
                  <button type="button" className="ph-empty-btn" onClick={handleEmpty} disabled={empty}>
                    🫗 تفريغ الكأس
                  </button>
                  <span className="ph-scene-hint">💡 اضغط باستمرار على القطّارة أو الحنفية أو صنبور التصريف</span>
                </div>
              </div>
              <PhScaleBar pH={pH} empty={empty} />
            </div>
          </div>

          {/* شريط سفلي يمتدّ بعرض الشاشة: الجانب النظري */}
          <InfoPanel pH={pH} empty={empty} solutionKey={solutionKey} mode="explore" />
        </div>
      ) : (
        <div className="ph-experiment">
          <div className="ph-workspace">
            <PhScaleBar pH={pH} empty={empty} />
            <div className="ph-center">
              <Beaker pH={pH} fillFraction={fillFraction(totalVolume)} volumeLabel={formatAr(totalVolume, 2)} pouring={false} />
            </div>
            <div className="ph-controls">
              <CustomControls
                customPH={customPH}
                customVolume={customVolume}
                onPHChange={setCustomPH}
                onVolumeChange={setCustomVolume}
              />
              <InfoPanel pH={pH} empty={empty} solutionKey={solutionKey} mode="custom" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
