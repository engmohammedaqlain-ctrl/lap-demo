/**
 * useSimulation.js
 * حالة المحاكاة المشتركة بين الكانفس ولوحات التحكم.
 *
 * التغييرات "الهيكلية" (مادة/شكل/حجم/سائل/الجسم الفعّال/عدد الأجسام/مفاتيح
 * الإظهار/الصوت) تمر عبر actions هنا فتُحدِّث stateRef.current ثم تستدعي bump()
 * لإجبار React على إعادة عرض لوحات HUD بالقيم الجديدة.
 *
 * التغييرات "اللحظية" (العمق/السرعة/الإزاحة الأفقية لكل جسم كل إطار) تُترك
 * لحلقة رسم الكانفس (CanvasStage) لتعديلها مباشرة على نفس stateRef.current
 * بلا bump — أي إعادة عرض React بمعدل ٦٠ إطار/ثانية غير ضرورية لأنها لا
 * تُرسم إلا على الكانفس، لا في DOM.
 */
import { useCallback, useRef, useState } from "react";
import { MATERIALS, LIQUIDS, MAX_BODIES } from "../data/simulationData.js";
import { findEquilibriumDepth } from "../physics/physics.js";

export const CUBE_SIZE_RANGE = { min: 0.22, max: 0.45, step: 0.01, default: 0.38 };
export const SPHERE_SIZE_RANGE = { min: 0.16, max: 0.3, step: 0.01, default: 0.24 };

export function sizeRangeFor(shapeType) {
  return shapeType === "sphere" ? SPHERE_SIZE_RANGE : CUBE_SIZE_RANGE;
}

export function makeBody(materialKey, shapeType, shapeSize, offsetX = 0) {
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

export function resetBodyEquilibrium(body, liquidKey) {
  const liquid = LIQUIDS[liquidKey];
  const material = MATERIALS[body.materialKey];
  const eq = findEquilibriumDepth(
    { type: body.shapeType, size: body.shapeSize },
    material.density,
    liquid.density
  );
  body.depth = eq.depth;
  body.velocity = 0;
}

export function resetAllEquilibrium(state) {
  state.bodies.forEach((body) => resetBodyEquilibrium(body, state.liquidKey));
}

export function activeBodyOf(state) {
  return state.bodies[state.activeIndex] || state.bodies[0] || null;
}

function createInitialState() {
  return {
    liquidKey: "water",
    bodies: [makeBody("wood", "cube", 0.38, 0)],
    activeIndex: 0,
    isDragging: false,
    dragIndex: -1,
    dragOffsetX: 0,
    dragOffsetY: 0,
    soundEnabled: true,
    showGravity: true,
    showBuoyancy: true,
    showValues: true,
    showDepthLines: true,
  };
}

export function useSimulation() {
  const stateRef = useRef(null);
  if (!stateRef.current) stateRef.current = createInitialState();

  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const actionsRef = useRef(null);
  if (!actionsRef.current) {
    actionsRef.current = {
      /** يضيف جسماً جديداً عند الإفلات (حتى MAX_BODIES)، أو يبدّل مادة الجسم الفعّال عند اكتمال العدد */
      addBody(materialKey, offsetX) {
        const state = stateRef.current;
        if (state.bodies.length >= MAX_BODIES) {
          actionsRef.current.setMaterialForActive(materialKey);
          return;
        }
        const ref = activeBodyOf(state);
        const shapeType = ref ? ref.shapeType : "cube";
        const shapeSize = ref ? ref.shapeSize : CUBE_SIZE_RANGE.default;
        const body = makeBody(materialKey, shapeType, shapeSize, offsetX);
        state.bodies.push(body);
        state.activeIndex = state.bodies.length - 1;
        resetBodyEquilibrium(body, state.liquidKey);
        bump();
      },
      setMaterialForActive(materialKey) {
        const state = stateRef.current;
        const body = activeBodyOf(state);
        if (!body) return;
        body.materialKey = materialKey;
        resetBodyEquilibrium(body, state.liquidKey);
        bump();
      },
      setShapeForActive(shapeType) {
        const state = stateRef.current;
        const body = activeBodyOf(state);
        if (!body) return;
        body.shapeType = shapeType;
        const range = sizeRangeFor(shapeType);
        if (body.shapeSize < range.min || body.shapeSize > range.max) {
          body.shapeSize = range.default;
        }
        resetBodyEquilibrium(body, state.liquidKey);
        bump();
      },
      setSizeForActive(size) {
        const state = stateRef.current;
        const body = activeBodyOf(state);
        if (!body) return;
        body.shapeSize = size;
        resetBodyEquilibrium(body, state.liquidKey);
        bump();
      },
      setLiquid(liquidKey) {
        const state = stateRef.current;
        state.liquidKey = liquidKey;
        resetAllEquilibrium(state);
        bump();
      },
      setActiveIndex(i) {
        const state = stateRef.current;
        if (i < 0 || i >= state.bodies.length) return;
        state.activeIndex = i;
        bump();
      },
      /** يحذف الجسم الفعّال شرط بقاء جسم واحد على الأقل */
      removeActiveBody() {
        const state = stateRef.current;
        actionsRef.current.removeBodyAt(state.activeIndex);
      },
      removeBodyAt(index) {
        const state = stateRef.current;
        if (state.bodies.length <= 1) return;
        state.bodies.splice(index, 1);
        state.activeIndex = Math.min(state.activeIndex, state.bodies.length - 1);
        bump();
      },
      toggleFlag(key) {
        const state = stateRef.current;
        state[key] = !state[key];
        bump();
      },
      setSoundEnabled(enabled) {
        stateRef.current.soundEnabled = enabled;
        bump();
      },
      resetAllEquilibrium() {
        resetAllEquilibrium(stateRef.current);
        bump();
      },
      bump,
    };
  }

  return { stateRef, version, actions: actionsRef.current };
}
