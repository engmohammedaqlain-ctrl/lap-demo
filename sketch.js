/**
 * sketch.js — مشهد تفاعلي بملء الشاشة
 * يدعم حتى ٣ أجسام مستقلة في الإناء في الوقت نفسه (state.bodies).
 */

/**
 * viscosity بالباسكال·ثانية (Pa·s) — قيم حقيقية تقريبية عند 20°م.
 * تُستخدم لحساب تخميد الحركة (dampingFactor) بحيث يغطس الجسم في العسل
 * أبطأ بكثير وبدون تذبذب مقارنة بالماء، بدلاً من معاملة كل السوائل بنفس اللزوجة.
 */
const LIQUIDS = {
  water: { nameAr: "ماء عذب", density: 1000, viscosity: 0.001, color: [45, 130, 195], colorDeep: [15, 65, 120] },
  seawater: { nameAr: "ماء البحر", density: 1025, viscosity: 0.0011, color: [35, 125, 165], colorDeep: [10, 70, 105] },
  oliveOil: { nameAr: "زيت زيتون", density: 910, viscosity: 0.081, color: [160, 150, 55], colorDeep: [110, 100, 30] },
  honey: { nameAr: "عسل", density: 1420, viscosity: 5, color: [175, 120, 35], colorDeep: [120, 75, 15] },
  glycerin: { nameAr: "جليسرين", density: 1260, viscosity: 1.41, color: [180, 190, 175], colorDeep: [130, 145, 130] },
};

const BASE_DAMPING = 4.5;
const WATER_VISCOSITY = LIQUIDS.water.viscosity;

/**
 * مقياس لوغاريتمي لتحويل اللزوجة الحقيقية إلى معامل تخميد بصري معقول.
 * مقياس خطي مباشر يجعل العسل (لزوجته 5000x الماء) يوقف الجسم فوراً
 * بشكل غير واقعي بصرياً؛ اللوغاريتم يحافظ على الترتيب الصحيح (عسل > جليسرين
 * > زيت > ماء البحر ≈ ماء) مع نمو متدرج محسوس.
 */
function dampingFromViscosity(viscosity) {
  const ratio = Math.max(1, viscosity / WATER_VISCOSITY);
  return BASE_DAMPING * (1 + Math.log10(ratio) * 1.8);
}

/**
 * مرتّبة تصاعدياً بالكثافة (240 → 2700) لتغطي سلوكاً متنوعاً فعلياً:
 * فلّين/خشب يطفوان بوضوح، جليد يطفو بالكاد وقد يغرق بزيت الزيتون (كثافته
 * 910 أقل من الجليد 919 بقليل)، بلاستيك يغرق بالماء لكنه يطفو بالعسل
 * (1420 أكبر من 1380) - يوضّح أن الطفو يعتمد على السائل وليس الجسم فقط.
 * استبدلنا الرصاص/الذهب لأن كلاهما أثقل من كل سائل بالتجربة فيغرقان
 * دوماً بالطريقة نفسها (لا تنوّع حقيقي بالسلوك، فقط لون مختلف).
 */
const MATERIALS = {
  cork: { nameAr: "فلّين", density: 240, color: [210, 185, 150], pattern: "cork" },
  wood: { nameAr: "خشب", density: 600, color: [165, 125, 90], pattern: "wood" },
  ice: { nameAr: "جليد", density: 919, color: [205, 225, 235], pattern: "smooth" },
  plastic: { nameAr: "بلاستيك", density: 1380, color: [70, 175, 190], pattern: "smooth" },
  stone: { nameAr: "حجر", density: 2700, color: [175, 168, 155], pattern: "stone" },
};

const MAX_BODIES = 3;

/**
 * كل جسم في الإناء كائن مستقل بمادته/شكله/حجمه وحالته الفيزيائية الخاصة،
 * فيمكن وضع حتى ٣ أجسام معاً ومقارنة طفوها في الوقت نفسه. الإعدادات
 * المشتركة (السائل، الصوت، إظهار القوى...) تبقى على مستوى state العام.
 */
function makeBody(materialKey, shapeType, shapeSize, offsetX = 0) {
  return {
    materialKey,
    shapeType,
    shapeSize,
    depth: 0,
    velocity: 0,
    offsetX,
    offsetXVelocity: 0,
    hasSettledOnce: false,
  };
}

