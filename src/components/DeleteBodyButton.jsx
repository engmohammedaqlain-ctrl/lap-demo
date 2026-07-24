/**
 * DeleteBodyButton.jsx — يحذف الجسم الفعّال (يظهر فقط عند وجود أكثر من جسم)
 */
import { SoundEngine } from "../audio/soundEngine.js";

export default function DeleteBodyButton({ stateRef, actions }) {
  const count = stateRef.current.bodies.length;
  if (count <= 1) return <button id="delete-body-btn" className="delete-body-btn" hidden />;

  function handleClick() {
    actions.removeActiveBody();
    if (stateRef.current.soundEnabled) SoundEngine.playClick();
  }

  return (
    <button
      id="delete-body-btn"
      className="delete-body-btn"
      title="حذف الجسم المحدَّد"
      onClick={handleClick}
    >
      ✕ حذف
    </button>
  );
}
