/**
 * physics.js
 * محرك فيزياء الطفو - دوال خالصة (Pure Functions)
 * لا تحتوي على أي كود رسم أو DOM. تستقبل أرقام، تُرجع أرقام.
 * هذا يسمح باختبارها مباشرة في console المتصفح أو Node بدون تشغيل أي رسم.
 */

const GRAVITY = 9.81; // m/s^2

/* ============================================================
   1. دوال حساب الحجم المغمور لكل شكل
   كل دالة تستقبل "h" = عمق الغمر الحالي (متر)
   وتُرجع الحجم المغمور بالمتر المكعب (m^3)
   ============================================================ */

/**
 * مكعب: الحجم المغمور خطي = (مساحة القاعدة) × (عمق الغمر)
 * @param {number} h - عمق الغمر (0 = لا غمر، side = غمر كامل)
 * @param {number} side - طول حافة المكعب (متر)
 */
function cubeSubmergedVolume(h, side) {
  const clampedH = Math.max(0, Math.min(h, side)); // لا يمكن أن يتجاوز الغمر طول الحافة
  return side * side * clampedH;
}

/**
 * كرة: الحجم المغمور = حجم "القبعة الكروية" (spherical cap)
 * الصيغة: V = (π * h^2 * (3r - h)) / 3
 * @param {number} h - عمق الغمر من أسفل الكرة (0 = لا غمر، 2r = غمر كامل)
 * @param {number} r - نصف قطر الكرة (متر)
 */
function sphereSubmergedVolume(h, r) {
  const clampedH = Math.max(0, Math.min(h, 2 * r)); // لا يمكن أن يتجاوز الغمر القطر الكامل
  return (Math.PI * clampedH * clampedH * (3 * r - clampedH)) / 3;
}

/* ============================================================
   2. حجم الجسم الكامل (لحساب الكتلة من الكثافة)
   ============================================================ */

function cubeFullVolume(side) {
  return side * side * side;
}

function sphereFullVolume(r) {
  return (4 / 3) * Math.PI * r * r * r;
}

/* ============================================================
   3. القوى: الوزن وقوة الطفو
   ============================================================ */

/**
 * وزن الجسم = الكتلة × الجاذبية
 * الكتلة = الكثافة × الحجم الكامل
 */
function calcWeight(objectDensity, fullVolume) {
  const mass = objectDensity * fullVolume;
  return mass * GRAVITY;
}

/**
 * قوة الطفو (أرخميدس) = كثافة السائل × الحجم المغمور × الجاذبية
 */
function calcBuoyantForce(liquidDensity, submergedVolume) {
  return liquidDensity * submergedVolume * GRAVITY;
}

/* ============================================================
   4. حل التوازن: إيجاد عمق الغمر "h" الذي يجعل
   قوة الطفو = الوزن (Binary Search لأن المعادلة غير خطية للكرة)
   ============================================================ */

/**
 * @param {object} shape - { type: 'cube'|'sphere', size: number }
 *        cube: size = طول الحافة (side)
 *        sphere: size = نصف القطر (radius)
 * @param {number} objectDensity - كثافة الجسم (kg/m^3)
 * @param {number} liquidDensity - كثافة السائل (kg/m^3)
 * @returns {object} { depth, isFullyFloating, isFullySubmerged, submergedFraction }
 */
