/**
 * PhApp.jsx — تجربة الأس الهيدروجيني (pH) بمنضدة مختبر تفاعلية احترافية.
 *
 * وضعان:
 *  - "استكشف": اختر سائلاً من الشرائح، ثم تفاعل مع أدوات المنضدة مباشرة:
 *    القطّارة (استمر بالضغط لإسقاط السائل)، حنفية الماء (تخفيف)، وصنبور
 *    التصريف. السائل يأخذ لون مادته الحقيقي، والـ pH يظهر على المقياس.
 *  - "حضّر محلولك": أنبوبا اختبار رفيعان — اختر سائلاً لكلٍّ، راقب pH، واصب
 *    في الكأس الكبير؛ يُحسب pH المزيج علمياً عبر ميزان الشحنة (H⁺/OH⁻).
 *
 * الصبّ/الإسقاط/التصريف مستمرّ طالما الزر مضغوط عبر حلقة requestAnimationFrame
 * تعدّل الحجوم؛ مصدر الحقيقة volumesRef (يُقرأ/يُكتب فوراً) ونعكسه إلى state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import PlatformBrand from "../components/PlatformBrand.jsx";
import PhScene from "./components/PhScene.jsx";
import PhScaleBar from "./components/PhScaleBar.jsx";
import InfoPanel from "./components/InfoPanel.jsx";
import SolutionPicker from "./components/SolutionPicker.jsx";
import Beaker from "./components/Beaker.jsx";
import TestTube from "./components/TestTube.jsx";
import ModeTabs from "./components/ModeTabs.jsx";
import PhHelpModal from "./components/PhHelpModal.jsx";
import { SOLUTIONS, DEFAULT_SOLUTION, blendedColorCSS, solutionColorSolid } from "./phData.js";
import { phColorCSS } from "./phColor.js";
import {
  computePH,
  mixPH,
  fillFraction,
  formatAr,
  MAX_VOLUME,
  DEFAULT_SOLUTE_VOLUME,
  NEUTRAL_PH,
  TUBE_MAX_VOLUME,
} from "./phModel.js";
import { PhSound } from "./phAudio.js";
import "./ph.css";

const WATER_RATE = 0.5; // لتر/ثانية
const SOLUTE_RATE = 0.45; // لتر/ثانية (القطّارة)
const DRAIN_RATE = 0.5; // لتر/ثانية

const INITIAL_TUBES = [
  { key: "lemon", volume: 0.2 },
  { key: "soap", volume: 0.2 },
];

function blendPartsColor(parts) {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const p of parts) {
    if (p.volume <= 0) continue;
    total += p.volume;
    r += p.color[0] * p.volume;
    g += p.color[1] * p.volume;
    b += p.color[2] * p.volume;
    a += p.alpha * p.volume;
  }
  if (total <= 0) return phColorCSS(NEUTRAL_PH);
  return `rgba(${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)}, ${(a / total).toFixed(3)})`;
}

export default function PhApp({ onHome }) {
  const [mode, setMode] = useState("explore");
  const [solutionKey, setSolutionKey] = useState(DEFAULT_SOLUTION);
  const [volumes, setVolumes] = useState({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
  const [tubes, setTubes] = useState(INITIAL_TUBES);
  const [beakerParts, setBeakerParts] = useState([]);
  const [pouringTube, setPouringTube] = useState(null); // 0 | 1 | null
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pouringWater, setPouringWater] = useState(false);
  const [dripping, setDripping] = useState(false);
  const [draining, setDraining] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const volumesRef = useRef(volumes);
  const labBeakerRef = useRef(null);
  const applyVolumes = useCallback((next) => {
    volumesRef.current = next;
    setVolumes(next);
  }, []);

  const tubesRef = useRef(tubes);
  const beakerPartsRef = useRef(beakerParts);
  useEffect(() => {
    tubesRef.current = tubes;
  }, [tubes]);
  useEffect(() => {
    beakerPartsRef.current = beakerParts;
  }, [beakerParts]);

  const solutePH = SOLUTIONS[solutionKey].pH;

  const beakerVolume = beakerParts.reduce((s, p) => s + p.volume, 0);
  const beakerPH = beakerVolume <= 0.001 ? NEUTRAL_PH : mixPH(beakerParts);

  const totalVolume = mode === "explore" ? volumes.solute + volumes.water : beakerVolume;
  const empty = totalVolume <= 0.001;
  const full = totalVolume >= MAX_VOLUME - 0.001;
  const pH =
    mode === "custom"
      ? beakerPH
      : empty
      ? NEUTRAL_PH
      : computePH({ soluteVolume: volumes.solute, waterVolume: volumes.water, solutePH });

  const liquidColor =
    mode === "custom"
      ? empty
        ? phColorCSS(NEUTRAL_PH)
        : blendPartsColor(beakerParts)
      : blendedColorCSS(solutionKey, volumes.solute, volumes.water);
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

  /* ===== صبّ من أنابيب الاختبار إلى الكأس ===== */
  const pouringTubeRef = useRef(null);

  const stopTubePour = useCallback(() => {
    pouringTubeRef.current = null;
    setPouringTube(null);
    PhSound.stopPour();
  }, []);

  function transferFromTube(index, requestedAmount) {
    const tubeList = tubesRef.current.map((t) => ({ ...t }));
    const tube = tubeList[index];
    if (!tube || tube.volume <= 0.001) return false;

    const parts = beakerPartsRef.current.slice();
    const beakerVol = parts.reduce((s, p) => s + p.volume, 0);
    const room = Math.max(0, MAX_VOLUME - beakerVol);
    const amount = Math.min(tube.volume, room, requestedAmount);
    if (amount <= 0.00001) return false;

    const sol = SOLUTIONS[tube.key];
    tube.volume = Math.max(0, tube.volume - amount);
    parts.push({
      volume: amount,
      pH: sol.pH,
      color: sol.color,
      alpha: sol.alpha,
      key: tube.key,
    });

    const merged = [];
    for (const part of parts) {
      const previous = merged[merged.length - 1];
      if (previous && previous.key === part.key && Math.abs(previous.pH - part.pH) < 1e-9) {
        previous.volume += part.volume;
      } else {
        merged.push({ ...part });
      }
    }

    tubesRef.current = tubeList;
    beakerPartsRef.current = merged;
    setTubes(tubeList);
    setBeakerParts(merged);
    return tube.volume > 0.001 && beakerVol + amount < MAX_VOLUME - 0.001;
  }

  function startTubePour(index) {
    if (mode !== "custom") return;
    const tube = tubesRef.current[index];
    if (!tube || tube.volume <= 0.001) return;
    const beakerVol = beakerPartsRef.current.reduce((s, p) => s + p.volume, 0);
    if (beakerVol >= MAX_VOLUME - 0.001) return;

    pouringTubeRef.current = index;
    setPouringTube(index);
    if (soundEnabled) PhSound.playPouredIntoWater();

    // ينقل كامل محتوى الأنبوب مرة واحدة، مع إبقاء ما لا يتّسع له الكأس داخل الأنبوب.
    transferFromTube(index, tube.volume);
  }

  function setTubeSolution(index, key) {
    setTubes((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, key } : t));
      tubesRef.current = next;
      return next;
    });
    if (soundEnabled) PhSound.playClick();
  }

  function setTubeVolume(index, volume) {
    const v = Math.max(0, Math.min(TUBE_MAX_VOLUME, volume));
    setTubes((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, volume: v } : t));
      tubesRef.current = next;
      return next;
    });
  }

  function fillTube(index) {
    setTubeVolume(index, TUBE_MAX_VOLUME);
    if (soundEnabled) PhSound.playFill();
  }

  function emptyBeaker() {
    stopTubePour();
    beakerPartsRef.current = [];
    setBeakerParts([]);
    if (soundEnabled) PhSound.playClick();
  }

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
    stopTubePour();
    setMode(next);
    if (soundEnabled) PhSound.playClick();
  }

  return (
    <div className="ph-stage">
      <header className="ph-topbar">
        <PlatformBrand onClick={onHome} />
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
          <div className="ph-workspace">
            {/* ترتيب DOM لـ RTL: الأول يمين → اختيار السائل | الوسط → الكأس | الأخير يسار → المقياس */}
            <SolutionPicker activeKey={solutionKey} onSelect={selectSolution} />

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

            <PhScaleBar pH={pH} empty={empty} />
          </div>

          <div className="ph-bench-footer">
            <button type="button" className="ph-empty-btn" onClick={handleEmpty} disabled={empty}>
              🔄 تفريغ الكأس
            </button>
            <span className="ph-scene-hint">💡 اضغط باستمرار على الحنفية أو القطّارة أو صنبور التصريف</span>
          </div>

          <InfoPanel pH={pH} empty={empty} solutionKey={solutionKey} mode="explore" />
        </div>
      ) : (
        <div className="ph-experiment">
          <div className="ph-workspace ph-workspace-lab">
            <div className="ph-lab">
              <TestTube
                index={0}
                label="أنبوب ١"
                solutionKey={tubes[0].key}
                volume={tubes[0].volume}
                pouring={pouringTube === 0}
                canPour={!full && pouringTube !== 1}
                beakerRef={labBeakerRef}
                onSolutionChange={(key) => setTubeSolution(0, key)}
                onVolumeChange={(v) => setTubeVolume(0, v)}
                onFill={() => fillTube(0)}
                onPourStart={() => startTubePour(0)}
                onPourStop={stopTubePour}
                onPickUp={() => soundEnabled && PhSound.playPickUp()}
                onPutDown={() => soundEnabled && PhSound.playPutDown()}
              />

              <div className="ph-lab-beaker" ref={labBeakerRef}>
                <div className="ph-lab-beaker-title">الكأس الكبير</div>
                <Beaker
                  pH={pH}
                  fillFraction={fillFraction(totalVolume)}
                  volumeLabel={formatAr(totalVolume, 2)}
                  pouring={pouringTube != null}
                  liquidColor={liquidColor}
                />
                {!empty && (
                  <div className="ph-lab-beaker-ph" style={{ background: phColorCSS(pH) }}>
                    <span>pH</span>
                    <strong>{formatAr(pH, 2)}</strong>
                  </div>
                )}
                <button type="button" className="ph-empty-btn" onClick={emptyBeaker} disabled={empty}>
                  🔄 تفريغ الكأس
                </button>
                <span className="ph-lab-hint">
                  اسحب أي أنبوب فوق الكأس؛ يُسكب محتواه كاملاً دفعة واحدة
                </span>
              </div>

              <TestTube
                index={1}
                label="أنبوب ٢"
                solutionKey={tubes[1].key}
                volume={tubes[1].volume}
                pouring={pouringTube === 1}
                canPour={!full && pouringTube !== 0}
                beakerRef={labBeakerRef}
                onSolutionChange={(key) => setTubeSolution(1, key)}
                onVolumeChange={(v) => setTubeVolume(1, v)}
                onFill={() => fillTube(1)}
                onPourStart={() => startTubePour(1)}
                onPourStop={stopTubePour}
                onPickUp={() => soundEnabled && PhSound.playPickUp()}
                onPutDown={() => soundEnabled && PhSound.playPutDown()}
              />
            </div>

            <aside className="ph-lab-side">
              <PhScaleBar pH={pH} empty={empty} />
              <InfoPanel pH={pH} empty={empty} solutionKey={solutionKey} mode="custom" />
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
