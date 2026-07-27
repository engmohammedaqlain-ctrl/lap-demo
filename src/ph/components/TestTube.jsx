/**
 * TestTube.jsx — أنبوب اختبار طويل قابل للإمساك والسحب.
 * عند سحبه فوق الكأس يميل تلقائياً ويبدأ الصب، ثم يعود إلى حامله عند الإفلات.
 */
import { useRef, useState } from "react";
import { SOLUTIONS, SOLUTION_ORDER, solutionColorCSS } from "../phData.js";
import { formatAr, TUBE_MAX_VOLUME } from "../phModel.js";
import { phColorCSS } from "../phColor.js";

export default function TestTube({
  index,
  label,
  solutionKey,
  volume,
  pouring,
  canPour,
  beakerRef,
  onSolutionChange,
  onVolumeChange,
  onFill,
  onPourStart,
  onPourStop,
  onPickUp,
  onPutDown,
}) {
  const dragRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const overBeakerRef = useRef(false);
  const draggingRef = useRef(false);
  const [drag, setDrag] = useState({ active: false, x: 0, y: 0, over: false });

  const solution = SOLUTIONS[solutionKey];
  const pH = solution.pH;
  const empty = volume <= 0.001;
  const tubeFill = Math.max(0, Math.min(100, Math.round((volume / TUBE_MAX_VOLUME) * 100)));
  const liquidColor = solutionColorCSS(solutionKey);

  function isOverBeaker(clientX, clientY) {
    const rect = beakerRef?.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left - 55 &&
      clientX <= rect.right + 55 &&
      clientY >= rect.top - 85 &&
      clientY <= rect.bottom + 25
    );
  }

  function moveDrag(clientX, clientY) {
    if (!draggingRef.current || !clientX || !clientY) return;
    const over = isOverBeaker(clientX, clientY);
    const wasOver = overBeakerRef.current;
    overBeakerRef.current = over;
    setDrag({
      active: true,
      x: clientX - startRef.current.x,
      y: clientY - startRef.current.y,
      over,
    });
    if (over && !wasOver) onPourStart();
    if (!over && wasOver) onPourStop();
  }

  function stopDrag(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      dragRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      // قد يكون الالتقاط تحرّر تلقائياً
    }
    if (overBeakerRef.current || pouring) onPourStop();
    overBeakerRef.current = false;
    setDrag({ active: false, x: 0, y: 0, over: false });
    onPutDown?.();
  }

  const tilt = drag.over ? (index === 0 ? -68 : 68) : Math.max(-16, Math.min(16, drag.x * 0.035));
  const dragStyle = drag.active
    ? {
        transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${tilt}deg)`,
      }
    : undefined;

  return (
    <div className={`ph-tube-station${pouring ? " pouring" : ""}${drag.active ? " dragging" : ""}`}>
      <div className="ph-tube-label">{label}</div>

      <div className="ph-tube-visual-slot">
        <div
          ref={dragRef}
          className={`ph-tube-drag${drag.over ? " over-beaker" : ""}${empty && !drag.active ? " empty" : ""}`}
          style={dragStyle}
          role="button"
          tabIndex={empty ? -1 : 0}
          draggable={!empty && canPour}
          aria-label={`${label}: اسحب الأنبوب إلى الكأس للصب`}
          title={empty ? "املأ الأنبوب أولاً" : "أمسك واسحب نحو الكأس للصب"}
          onPointerDown={(e) => {
            if (empty || !canPour || e.button !== 0) return;
            e.preventDefault();
            startRef.current = { x: e.clientX, y: e.clientY };
            overBeakerRef.current = false;
            draggingRef.current = true;
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              // بعض أدوات الاختبار/المتصفحات لا تدعم الالتقاط الاصطناعي
            }
            setDrag({ active: true, x: 0, y: 0, over: false });
            onPickUp?.();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            moveDrag(e.clientX, e.clientY);
          }}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onDragStart={(e) => {
            if (empty || !canPour) {
              e.preventDefault();
              return;
            }
            if (!draggingRef.current) {
              startRef.current = { x: e.clientX, y: e.clientY };
              draggingRef.current = true;
              setDrag({ active: true, x: 0, y: 0, over: false });
              onPickUp?.();
            }
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrag={(e) => moveDrag(e.clientX, e.clientY)}
          onDragEnd={stopDrag}
        >
          {!empty && (
            <div className="ph-tube-ph-badge" style={{ background: phColorCSS(pH) }}>
              <span className="ph-tube-ph-k">pH</span>
              <span className="ph-tube-ph-v">{formatAr(pH, 1)}</span>
            </div>
          )}

          <div className="ph-tube" aria-hidden="true">
            <div className="ph-tube-rim" />
            <div className="ph-tube-glass">
              <div
                className="ph-tube-liquid"
                style={{
                  height: `${tubeFill}%`,
                  background: liquidColor,
                }}
              />
              <div className="ph-tube-shine" />
            </div>
            <div className="ph-tube-base" />
          </div>
          {pouring && drag.over && <span className="ph-tube-stream" style={{ background: liquidColor }} />}
        </div>
      </div>

      <div className="ph-tube-meta">
        <span className="ph-tube-vol">
          {formatAr(volume, 2)} / {formatAr(TUBE_MAX_VOLUME, 2)} لتر
        </span>
        {!empty && (
          <span className="ph-tube-sol">
            {solution.emoji} {solution.nameAr}
          </span>
        )}
      </div>

      <label className="ph-tube-field">
        <span className="ph-tube-field-label">السائل</span>
        <select
          className="ph-tube-select"
          value={solutionKey}
          onChange={(e) => onSolutionChange(e.target.value)}
        >
          {SOLUTION_ORDER.map((key) => (
            <option key={key} value={key}>
              {SOLUTIONS[key].emoji} {SOLUTIONS[key].nameAr} (pH {formatAr(SOLUTIONS[key].pH, 1)})
            </option>
          ))}
        </select>
      </label>

      <label className="ph-tube-field">
        <span className="ph-tube-field-label">كمية السائل</span>
        <input
          type="range"
          className="ph-slider"
          min="0"
          max={TUBE_MAX_VOLUME}
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        />
      </label>

      <button
        type="button"
        className="ph-tube-fill"
        disabled={volume >= TUBE_MAX_VOLUME - 0.001}
        onClick={onFill}
      >
        🧪 ملء الأنبوب
      </button>
      <span className="ph-tube-drag-hint">✋ أمسك الأنبوب واسحبه نحو الكأس</span>
    </div>
  );
}
