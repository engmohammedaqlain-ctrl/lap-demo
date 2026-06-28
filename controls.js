/**
 * controls.js — تحكم HUD + سحب وإفلات المواد (يدعم حتى ٣ أجسام)
 *
 * الأزرار (الشكل/الحجم/المادة بالضغط) تعمل على "الجسم الفعّال"
 * (state.activeIndex). إفلات مادة فوق البركة يضيف جسماً جديداً (حتى ٣)،
 * والضغط على جسم في البركة يجعله الفعّال.
 */

function setupControls() {
  document.querySelectorAll('input[name="shape"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      const body = activeBody();
      if (!body) return;
      body.shapeType = e.target.value;
      updateShapeUI();
      applyShapeSizeRangeToActive();
      resetBodyEquilibrium(body);
      updatePanelData();
      if (state.soundEnabled) SoundEngine.playClick();
    });
  });

  document.querySelectorAll(".shape-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const body = activeBody();
      if (!body) return;
      const radio = btn.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      body.shapeType = btn.dataset.shape;
      updateShapeUI();
      applyShapeSizeRangeToActive();
      resetBodyEquilibrium(body);
      updatePanelData();
    });
  });

  const liquidSelect = document.getElementById("liquid-select");
  if (liquidSelect) {
    liquidSelect.addEventListener("change", (e) => {
      state.liquidKey = e.target.value;
      resetAllEquilibrium();
      updatePanelData();
      if (state.soundEnabled) SoundEngine.playClick();
    });
  }

  const sizeSlider = document.getElementById("size-slider");
  if (sizeSlider) {
    sizeSlider.addEventListener("input", (e) => {
      const body = activeBody();
      if (!body) return;
      body.shapeSize = parseFloat(e.target.value);
      resetBodyEquilibrium(body);
      updateSizeLabel(body.shapeSize);
      updatePanelData();
    });
  }

  bindCheckbox("show-gravity", "showGravity");
  bindCheckbox("show-buoyancy", "showBuoyancy");
  bindCheckbox("show-values-checkbox", "showValues");
  bindCheckbox("show-depth-lines", "showDepthLines");

  setupMaterialDragDrop();
  setupDockToggle();
  setupDeleteButton();
  syncControlsToActive();
}

/** زر "حذف" يحذف الجسم المحدَّد بضغطة واحدة - أسهل من السحب خارج البركة */
function setupDeleteButton() {
  const btn = document.getElementById("delete-body-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    removeActiveBody();
    if (state.soundEnabled) SoundEngine.playClick();
  });
}

/** يحذف الجسم الفعّال شرط بقاء جسم واحد على الأقل */
function removeActiveBody() {
  if (state.bodies.length <= 1) return;
  state.bodies.splice(state.activeIndex, 1);
  state.activeIndex = Math.min(state.activeIndex, state.bodies.length - 1);
  syncControlsToActive();
  updatePanelData();
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

/** يعكس شكل الجسم الفعّال على معاينات المواد وأزرار الشكل وأزرار الراديو */
function updateShapeUI() {
  const body = activeBody();
  const shape = body ? body.shapeType : "cube";

  const tray = document.getElementById("material-tray");
  if (tray) {
    tray.classList.remove("shape-cube", "shape-sphere");
    tray.classList.add(shape === "sphere" ? "shape-sphere" : "shape-cube");
  }
  document.querySelectorAll(".shape-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.shape === shape);
  });
  document.querySelectorAll('input[name="shape"]').forEach((r) => {
    r.checked = r.value === shape;
  });
}

/** يضبط مدى شريط الحجم حسب شكل الجسم الفعّال ويثبّت قيمته على حجم الجسم */
function applyShapeSizeRangeToActive() {
  const body = activeBody();
  const slider = document.getElementById("size-slider");
  if (!body || !slider) return;

  if (body.shapeType === "sphere") {
    slider.min = "0.16";
    slider.max = "0.30";
    slider.step = "0.01";
    if (body.shapeSize < 0.16 || body.shapeSize > 0.3) body.shapeSize = 0.24;
  } else {
    slider.min = "0.22";
    slider.max = "0.45";
    slider.step = "0.01";
    if (body.shapeSize < 0.22 || body.shapeSize > 0.45) body.shapeSize = 0.38;
  }

  slider.value = String(body.shapeSize);
  updateSizeLabel(body.shapeSize);
}