const state = {
  liquidKey: "water",
  bodies: [],          // تُملأ في setup()
  activeIndex: 0,      // الجسم الذي تتحكّم به اللوحات وتُعرض قياساته
  isDragging: false,
  dragIndex: -1,       // أي جسم يُسحب حالياً (-1 = لا شيء)
  dragOffsetX: 0,
  dragOffsetY: 0,
  soundEnabled: true,
  showGravity: true,
  showBuoyancy: true,
  showValues: true,
  showDepthLines: true,
};

function activeBody() {
  return state.bodies[state.activeIndex] || state.bodies[0] || null;
}

let bubbles = [];
let lastFrameTime = 0;
let groundY, waterLevelY;
let containerX, containerY, containerW, containerH;
let poolBounds = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * مقياس بكسل/متر ثابت لكل الأجسام (لا يعتمد على جسم بعينه) حتى تتعايش عدة
 * أجسام بمقاييس متناسبة فيما بينها وتتسع جنباً إلى جنب داخل الإناء. نشتقّه
 * من عرض الإناء وبُعد مرجعي ثابت بدل حجم الجسم الحالي — فلو ربطناه بحجم
 * جسم واحد لتغيّر مقاس كل الأجسام عند تكبير ذلك الجسم.
 */
const REFERENCE_DIM_M = 0.55;
function getPixelsPerMeter() {
  const poolInnerW = containerW - 24;
  const scale = (poolInnerW * 0.32) / REFERENCE_DIM_M;
  return constrain(scale, 70, 230);
}

function metersToPixels(m) {
  return m * getPixelsPerMeter();
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  layoutScene();
  state.bodies = [makeBody("wood", "cube", 0.38, 0)];
  state.activeIndex = 0;
  resetAllEquilibrium();
  setupControls();
  setupSoundToggle();
  updatePanelData();
  lastFrameTime = performance.now();

  // إعادة قياس التخطيط بعد استقرار الخط المُحمَّل عن بُعد (Google Fonts):
  // ارتفاع .hud-body الفعلي قد يتغيّر قليلاً بين الخط الافتراضي والخط
  // النهائي، فنعيد الحساب فور اكتمال تحميل الخطوط لتطابق دقيق.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { layoutScene(); resetAllEquilibrium(); });
  }
}

function resetBodyEquilibrium(body) {
  const liquid = LIQUIDS[state.liquidKey];
  const material = MATERIALS[body.materialKey];
  const eq = findEquilibriumDepth(
    { type: body.shapeType, size: body.shapeSize },
    material.density,
    liquid.density
  );
  body.depth = eq.depth;
  body.velocity = 0;
}

function resetAllEquilibrium() {
  state.bodies.forEach(resetBodyEquilibrium);
}

/**
 * يقيس الحجز الرأسي الحقيقي للوحات HUD من DOM مباشرة (getBoundingClientRect)
 * بدل أرقام ثابتة مخمَّنة. أرقام ثابتة لا تطابق الارتفاع الفعلي للوحات
 * (تختلف حسب طول النص/حجم الخط/حالة الطي)، وهذا ما كان يجعل حوض
 * المحاكاة يُحسب في مكان تغطّيه اللوحات فعلياً على الجوال.
 */
function getReservedSpace() {
  const hudBody = document.querySelector(".hud-body");
  const dock = document.getElementById("control-dock");

  const topReserve = hudBody ? hudBody.getBoundingClientRect().bottom + 8 : 118;
  const bottomReserve = dock
    ? Math.max(8, window.innerHeight - dock.getBoundingClientRect().top + 8)
    : 132;

  return { topReserve, bottomReserve };
}

