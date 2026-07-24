/**
 * MaterialTray.jsx
 * شريط شرائح المواد — سحب وإفلات مبني على Pointer Events (لا HTML5 Drag and
 * Drop، الذي لا يعمل من اللمس على الجوال) — ضغطة بدون سحب = تبديل مادة
 * الجسم الفعّال، سحب فوق البركة = إضافة جسم جديد. مُعاد بناؤه من
 * setupMaterialDragDrop في controls.js الأصلي، بشرائح مبنية من MATERIALS
 * بدل تكرارها بالـ HTML.
 */
import { useRef } from "react";
import { MATERIALS, MATERIAL_ORDER, MAX_BODIES } from "../data/simulationData.js";
import { SoundEngine } from "../audio/soundEngine.js";

const DRAG_THRESHOLD = 8; // بكسل - أقل من هذا = ضغطة اختيار، أكثر = سحب

function setDropIndicator(active, full) {
  const holder = document.getElementById("canvas-holder");
  const indicator = document.getElementById("drop-indicator");
  if (holder) holder.classList.toggle("drop-active", active && !full);
  if (indicator) {
    indicator.hidden = !active;
    indicator.textContent = full ? "العدد مكتمل — سيتبدّل الجسم الفعّال" : "أفلت فوق البركة ↓";
  }
}

function MaterialChip({ materialKey, mat, isActive, stateRef, actions, canvasApiRef }) {
  const chipRef = useRef(null);
  const drag = useRef({ pointerId: null, startX: 0, startY: 0, dragging: false, ghost: null });

  function showGhost(clientX, clientY) {
    const ghost = document.createElement("div");
    ghost.className = "chip-ghost";
    const preview = chipRef.current.querySelector(".chip-preview");
    if (preview) ghost.appendChild(preview.cloneNode(true));
    document.body.appendChild(ghost);
    drag.current.ghost = ghost;
    moveGhost(clientX, clientY);
  }

  function moveGhost(clientX, clientY) {
    if (drag.current.ghost) {
      drag.current.ghost.style.left = clientX + "px";
      drag.current.ghost.style.top = clientY + "px";
    }
  }

  function removeGhost() {
    if (drag.current.ghost) {
      drag.current.ghost.remove();
      drag.current.ghost = null;
    }
  }

  function cleanup(chip) {
    chip.classList.remove("dragging");
    setDropIndicator(false, false);
    removeGhost();
    drag.current.dragging = false;
    drag.current.pointerId = null;
  }

  function handlePointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const chip = chipRef.current;
    drag.current.pointerId = e.pointerId;
    drag.current.startX = e.clientX;
    drag.current.startY = e.clientY;
    drag.current.dragging = false;
    chip.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (e.pointerId !== drag.current.pointerId) return;
    const chip = chipRef.current;
    if (!drag.current.dragging) {
      const moved = Math.hypot(e.clientX - drag.current.startX, e.clientY - drag.current.startY);
      if (moved < DRAG_THRESHOLD) return;
      drag.current.dragging = true;
      chip.classList.add("dragging");
      showGhost(e.clientX, e.clientY);
    }
    moveGhost(e.clientX, e.clientY);
    const inPool = canvasApiRef.current ? canvasApiRef.current.isPointInPool(e.clientX, e.clientY) : false;
    const full = stateRef.current.bodies.length >= MAX_BODIES;
    setDropIndicator(inPool, full);
    e.preventDefault();
  }

  function handlePointerUp(e) {
    if (e.pointerId !== drag.current.pointerId) return;
    const chip = chipRef.current;
    chip.releasePointerCapture(e.pointerId);

    if (drag.current.dragging) {
      const inPool = canvasApiRef.current ? canvasApiRef.current.isPointInPool(e.clientX, e.clientY) : false;
      if (inPool) {
        canvasApiRef.current.addBodyFromDrop(materialKey, e.clientX);
        if (stateRef.current.soundEnabled) SoundEngine.playSplash(0.6);
      }
    } else {
      actions.setMaterialForActive(materialKey);
      if (stateRef.current.soundEnabled) SoundEngine.playClick();
    }
    cleanup(chip);
  }

  function handlePointerCancel() {
    cleanup(chipRef.current);
  }

  return (
    <div
      ref={chipRef}
      className={`mat-chip${isActive ? " active" : ""}`}
      data-material={materialKey}
      title={mat.hint}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <span className={`chip-preview mat-${materialKey}`}></span>
      <span className="chip-name">{mat.nameAr}</span>
    </div>
  );
}

export default function MaterialTray({ stateRef, actions, canvasApiRef }) {
  const activeBody = stateRef.current.bodies[stateRef.current.activeIndex];
  const shapeType = activeBody ? activeBody.shapeType : "cube";
  const activeMaterialKey = activeBody ? activeBody.materialKey : null;

  return (
    <div id="material-tray" className={`material-tray shape-${shapeType}`}>
      {MATERIAL_ORDER.map((key) => (
        <MaterialChip
          key={key}
          materialKey={key}
          mat={MATERIALS[key]}
          isActive={key === activeMaterialKey}
          stateRef={stateRef}
          actions={actions}
          canvasApiRef={canvasApiRef}
        />
      ))}
    </div>
  );
}
