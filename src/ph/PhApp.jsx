/**
 * PhApp.jsx — تجربة الأس الهيدروجيني في مختبر حقيقي (Canvas):
 *   - اختر سائلاً من قوارير الرف (لمسة).
 *   - الضغط المطوّل: حنفية الماء (تخفيف)، القطّارة (إضافة)، صمام التصريف.
 *   - جهاز "محلول مخصّص": لفّ المقبض لضبط pH والرافعة للحجم.
 * الواجهة الموحّدة الوحيدة: رئيسية / شرح / صوت / إعادة. كل شيء آخر داخل المشهد.
 *
 * المنطق: حلقة rAF تعدّل الحجوم طالما التدفّق مفعّل؛ مصدر الحقيقة volumesRef.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import PhLab from "./PhLab.jsx";
import PhHelpModal from "./components/PhHelpModal.jsx";
import { SOLUTIONS, DEFAULT_SOLUTION, blendedColorCSS } from "./phData.js";
import { phColorRGB } from "./phColor.js";
import { computePH, phStatus, MAX_VOLUME, DEFAULT_SOLUTE_VOLUME, NEUTRAL_PH } from "./phModel.js";
import { PhSound } from "./phAudio.js";
import Hud from "../ui/Hud.jsx";
import "./ph.css";

const WATER_RATE = 0.5; // لتر/ثانية
const SOLUTE_RATE = 0.45; // لتر/ثانية (القطّارة)
const DRAIN_RATE = 0.5; // لتر/ثانية
const WATER_RGB = [200, 228, 240];

function parseRGBA(css) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(css);
  if (!m) return { rgb: WATER_RGB.slice(), a: 0.5 };
  return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
}

export default function PhApp({ onHome }) {
  const [customActive, setCustomActive] = useState(false);
  const [solutionKey, setSolutionKey] = useState(DEFAULT_SOLUTION);
  const [volumes, setVolumes] = useState({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
  const [customPH, setCustomPH] = useState(NEUTRAL_PH);
  const [customVolume, setCustomVolume] = useState(0.6);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flows, setFlows] = useState({ water: false, dripping: false, draining: false });
  const [waste, setWaste] = useState({ vol: 0, rgb: WATER_RGB.slice(), a: 0.5 });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    PhSound.setMuted(false);
    return () => {
      PhSound.stopPour();
      PhSound.stopDrainSound();
    };
  }, []);

  const volumesRef = useRef(volumes);
  const applyVolumes = useCallback((next) => {
    volumesRef.current = next;
    setVolumes(next);
  }, []);

  const solution = SOLUTIONS[solutionKey];
  const exploreTotal = volumes.solute + volumes.water;
  const totalVolume = customActive ? customVolume : exploreTotal;
  const empty = totalVolume <= 0.001;
  const full = totalVolume >= MAX_VOLUME - 0.001;
  const pH = customActive
    ? customPH
    : empty
    ? NEUTRAL_PH
    : computePH({ soluteVolume: volumes.solute, waterVolume: volumes.water, solutePH: solution.pH });

  const exploreColor = parseRGBA(blendedColorCSS(solutionKey, volumes.solute, volumes.water));
  const liquid = customActive ? { rgb: phColorRGB(customPH), a: 0.88 } : exploreColor;
  const tone = empty ? "" : phStatus(pH).label;

  /* ===== حلقة الصبّ/الإسقاط/التصريف ===== */
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const flowsRef = useRef({ water: false, solute: false, drain: false });
  const wasteRef = useRef(waste);
  const colorRef = useRef(exploreColor);
  colorRef.current = exploreColor;

  const tick = useCallback(
    (ts) => {
      const f = flowsRef.current;
      if (!f.water && !f.solute && !f.drain) {
        rafRef.current = 0;
        return;
      }
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;

      let { solute, water } = volumesRef.current;
      if (f.water) {
        const room = Math.max(0, MAX_VOLUME - (solute + water));
        water += Math.min(room, WATER_RATE * dt);
      }
      if (f.solute) {
        const room = Math.max(0, MAX_VOLUME - (solute + water));
        solute += Math.min(room, SOLUTE_RATE * dt);
        PhSound.playDrip();
      }
      if (f.drain) {
        const total = solute + water;
        if (total > 0) {
          const frac = Math.min(1, (DRAIN_RATE * dt) / total);
          const removed = total * frac;
          solute *= 1 - frac;
          water *= 1 - frac;
          if (solute + water < 0.002) {
            solute = 0;
            water = 0;
          }
          const c = colorRef.current;
          const w = wasteRef.current;
          const nv = w.vol + removed;
          const t = removed / Math.max(0.0001, nv);
          wasteRef.current = {
            vol: nv,
            rgb: w.rgb.map((v, i) => v + (c.rgb[i] - v) * Math.min(1, t * 2.5)),
            a: w.a + (c.a - w.a) * Math.min(1, t * 2.5),
          };
          setWaste(wasteRef.current);
        }
      }
      applyVolumes({ solute, water });

      if ((f.water || f.solute) && solute + water >= MAX_VOLUME - 0.001) {
        stopWater();
        stopDrip();
      }
      if (f.drain && solute + water <= 0) stopDrain();
      rafRef.current = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyVolumes]
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
    if (isNeutral && !wasNeutralRef.current && !customActive && soundEnabled) PhSound.playNeutralChime();
    wasNeutralRef.current = isNeutral;
  }, [pH, empty, soundEnabled, customActive]);

  /* ===== أفعال ===== */
  function backToExplore() {
    if (customActive) setCustomActive(false);
  }
  function stopWater() {
    setFlows((f) => ({ ...f, water: false }));
    stopFlowKind("water");
    PhSound.stopPour();
  }
  function stopDrip() {
    setFlows((f) => ({ ...f, dripping: false }));
    stopFlowKind("solute");
  }
  function stopDrain() {
    setFlows((f) => ({ ...f, draining: false }));
    stopFlowKind("drain");
    PhSound.stopDrainSound();
  }
  function startWater() {
    backToExplore();
    if (volumesRef.current.solute + volumesRef.current.water >= MAX_VOLUME - 0.001) return;
    setFlows((f) => ({ ...f, water: true }));
    startFlow("water");
    PhSound.startPour();
  }
  function startDrip() {
    backToExplore();
    if (volumesRef.current.solute + volumesRef.current.water >= MAX_VOLUME - 0.001) return;
    setFlows((f) => ({ ...f, dripping: true }));
    startFlow("solute");
  }
  function startDrain() {
    backToExplore();
    const t = volumesRef.current.solute + volumesRef.current.water;
    if (t <= 0.001) return;
    setFlows((f) => ({ ...f, draining: true }));
    startFlow("drain");
    PhSound.startDrainSound();
  }
  function stopAll() {
    stopWater();
    stopDrip();
    stopDrain();
  }

  function selectSolution(key) {
    stopAll();
    setCustomActive(false);
    setSolutionKey(key);
    applyVolumes({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
    PhSound.playClick();
  }

  function enterCustom() {
    if (!customActive) {
      stopAll();
      setCustomActive(true);
    }
  }
  function onCustomPH(v) {
    enterCustom();
    setCustomPH(v);
  }
  function onCustomVolume(v) {
    enterCustom();
    setCustomVolume(v);
  }

  function reset() {
    stopAll();
    setCustomActive(false);
    setSolutionKey(DEFAULT_SOLUTION);
    applyVolumes({ solute: DEFAULT_SOLUTE_VOLUME, water: 0 });
    setCustomPH(NEUTRAL_PH);
    setCustomVolume(0.6);
    wasteRef.current = { vol: 0, rgb: WATER_RGB.slice(), a: 0.5 };
    setWaste(wasteRef.current);
    PhSound.playClick();
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      PhSound.setMuted(!next);
      return next;
    });
  }

  return (
    <div className="ph-stage">
      <PhLab
        mode={customActive ? "custom" : "explore"}
        solutionKey={solutionKey}
        solRGB={solution.color}
        liquid={liquid}
        total={totalVolume}
        pH={pH}
        empty={empty}
        full={full}
        tone={tone}
        flows={flows}
        waste={waste}
        customActive={customActive}
        customPH={customPH}
        customVolume={customVolume}
        onSelect={selectSolution}
        onWaterStart={startWater}
        onWaterStop={stopWater}
        onDripStart={startDrip}
        onDripStop={stopDrip}
        onDrainStart={startDrain}
        onDrainStop={stopDrain}
        onCustomPH={onCustomPH}
        onCustomVolume={onCustomVolume}
      />

      <header className="ph-hud">
        <Hud
          onHome={onHome}
          onHelp={() => {
            setHelpOpen(true);
            PhSound.playClick();
          }}
          sound={soundEnabled}
          onSound={toggleSound}
          onReset={reset}
        />
      </header>

      <PhHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