function findEquilibriumDepth(shape, objectDensity, liquidDensity) {
  let getSubmergedVolume, getFullVolume, maxDepth;

  if (shape.type === "cube") {
    getSubmergedVolume = (h) => cubeSubmergedVolume(h, shape.size);
    getFullVolume = () => cubeFullVolume(shape.size);
    maxDepth = shape.size;
  } else if (shape.type === "sphere") {
    getSubmergedVolume = (h) => sphereSubmergedVolume(h, shape.size);
    getFullVolume = () => sphereFullVolume(shape.size);
    maxDepth = 2 * shape.size;
  } else {
    throw new Error(`شكل غير معروف: ${shape.type}`);
  }

  const fullVolume = getFullVolume();
  const weight = calcWeight(objectDensity, fullVolume);

  // حالة خاصة: الجسم أثقل من السائل عند الغمر الكامل بالكامل (يغرق كلياً)
  const maxBuoyantForce = calcBuoyantForce(liquidDensity, fullVolume);
  if (weight >= maxBuoyantForce) {
    return {
      depth: maxDepth,
      isFullyFloating: false,
      isFullySubmerged: true,
      submergedFraction: 1,
    };
  }

  // حالة خاصة: حتى عند عمق غمر صفر تقريباً، الجسم أخف بكثير (يطفو شبه كامل فوق السطح)
  // نتحقق هل القوة عند h=0 أصلاً أكبر من الوزن (يعني توازنه عند عمق قريب من صفر)
  if (weight <= 0) {
    return {
      depth: 0,
      isFullyFloating: true,
      isFullySubmerged: false,
      submergedFraction: 0,
    };
  }

  // البحث الثنائي (Binary Search) لإيجاد h حيث buoyantForce(h) === weight
  let low = 0;
  let high = maxDepth;
  let mid = 0;
  const TOLERANCE = 1e-9;
  const MAX_ITERATIONS = 100;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    mid = (low + high) / 2;
    const submergedVol = getSubmergedVolume(mid);
    const buoyantForce = calcBuoyantForce(liquidDensity, submergedVol);

    if (Math.abs(buoyantForce - weight) < TOLERANCE) {
      break;
    }

    if (buoyantForce < weight) {
      // الطفو غير كافٍ، يحتاج يغرق أعمق
      low = mid;
    } else {
      // الطفو أكثر من اللازم، يرتفع لأعلى
      high = mid;
    }
  }

  return {
    depth: mid,
    isFullyFloating: mid <= 0 + 1e-6,
    isFullySubmerged: mid >= maxDepth - 1e-6,
    submergedFraction: mid / maxDepth,
  };
}

/* ============================================================
   5. محاكاة حركية حقيقية (لا lerp تجميلي)
   نحل معادلة الحركة: m * a = الوزن - قوة الطفو - قوة اللزوجة (تخميد)
   هذا يعطي تذبذب واقعي قبل الاستقرار (يشبه جسم حقيقي يُرمى بالماء)
   ============================================================ */

/**
 * خطوة فيزيائية واحدة (Semi-Implicit Euler Integration)
 * يتبع نموذج PhET الرسمي للطفو (انظر density-buoyancy-common/doc/model.md):
 * - Gravity: تسارع ثابت لأسفل
 * - Buoyancy: قوة لأعلى فقط، تساوي وزن السائل المُزاح
 * - Contact: تلامس صلب مع القاعدة/السطح، بلا ارتداد إطلاقاً (No restitution)
 * - Viscosity: قوة لزجة تخميدية تجعل التذبذب يستقر بمعدل معقول
 *
 * @param {object} body - { type, size, density }
 * @param {number} liquidDensity
 * @param {number} currentDepth - العمق الحالي (متر)
 * @param {number} currentVelocity - السرعة الرأسية الحالية (م/ث)، إيجابي = يغرق أكثر
 * @param {number} dt - الزمن المنقضي (ثانية) منذ آخر خطوة
 * @param {number} dampingFactor - عامل التخميد اللزج (0 = بلا تخميد، أعلى = أكثر هدوءاً)
 * @param {number} floorDepth - عمق قاعدة الإناء (متر من سطح السائل) - حد تلامس صلب سفلي
 * @param {number} ceilingDepth - أعلى نقطة يمكن أن يصلها الجسم فوق السطح (سالبة) - حد تلامس صلب علوي
 * @returns {object} { depth, velocity }
 */
const MAX_VELOCITY = 5; // م/ث - نفس الحد المستخدم في محاكاة PhET الرسمية لمنع قفزات غير واقعية

