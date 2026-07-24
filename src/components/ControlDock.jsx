/**
 * ControlDock.jsx — لوحة التحكم السفلية. على الشاشات الكبيرة CSS لا يفرض
 * عليها موضع "ورقة قابلة للطي"؛ على الجوال تصبح bottom sheet قابلة للطي/التوسيع.
 */
import { useRef, useState } from "react";
import { SoundEngine } from "../audio/soundEngine.js";
import ForcesPanel from "./ForcesPanel.jsx";
import LiquidSelect from "./LiquidSelect.jsx";
import SizeSlider from "./SizeSlider.jsx";
import Readouts from "./Readouts.jsx";
import MiniStats from "./MiniStats.jsx";

/**
 * الورقة السفلية تتحرك بانتقال CSS مدته 0.25 ثانية (max-height). إعادة قياس
 * تخطيط الحوض مرة واحدة فقط عند الضغط تلتقط ارتفاعها قبل اكتمال الحركة؛
 * هنا نعيد القياس كل إطار طوال مدة الانتقال حتى يتزامن حجم الحوض مع حركة
 * الورقة بدل "قفزة" مفاجئة بعد انتهائها.
 */
function syncLayoutToDockTransition(canvasApiRef, durationMs = 320) {
  const start = performance.now();
  function tick() {
    canvasApiRef.current?.relayout();
    if (performance.now() - start < durationMs) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export default function ControlDock({ stateRef, actions, canvasApiRef }) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useRef("dock-body").current;

  function handleToggle() {
    setExpanded((v) => !v);
    if (stateRef.current.soundEnabled) SoundEngine.playClick();
    syncLayoutToDockTransition(canvasApiRef);
  }

  return (
    <div className={`control-dock${expanded ? " expanded" : ""}`} id="control-dock">
      <button
        className="dock-toggle"
        id="dock-toggle"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={handleToggle}
      >
        <MiniStats stateRef={stateRef} />
        <span className="dock-chevron" aria-hidden="true">
          ︿
        </span>
      </button>

      <div className="dock-body" id={bodyId}>
        <ForcesPanel stateRef={stateRef} actions={actions} />

        <aside className="hud-column hud-right">
          <LiquidSelect stateRef={stateRef} actions={actions} />
          <SizeSlider stateRef={stateRef} actions={actions} />
          <Readouts stateRef={stateRef} />
        </aside>
      </div>
    </div>
  );
}
