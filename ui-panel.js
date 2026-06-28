/**
 * ui-panel.js — تحديث القياسات في لوحة يمين
 */

function formatNumber(value, decimals = 1) {
  return value.toLocaleString("ar-EG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMass(kg) {
  if (kg < 1) return formatNumber(kg * 1000, 1) + " غم";
  return formatNumber(kg, 2) + " كغ";
}

function computePhysicsSnapshot(params) {
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

function updateMeasurementPanel(data) {
  setText("tag-mass", formatMass(data.mass));
  setText("tag-weight", formatNumber(data.weight, 1) + " N");
  setText("tag-buoyant", formatNumber(data.buoyantForce, 1) + " N");
  setText("tag-submerged", formatNumber(data.submergedPercent, 0) + "٪");

  // نسخة مصغّرة تُعرض دوماً على مقبض الورقة السفلية المطوية في الجوال
  setText("mini-mass", formatMass(data.mass));
  setText("mini-weight", formatNumber(data.weight, 0) + "N");
  setText("mini-buoyant", formatNumber(data.buoyantForce, 0) + "N");
  setText("mini-submerged", formatNumber(data.submergedPercent, 0) + "٪");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateSizeLabel(size) {
  setText("size-value", formatNumber(size, 2) + " م");
}