function stepSimulation(
  body,
  liquidDensity,
  currentDepth,
  currentVelocity,
  dt,
  dampingFactor = 4.5,
  floorDepth = Infinity,
  ceilingDepth = -Infinity
) {
  let getSubmergedVolume, getFullVolume, maxDepth;

  if (body.type === "cube") {
    getSubmergedVolume = (h) => cubeSubmergedVolume(h, body.size);
    getFullVolume = () => cubeFullVolume(body.size);
    maxDepth = body.size;
  } else {
    getSubmergedVolume = (h) => sphereSubmergedVolume(h, body.size);
    getFullVolume = () => sphereFullVolume(body.size);
    maxDepth = 2 * body.size;
  }

  const fullVolume = getFullVolume();
  const mass = body.density * fullVolume;
  if (mass <= 0) return { depth: currentDepth, velocity: 0 };

  const clampedDepth = Math.max(0, Math.min(currentDepth, maxDepth));
  const submergedVol = getSubmergedVolume(clampedDepth);

  const weightForce = calcWeight(body.density, fullVolume); // لأسفل (موجب)
  const buoyantForce = calcBuoyantForce(liquidDensity, submergedVol); // لأعلى (سالب)
  const dampingForce = -dampingFactor * currentVelocity * mass; // يعاكس الحركة دوماً (مقاومة لزجة)

  const netForce = weightForce - buoyantForce + dampingForce;
  const acceleration = netForce / mass;

  let newVelocity = currentVelocity + acceleration * dt;
  newVelocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, newVelocity));

  let newDepth = currentDepth + newVelocity * dt;

  // تلامس صلب عند القاعدة: بلا ارتداد (يطابق "No restitution" في نموذج PhET الرسمي)
  // الجسم يتوقف فوراً عند ملامسة القاعدة، والقوة العادية المضادة تُمتص داخل القيد مباشرة
  if (newDepth > floorDepth) {
    newDepth = floorDepth;
    if (newVelocity > 0) newVelocity = 0;
  }

  // تلامس صلب عند السطح العلوي (حاجز غير مرئي يحفظ الجسم ضمن منطقة العمل)
  if (newDepth < ceilingDepth) {
    newDepth = ceilingDepth;
    if (newVelocity < 0) newVelocity = 0;
  }

  return { depth: newDepth, velocity: newVelocity };
}

/**
 * مركز الطفو (Center of Buoyancy) - نقطة تأثير قوة الطفو
 * تقريب: منتصف الحجم المغمور رأسياً (دقيق للمكعب، تقريب جيد للكرة)
 * يُستخدم لرسم سهم القوة من نقطة صحيحة فيزيائياً لا من مركز الجسم فقط
 */
function calcCenterOfBuoyancy(body, depth) {
  const clampedDepth = Math.max(0, depth);
  if (body.type === "cube") {
    const h = Math.min(clampedDepth, body.size);
    return h / 2; // من قاعدة الجسم المغمورة
  } else {
    const h = Math.min(clampedDepth, 2 * body.size);
    // مركز ثقل القبعة الكروية (تقريب عملي بصري كافٍ)
    return h / 2;
  }
}

/* ============================================================
   6. فيزياء نابض-تخميد للحركة الأفقية (غير متعلقة بأرخميدس)
   تُستخدم فقط لإحساس "سحب حر" واقعي: بعد إفلات الجسم بعيداً عن مركز
   الإناء أفقياً، يعود تدريجياً للمركز (لأن إناء متماثل بلا تيار لا توجد
   فيه قوة أفقية صافية في حالة التوازن - هذا افتراض فيزيائي صحيح، لا تبسيط مخالف)
   ============================================================ */

/**
 * خطوة نابض-تخميد بسيطة (Hooke's law + viscous damping)
 * F = -k*x - c*v  =>  a = F/m (نفترض كتلة وحدة لتبسيط الضبط البصري، فهذا تأثير
 * بصري بحت لا يدخل في أي حساب علمي آخر بالتجربة)
 * @param {number} offset - الإزاحة الحالية عن نقطة الراحة (بكسل)
 * @param {number} velocity - السرعة الحالية (بكسل/ثانية)
 * @param {number} dt - الزمن المنقضي (ثانية)
 * @param {number} stiffness - معامل صلابة النابض (k)
 * @param {number} damping - معامل التخميد (c)
 * @returns {object} { offset, velocity }
 */
function stepSpringReturn(offset, velocity, dt, stiffness = 35, damping = 9) {
  const springForce = -stiffness * offset;
  const dampingForce = -damping * velocity;
  const acceleration = springForce + dampingForce;

  let newVelocity = velocity + acceleration * dt;
  let newOffset = offset + newVelocity * dt;

  // إخماد نهائي لمنع ارتجاف مجهري لا ينتهي رياضياً (نفس فلسفة إخماد القاعدة الصلبة)
  if (Math.abs(newOffset) < 0.05 && Math.abs(newVelocity) < 0.5) {
    newOffset = 0;
    newVelocity = 0;
  }

  return { offset: newOffset, velocity: newVelocity };
}

/* ============================================================
   تصدير الدوال (يعمل في المتصفح مباشرة كمتغيرات عامة،
   ويدعم Node.js لو رغبت تشغّل اختبارات لاحقاً)
   ============================================================ */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GRAVITY,
    cubeSubmergedVolume,
    sphereSubmergedVolume,
    cubeFullVolume,
    sphereFullVolume,
    calcWeight,
    calcBuoyantForce,
    findEquilibriumDepth,
    stepSimulation,
    calcCenterOfBuoyancy,
    stepSpringReturn,
  };
}