/**
 * سحب وإفلات مبني على Pointer Events (لا HTML5 Drag and Drop).
 * الـ Drag and Drop الأصلي (dragstart/dragover/drop) لا يعمل إطلاقاً من
 * اللمس على أي متصفح جوال (Safari iOS، Chrome Android) - قيد فعلي بالمنصّة
 * وليس مجرد خلل إعداد. Pointer Events توحّد الماوس واللمس بمسار واحد.
 *
 * الإفلات فوق البركة = إضافة جسم جديد (حتى MAX_BODIES) بمادة الشريحة.
 * الضغط دون سحب = تبديل مادة الجسم الفعّال.
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
      const full = state.bodies.length >= MAX_BODIES;
      canvasHolder.classList.toggle("drop-active", active && !full);
      if (dropIndicator) {
        dropIndicator.hidden = !active;
        // عند اكتمال العدد نوضّح أن الإفلات سيبدّل مادة الجسم الفعّال
        dropIndicator.textContent = full
          ? "العدد مكتمل — سيتبدّل الجسم الفعّال"
          : "أفلت فوق البركة ↓";
      }
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
          addBodyFromDrop(chip.dataset.material, e.clientX);
          if (state.soundEnabled) SoundEngine.playSplash(0.6);
        }
      } else {
        // لم تتجاوز الحركة حد السحب - ضغطة اختيار: بدّل مادة الجسم الفعّال
        applyMaterialToActive(chip.dataset.material);
        if (state.soundEnabled) SoundEngine.playClick();
      }
      cleanup();
    });

    chip.addEventListener("pointercancel", cleanup);
  });
}

/** يبدّل مادة الجسم الفعّال (ضغطة على شريحة المادة) */
function applyMaterialToActive(materialKey) {
  const body = activeBody();
  if (!body) return;
  body.materialKey = materialKey;
  resetBodyEquilibrium(body);
  highlightActiveMaterial(materialKey);
  updatePanelData();
}

/**
 * يضيف جسماً جديداً عند نقطة الإفلات (حتى MAX_BODIES). عند اكتمال العدد
 * يبدّل مادة الجسم الفعّال بدل تجاهل الإفلات. الشكل/الحجم يُورَثان من الجسم
 * الفعّال الحالي ليكون السلوك متوقّعاً.
 */
function addBodyFromDrop(materialKey, clientX) {
  if (state.bodies.length >= MAX_BODIES) {
    applyMaterialToActive(materialKey);
    return;
  }

  const ref = activeBody();
  const shapeType = ref ? ref.shapeType : "cube";
  const shapeSize = ref ? ref.shapeSize : 0.38;

  const pt = clientToCanvas(clientX, 0);
  const sp = metersToPixels(shapeSize);
  const half = shapeType === "cube" ? sp / 2 : sp;
  const limit = Math.max(0, containerW / 2 - half - 8);
  const offsetX = constrain(pt.x - (containerX + containerW / 2), -limit, limit);

  const body = makeBody(materialKey, shapeType, shapeSize, offsetX);
  state.bodies.push(body);
  state.activeIndex = state.bodies.length - 1;
  resetBodyEquilibrium(body);
  syncControlsToActive();
  updatePanelData();
}

/** يزامن كل اللوحات (الشكل/الحجم/المادة/العدّاد) مع الجسم الفعّال */
function syncControlsToActive() {
  updateShapeUI();
  applyShapeSizeRangeToActive();
  const body = activeBody();
  if (body) highlightActiveMaterial(body.materialKey);
  updateBodyCount();
}

function highlightActiveMaterial(materialKey) {
  document.querySelectorAll(".mat-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.material === materialKey);
  });
}

/** يعرض عدد الأجسام الحالي (n/3) في عنوان لوحة الجسم وفي التلميح */
function updateBodyCount() {
  const n = state.bodies.length;
  const max = toArabicNum(MAX_BODIES);
  const cur = toArabicNum(n);

  const heading = document.querySelector(".hud-body .hud-heading");
  if (heading) heading.textContent = `الأجسام (${cur}/${max}) — اسحب مادة للبركة`;

  const hint = document.querySelector(".mat-hint");
  if (hint) {
    hint.textContent = n >= MAX_BODIES
      ? `اكتمل العدد (${cur}/${max}) — اضغط "حذف" لإزالة المحدَّد`
      : `اسحب مادة للبركة لإضافة جسم (${cur}/${max})`;
  }

  // زر الحذف يظهر فقط عندما يوجد أكثر من جسم واحد - حذف الجسم الأخير غير مسموح
  const deleteBtn = document.getElementById("delete-body-btn");
  if (deleteBtn) deleteBtn.hidden = n <= 1;
}

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
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
