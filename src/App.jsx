/**
 * App.jsx — التخطيط العلوي: حوض المحاكاة (الكانفس) + كل لوحات HUD.
 * يملك useSimulation() (مصدر الحقيقة الوحيد لحالة المحاكاة) ويمرره لأبنائه.
 */
import { useRef, useState } from "react";
import CanvasStage from "./components/CanvasStage.jsx";
import MaterialTray from "./components/MaterialTray.jsx";
import ShapeRow from "./components/ShapeRow.jsx";
import DeleteBodyButton from "./components/DeleteBodyButton.jsx";
import ControlDock from "./components/ControlDock.jsx";
import HelpModal from "./components/HelpModal.jsx";
import SoundToggle from "./components/SoundToggle.jsx";
import DropIndicator from "./components/DropIndicator.jsx";
import { useSimulation } from "./simulation/useSimulation.js";
import { MAX_BODIES } from "./data/simulationData.js";
import { toArabicNum } from "./physics/snapshot.js";
import { SoundEngine } from "./audio/soundEngine.js";

export default function App() {
  const { stateRef, actions } = useSimulation();
  const canvasApiRef = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const bodyCount = stateRef.current.bodies.length;
  const cur = toArabicNum(bodyCount);
  const max = toArabicNum(MAX_BODIES);
  const bodyHeading = `الأجسام (${cur}/${max}) — اسحب مادة للبركة`;
  const bodyHint =
    bodyCount >= MAX_BODIES
      ? `اكتمل العدد (${cur}/${max}) — اضغط "حذف" لإزالة المحدَّد`
      : `اسحب مادة للبركة لإضافة جسم (${cur}/${max})`;

  function openHelp() {
    setHelpOpen(true);
    if (stateRef.current.soundEnabled) SoundEngine.playClick();
  }

  return (
    <div id="sim-stage">
      <CanvasStage ref={canvasApiRef} stateRef={stateRef} actions={actions} />

      <div className="sim-title">
        <span className="title-accent"></span>
        <span className="title-text">الطفو</span>
        <span className="title-sub">تجربة أرخميدس</span>
        <button
          id="help-toggle"
          className="help-toggle"
          aria-label="عن التجربة والقوانين"
          title="عن التجربة والقوانين"
          onClick={openHelp}
        >
          ؟
        </button>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="hud hud-body">
        <div className="hud-heading-row">
          <div className="hud-heading">{bodyHeading}</div>
          <DeleteBodyButton stateRef={stateRef} actions={actions} />
        </div>
        <MaterialTray stateRef={stateRef} actions={actions} canvasApiRef={canvasApiRef} />
        <ShapeRow stateRef={stateRef} actions={actions} />
        <p className="mat-hint">{bodyHint}</p>
      </div>

      <ControlDock stateRef={stateRef} actions={actions} canvasApiRef={canvasApiRef} />

      <DropIndicator />
      <SoundToggle stateRef={stateRef} actions={actions} />
    </div>
  );
}
