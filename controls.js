/**
 * controls.js — تحكم HUD + سحب وإفلات المواد
 */

function setupControls() {
  document.querySelectorAll('input[name="shape"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      state.shapeType = e.target.value;
      updateShapeUI();
      updateSizeSliderRange();
      resetToEquilibrium();
      if (state.soundEnabled) SoundEngine.playClick();
    });
  });

  document.querySelectorAll(".shape-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const radio = btn.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      state.shapeType = btn.dataset.shape;
      updateShapeUI();
      updateSizeSliderRange();
      resetToEquilibrium();
    });
  });

  const liquidSelect = document.getElementById("liquid-select");
  if (liquidSelect) {
    liquidSelect.addEventListener("change", (e) => {
      state.liquidKey = e.target.value;
      resetToEquilibrium();
      if (state.soundEnabled) SoundEngine.playClick();
    });
  }

  const sizeSlider = document.getElementById("size-slider");
  if (sizeSlider) {
    sizeSlider.addEventListener("input", (e) => {
      state.shapeSize = parseFloat(e.target.value);
      resetToEquilibrium();
      updateSizeLabel(state.shapeSize);
    });
  }

  updateShapeUI();
  updateSizeSliderRange();
  updateSizeLabel(state.shapeSize);

  bindCheckbox("show-gravity", "showGravity");
  bindCheckbox("show-buoyancy", "showBuoyancy");
  bindCheckbox("show-values-checkbox", "showValues");
  bindCheckbox("show-depth-lines", "showDepthLines");

  setupMaterialDragDrop();
  setupDockToggle();
  highlightActiveMaterial("wood");
}

/**
 * زر الطي/التوسيع لورقة التحكم السفلية (bottom sheet) على الجوال.
 * على الشاشات الكبيرة الزر مخفي بـ CSS فلا تأثير لهذا الكود هناك.
 * إعادة حساب تخطيط المشهد عند كل تبديل لأن ارتفاع الورقة يتغيّر،
 * فمساحة حوض المحاكاة المتاحة تتغيّر معه.
 */
function setupDockToggle() {
  const dock = document.getElementById("control-dock");
  const toggle = document.getElementById("dock-toggle");
  if (!dock || !toggle) return;

  toggle.addEventListener("click", () => {
    const expanded = dock.classList.toggle("expanded");
    toggle.setAttribute("aria-expanded", String(expanded));
    if (state.soundEnabled) SoundEngine.playClick();
    if (typeof layoutScene === "function") syncLayoutToDockTransition();
  });
}

/**
 * الورقة السفلية تتحرك بانتقال CSS مدته 0.25 ثانية (max-height). قياس
 * ارتفاعها مرة واحدة فقط فور الضغط (بـ requestAnimationFrame وحيد) كان
 * يلتقط ارتفاعها قبل اكتمال الحركة، فيُحسب تخطيط الحوض بناءً على حالة
 * قديمة - ثم تكبر الورقة فعلياً بعد ذلك وتغطّي حوضاً لم يُعاد قياسه.
 * هنا نعيد القياس في كل إطار طوال مدة الانتقال، فيتزامن حجم الحوض مع
 * حركة الورقة بدلاً من "قفزة" مفاجئة بعد انتهائها.
 */
