/**
 * useSnapshot.js — يقرأ الجسم الفعّال من stateRef كل ~150ms ويحسب لقطة
 * القياسات (كتلة/وزن/طفو/نسبة الغمر). مُستقل تماماً عن CanvasStage
 * (لا يمر بأي prop/callback منه) — إعادة عرض React بمعدل ٦٠ إطار/ثانية
 * لأرقام نصية صغيرة غير مجدية، فيكتفي هذا الـ hook بمعدل أبطأ يكفي للعين.
 */
import { useEffect, useState } from "react";
import { LIQUIDS, MATERIALS } from "../data/simulationData.js";
import { computePhysicsSnapshot } from "../physics/snapshot.js";
import { activeBodyOf } from "./useSimulation.js";

const POLL_MS = 150;

export function useSnapshot(stateRef) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    function tick() {
      const state = stateRef.current;
      const body = activeBodyOf(state);
      if (body) {
        const liquid = LIQUIDS[state.liquidKey];
        const material = MATERIALS[body.materialKey];
        setSnapshot(
          computePhysicsSnapshot({
            shapeType: body.shapeType,
            shapeSize: body.shapeSize,
            materialDensity: material.density,
            liquidDensity: liquid.density,
            depth: body.depth,
            velocity: body.velocity,
          })
        );
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [stateRef]);

  return snapshot;
}
