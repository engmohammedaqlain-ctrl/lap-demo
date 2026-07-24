/**
 * SizeSlider.jsx — يضبط مدى الشريط حسب شكل الجسم الفعّال (المدى مختلف
 * بين المكعب والكرة) ويثبّت قيمته على حجم الجسم الحالي.
 */
import { sizeRangeFor } from "../simulation/useSimulation.js";
import { formatNumber } from "../physics/snapshot.js";

export default function SizeSlider({ stateRef, actions }) {
  const activeBody = stateRef.current.bodies[stateRef.current.activeIndex];
  if (!activeBody) return null;

  const range = sizeRangeFor(activeBody.shapeType);

  return (
    <div className="hud hud-size">
      <div className="hud-heading">الحجم</div>
      <input
        type="range"
        id="size-slider"
        min={range.min}
        max={range.max}
        step={range.step}
        value={activeBody.shapeSize}
        onChange={(e) => actions.setSizeForActive(parseFloat(e.target.value))}
      />
      <span className="hud-readout" id="size-value">
        {formatNumber(activeBody.shapeSize, 2)} م
      </span>
    </div>
  );
}