function syncLayoutToDockTransition(durationMs = 320) {
  const start = performance.now();
  function tick() {
    layoutScene();
    if (performance.now() - start < durationMs) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateShapeUI() {
  const tray = document.getElementById("material-tray");
  if (tray) {
    tray.classList.remove("shape-cube", "shape-sphere");
    tray.classList.add(state.shapeType === "sphere" ? "shape-sphere" : "shape-cube");
  }
  document.querySelectorAll(".shape-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.shape === state.shapeType);
  });
}

function updateSizeSliderRange() {
  const slider = document.getElementById("size-slider");
  if (!slider) return;

  if (state.shapeType === "sphere") {
    slider.min = "0.16";
    slider.max = "0.30";
    slider.step = "0.01";
    if (parseFloat(slider.value) < 0.16) slider.value = "0.24";
    if (parseFloat(slider.value) > 0.30) slider.value = "0.24";
  } else {
    slider.min = "0.22";
    slider.max = "0.45";
    slider.step = "0.01";
    if (parseFloat(slider.value) < 0.22) slider.value = "0.38";
  }

  state.shapeSize = parseFloat(slider.value);
  updateSizeLabel(state.shapeSize);
}

/**
 * سحب وإفلات مبني على Pointer Events (لا HTML5 Drag and Drop).
 * الـ Drag and Drop الأصلي (dragstart/dragover/drop) لا يعمل إطلاقاً من
 * اللمس على أي متصفح جوال (Safari iOS، Chrome Android) - قيد فعلي بالمنصّة
 * وليس مجرد خلل إعداد، لذلك السحب لم يكن يعمل سوى بالماوس فقط من الأساس.
 * Pointer Events توحّد الماوس واللمس بمسار واحد، فيعمل السحب فعلياً
 * بالإصبع تماماً كما يعمل بالماوس.
 */
function setupMaterialDragDrop() {
  const tray = document.getElementById("material-tray");
  const canvasHolder = document.getElementById("canvas-holder");
  const dropIndicator = document.getElementById("drop-indicator");
  if (!tray || !canvasHolder) return;

  const DRAG_THRESHOLD = 8; // بكسل - أقل من هذا = ضغطة اختيار، أكثر = سحب

  tray.querySelectorAll(".mat-chip").forEach((chip) => {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let ghost = null;

    function showGhost(clientX, clientY) {
      ghost = document.createElement("div");
      ghost.className = "chip-ghost";
      const preview = chip.querySelector(".chip-preview");
      if (preview) ghost.appendChild(preview.cloneNode(true));
      document.body.appendChild(ghost);
      moveGhost(clientX, clientY);
    }

    function moveGhost(clientX, clientY) {
      if (ghost) {
        ghost.style.left = clientX + "px";
        ghost.style.top = clientY + "px";
      }
    }

    function removeGhost() {
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
    }

    function setDropZoneActive(active) {
      canvasHolder.classList.toggle("drop-active", active);
      if (dropIndicator) dropIndicator.hidden = !active;
    }

    function cleanup() {
      chip.classList.remove("dragging");
      setDropZoneActive(false);
      removeGhost();
      dragging = false;
      pointerId = null;
    }

    chip.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      chip.setPointerCapture(pointerId);
    });

    chip.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pointerId) return;
      if (!dragging) {
        const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (moved < DRAG_THRESHOLD) return;
        dragging = true;
        chip.classList.add("dragging");
        showGhost(e.clientX, e.clientY);
      }
      moveGhost(e.clientX, e.clientY);
      setDropZoneActive(isPointInPool(e.clientX, e.clientY));
      e.preventDefault();
    });

    chip.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pointerId) return;
      chip.releasePointerCapture(pointerId);

      if (dragging) {
        if (isPointInPool(e.clientX, e.clientY)) {
          applyMaterial(chip.dataset.material);
          state.offsetX = 0;
          state.offsetXVelocity = 0;
          if (state.soundEnabled) SoundEngine.playSplash(0.6);
        }
      } else {
        // لم تتجاوز الحركة حد السحب - ضغطة اختيار عادية
        applyMaterial(chip.dataset.material);
        if (state.soundEnabled) SoundEngine.playClick();
      }
      cleanup();
    });

    chip.addEventListener("pointercancel", cleanup);
  });
}

function applyMaterial(materialKey) {
  state.materialKey = materialKey;
  resetToEquilibrium();
  highlightActiveMaterial(materialKey);
  updatePanelData();
}

function highlightActiveMaterial(materialKey) {
  document.querySelectorAll(".mat-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.material === materialKey);
  });
}

function bindCheckbox(id, stateKey) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", (e) => {
    state[stateKey] = e.target.checked;
  });
}

function isPointInPool(clientX, clientY) {
  if (typeof poolBounds === "undefined") return true;
  const pt = typeof clientToCanvas === "function"
    ? clientToCanvas(clientX, clientY)
    : { x: clientX, y: clientY };
  return (
    pt.x >= poolBounds.left &&
    pt.x <= poolBounds.right &&
    pt.y >= poolBounds.top &&
    pt.y <= poolBounds.bottom
  );
}
