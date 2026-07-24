/**
 * physics.js
 * محرك فيزياء الطفو - دوال خالصة (Pure Functions)
 * لا تحتوي على أي كود رسم أو DOM. تستقبل أرقام، تُرجع أرقام.
 */

export const GRAVITY = 9.81; // m/s^2

/* ============================================================
   1. دوال حساب الحجم المغمور لكل شكل
   ============================================================ */

/**
 * مكعب: الحجم المغمور خطي = (مساحة القاعدة) × (عمق الغمر)
 */
export function cubeSubmergedVolume(h, side) {
  const clampedH = Math.max(0, Math.min(h, side));
  return side * side * clampedH;
}

/**
 * كرة: الحجم المغمور = حجم "القبعة الكروية" (spherical cap)
 * الصيغة: V = (π * h^2 * (3r - h)) / 3
 */
export function sphereSubmergedVolume(h, r) {
  const clampedH = Math.max(0, Math.min(h, 2 * r));
  return (Math.PI * clampedH * clampedH * (3 * r - clampedH)) / 3;
}

/* ============================================================
   2. حجم الجسم الكامل (لحساب الكتلة من الكثافة)
   ============================================================ */

export function cubeFullVolume(side) {
  return side * side * side;
}

export function sphereFullVolume(r) {
  return (4 / 3) * Math.PI * r * r * r;
}

/* ============================================================
   3. القوى: الوزن وقوة الطفو
   ============================================================ */

export function calcWeight(objectDensity, fullVolume) {
  const mass = objectDensity * fullVolume;
  return mass * GRAVITY;
}

export function calcBuoyantForce(liquidDensity, submergedVolume) {
  return liquidDensity * submergedVolume * GRAVITY;
}

/* ============================================================
   4. حل التوازن: إيجاد عمق الغمر "h" الذي يجعل
   قوة الطفو = الوزن (Binary Search لأن المعادلة غير خطية للكرة)
   ============================================================ */

export function findEquilibriumDepth(shape, objectDensity, liquidDensity) {
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

  const maxBuoyantForce = calcBuoyantForce(liquidDensity, fullVolume);
  if (weight >= maxBuoyantForce) {
    return {
      depth: maxDepth,
      isFullyFloating: false,
      isFullySubmerged: true,
      submergedFraction: 1,
    };
  }

  if (weight <= 0) {
    return {
      depth: 0,
      isFullyFloating: true,
      isFullySubmerged: false,
      submergedFraction: 0,
    };
  }

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
      low = mid;
    } else {
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
   ============================================================ */

export const MAX_VELOCITY = 5; // م/ث

export function stepSimulation(
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

  const weightForce = calcWeight(body.density, fullVolume);
  const buoyantForce = calcBuoyantForce(liquidDensity, submergedVol);
  const dampingForce = -dampingFactor * currentVelocity * mass;

  const netForce = weightForce - buoyantForce + dampingForce;
  const acceleration = netForce / mass;

  let newVelocity = currentVelocity + acceleration * dt;
  newVelocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, newVelocity));

  let newDepth = currentDepth + newVelocity * dt;

  if (newDepth > floorDepth) {
    newDepth = floorDepth;
    if (newVelocity > 0) newVelocity = 0;
  }

  if (newDepth < ceilingDepth) {
    newDepth = ceilingDepth;
    if (newVelocity < 0) newVelocity = 0;
  }

  return { depth: newDepth, velocity: newVelocity };
}

/**
 * مركز الطفو (Center of Buoyancy) - نقطة تأثير قوة الطفو
 */
export function calcCenterOfBuoyancy(body, depth) {
  const clampedDepth = Math.max(0, depth);
  if (body.type === "cube") {
    const h = Math.min(clampedDepth, body.size);
    return h / 2;
  } else {
    const h = Math.min(clampedDepth, 2 * body.size);
    return h / 2;
  }
}

/* ============================================================
   6. فيزياء نابض-تخميد للحركة الأفقية (غير متعلقة بأرخميدس)
   ============================================================ */

export function stepSpringReturn(offset, velocity, dt, stiffness = 35, damping = 9) {
  const springForce = -stiffness * offset;
  const dampingForce = -damping * velocity;
  const acceleration = springForce + dampingForce;

  let newVelocity = velocity + acceleration * dt;
  let newOffset = offset + newVelocity * dt;

  if (Math.abs(newOffset) < 0.05 && Math.abs(newVelocity) < 0.5) {
    newOffset = 0;
    newVelocity = 0;
  }

  return { offset: newOffset, velocity: newVelocity };
}