function layoutScene() {
  const mobile = width < 768;

  if (mobile) {
    const { topReserve, bottomReserve } = getReservedSpace();
    const available = Math.max(120, height - topReserve - bottomReserve);
    containerW = min(width * 0.92, width - 14);
    // الحوض يأخذ معظم المساحة المتاحة (التجربة هي المحتوى الأساسي)
    // بدل سقف ثابت صغير كان يترك فجوة سماء فارغة قبل المنظر الخلفي
    containerH = constrain(available * 0.76, 150, 560);
    containerX = (width - containerW) / 2;
    // توسيط رأسي ضمن المساحة المتاحة بدل دفع الحوض للأعلى وترك شريط تربة فارغ أسفله
    containerY = topReserve + (available - containerH) * 0.5;
    // غالب ارتفاع الحوض "مدفون" تحت خط الأرض (نفس طابع البئر الحجري
    // المُغروس بالتربة على سطح المكتب)، لا عائماً كاملاً في السماء
    groundY = containerY + containerH * 0.18;
  } else {
    // حوض أكبر على سطح المكتب: أعرض وأعمق ليأخذ مساحة أوضح ويتّسع لعدة أجسام
    groundY = height * 0.44;
    containerW = min(width * 0.52, 620);
    containerH = min(height * 0.56, 480);
    containerX = (width - containerW) / 2;
    containerY = groundY - 28;
  }

  waterLevelY = containerY + containerH * 0.36;

  poolBounds = {
    left: containerX - 16,
    top: containerY - 16,
    right: containerX + containerW + 16,
    bottom: containerY + containerH + 16,
  };

  clampAllBodiesHorizontal();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutScene();
  resetAllEquilibrium();
}

function draw() {
  const now = performance.now();
  let dt = (now - lastFrameTime) / 1000;
  dt = min(dt, 1 / 30);
  lastFrameTime = now;

  drawLandscape();
  updatePhysics(dt);
  drawPoolWalls();
  if (state.showDepthLines) drawGrid(50, containerY, waterLevelY);
  drawLiquid();
  if (state.showDepthLines) drawGrid(22, waterLevelY, containerY + containerH);
  updateAndDrawBubbles(dt);
  drawWaterSurface();
  drawBodies();
  drawBodiesLabels();
  drawBodiesForces();
  if (state.showDepthLines) drawDepthGuide();
  drawHoverHint();
  updatePanelData();
}

/* ===== خلفية فلسطينية ===== */
function drawLandscape() {
  noStroke();

  // سماء متوسطية
  for (let y = 0; y < groundY; y += 5) {
    const t = y / groundY;
    fill(lerp(100, 160, t), lerp(170, 215, t), lerp(220, 245, t));
    rect(0, y, width, 5);
  }

  // تلال terraced (حقول مدرّجة)
  fill(85, 120, 65, 100);
  beginShape();
  vertex(0, groundY);
  for (let x = 0; x <= width; x += 30) {
    const terr = floor(sin(x * 0.012) * 3) * 4;
    vertex(x, groundY - 25 - sin(x * 0.007) * 20 + terr);
  }
  vertex(width, groundY);
  endShape(CLOSE);

  // terraced lines
  stroke(70, 100, 55, 60);
  strokeWeight(1);
  for (let i = 0; i < 4; i++) {
    const ty = groundY - 8 - i * 7;
    line(0, ty, width, ty);
  }
  noStroke();

  // عشب زيتوني
  fill(58, 105, 48);
  rect(0, groundY, width, height - groundY);

  // تربة حمراء فلسطينية
  fill(160, 95, 60);
  rect(0, groundY + 16, width, height - groundY - 16);

  // حجر جيري (Jerusalem stone)
  fill(215, 200, 170);
  rect(0, groundY + 10, width, 8);

  // بستان زيتون
  drawOliveTree(width * 0.08, groundY - 2, 0.9);
  drawOliveTree(width * 0.18, groundY - 6, 1.1);
  drawOliveTree(width * 0.92, groundY - 2, 0.9);
  drawOliveTree(width * 0.82, groundY - 6, 1.05);

  // سياج حجري بسيط
  drawStoneWall(0, groundY - 2, width * 0.07);
  drawStoneWall(width * 0.93, groundY - 2, width * 0.07);
}

function drawStoneWall(x, y, w) {
  fill(190, 175, 150);
  noStroke();
  rect(x, y, w, 14, 2);
  fill(175, 160, 135);
  rect(x + 3, y + 3, w - 6, 4, 1);
  rect(x + 5, y + 9, w - 10, 3, 1);
}

function drawOliveTree(x, baseY, treeScale = 1) {
  push();
  translate(x, baseY);
  scale(treeScale);
  noStroke();

  fill(85, 60, 35);
  rect(-4, -50, 8, 50, 2);

  fill(45, 80, 38);
  ellipse(0, -58, 48, 34);
  fill(55, 95, 45);
  ellipse(-10, -52, 30, 24);
  ellipse(12, -54, 32, 26);

  // ثمار زيتون
  fill(70, 90, 40);
  for (let i = 0; i < 5; i++) {
    circle(-8 + i * 5, -56 + (i % 2) * 4, 4);
  }
  pop();
}

