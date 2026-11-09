/**
 * BuoyancyApp.jsx — تجربة الطفو (أرخميدس) بأسلوب مختبر تفاعلي:
 * المشهد (خزان + رف أجسام) على Canvas، والواجهة طبقة زجاجية خفيفة:
 *   - تبويبان: استكشف / الجسم الغامض.
 *   - لوحة السائل (يسار) مع مفاتيح الإظهار.
 *   - في الجسم الغامض: اختر مادة الجسم بعد تجربته في السوائل.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import BuoyancyScene from "./buoyancy/BuoyancyScene.jsx";
import HelpModal from "./components/HelpModal.jsx";
import { LIQUIDS, LIQUID_ORDER, MYSTERY_MATERIALS, MYSTERY_ORDER } from "./buoyancy/catalog.js";
import { iconFor, getTextures } from "./buoyancy/textures.js";
import {
  IconHome,
  IconHelp,
  IconSound,
  IconReset,
  IconRuler,
  IconForces,
  IconValues,
  IconDrop,
  IconNext,
} from "./ui/icons.jsx";
import { play, setMuted } from "./audio/sfx.js";
import "./buoyancy/buoyancy.css";

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const fmtD = (n) => Math.round(n).toLocaleString("ar-EG");

const TOGGLES = [
  { key: "forces", label: "القوى", Icon: IconForces },
  { key: "values", label: "القيم", Icon: IconValues },
  { key: "displacement", label: "الإزاحة", Icon: IconDrop },
  { key: "ruler", label: "المسطرة", Icon: IconRuler },
];

export default function BuoyancyApp({ onHome }) {
  const sceneRef = useRef(null);
  const [mode, setMode] = useState("explore");
  const [liquidKey, setLiquidKey] = useState("water");
  const [customDensity, setCustomDensity] = useState(1300);
  const [flags, setFlags] = useState({ forces: true, values: true, displacement: true, ruler: true });
  const [sound, setSound] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [guess, setGuess] = useState({ status: "idle", wrong: [], msg: "" });
  const woodImg = useMemo(() => `url(${getTextures().wood.front.toDataURL("image/jpeg", 0.8)})`, []);

  useEffect(() => {
    setMuted(false);
  }, []);

  const click = (name = "click") => play(name);
  const density = liquidKey === "custom" ? customDensity : LIQUIDS[liquidKey].density;

  function pickLiquid(k) {
    click("select");
    play("drop", { delay: 0.08, volume: 0.5 });
    setLiquidKey(k);
  }
  function toggle(k) {
    click("tick");
    setFlags((f) => ({ ...f, [k]: !f[k] }));
  }
  function switchMode(m) {
    if (m === mode) return;
    click("select");
    setMode(m);
    setGuess({ status: "idle", wrong: [], msg: "" });
  }
  function reset() {
    click("back");
    sceneRef.current?.reset();
    setLiquidKey("water");
    setGuess({ status: "idle", wrong: [], msg: "" });
  }
  function choose(key) {
    if (guess.status === "right" || guess.wrong.includes(key)) return;
    const res = sceneRef.current?.checkMystery(key);
    if (!res) return;
    if (res.ok) {
      setGuess({ status: "right", wrong: guess.wrong, msg: `${MYSTERY_MATERIALS[key].nameAr} — كثافته ${fmtD(res.density)} كغ/م³` });
    } else {
      play("back", { volume: 0.8 });
      setGuess({ status: "wrong", wrong: [...guess.wrong, key], msg: "ليس هذا" });
    }
  }
  function nextMystery() {
    click("select");
    sceneRef.current?.newMystery();
    setGuess({ status: "idle", wrong: [], msg: "" });
  }

  return (
    <div id="sim-stage" className="bu-stage" data-liquid={liquidKey} style={{ "--wood-img": woodImg }}>
      <BuoyancyScene
        ref={sceneRef}
        mode={mode}
        liquidKey={liquidKey}
        customDensity={customDensity}
        flags={flags}
        soundEnabled={sound}
        onMystery={(e) => e.type === "new" && setGuess({ status: "idle", wrong: [], msg: "" })}
      />

      <header className="bu-topbar">
        <div className="bu-cluster">
          <button type="button" className="bu-btn" aria-label="الرئيسية" title="الرئيسية" onClick={() => (click(), onHome())}>
            <IconHome />
          </button>
          <button type="button" className="bu-btn" aria-label="شرح" title="شرح" onClick={() => (click(), setHelpOpen(true))}>
            <IconHelp />
          </button>
          <button
            type="button"
            className="bu-btn"
            aria-label={sound ? "إيقاف الصوت" : "تشغيل الصوت"}
            title={sound ? "إيقاف الصوت" : "تشغيل الصوت"}
            onClick={() => {
              const next = !sound;
              setSound(next);
              setMuted(!next);
              if (next) play("click");
            }}
          >
            <IconSound muted={!sound} />
          </button>
          <button type="button" className="bu-btn" aria-label="إعادة الضبط" title="إعادة الضبط" onClick={reset}>
            <IconReset />
          </button>
        </div>

        <nav className="bu-tabs" role="tablist" aria-label="الوضع">
          <button type="button" role="tab" aria-selected={mode === "explore"} className={mode === "explore" ? "on" : ""} onClick={() => switchMode("explore")}>
            استكشف
          </button>
          <button type="button" role="tab" aria-selected={mode === "mystery"} className={mode === "mystery" ? "on" : ""} onClick={() => switchMode("mystery")}>
            الجسم الغامض
          </button>
        </nav>
        <span className="bu-spacer" />
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <aside className="bu-panel bu-fluid" aria-label="السائل">
        <h2 className="bu-h">السائل</h2>
        <div className="bu-liquid-list" role="radiogroup" aria-label="السائل">
          {LIQUID_ORDER.map((k) => {
            const l = LIQUIDS[k];
            const active = k === liquidKey;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                className={`bu-liquid${active ? " active" : ""}`}
                onClick={() => pickLiquid(k)}
              >
                <span className="bu-drop" style={{ background: `linear-gradient(160deg, ${rgb(l.color)}, ${rgb(l.deep)})` }} />
                <span className="bu-liquid-name">{l.nameAr}</span>
                <span className="bu-liquid-d">{k === "custom" ? "؟" : fmtD(l.density)}</span>
              </button>
            );
          })}
        </div>

        {liquidKey === "custom" && (
          <label className="bu-slider">
            <input
              type="range"
              min="300"
              max="3000"
              step="10"
              value={customDensity}
              onChange={(e) => {
                setCustomDensity(+e.target.value);
                play("tick", { throttle: 70, jitter: 0.02 });
              }}
              aria-label="كثافة السائل"
            />
          </label>
        )}

        <div className="bu-density" title="كثافة السائل">
          <b>{fmtD(density)}</b>
          <small>كغ/م³</small>
        </div>

        <div className="bu-toggles" role="group" aria-label="إظهار">
          {TOGGLES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`bu-tog${flags[key] ? " on" : ""}`}
              aria-pressed={flags[key]}
              aria-label={label}
              title={label}
              onClick={() => toggle(key)}
            >
              <Icon />
            </button>
          ))}
        </div>
      </aside>

      {mode === "mystery" && (
        <section className={`bu-panel bu-guess is-${guess.status}`} aria-label="ما هذا الجسم؟">
          <h2 className="bu-h">ما مادة الجسم؟</h2>
          <div className="bu-choices">
            {MYSTERY_ORDER.map((k) => {
              const wrong = guess.wrong.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className={`bu-choice${wrong ? " wrong" : ""}`}
                  onClick={() => choose(k)}
                  disabled={guess.status === "right"}
                  aria-label={MYSTERY_MATERIALS[k].nameAr}
                >
                  <img src={iconFor(`m_${k}`)} alt="" width="34" height="34" draggable="false" />
                  <span>{MYSTERY_MATERIALS[k].nameAr}</span>
                </button>
              );
            })}
          </div>
          {guess.msg && <p className="bu-msg">{guess.msg}</p>}
          {guess.status === "right" && (
            <button type="button" className="bu-next" onClick={nextMystery}>
              جسم جديد <IconNext width="18" height="18" />
            </button>
          )}
        </section>
      )}
    </div>
  );
}
