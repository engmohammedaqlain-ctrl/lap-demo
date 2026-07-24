/**
 * ShapeRow.jsx — أزرار اختيار شكل الجسم الفعّال (مكعب/كرة)
 */
import { SoundEngine } from "../audio/soundEngine.js";

const SHAPES = [
  { value: "cube", label: "■ مكعب" },
  { value: "sphere", label: "● كرة" },
];

export default function ShapeRow({ stateRef, actions }) {
  const activeBody = stateRef.current.bodies[stateRef.current.activeIndex];
  const shapeType = activeBody ? activeBody.shapeType : "cube";

  function handleSelect(value) {
    if (value === shapeType) return;
    actions.setShapeForActive(value);
    if (stateRef.current.soundEnabled) SoundEngine.playClick();
  }

  return (
    <div className="shape-row">
      <span className="shape-label">الشكل:</span>
      {SHAPES.map((s) => (
        <label
          key={s.value}
          className={`shape-btn${shapeType === s.value ? " active" : ""}`}
          data-shape={s.value}
          onClick={() => handleSelect(s.value)}
        >
          <input type="radio" name="shape" value={s.value} checked={shapeType === s.value} hidden readOnly />
          {s.label}
        </label>
      ))}
    </div>
  );
}
