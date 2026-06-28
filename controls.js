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

function setupMaterialDragDrop() {
  const tray = document.getElementById("material-tray");
  const canvasHolder = document.getElementById("canvas-holder");
  const dropIndicator = document.getElementById("drop-indicator");
  if (!tray || !canvasHolder) return;

  let dragPayload = null;

  tray.querySelectorAll(".mat-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      dragPayload = { material: chip.dataset.material };
      e.dataTransfer.setData("text/plain", dragPayload.material);
      e.dataTransfer.effectAllowed = "copy";
      chip.classList.add("dragging");
      canvasHolder.classList.add("drop-active");
      if (dropIndicator) dropIndicator.hidden = false;
    });

    chip.addEventListener("dragend", () => {
      chip.classList.remove("dragging");
      canvasHolder.classList.remove("drop-active");
      if (dropIndicator) dropIndicator.hidden = true;
      dragPayload = null;
    });

    chip.addEventListener("click", () => {
      applyMaterial(chip.dataset.material);
      if (state.soundEnabled) SoundEngine.playClick();
    });
  });

  canvasHolder.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  canvasHolder.addEventListener("dragleave", (e) => {
    if (!canvasHolder.contains(e.relatedTarget)) {
      canvasHolder.classList.remove("drop-active");
      if (dropIndicator) dropIndicator.hidden = true;
    }
  });

  canvasHolder.addEventListener("drop", (e) => {
    e.preventDefault();
    canvasHolder.classList.remove("drop-active");
    if (dropIndicator) dropIndicator.hidden = true;
    if (!dragPayload) return;

    if (isPointInPool(e.clientX, e.clientY)) {
      applyMaterial(dragPayload.material);
      state.offsetX = 0;
      state.offsetXVelocity = 0;
      if (state.soundEnabled) SoundEngine.playSplash(0.6);
    }
    dragPayload = null;
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
