/**
 * CircuitScene.jsx — المشهد التفاعلي لمختبر الدوائر الكهربائية
 * إدارة الرسم على الـ Canvas، التفاعل، قياسات الفولتميتر، والمحاكاة اللحظية.
 */
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  Component,
  JunctionNode,
  ElasticWire,
  solveSubstep,
  getResistorBands,
  serializeCircuitState,
  deserializeCircuitState,
  EXPERIMENT_PRESETS,
  resetIds,
} from "./circuitEngine.js";
import { CircuitSound } from "./circuitAudio.js";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;
const GRID_SIZE = 20;
const FIXED_SUBSTEP_DT = 0.002; // 2ms physical substep

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

const CircuitScene = forwardRef(function CircuitScene(
  {
    snapToGrid = true,
    showValues = true,
    flowMode = "electrons", // 'electrons' | 'conventional' | 'none'
    activeWireColor = "#1B7340",
    dmmVisible = true,
    onHistoryChange,
    onShortCircuitChange,
    onMetricsChange,
    activePresetKey = "series",
  },
  ref
) {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);

  // Simulation State Refs
  const componentsRef = useRef([]);
  const junctionsRef = useRef([]);
  const wiresRef = useRef([]);
  const selectedItemRef = useRef(null);
  const sparkParticlesRef = useRef([]);
  const isShortRef = useRef(false);
  const lastMetricsReportRef = useRef(0);

  // Viewport transformation
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const animFrameRef = useRef(null);
  const particlePhaseRef = useRef(0.0);

  // Interaction State
  const activeDragRef = useRef(null);
  const activeWireDrawingRef = useRef(null);
  const hoveredTermRef = useRef(null);

  // Multimeter Tool
  const dmmRef = useRef({
    visible: true,
    x: 230,
    y: -140,
    w: 140,
    h: 96,
    mode: "V_DC",
    redProbe: { x: 150, y: -40, term: null },
    blackProbe: { x: 270, y: -40, term: null },
  });

  // History Stack
  const historyStackRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // Inspector State
  const [selectedItemState, setSelectedItemState] = useState(null);

  const snap = useCallback(
    (val) => {
      if (!snapToGrid) return val;
      return Math.round(val / GRID_SIZE) * GRID_SIZE;
    },
    [snapToGrid]
  );

  const recordHistory = useCallback(() => {
    const json = serializeCircuitState(
      componentsRef.current,
      junctionsRef.current,
      wiresRef.current
    );
    if (historyIndexRef.current < historyStackRef.current.length - 1) {
      historyStackRef.current.splice(historyIndexRef.current + 1);
    }
    historyStackRef.current.push(json);
    if (historyStackRef.current.length > 35) historyStackRef.current.shift();
    historyIndexRef.current = historyStackRef.current.length - 1;

    if (onHistoryChange) {
      onHistoryChange({
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyStackRef.current.length - 1,
      });
    }
  }, [onHistoryChange]);

  const stepPhysics = useCallback(() => {
    let shortAlert = false;
    for (let i = 0; i < 8; i++) {
      const res = solveSubstep(
        componentsRef.current,
        junctionsRef.current,
        wiresRef.current,
        FIXED_SUBSTEP_DT,
        (sx, sy) => {
          for (let k = 0; k < 3; k++) {
            sparkParticlesRef.current.push({
              x: sx + (Math.random() - 0.5) * 26,
              y: sy + (Math.random() - 0.5) * 16,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 1) * 5,
              life: 1.0,
            });
          }
        }
      );
      if (res.isShortCircuit) shortAlert = true;
    }

    if (shortAlert !== isShortRef.current) {
      isShortRef.current = shortAlert;
      if (shortAlert) CircuitSound.playShort();
      if (onShortCircuitChange) onShortCircuitChange(shortAlert);
    }

    const now = Date.now();
    if (onMetricsChange && now - lastMetricsReportRef.current > 180) {
      lastMetricsReportRef.current = now;
      let totalCurrent = 0;
      let totalPower = 0;
      let hasBattery = false;
      let openSwitches = 0;

      componentsRef.current.forEach((c) => {
        if (c.type === "battery") {
          hasBattery = true;
          totalCurrent += Math.abs(c.current);
          totalPower += Math.abs(c.power);
        } else if (c.type === "switch" && c.isOpen) {
          openSwitches++;
        }
      });

      onMetricsChange({
        totalCurrent,
        totalPower,
        hasBattery,
        openSwitches,
        isShortCircuit: isShortRef.current,
        compCount: componentsRef.current.length,
        wireCount: wiresRef.current.length,
      });
    }
  }, [onMetricsChange, onShortCircuitChange]);

  const toWorld = useCallback((sx, sy) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    return {
      x: (sx - w / 2 - panRef.current.x) / zoomRef.current,
      y: (sy - h / 2 - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const toScreen = useCallback((wx, wy) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 400, y: 300 };
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    return {
      x: wx * zoomRef.current + w / 2 + panRef.current.x,
      y: wy * zoomRef.current + h / 2 + panRef.current.y,
    };
  }, []);

  const hitTestTerminal = useCallback((wx, wy, radius = 16) => {
    for (let c of componentsRef.current) {
      for (let t of c.getTerminals()) {
        if (Math.hypot(t.x - wx, t.y - wy) <= radius) return t;
      }
    }
    for (let j of junctionsRef.current) {
      if (Math.hypot(j.x - wx, j.y - wy) <= radius) return j.terminal;
    }
    return null;
  }, []);

  const hitTestWire = useCallback((wx, wy, threshold = 10) => {
    for (let w of wiresRef.current) {
      const pts = w.getAllPoints();
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegment(wx, wy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= threshold) {
          return { wire: w, segmentIndex: i, point: { x: wx, y: wy } };
        }
      }
    }
    return null;
  }, []);

  const hitTestWireWaypoint = useCallback((wx, wy, radius = 12) => {
    if (!(selectedItemRef.current instanceof ElasticWire)) return null;
    for (let i = 0; i < selectedItemRef.current.waypoints.length; i++) {
      const wp = selectedItemRef.current.waypoints[i];
      if (Math.hypot(wp.x - wx, wp.y - wy) <= radius) {
        return { wire: selectedItemRef.current, index: i };
      }
    }
    return null;
  }, []);

  const updateSelectedItem = useCallback((item) => {
    selectedItemRef.current = item;
    if (!item) {
      setSelectedItemState(null);
    } else if (item instanceof Component) {
      const sp = toScreen(item.x, item.y);
      setSelectedItemState({
        type: "component",
        id: item.id,
        compType: item.type,
        title: item.title,
        val: item.val,
        unit: item.unit,
        wiper: item.wiper,
        isOpen: item.isOpen,
        voltageDrop: item.voltageDrop || 0,
        current: item.current || 0,
        power: item.power || 0,
        worldX: item.x,
        worldY: item.y,
        screenX: sp.x,
        screenY: sp.y,
      });
    } else if (item instanceof ElasticWire) {
      const midX = (item.termA.x + item.termB.x) / 2;
      const midY = (item.termA.y + item.termB.y) / 2;
      const sp = toScreen(midX, midY);
      setSelectedItemState({
        type: "wire",
        id: item.id,
        color: item.color,
        current: item.current || 0,
        screenX: sp.x,
        screenY: sp.y,
      });
    }
  }, [toScreen]);

  // Expose Controls via Ref
  useImperativeHandle(ref, () => ({
    undo() {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const data = deserializeCircuitState(historyStackRef.current[historyIndexRef.current]);
        componentsRef.current = data.components;
        junctionsRef.current = data.junctions;
        wiresRef.current = data.wires;
        updateSelectedItem(null);
        stepPhysics();
        onHistoryChange({
          canUndo: historyIndexRef.current > 0,
          canRedo: historyIndexRef.current < historyStackRef.current.length - 1,
        });
      }
    },
    redo() {
      if (historyIndexRef.current < historyStackRef.current.length - 1) {
        historyIndexRef.current++;
        const data = deserializeCircuitState(historyStackRef.current[historyIndexRef.current]);
        componentsRef.current = data.components;
        junctionsRef.current = data.junctions;
        wiresRef.current = data.wires;
        updateSelectedItem(null);
        stepPhysics();
        onHistoryChange({
          canUndo: historyIndexRef.current > 0,
          canRedo: historyIndexRef.current < historyStackRef.current.length - 1,
        });
      }
    },
    autoTidy() {
      // 1. Snap all component and junction positions to neat grid
      componentsRef.current.forEach((c) => {
        c.x = Math.round(c.x / 40) * 40;
        c.y = Math.round(c.y / 40) * 40;
      });
      junctionsRef.current.forEach((j) => {
        j.x = Math.round(j.x / 40) * 40;
        j.y = Math.round(j.y / 40) * 40;
      });

      // 2. Orthogonalize wires with clean 90° Manhattan bends
      wiresRef.current.forEach((w) => {
        const ax = w.termA.x;
        const ay = w.termA.y;
        const bx = w.termB.x;
        const by = w.termB.y;

        const dx = Math.abs(ax - bx);
        const dy = Math.abs(ay - by);

        if (dx <= 12 || dy <= 12) {
          w.waypoints = [];
        } else {
          // Midpoint orthogonal bend
          const midX = Math.round((ax + bx) / 80) * 40;
          w.waypoints = [
            { x: midX, y: Math.round(ay) },
            { x: midX, y: Math.round(by) },
          ];
        }
      });

      updateSelectedItem(null);
      recordHistory();
      stepPhysics();
      CircuitSound.playClick();
    },
    resetView() {
      zoomRef.current = 1.0;
      panRef.current = { x: 0, y: 0 };
    },
    zoomIn() {
      zoomRef.current = Math.min(MAX_ZOOM, zoomRef.current * 1.2);
    },
    zoomOut() {
      zoomRef.current = Math.max(MIN_ZOOM, zoomRef.current / 1.2);
    },
    clearAll() {
      componentsRef.current = [];
      junctionsRef.current = [];
      wiresRef.current = [];
      updateSelectedItem(null);
      recordHistory();
      stepPhysics();
      CircuitSound.playTrash();
    },
    loadPreset(presetKey) {
      const preset = EXPERIMENT_PRESETS[presetKey];
      if (preset) {
        const data = preset.build();
        componentsRef.current = data.components;
        junctionsRef.current = data.junctions;
        wiresRef.current = data.wires;
        zoomRef.current = 1.0;
        panRef.current = { x: 0, y: 0 };
        updateSelectedItem(null);
        recordHistory();
        stepPhysics();
      }
    },
    exportPNG() {
      updateSelectedItem(null);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `circuit-lab-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    },
    spawnComponent(type) {
      const x = -panRef.current.x / zoomRef.current + (Math.random() - 0.5) * 40;
      const y = -panRef.current.y / zoomRef.current + (Math.random() - 0.5) * 40;
      const comp = new Component(type, snap(x), snap(y));
      componentsRef.current.push(comp);
      updateSelectedItem(comp);
      CircuitSound.playClick();
      recordHistory();
      stepPhysics();
    },
  }));

  // Initialize Preset
  useEffect(() => {
    if (activePresetKey && EXPERIMENT_PRESETS[activePresetKey]) {
      const data = EXPERIMENT_PRESETS[activePresetKey].build();
      componentsRef.current = data.components;
      junctionsRef.current = data.junctions;
      wiresRef.current = data.wires;
      recordHistory();
      stepPhysics();
    }
  }, [activePresetKey, recordHistory, stepPhysics]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let isRunning = true;

    function renderFrame() {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Simulation Substep
      stepPhysics();
      if (flowMode !== "none") particlePhaseRef.current += 0.015;

      ctx.save();
      ctx.translate(w / 2 + panRef.current.x, h / 2 + panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // 1. Grid
      const step = GRID_SIZE;
      const startX = -w / zoomRef.current - panRef.current.x / zoomRef.current;
      const endX = w / zoomRef.current - panRef.current.x / zoomRef.current;
      const startY = -h / zoomRef.current - panRef.current.y / zoomRef.current;
      const endY = h / zoomRef.current - panRef.current.y / zoomRef.current;

      ctx.save();
      ctx.fillStyle = "rgba(27, 115, 64, 0.16)";
      for (let x = Math.floor(startX / step) * step; x < endX; x += step) {
        for (let y = Math.floor(startY / step) * step; y < endY; y += step) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      ctx.restore();

      // 2. Elastic Wires
      wiresRef.current.forEach((wObj) => {
        const pts = wObj.getAllPoints();

        ctx.save();
        // Drop Shadow
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y + 2);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + 2);
        ctx.stroke();

        // Selected Glow
        if (selectedItemRef.current === wObj) {
          ctx.strokeStyle = "#1B7340";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();

          wObj.waypoints.forEach((wp) => {
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#1B7340";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }

        // Wire Insulation
        ctx.strokeStyle = wObj.color;
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        // Highlight Shine
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y - 1);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y - 1);
        ctx.stroke();
        ctx.restore();

        // Flow Particles
        if (flowMode !== "none" && Math.abs(wObj.current) > 0.001) {
          let totalLen = 0;
          const dists = [];
          for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
            dists.push(d);
            totalLen += d;
          }

          const count = Math.max(2, Math.floor(totalLen / 25));
          let dir = wObj.current > 0 ? 1 : -1;
          if (flowMode === "electrons") dir *= -1;

          for (let i = 0; i < count; i++) {
            const prog = (((i / count + (particlePhaseRef.current * dir)) % 1) + 1) % 1;
            const targetD = prog * totalLen;

            let accumulated = 0;
            let segIdx = 0;
            while (segIdx < dists.length - 1 && accumulated + dists[segIdx] < targetD) {
              accumulated += dists[segIdx];
              segIdx++;
            }

            const segProg = dists[segIdx] > 0 ? (targetD - accumulated) / dists[segIdx] : 0;
            const p1 = pts[segIdx];
            const p2 = pts[segIdx + 1];
            const px = p1.x + (p2.x - p1.x) * segProg;
            const py = p1.y + (p2.y - p1.y) * segProg;

            ctx.save();
            if (flowMode === "electrons") {
              ctx.fillStyle = "#0284c7";
              ctx.beginPath();
              ctx.arc(px, py, 3.8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 8px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("−", px, py);
            } else {
              ctx.fillStyle = "#eab308";
              ctx.beginPath();
              ctx.arc(px, py, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      });

      // 3. Draft Wire
      if (activeWireDrawingRef.current) {
        const draft = activeWireDrawingRef.current;
        const pts = [{ x: draft.fromTerm.x, y: draft.fromTerm.y }, ...draft.waypoints, draft.curPos];
        ctx.save();
        ctx.strokeStyle = activeWireColor;
        ctx.lineWidth = 4.5;
        ctx.setLineDash([6, 6]);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Components
      componentsRef.current.forEach((c) => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);

        if (selectedItemRef.current === c) {
          ctx.save();
          ctx.strokeStyle = "#1B7340";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(-48, -26, 96, 52, 12);
          ctx.stroke();
          ctx.restore();
        }

        if (c.type === "battery") {
          const grad = ctx.createLinearGradient(0, -16, 0, 16);
          grad.addColorStop(0, "#0369a1");
          grad.addColorStop(0.3, "#38bdf8");
          grad.addColorStop(0.7, "#0284c7");
          grad.addColorStop(1, "#075985");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(-38, -16, 72, 32, 4);
          ctx.fill();

          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(34, -7, 6, 14);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("+", 24, 0);
          ctx.fillText("−", -24, 0);
          ctx.font = "bold 11px 'IBM Plex Sans Arabic', monospace";
          ctx.fillText(`${c.val.toFixed(0)}V`, 0, 0);
        } else if (c.type === "bulb") {
          const brightness = Math.min(1.0, c.power / 6.0);

          if (brightness > 0.05) {
            ctx.save();
            const glowGrad = ctx.createRadialGradient(0, -10, 4, 0, -10, 70);
            glowGrad.addColorStop(0, `rgba(254, 240, 138, ${brightness * 0.95})`);
            glowGrad.addColorStop(0.5, `rgba(250, 204, 21, ${brightness * 0.4})`);
            glowGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, -10, 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(0, -10, 18, 0, Math.PI * 2);
          ctx.fillStyle = brightness > 0.05 ? "#fef9c3" : "#f8fafc";
          ctx.fill();
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.strokeStyle = brightness > 0.05 ? "#eab308" : "#64748b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-6, 6);
          ctx.lineTo(-2, -14);
          ctx.lineTo(2, -14);
          ctx.lineTo(6, 6);
          ctx.stroke();

          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(-8, 6, 16, 10);
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-8, 0);
          ctx.moveTo(8, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();
        } else if (c.type === "resistor") {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-22, 0);
          ctx.moveTo(22, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();

          ctx.fillStyle = "#fed7aa";
          ctx.beginPath();
          ctx.roundRect(-22, -9, 44, 18, 5);
          ctx.fill();
          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 1;
          ctx.stroke();

          const bands = getResistorBands(c.val);
          const pos = [-13, -4, 5, 14];
          bands.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(pos[i], -9, 4.5, 18);
          });
        } else if (c.type === "potentiometer") {
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.roundRect(-24, -14, 48, 26, 6);
          ctx.fill();
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#1B7340";
          ctx.beginPath();
          ctx.arc(0, -1, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();

          const angle = -Math.PI + c.wiper * (Math.PI * 2);
          ctx.strokeStyle = "#f8fafc";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, -1);
          ctx.lineTo(Math.cos(angle) * 7, -1 + Math.sin(angle) * 7);
          ctx.stroke();

          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-20, 12);
          ctx.lineTo(-20, 16);
          ctx.moveTo(0, 12);
          ctx.lineTo(0, 16);
          ctx.moveTo(20, 12);
          ctx.lineTo(20, 16);
          ctx.stroke();
        } else if (c.type === "capacitor") {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-30, 0);
          ctx.lineTo(-8, 0);
          ctx.moveTo(8, 0);
          ctx.lineTo(30, 0);
          ctx.stroke();

          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-8, -18, 4, 36);
          ctx.fillRect(4, -18, 4, 36);

          const chargeRatio = Math.min(1.0, c.voltageDrop / 15.0);
          if (chargeRatio > 0.05) {
            ctx.fillStyle = `rgba(56, 189, 248, ${chargeRatio * 0.8})`;
            ctx.fillRect(-4, -16, 8, 32);
          }
        } else if (c.type === "led") {
          const isLighting = c.current > 0.005;
          ctx.save();
          if (isLighting) {
            const ledGlow = ctx.createRadialGradient(0, -6, 2, 0, -6, 40);
            ledGlow.addColorStop(0, "rgba(239, 68, 68, 0.9)");
            ledGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.fillStyle = ledGlow;
            ctx.beginPath();
            ctx.arc(0, -6, 40, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = isLighting ? "#ff4d4d" : "#f87171";
          ctx.beginPath();
          ctx.arc(0, -4, 14, Math.PI, 0, false);
          ctx.rect(-14, -4, 28, 12);
          ctx.fill();
          ctx.strokeStyle = "#b91c1c";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#b91c1c";
          ctx.fillRect(-16, 8, 32, 3);
          ctx.restore();

          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-14, 0);
          ctx.moveTo(14, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();
        } else if (c.type === "switch") {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-18, 0);
          ctx.moveTo(18, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();

          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.arc(-18, 0, 4, 0, Math.PI * 2);
          ctx.arc(18, 0, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.translate(-18, 0);
          if (c.isOpen) ctx.rotate(-0.55);
          ctx.strokeStyle = "#CE1126";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();
          ctx.restore();
        } else if (c.type === "ammeter") {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-20, 0);
          ctx.moveTo(20, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(-20, -15, 40, 30, 6);
          ctx.fill();
          ctx.strokeStyle = "#1B7340";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#1A1A1A";
          ctx.font = "bold 10px 'IBM Plex Sans Arabic', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.abs(c.current).toFixed(2)}A`, 0, 0);
        }

        ctx.restore();

        // Component Values Label
        if (showValues && c.val !== undefined) {
          ctx.save();
          ctx.translate(c.x, c.y - 28);
          ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
          ctx.strokeStyle = "rgba(27, 115, 64, 0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-28, -10, 56, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#1A1A1A";
          ctx.font = "bold 11px 'IBM Plex Sans Arabic', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const displayVal =
            c.type === "potentiometer"
              ? `${(c.val * c.wiper).toFixed(0)}/${c.val}`
              : `${c.val}`;
          ctx.fillText(`${displayVal} ${c.unit}`, 0, 0);
          ctx.restore();
        }
      });

      // 5. Junctions & Terminals
      junctionsRef.current.forEach((j) => {
        ctx.save();
        ctx.fillStyle = "#1B7340";
        ctx.beginPath();
        ctx.arc(j.x, j.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });

      componentsRef.current.forEach((c) => {
        c.getTerminals().forEach((t) => {
          const isHover = hoveredTermRef.current === t;
          ctx.save();
          ctx.fillStyle = isHover ? "#10b981" : "#1B7340";
          ctx.beginPath();
          ctx.arc(t.x, t.y, isHover ? 6.5 : 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        });
      });

      // 6. Desktop Multimeter (DMM)
      if (dmmVisible) {
        const m = dmmRef.current;
        const redJackX = m.x - 30,
          redJackY = m.y + m.h / 2;
        const blackJackX = m.x + 30,
          blackJackY = m.y + m.h / 2;

        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#CE1126";
        ctx.beginPath();
        ctx.moveTo(redJackX, redJackY);
        ctx.quadraticCurveTo(redJackX, m.redProbe.y + 35, m.redProbe.x, m.redProbe.y);
        ctx.stroke();

        ctx.strokeStyle = "#334155";
        ctx.beginPath();
        ctx.moveTo(blackJackX, blackJackY);
        ctx.quadraticCurveTo(blackJackX, m.blackProbe.y + 35, m.blackProbe.x, m.blackProbe.y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.roundRect(-m.w / 2, -m.h / 2, m.w, m.h, 12);
        ctx.fill();
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(-m.w / 2 + 10, -m.h / 2 + 8, m.w - 20, 32, 5);
        ctx.fill();

        let dispText = "0.00 V";
        const vR =
          m.redProbe.term && m.redProbe.term.node ? m.redProbe.term.node.voltage : 0;
        const vB =
          m.blackProbe.term && m.blackProbe.term.node ? m.blackProbe.term.node.voltage : 0;
        const vDiff = vR - vB;

        if (m.mode === "V_DC") {
          dispText = `${vDiff.toFixed(2)} V`;
          CircuitSound.setContinuityBuzzer(false);
        } else if (m.mode === "CONT") {
          const isCont =
            m.redProbe.term &&
            m.blackProbe.term &&
            m.redProbe.term.node === m.blackProbe.term.node;
          dispText = isCont ? "0.0 Ω BEEP" : "OPEN";
          CircuitSound.setContinuityBuzzer(isCont);
        }

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 15px 'IBM Plex Sans Arabic', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dispText, 0, -m.h / 2 + 24);

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 14, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#d97706";
        ctx.fillRect(-2, 2, 4, 10);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 8px 'IBM Plex Sans Arabic', sans-serif";
        ctx.fillText(m.mode === "V_DC" ? "VOLTAGE" : "BUZZER", 0, 36);
        ctx.restore();

        // Probes
        [
          { p: m.redProbe, c: "#CE1126" },
          { p: m.blackProbe, c: "#334155" },
        ].forEach(({ p, c }) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.roundRect(-4, -20, 8, 20, 3);
          ctx.fill();
          ctx.fillStyle = "#cbd5e1";
          ctx.beginPath();
          ctx.moveTo(-2, 0);
          ctx.lineTo(0, 8);
          ctx.lineTo(2, 0);
          ctx.fill();
          ctx.restore();
        });
      }

      // 7. Sparks
      for (let i = sparkParticlesRef.current.length - 1; i >= 0; i--) {
        const p = sparkParticlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          sparkParticlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.fillStyle = `rgba(245, 158, 11, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(renderFrame);
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      CircuitSound.setContinuityBuzzer(false);
    };
  }, [dmmVisible, flowMode, showValues, stepPhysics, activeWireColor]);

  // Pointer Interaction Handlers
  const handlePointerDown = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wPos = toWorld(sx, sy);

      canvas.setPointerCapture(e.pointerId);

      // 1. Multimeter Hit Test
      if (dmmVisible) {
        const dmm = dmmRef.current;
        if (Math.hypot(dmm.redProbe.x - wPos.x, dmm.redProbe.y - wPos.y) <= 20) {
          activeDragRef.current = { type: "probe", probe: dmm.redProbe };
          return;
        }
        if (Math.hypot(dmm.blackProbe.x - wPos.x, dmm.blackProbe.y - wPos.y) <= 20) {
          activeDragRef.current = { type: "probe", probe: dmm.blackProbe };
          return;
        }
        if (Math.abs(wPos.x - dmm.x) <= dmm.w / 2 && Math.abs(wPos.y - dmm.y) <= dmm.h / 2) {
          if (Math.hypot(wPos.x - dmm.x, wPos.y - (dmm.y + 12)) <= 18) {
            dmm.mode = dmm.mode === "V_DC" ? "CONT" : "V_DC";
            CircuitSound.playClick();
          } else {
            activeDragRef.current = { type: "dmmBody", ox: wPos.x - dmm.x, oy: wPos.y - dmm.y };
          }
          return;
        }
      }

      // 2. Active Wire Drawing Click
      if (activeWireDrawingRef.current) {
        const targetTerm = hitTestTerminal(wPos.x, wPos.y, 18);
        if (targetTerm && targetTerm !== activeWireDrawingRef.current.fromTerm) {
          const newWire = new ElasticWire(
            activeWireDrawingRef.current.fromTerm,
            targetTerm,
            activeWireColor,
            activeWireDrawingRef.current.waypoints
          );
          wiresRef.current.push(newWire);
          activeWireDrawingRef.current = null;
          CircuitSound.playSnap();
          recordHistory();
          stepPhysics();
          return;
        } else if (!targetTerm) {
          activeWireDrawingRef.current.waypoints.push({ x: snap(wPos.x), y: snap(wPos.y) });
          CircuitSound.playClick();
          return;
        }
      }

      // 3. Waypoint Drag
      const hitWP = hitTestWireWaypoint(wPos.x, wPos.y, 12);
      if (hitWP) {
        activeDragRef.current = { type: "waypoint", wire: hitWP.wire, index: hitWP.index };
        return;
      }

      // 4. Terminal Click => Start Wire Drawing
      const hitTerm = hitTestTerminal(wPos.x, wPos.y, 16);
      if (hitTerm) {
        activeWireDrawingRef.current = {
          fromTerm: hitTerm,
          waypoints: [],
          curPos: { x: wPos.x, y: wPos.y },
        };
        return;
      }

      // 5. Component Click
      const hitComp = componentsRef.current.find(
        (c) => Math.hypot(c.x - wPos.x, c.y - wPos.y) <= 34
      );
      if (hitComp) {
        if (hitComp.type === "switch") {
          hitComp.isOpen = !hitComp.isOpen;
          CircuitSound.playClick();
          recordHistory();
          stepPhysics();
        } else if (
          hitComp.type === "potentiometer" &&
          Math.hypot(wPos.x - hitComp.x, wPos.y - hitComp.y) <= 15
        ) {
          activeDragRef.current = { type: "potKnob", comp: hitComp };
          updateSelectedItem(hitComp);
          return;
        }
        activeDragRef.current = {
          type: "component",
          comp: hitComp,
          ox: wPos.x - hitComp.x,
          oy: wPos.y - hitComp.y,
        };
        updateSelectedItem(hitComp);
        return;
      }

      // 6. Wire Selection
      const hitW = hitTestWire(wPos.x, wPos.y, 10);
      if (hitW) {
        updateSelectedItem(hitW.wire);
        return;
      }

      // 7. Pan Viewport
      activeDragRef.current = {
        type: "pan",
        startSx: sx,
        startSy: sy,
        initPanX: panRef.current.x,
        initPanY: panRef.current.y,
      };
      updateSelectedItem(null);
    },
    [
      activeWireColor,
      dmmVisible,
      hitTestTerminal,
      hitTestWire,
      hitTestWireWaypoint,
      recordHistory,
      snap,
      stepPhysics,
      toWorld,
      updateSelectedItem,
    ]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wPos = toWorld(sx, sy);

      hoveredTermRef.current = hitTestTerminal(wPos.x, wPos.y, 18);

      if (activeWireDrawingRef.current) {
        activeWireDrawingRef.current.curPos = wPos;
        return;
      }

      const activeDrag = activeDragRef.current;
      if (!activeDrag) return;

      if (activeDrag.type === "pan") {
        panRef.current = {
          x: activeDrag.initPanX + (sx - activeDrag.startSx),
          y: activeDrag.initPanY + (sy - activeDrag.startSy),
        };
      } else if (activeDrag.type === "component") {
        activeDrag.comp.x = snap(wPos.x - activeDrag.ox);
        activeDrag.comp.y = snap(wPos.y - activeDrag.oy);
      } else if (activeDrag.type === "potKnob") {
        const angle = Math.atan2(wPos.y - activeDrag.comp.y, wPos.x - activeDrag.comp.x);
        let norm = (angle + Math.PI) / (Math.PI * 2);
        activeDrag.comp.wiper = Math.min(1.0, Math.max(0.0, norm));
        updateSelectedItem(activeDrag.comp);
      } else if (activeDrag.type === "waypoint") {
        activeDrag.wire.waypoints[activeDrag.index] = { x: snap(wPos.x), y: snap(wPos.y) };
      } else if (activeDrag.type === "probe") {
        activeDrag.probe.x = wPos.x;
        activeDrag.probe.y = wPos.y;
        activeDrag.probe.term = hoveredTermRef.current;
      } else if (activeDrag.type === "dmmBody") {
        dmmRef.current.x = wPos.x - activeDrag.ox;
        dmmRef.current.y = wPos.y - activeDrag.oy;
      }
    },
    [hitTestTerminal, snap, toWorld, updateSelectedItem]
  );

  const handlePointerUp = useCallback(() => {
    const activeDrag = activeDragRef.current;
    if (
      activeDrag &&
      (activeDrag.type === "component" ||
        activeDrag.type === "waypoint" ||
        activeDrag.type === "potKnob")
    ) {
      recordHistory();
      stepPhysics();
    }
    activeDragRef.current = null;
  }, [recordHistory, stepPhysics]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
  }, []);

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    if (type) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pos = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const comp = new Component(type, snap(pos.x), snap(pos.y));
      componentsRef.current.push(comp);
      updateSelectedItem(comp);
      CircuitSound.playClick();
      recordHistory();
      stepPhysics();
    }
  };

  // Popover Inspector Actions
  const handleSliderChange = (val) => {
    const item = selectedItemRef.current;
    if (!item || !(item instanceof Component)) return;
    const num = parseFloat(val);
    if (item.type === "potentiometer") {
      item.wiper = num;
    } else {
      item.val = num;
    }
    updateSelectedItem(item);
    stepPhysics();
  };

  const handleRotate = () => {
    const item = selectedItemRef.current;
    if (!item || !(item instanceof Component)) return;
    item.rotation = (item.rotation + Math.PI / 2) % (Math.PI * 2);
    item.x = snap(item.x);
    item.y = snap(item.y);
    CircuitSound.playClick();
    stepPhysics();
  };

  const handleDelete = () => {
    const item = selectedItemRef.current;
    if (!item) return;
    if (item instanceof Component) {
      const terms = item.getTerminals();
      wiresRef.current = wiresRef.current.filter(
        (w) => !terms.includes(w.termA) && !terms.includes(w.termB)
      );
      componentsRef.current = componentsRef.current.filter((c) => c !== item);
    } else if (item instanceof ElasticWire) {
      wiresRef.current = wiresRef.current.filter((w) => w !== item);
    }
    updateSelectedItem(null);
    CircuitSound.playTrash();
    recordHistory();
    stepPhysics();
  };

  return (
    <div
      className="circuit-viewport"
      ref={viewportRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Inspector Popover */}
      {selectedItemState && (
        <div className="cir-popover-inspector active">
          <div className="cir-popover-header">
            <span>{selectedItemState.title || "سلك توصيل"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="cir-popover-val">
                {selectedItemState.type === "component" &&
                  selectedItemState.compType === "potentiometer" &&
                  `${(selectedItemState.val * selectedItemState.wiper).toFixed(1)} / ${selectedItemState.val} Ω`}
                {selectedItemState.type === "component" &&
                  selectedItemState.compType !== "potentiometer" &&
                  `${selectedItemState.val} ${selectedItemState.unit || ""}`}
                {selectedItemState.type === "wire" &&
                  `${(selectedItemState.current * 1000).toFixed(1)} mA`}
              </span>
              <button
                type="button"
                className="cir-edu-close"
                onClick={() => updateSelectedItem(null)}
                title="إغلاق لوحة الخصائص"
              >
                ✕
              </button>
            </div>
          </div>

          {selectedItemState.type === "component" &&
            (selectedItemState.compType === "battery" ||
              selectedItemState.compType === "resistor" ||
              selectedItemState.compType === "bulb" ||
              selectedItemState.compType === "potentiometer" ||
              selectedItemState.compType === "capacitor") && (
              <div className="cir-popover-body">
                <div className="cir-popover-row">
                  <span>
                    {selectedItemState.compType === "battery"
                      ? "الجهد (V):"
                      : selectedItemState.compType === "capacitor"
                      ? "السعة (µF):"
                      : selectedItemState.compType === "potentiometer"
                      ? "الموضع (Wiper):"
                      : "المقاومة (Ω):"}
                  </span>
                </div>
                <input
                  type="range"
                  className="cir-popover-slider"
                  min={
                    selectedItemState.compType === "battery"
                      ? 1
                      : selectedItemState.compType === "capacitor"
                      ? 100
                      : selectedItemState.compType === "potentiometer"
                      ? 0
                      : 1
                  }
                  max={
                    selectedItemState.compType === "battery"
                      ? 120
                      : selectedItemState.compType === "capacitor"
                      ? 5000
                      : selectedItemState.compType === "potentiometer"
                      ? 1
                      : 100
                  }
                  step={
                    selectedItemState.compType === "capacitor"
                      ? 100
                      : selectedItemState.compType === "potentiometer"
                      ? 0.01
                      : 1
                  }
                  value={
                    selectedItemState.compType === "potentiometer"
                      ? selectedItemState.wiper
                      : selectedItemState.val
                  }
                  onChange={(e) => handleSliderChange(e.target.value)}
                />
              </div>
            )}

          <div className="cir-popover-actions">
            {selectedItemState.type === "component" && (
              <button
                type="button"
                className="cir-btn-action-sm"
                onClick={handleRotate}
                title="تدوير (R)"
              >
                🔄 تدوير
              </button>
            )}
            <button
              type="button"
              className="cir-btn-action-sm del"
              onClick={handleDelete}
              title="حذف"
            >
              🗑️ حذف
            </button>
          </div>
        </div>
      )}

      {/* Floating Zoom & Pan Controls */}
      <div className="cir-nav-tools">
        <button
          type="button"
          className="cir-btn-nav-float"
          onClick={() => ref.current?.zoomIn()}
          title="تكبير"
        >
          +
        </button>
        <button
          type="button"
          className="cir-btn-nav-float"
          onClick={() => ref.current?.zoomOut()}
          title="تصغير"
        >
          −
        </button>
        <button
          type="button"
          className="cir-btn-nav-float"
          onClick={() => ref.current?.resetView()}
          title="إعادة ضبط الرؤية"
        >
          🎯
        </button>
      </div>
    </div>
  );
});

export default CircuitScene;