function drawPoolWalls() {
  const innerX = containerX + 5;
  const innerW = containerW - 10;
  const innerBottom = containerY + containerH - 5;

  noStroke();
  fill(130, 85, 50);
  rect(containerX - 12, containerY - 8, containerW + 24, containerH + 18, 6);

  // حجر القدس
  fill(220, 205, 175);
  rect(containerX - 5, containerY, 10, containerH);
  rect(containerX + containerW - 5, containerY, 10, containerH);
  rect(containerX, innerBottom, containerW, 10);

  // حافة مزخرفة
  fill(235, 220, 195);
  rect(containerX - 10, containerY - 7, containerW + 20, 12, 5);

  // نمط كوفي خفيف على الحافة
  stroke(27, 115, 64, 40);
  strokeWeight(1);
  for (let i = 0; i < 8; i++) {
    const hx = containerX - 6 + i * ((containerW + 12) / 7);
    line(hx, containerY - 5, hx + 8, containerY - 2);
  }
  noStroke();
}

function drawGrid(alpha, fromY, toY) {
  const sp = metersToPixels(0.1);
  stroke(255, 255, 255, alpha);
  strokeWeight(1);
  const left = containerX + 5;
  const right = containerX + containerW - 5;
  for (let x = left; x <= right; x += sp) line(x, fromY, x, toY);
  for (let y = containerY; y <= containerY + containerH; y += sp) {
    if (y >= fromY && y <= toY) line(left, y, right, y);
  }
}

function drawLiquid() {
  const liquid = LIQUIDS[state.liquidKey];
  noStroke();
  const top = waterLevelY;
  const bottom = containerY + containerH - 5;
  const left = containerX + 5;
  const w = containerW - 10;

  for (let y = top; y < bottom; y += 3) {
    const t = (y - top) / (bottom - top);
    fill(
      lerp(liquid.color[0], liquid.colorDeep[0], t),
      lerp(liquid.color[1], liquid.colorDeep[1], t),
      lerp(liquid.color[2], liquid.colorDeep[2], t),
      235
    );
    rect(left, y, w, 3);
  }
}

function drawWaterSurface() {
  const liquid = LIQUIDS[state.liquidKey];
  const turb = constrain(maxAbsBodyVelocity() * 4, 0, 5);
  noFill();
  stroke(liquid.colorDeep[0], liquid.colorDeep[1], liquid.colorDeep[2], 200);
  strokeWeight(2);
  beginShape();
  for (let x = containerX + 5; x <= containerX + containerW - 5; x += 5) {
    vertex(x, waterLevelY + sin(x * 0.04 + frameCount * 0.03) * 1.4 + sin(x * 0.08) * turb * 0.3);
  }
  endShape();
}

function maxAbsBodyVelocity() {
  let m = 0;
  for (const b of state.bodies) m = Math.max(m, Math.abs(b.velocity));
  return m;
}

function spawnBubbleAt(body) {
  const c = getBodyCenterPx(body);
  const sp = c.sizePx;
  bubbles.push({
    x: c.x + random(-sp * 0.3, sp * 0.3),
    y: waterLevelY + metersToPixels(body.depth) * 0.5,
    r: random(2, 4),
    vy: random(-35, -20),
    life: 1,
  });
  if (state.soundEnabled && random() < 0.35) SoundEngine.playBubble();
}

function updateAndDrawBubbles(dt) {
  noStroke();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y += b.vy * dt;
    b.life -= dt * 0.7;
    if (b.life <= 0 || b.y < waterLevelY) { bubbles.splice(i, 1); continue; }
    fill(255, 255, 255, 120 * b.life);
    circle(b.x, b.y, b.r * 2);
  }
}

function getBodyCenterPx(body) {
  const sizePx = metersToPixels(body.shapeSize);
  const cx = containerX + containerW / 2 + body.offsetX;
  const depthPx = metersToPixels(body.depth);

  if (body.shapeType === "cube") {
    return { x: cx, y: waterLevelY - sizePx + depthPx + sizePx / 2, sizePx };
  }
  return { x: cx, y: waterLevelY - sizePx + depthPx, sizePx };
}

