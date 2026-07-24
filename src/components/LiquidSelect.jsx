/**
 * LiquidSelect.jsx — اختيار السائل، مبني من LIQUIDS بدل تكرار الأسماء بالـ HTML
 */
import { SoundEngine } from "../audio/soundEngine.js";
import { LIQUIDS, LIQUID_ORDER } from "../data/simulationData.js";

export default function LiquidSelect({ stateRef, actions }) {
  const liquidKey = stateRef.current.liquidKey;

  function handleChange(e) {
    actions.setLiquid(e.target.value);
    if (stateRef.current.soundEnabled) SoundEngine.playClick();
  }

  return (
    <div className="hud hud-fluid">
      <div className="hud-heading">السائل</div>
      <select id="liquid-select" className="hud-select" value={liquidKey} onChange={handleChange}>
        {LIQUID_ORDER.map((key) => {
          const liquid = LIQUIDS[key];
          const label = liquid.emoji ? `${liquid.emoji} ${liquid.nameAr}` : liquid.nameAr;
          return (
            <option key={key} value={key}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
