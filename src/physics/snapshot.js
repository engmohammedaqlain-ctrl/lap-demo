/**
 * snapshot.js — حساب لقطة القياسات (كتلة/وزن/طفو/نسبة الغمر) من حالة جسم،
 * وتنسيق الأرقام بالعربية. منطق حسابي خالص، بلا كتابة DOM (تُترجم هنا
 * إلى JSX عبر مكوّنات React بدل textContent مباشر).
 */
import {
  cubeFullVolume,
  sphereFullVolume,
  cubeSubmergedVolume,
  sphereSubmergedVolume,
  calcWeight,
  calcBuoyantForce,
} from "./physics.js";

export function formatNumber(value, decimals = 1) {
  return value.toLocaleString("ar-EG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMass(kg) {
  if (kg < 1) return formatNumber(kg * 1000, 1) + " غم";
  return formatNumber(kg, 2) + " كغ";
}

export function computePhysicsSnapshot(params) {
  const { shapeType, shapeSize, materialDensity, liquidDensity, depth, velocity } = params;

  const fullVolume = shapeType === "cube" ? cubeFullVolume(shapeSize) : sphereFullVolume(shapeSize);
  const maxDepth = shapeType === "cube" ? shapeSize : 2 * shapeSize;
  const clampedDepth = Math.max(0, Math.min(depth, maxDepth));
  const submergedVol =
    shapeType === "cube"
      ? cubeSubmergedVolume(clampedDepth, shapeSize)
      : sphereSubmergedVolume(clampedDepth, shapeSize);

  const mass = materialDensity * fullVolume;
  const weight = calcWeight(materialDensity, fullVolume);
  const buoyantForce = calcBuoyantForce(liquidDensity, submergedVol);
  const netForce = weight - buoyantForce;
  const submergedPercent = (clampedDepth / maxDepth) * 100;

  let status = "floating";
  if (submergedPercent >= 99.5) status = "sinking";
  else if (submergedPercent <= 0.5) status = "surfaced";
  if (Math.abs(velocity) > 0.02) status = "moving";

  return {
    mass,
    weight,
    buoyantForce,
    netForce,
    submergedPercent,
    submergedVolume: submergedVol,
    fullVolume,
    status,
  };
}

export function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}