function drawBodies() {
  const hovered = hoveredBodyIndex();
  state.bodies.forEach((body, i) => {
    const mat = MATERIALS[body.materialKey];
    const { x, y, sizePx } = getBodyCenterPx(body);

    push();
    if (i === hovered || (state.isDragging && state.dragIndex === i)) {
      drawingContext.shadowColor = "rgba(0,0,0,0.3)";
      drawingContext.shadowBlur = 10;
    }
    if (body.shapeType === "cube") {
      drawMaterialCube(x, y, sizePx, mat);
    } else {
      drawMaterialSphere(x, y, sizePx, mat);
    }
    pop();

    // حلقة تمييز حول الجسم الفعّال (الذي تتحكّم به اللوحات) عند وجود أكثر من جسم
    if (i === state.activeIndex && state.bodies.length > 1) {
      drawActiveRing(x, y, sizePx, body.shapeType);
    }
  });
}

function drawActiveRing(x, y, sizePx, shapeType) {
  push();
  noFill();
  stroke(27, 115, 64, 235);
  strokeWeight(2.5);
  drawingContext.setLineDash([5, 4]);
  if (shapeType === "cube") {
    rectMode(CENTER);
    rect(x, y, sizePx + 12, sizePx + 12, 5);
  } else {
    circle(x, y, sizePx * 2 + 12);
  }
  drawingContext.setLineDash([]);
  pop();
}

function drawMaterialCube(x, y, s, mat) {
  rectMode(CENTER);
  fill(mat.color[0], mat.color[1], mat.color[2]);
  stroke(255, 255, 255, 100);
  strokeWeight(1.2);
  rect(x, y, s, s, 3);

  if (mat.pattern === "wood") {
    noStroke();
    stroke(120, 85, 55, 80);
    strokeWeight(0.8);
    for (let i = -2; i <= 2; i++) {
      line(x - s * 0.4, y + i * s * 0.12, x + s * 0.4, y + i * s * 0.12);
    }
  } else if (mat.pattern === "stone") {
    noStroke();
    fill(160, 150, 135, 100);
    rect(x - s * 0.15, y - s * 0.1, s * 0.2, s * 0.15, 2);
    rect(x + s * 0.05, y + s * 0.08, s * 0.18, s * 0.12, 2);
  }
}

function drawMaterialSphere(x, y, r, mat) {
  fill(mat.color[0], mat.color[1], mat.color[2]);
  stroke(255, 255, 255, 100);
  strokeWeight(1.2);
  circle(x, y, r * 2);

  // highlight
  noStroke();
  fill(255, 255, 255, 50);
  ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.35);
}

function drawBodiesLabels() {
  state.bodies.forEach((body) => drawBodyLabel(body));
}

function drawBodyLabel(body) {
  const mat = MATERIALS[body.materialKey];
  const vol = body.shapeType === "cube"
    ? cubeFullVolume(body.shapeSize)
    : sphereFullVolume(body.shapeSize);
  const mass = mat.density * vol;
  const { x, y, sizePx } = getBodyCenterPx(body);

  const label = mass < 1
    ? (mass * 1000).toLocaleString("ar-EG", { maximumFractionDigits: 1 }) + " غم"
    : mass.toLocaleString("ar-EG", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " كغ";

  const labelOffset = body.shapeType === "sphere" ? sizePx + 14 : sizePx * 0.55;

  push();
  textAlign(CENTER, CENTER);
  textSize(10);
  textStyle(BOLD);
  const tw = textWidth(label);
  noStroke();
  fill(255, 252, 245, 230);
  rectMode(CENTER);
  rect(x, y - labelOffset, tw + 14, 18, 4);
  fill(30, 30, 30);
  text(label, x, y - labelOffset);
  pop();
}

function isPointOverBody(body, px, py) {
  const { x, y, sizePx } = getBodyCenterPx(body);
  const hit = body.shapeType === "cube" ? sizePx / 2 : sizePx;
  const pad = width < 768 ? 14 : 8;
  return dist(px, py, x, y) < hit + pad;
}

/** فهرس الجسم تحت المؤشر (نمرّ بالعكس فالأخير مرسوم فوق البقية) أو -1 */
function hoveredBodyIndex() {
  for (let i = state.bodies.length - 1; i >= 0; i--) {
    if (isPointOverBody(state.bodies[i], mouseX, mouseY)) return i;
  }
  return -1;
}

function drawHoverHint() {
  const over = hoveredBodyIndex() >= 0 || state.isDragging;
  cursor(over ? (state.isDragging ? "grabbing" : "grab") : ARROW);
}

function drawBodiesForces() {
  if (!state.showGravity && !state.showBuoyancy) return;
  // الأسهم والقيم تظهر فقط على الجسم المحدَّد (الفعّال) لا على كل الأجسام
  // معاً — لو وجد أكثر من جسم بصير المشهد مزدحماً بأسهم متراكبة بلا فائدة.
  const body = activeBody();
  if (body) drawBodyForces(body, true);
}

function drawBodyForces(body, showLabels) {
  const liquid = LIQUIDS[state.liquidKey];
  const mat = MATERIALS[body.materialKey];
  const vol = body.shapeType === "cube"
    ? cubeFullVolume(body.shapeSize)
    : sphereFullVolume(body.shapeSize);
  const clampedDepth = max(0, body.depth);
  const subVol = body.shapeType === "cube"
    ? cubeSubmergedVolume(clampedDepth, body.shapeSize)
    : sphereSubmergedVolume(clampedDepth, body.shapeSize);

  const weight = calcWeight(mat.density, vol);
  const buoyant = calcBuoyantForce(liquid.density, subVol);
  const { x, y, sizePx } = getBodyCenterPx(body);

  const wLen = forceToArrowLength(weight);
  const bLen = forceToArrowLength(buoyant);
  const off = max(14, sizePx * 0.22);
  const arrowFill = [255, 252, 245];
  const arrowOutline = [18, 52, 88];

  if (state.showGravity && wLen >= 4) {
    drawOutlinedArrow(x - off, y, x - off, y + wLen, arrowFill, arrowOutline);
    if (showLabels) drawForceLabel("الوزن", x - off, y + wLen, weight, "down");
  }
  if (state.showBuoyancy && bLen >= 4) {
    drawOutlinedArrow(x + off, y, x + off, y - bLen, arrowFill, arrowOutline);
    if (showLabels) drawForceLabel("الطفو", x + off, y - bLen, buoyant, "up");
  }
}

function drawOutlinedArrow(x1, y1, x2, y2, color, outline) {
  drawArrow(x1, y1, x2, y2, { color: outline, weight: 6, headSize: 13 });
  drawArrow(x1, y1, x2, y2, { color: color, weight: 3.5, headSize: 10 });
}

function drawForceLabel(name, ax, ay, val, dir) {
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  const titleSize = width < 768 ? 10 : 11;
  const valSize = width < 768 ? 8.5 : 9.5;
  const valText = state.showValues
    ? val.toLocaleString("ar-EG", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " N"
    : null;

  textSize(titleSize);
  textStyle(BOLD);
  const nameW = textWidth(name);
  textSize(valSize);
  textStyle(NORMAL);
  const valW = valText ? textWidth(valText) : 0;

  const padX = 9;
  const lineH = state.showValues ? 13 : 0;
  const boxW = max(nameW, valW) + padX * 2;
  const boxH = state.showValues ? 34 : 20;
  const gap = 6;
  const boxY = dir === "down" ? ay + gap + boxH / 2 : ay - gap - boxH / 2;

  drawingContext.shadowColor = "rgba(0, 0, 0, 0.22)";
  drawingContext.shadowBlur = 5;
  drawingContext.shadowOffsetY = 2;

  noStroke();
  fill(252, 248, 238, 248);
  rect(ax, boxY, boxW, boxH, 5);

  drawingContext.shadowColor = "transparent";

  stroke(18, 52, 88, 90);
  strokeWeight(1);
  noFill();
  rect(ax, boxY, boxW, boxH, 5);

  const accent = dir === "up" ? [27, 115, 64] : [158, 74, 58];
  noStroke();
  fill(accent[0], accent[1], accent[2]);
  rectMode(CORNER);
  rect(ax - boxW / 2 + 2, boxY - boxH / 2 + 3, 3, boxH - 6, 2);
  rectMode(CENTER);

  noStroke();
  fill(15, 77, 42);
  textStyle(BOLD);
  textSize(titleSize);
  const titleY = state.showValues ? boxY - lineH / 2 : boxY;
  text(name, ax + 2, titleY);

  if (state.showValues) {
    fill(26, 26, 26);
    textStyle(NORMAL);
    textSize(valSize);
    text(valText, ax + 2, boxY + lineH / 2);
  }
  pop();
}

function drawDepthGuide() {
  push();
  stroke(255, 255, 255, 130);
  strokeWeight(1);
  drawingContext.setLineDash([4, 4]);
  line(containerX + 5, waterLevelY, containerX + containerW - 5, waterLevelY);
  drawingContext.setLineDash([]);
  pop();
}

/** يقصر الموضع الأفقي لجسم ضمن حدود الإناء (بالبكسل، نسبةً لمركز الإناء) */
function horizontalLimit(body) {
  const sp = metersToPixels(body.shapeSize);
  const half = body.shapeType === "cube" ? sp / 2 : sp;
  return Math.max(0, containerW / 2 - half - 8);
}

function clampAllBodiesHorizontal() {
  state.bodies.forEach((body) => {
    const limit = horizontalLimit(body);
    body.offsetX = constrain(body.offsetX, -limit, limit);
  });
}

/**
 * فصل أفقي بسيط بين الأجسام المتقاربة عند العمق نفسه حتى لا تتراكب تماماً
 * فتظهر جنباً إلى جنب. ليست محاكاة تصادم دقيقة — مجرد دفع لطيف يحسّن الوضوح.
 */
function resolveHorizontalOverlap() {
  for (let a = 0; a < state.bodies.length; a++) {
    for (let b = a + 1; b < state.bodies.length; b++) {
      if (state.isDragging && (state.dragIndex === a || state.dragIndex === b)) continue;
      const A = state.bodies[a], B = state.bodies[b];
      const ca = getBodyCenterPx(A), cb = getBodyCenterPx(B);
      const ra = A.shapeType === "cube" ? ca.sizePx / 2 : ca.sizePx;
      const rb = B.shapeType === "cube" ? cb.sizePx / 2 : cb.sizePx;
      if (Math.abs(ca.y - cb.y) > ra + rb) continue; // لا تراكب رأسي
      const dx = cb.x - ca.x;
      const minDx = ra + rb + 4;
      const overlap = minDx - Math.abs(dx);
      if (overlap > 0) {
        const pushPx = (overlap / 2) * (dx >= 0 ? 1 : -1);
        A.offsetX -= pushPx;
        B.offsetX += pushPx;
      }
    }
  }
  clampAllBodiesHorizontal();
}

function updatePhysics(dt) {
  const liquid = LIQUIDS[state.liquidKey];
  const ppm = getPixelsPerMeter();
  const floor = (containerY + containerH - 5 - waterLevelY) / ppm;
  const ceiling = -(waterLevelY - containerY - 12) / ppm;
  const damping = dampingFromViscosity(liquid.viscosity);

  state.bodies.forEach((body, i) => {
    if (state.isDragging && state.dragIndex === i) return; // الجسم المسحوب يتبع الإصبع

    // الموضع الأفقي يبقى حيث وضعه المستخدم (سحب حر) ولا يعود تلقائياً للمركز
    body.offsetX = constrain(body.offsetX, -horizontalLimit(body), horizontalLimit(body));
    body.offsetXVelocity = 0;

    const mat = MATERIALS[body.materialKey];
    const sim = { type: body.shapeType, size: body.shapeSize, density: mat.density };
    const wasMoving = abs(body.velocity) > 0.02;

    const result = stepSimulation(sim, liquid.density, body.depth, body.velocity, dt, damping, floor, ceiling);
    body.depth = result.depth;
    body.velocity = result.velocity;

    if (abs(body.velocity) > 0.15 && random() < 0.12) spawnBubbleAt(body);

    const settled = abs(body.velocity) < 0.015;
    if (wasMoving && settled && !body.hasSettledOnce) {
      body.hasSettledOnce = true;
      if (state.soundEnabled) SoundEngine.playSettleChime();
    }
    if (!settled) body.hasSettledOnce = false;
  });

  resolveHorizontalOverlap();
}

function updatePanelData() {
  const body = activeBody();
  if (!body) return;
  const liquid = LIQUIDS[state.liquidKey];
  const mat = MATERIALS[body.materialKey];
  updateMeasurementPanel(computePhysicsSnapshot({
    shapeType: body.shapeType,
    shapeSize: body.shapeSize,
    materialDensity: mat.density,
    liquidDensity: liquid.density,
    depth: body.depth,
    velocity: body.velocity,
  }));
}

function mousePressed() {
  const i = hoveredBodyIndex();
  if (i < 0) return;
  state.isDragging = true;
  state.dragIndex = i;
  state.activeIndex = i;
  if (typeof syncControlsToActive === "function") syncControlsToActive();
  const { x, y } = getBodyCenterPx(state.bodies[i]);
  state.dragOffsetX = mouseX - x;
  state.dragOffsetY = mouseY - y;
  state.bodies[i].offsetXVelocity = 0;
  state.bodies[i].velocity = 0;
  updatePanelData();
  if (state.soundEnabled) SoundEngine.playClick();
}

function mouseDragged() {
  if (!state.isDragging || state.dragIndex < 0) return;
  const body = state.bodies[state.dragIndex];
  const sp = metersToPixels(body.shapeSize);
  const baseY = waterLevelY - sp;
  const maxD = body.shapeType === "cube" ? sp : sp * 2;

  const depthPx = constrain(mouseY - state.dragOffsetY - baseY, -sp * 0.4, maxD + sp * 0.2);
  body.depth = depthPx / getPixelsPerMeter();
  body.velocity = 0;

  const cx = containerX + containerW / 2;
  const limit = horizontalLimit(body);
  body.offsetX = constrain(mouseX - state.dragOffsetX - cx, -limit, limit);
  body.offsetXVelocity = 0;
}

function mouseReleased() {
  if (!state.isDragging || state.dragIndex < 0) {
    state.isDragging = false;
    state.dragIndex = -1;
    return;
  }
  const idx = state.dragIndex;
  const body = state.bodies[idx];

  // أُفلِت خارج البركة (مثلاً رُفع للسماء) → احذف الجسم، شرط بقاء جسم واحد على الأقل
  const outside =
    mouseX < poolBounds.left || mouseX > poolBounds.right ||
    mouseY < poolBounds.top || mouseY > poolBounds.bottom;

  state.isDragging = false;
  state.dragIndex = -1;

  if (outside && state.bodies.length > 1) {
    state.bodies.splice(idx, 1);
    state.activeIndex = Math.min(state.activeIndex, state.bodies.length - 1);
    if (typeof syncControlsToActive === "function") syncControlsToActive();
    updatePanelData();
    if (state.soundEnabled) SoundEngine.playClick();
    return;
  }

  if (state.soundEnabled) SoundEngine.playSplash(constrain(abs(body.depth) * 1.2, 0.2, 1));
}

function touchStarted() {
  if (hoveredBodyIndex() >= 0) {
    mousePressed();
    return false;
  }
}

function touchMoved() {
  if (state.isDragging) {
    mouseDragged();
    return false;
  }
}

function touchEnded() {
  if (state.isDragging) {
    mouseReleased();
    return false;
  }
}

/**
 * تحويل إحداثيات اللمس/الإفلات (client) إلى إحداثيات p5 المنطقية.
 * مهم: نقسم على المقاس المنطقي (width/height) لا على مقاس الـ buffer الداخلي
 * (canvas.width = width × pixelDensity). poolBounds وكل إحداثيات الرسم تُحسب
 * بإحداثيات p5 المنطقية، فاستخدام canvas.width كان يضرب الإحداثيات في كثافة
 * البكسل (1.5–3 على الجوال/الشاشات عالية الدقة)، فيقع الإفلات "خارج" البركة
 * رغم أنه فوقها بصرياً — وهذا ما كان يعطّل السحب والإفلات فعلياً.
 */
function clientToCanvas(clientX, clientY) {
  const canvas = document.querySelector("#canvas-holder canvas");
  if (!canvas) return { x: clientX, y: clientY };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (width / rect.width),
    y: (clientY - rect.top) * (height / rect.height),
  };
}

function setupSoundToggle() {
  const btn = document.getElementById("sound-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    SoundEngine.setMuted(!state.soundEnabled);
    btn.textContent = state.soundEnabled ? "🔊" : "🔇";
  });
}
