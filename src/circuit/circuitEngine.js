/**
 * circuitEngine.js — المحرك الرياضي والفيزيائي للدوائر الكهربائية
 * Modified Nodal Analysis (MNA) مع معالجة العناصر غير الخطية وحساب المتغيرات
 */

let nextCompId = 1;
let nextNodeId = 1;
let nextWireId = 1;
let nextJuncId = 1;

export function resetIds() {
  nextCompId = 1;
  nextNodeId = 1;
  nextWireId = 1;
  nextJuncId = 1;
}

export class ElectricalNode {
  constructor() {
    this.id = nextNodeId++;
    this.terminals = [];
    this.voltage = 0.0;
  }
}

export class Terminal {
  constructor(parent, relX, relY, name = "") {
    this.parent = parent;
    this.relX = relX;
    this.relY = relY;
    this.name = name;
    this.node = null;
  }

  get x() {
    if (this.parent instanceof JunctionNode) return this.parent.x;
    const rad = this.parent.rotation || 0;
    return this.parent.x + (this.relX * Math.cos(rad) - this.relY * Math.sin(rad));
  }

  get y() {
    if (this.parent instanceof JunctionNode) return this.parent.y;
    const rad = this.parent.rotation || 0;
    return this.parent.y + (this.relX * Math.sin(rad) + this.relY * Math.cos(rad));
  }
}

export class JunctionNode {
  constructor(x, y) {
    this.id = nextJuncId++;
    this.x = x;
    this.y = y;
    this.terminal = new Terminal(this, 0, 0, "J");
  }
}

export class Component {
  constructor(type, x, y) {
    this.id = nextCompId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.current = 0.0;
    this.voltageDrop = 0.0;
    this.power = 0.0;
    this.prevVoltage = 0.0;
    this.prevCurrent = 0.0;

    if (type === "potentiometer") {
      this.t1 = new Terminal(this, -20, 16, "T1");
      this.tw = new Terminal(this, 0, 16, "W");
      this.t2 = new Terminal(this, 20, 16, "T2");
      this.val = 50.0;
      this.wiper = 0.5;
      this.unit = "Ω";
      this.title = "مقاومة متغيرة (3 أطراف)";
    } else {
      const halfL = type === "battery" ? 40 : type === "capacitor" ? 30 : 36;
      this.t1 = new Terminal(this, -halfL, 0, "T1");
      this.t2 = new Terminal(this, halfL, 0, "T2");

      if (type === "battery") {
        this.val = 9.0;
        this.unit = "V";
        this.title = "بطارية DC";
      } else if (type === "resistor") {
        this.val = 10.0;
        this.unit = "Ω";
        this.title = "مقاومة ثابتة";
      } else if (type === "capacitor") {
        this.val = 1500;
        this.unit = "µF";
        this.title = "مكثف";
      } else if (type === "led") {
        this.val = 2.0;
        this.unit = "V";
        this.title = "دايود مشع LED";
        this.color = "#ef4444";
      } else if (type === "bulb") {
        this.val = 10.0;
        this.unit = "Ω";
        this.title = "مصباح كهربائي";
      } else if (type === "switch") {
        this.isOpen = false;
        this.title = "مفتاح كهربائي";
      } else if (type === "ammeter") {
        this.val = 1e-4;
        this.unit = "A";
        this.title = "أميتر";
      }
    }
  }

  getTerminals() {
    if (this.type === "potentiometer") return [this.t1, this.tw, this.t2];
    return [this.t1, this.t2];
  }
}

export class ElasticWire {
  constructor(termA, termB, color = "#1B7340", waypoints = []) {
    this.id = nextWireId++;
    this.termA = termA;
    this.termB = termB;
    this.color = color;
    this.waypoints = waypoints;
    this.current = 0.0;
  }

  getAllPoints() {
    return [
      { x: this.termA.x, y: this.termA.y },
      ...this.waypoints,
      { x: this.termB.x, y: this.termB.y },
    ];
  }
}

const RESISTOR_PALETTE = [
  "#000000",
  "#78350f",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#64748b",
  "#ffffff",
];

export function getResistorBands(ohms) {
  const r = Math.max(0.1, ohms);
  let d1 = 1,
    d2 = 0,
    mult = 0;
  if (r >= 10) {
    const exp = Math.floor(Math.log10(r));
    const norm = r / Math.pow(10, exp - 1);
    d1 = Math.floor(norm / 10) % 10;
    d2 = Math.floor(norm) % 10;
    mult = exp - 1;
  } else if (r >= 1) {
    d1 = Math.floor(r);
    d2 = Math.floor((r * 10) % 10);
    mult = -1;
  }
  return [
    RESISTOR_PALETTE[d1] || "#78350f",
    RESISTOR_PALETTE[d2] || "#000000",
    mult === -1 ? "#eab308" : RESISTOR_PALETTE[mult] || "#000000",
    "#eab308",
  ];
}

export function rebuildGraphNodes(components, junctions, wires) {
  let nodes = [];
  components.forEach((c) => {
    c.getTerminals().forEach((t) => {
      const n = new ElectricalNode();
      n.terminals.push(t);
      t.node = n;
      nodes.push(n);
    });
  });

  junctions.forEach((j) => {
    const n = new ElectricalNode();
    n.terminals.push(j.terminal);
    j.terminal.node = n;
    nodes.push(n);
  });

  wires.forEach((w) => {
    if (!w.termA || !w.termB) return;
    const nA = w.termA.node;
    const nB = w.termB.node;
    if (nA && nB && nA !== nB) {
      nB.terminals.forEach((t) => {
        t.node = nA;
        nA.terminals.push(t);
      });
      nodes = nodes.filter((n) => n !== nB);
    }
  });

  return nodes;
}

function solveLinearSystem(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    if (Math.abs(A[i][i]) < 1e-12) continue;

    for (let k = i + 1; k < n; k++) {
      const c = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= c * A[i][j];
      b[k] -= c * b[i];
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    if (Math.abs(A[i][i]) > 1e-12) x[i] = sum / A[i][i];
  }
  return x;
}

function addConductanceBranch(A, nodeMap, nA, nB, g) {
  if (!nodeMap.has(nA) || !nodeMap.has(nB) || nA === nB) return;
  const i1 = nodeMap.get(nA) - 1;
  const i2 = nodeMap.get(nB) - 1;
  if (i1 >= 0) A[i1][i1] += g;
  if (i2 >= 0) A[i2][i2] += g;
  if (i1 >= 0 && i2 >= 0) {
    A[i1][i2] -= g;
    A[i2][i1] -= g;
  }
}

export function solveSubstep(components, junctions, wires, dt = 0.002, onSpark = null) {
  const nodes = rebuildGraphNodes(components, junctions, wires);
  let isShortCircuit = false;

  if (nodes.length < 2 || components.length === 0) {
    components.forEach((c) => {
      c.current = 0;
      c.voltageDrop = 0;
      c.power = 0;
    });
    wires.forEach((w) => {
      w.current = 0;
    });
    return { isShortCircuit: false, nodes };
  }

  const visited = new Set();
  const islands = [];

  nodes.forEach((n) => {
    if (!visited.has(n)) {
      const island = [];
      const q = [n];
      visited.add(n);

      while (q.length > 0) {
        const curr = q.shift();
        island.push(curr);

        curr.terminals.forEach((t) => {
          if (t.parent instanceof JunctionNode) {
            wires.forEach((w) => {
              if (w.termA === t || w.termB === t) {
                const otherT = w.termA === t ? w.termB : w.termA;
                if (otherT.node && !visited.has(otherT.node)) {
                  visited.add(otherT.node);
                  q.push(otherT.node);
                }
              }
            });
          } else {
            const comp = t.parent;
            if (comp.type === "switch" && comp.isOpen) return;

            comp.getTerminals().forEach((otherT) => {
              if (otherT !== t && otherT.node && !visited.has(otherT.node)) {
                visited.add(otherT.node);
                q.push(otherT.node);
              }
            });
          }
        });
      }
      if (island.length >= 2) islands.push(island);
    }
  });

  islands.forEach((island) => {
    const nodeMap = new Map();
    island.forEach((n, idx) => nodeMap.set(n, idx));

    const voltageSources = [];
    components.forEach((c) => {
      if (c.type === "battery") {
        if (nodeMap.has(c.t1.node) && nodeMap.has(c.t2.node) && c.t1.node !== c.t2.node) {
          voltageSources.push(c);
        }
      }
    });

    const numNodeEqs = island.length - 1;
    const numSrcEqs = voltageSources.length;
    const totalMNA = numNodeEqs + numSrcEqs;
    if (totalMNA <= 0) return;

    let nrIter = 0;
    let converged = false;

    while (nrIter < 8 && !converged) {
      nrIter++;
      const A = Array.from({ length: totalMNA }, () => Array(totalMNA).fill(0));
      const Z = Array(totalMNA).fill(0);

      for (let i = 0; i < numNodeEqs; i++) A[i][i] += 1e-9;

      components.forEach((c) => {
        if (c.type === "battery") return;
        if (c.type === "switch" && c.isOpen) return;

        if (c.type === "potentiometer") {
          const r1 = Math.max(0.05, c.val * Math.max(0.01, c.wiper));
          const r2 = Math.max(0.05, c.val * Math.max(0.01, 1.0 - c.wiper));
          addConductanceBranch(A, nodeMap, c.t1.node, c.tw.node, 1.0 / r1);
          addConductanceBranch(A, nodeMap, c.tw.node, c.t2.node, 1.0 / r2);
          return;
        }

        const n1 = c.t1.node;
        const n2 = c.t2.node;
        if (!nodeMap.has(n1) || !nodeMap.has(n2) || n1 === n2) return;

        const i1 = nodeMap.get(n1) - 1;
        const i2 = nodeMap.get(n2) - 1;
        const vEst = n2.voltage - n1.voltage;

        let g = 0.1;
        let Ieq = 0.0;

        if (c.type === "resistor" || c.type === "bulb") {
          g = 1.0 / Math.max(0.1, c.val);
        } else if (c.type === "switch" || c.type === "ammeter") {
          g = 1e4;
        } else if (c.type === "capacitor") {
          const C = c.val * 1e-6;
          const Geq = (2 * C) / dt;
          g = Geq;
          Ieq = Geq * (c.prevVoltage || 0.0) + (c.prevCurrent || 0.0);
        } else if (c.type === "led") {
          const Is = 1e-14;
          const nVt = 0.052;
          const vClip = Math.min(2.5, Math.max(-10, vEst));
          const expVal = Math.exp(vClip / nVt);
          const id = Is * (expVal - 1);
          const gd = Math.max(1e-9, Math.min(1e4, (Is / nVt) * expVal));
          g = gd;
          Ieq = -(id - gd * vClip);
        }

        if (i1 >= 0) A[i1][i1] += g;
        if (i2 >= 0) A[i2][i2] += g;
        if (i1 >= 0 && i2 >= 0) {
          A[i1][i2] -= g;
          A[i2][i1] -= g;
        }

        if (i1 >= 0) Z[i1] -= Ieq;
        if (i2 >= 0) Z[i2] += Ieq;
      });

      voltageSources.forEach((src, sIdx) => {
        const row = numNodeEqs + sIdx;
        const nPos = src.t2.node;
        const nNeg = src.t1.node;
        const iPos = nodeMap.get(nPos) - 1;
        const iNeg = nodeMap.get(nNeg) - 1;

        if (iPos >= 0) {
          A[iPos][row] += 1;
          A[row][iPos] += 1;
        }
        if (iNeg >= 0) {
          A[iNeg][row] -= 1;
          A[row][iNeg] -= 1;
        }
        Z[row] = src.val;
      });

      const X = solveLinearSystem(A, Z);
      if (X) {
        let maxDiff = 0.0;
        for (let i = 0; i < numNodeEqs; i++) {
          const diff = Math.abs(island[i + 1].voltage - X[i]);
          if (diff > maxDiff) maxDiff = diff;
          island[i + 1].voltage = X[i];
        }
        island[0].voltage = 0.0;

        voltageSources.forEach((src, sIdx) => {
          src.current = X[numNodeEqs + sIdx];
          src.voltageDrop = src.val;
          src.power = Math.abs(src.current * src.val);
          if (Math.abs(src.current) > 60) {
            isShortCircuit = true;
            if (onSpark) onSpark(src.x, src.y);
          }
        });

        if (maxDiff < 1e-4) converged = true;
      } else {
        break;
      }
    }
  });

  components.forEach((c) => {
    if (c.type === "battery") return;

    if (c.type === "potentiometer") {
      const v1 = c.t1.node ? c.t1.node.voltage : 0;
      const vw = c.tw.node ? c.tw.node.voltage : 0;
      const v2 = c.t2.node ? c.t2.node.voltage : 0;
      c.voltageDrop = Math.abs(v2 - v1);
      const r1 = Math.max(0.05, c.val * Math.max(0.01, c.wiper));
      c.current = (vw - v1) / r1;
      c.power = Math.abs(c.current * (vw - v1));
      return;
    }

    const vA = c.t1.node ? c.t1.node.voltage : 0;
    const vB = c.t2.node ? c.t2.node.voltage : 0;
    const vDiff = vB - vA;
    c.voltageDrop = Math.abs(vDiff);

    if (c.type === "capacitor") {
      const C = c.val * 1e-6;
      const Geq = (2 * C) / dt;
      c.current = Geq * (vDiff - (c.prevVoltage || 0.0)) - (c.prevCurrent || 0.0);
      c.prevVoltage = vDiff;
      c.prevCurrent = c.current;
    } else if (c.type === "led") {
      const Is = 1e-14;
      const nVt = 0.052;
      c.current = vDiff > 0 ? Is * (Math.exp(Math.min(3.0, vDiff) / nVt) - 1) : 0.0;
    } else if (c.type === "switch" && c.isOpen) {
      c.current = 0;
    } else {
      const r = c.type === "resistor" || c.type === "bulb" ? c.val : 1e-4;
      c.current = vDiff / Math.max(r, 1e-4);
    }
    c.power = Math.abs(c.current * c.voltageDrop);
  });

  wires.forEach((w) => {
    const pA = w.termA.parent;
    const pB = w.termB.parent;
    if (pA instanceof Component && !(pB instanceof Component)) {
      w.current = pA.type === "switch" && pA.isOpen ? 0.0 : pA.current;
    } else if (pB instanceof Component && !(pA instanceof Component)) {
      w.current = pB.type === "switch" && pB.isOpen ? 0.0 : pB.current;
    } else if (pA instanceof Component && pB instanceof Component) {
      w.current = pA.type === "switch" && pA.isOpen ? 0.0 : pA.current;
    } else {
      // Both are junctions or wires — propagate node voltage drop
      const v1 = w.termA.node ? w.termA.node.voltage : 0;
      const v2 = w.termB.node ? w.termB.node.voltage : 0;
      w.current = (v2 - v1) / 0.001;
    }
  });

  return { isShortCircuit, nodes };
}

export function serializeCircuitState(components, junctions, wires) {
  return JSON.stringify({
    components: components.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      rot: c.rotation,
      val: c.val,
      isOpen: c.isOpen,
      color: c.color,
      wiper: c.wiper,
    })),
    junctions: junctions.map((j) => ({ id: j.id, x: j.x, y: j.y })),
    wires: wires.map((w) => ({
      id: w.id,
      fromCompId: w.termA.parent instanceof Component ? w.termA.parent.id : null,
      fromJuncId: w.termA.parent instanceof JunctionNode ? w.termA.parent.id : null,
      fromTerm: w.termA.name,
      toCompId: w.termB.parent instanceof Component ? w.termB.parent.id : null,
      toJuncId: w.termB.parent instanceof JunctionNode ? w.termB.parent.id : null,
      toTerm: w.termB.name,
      color: w.color,
      waypoints: w.waypoints,
    })),
  });
}

export function deserializeCircuitState(json) {
  const data = JSON.parse(json);
  const components = [];
  const junctions = [];
  const wires = [];

  const compMap = new Map();
  data.components.forEach((d) => {
    const c = new Component(d.type, d.x, d.y);
    c.id = d.id;
    c.rotation = d.rot || 0;
    c.val = d.val;
    c.isOpen = d.isOpen;
    c.color = d.color;
    c.wiper = d.wiper;
    components.push(c);
    compMap.set(c.id, c);
  });

  const juncMap = new Map();
  data.junctions.forEach((d) => {
    const j = new JunctionNode(d.x, d.y);
    j.id = d.id;
    junctions.push(j);
    juncMap.set(j.id, j);
  });

  data.wires.forEach((d) => {
    let t1 = null,
      t2 = null;
    if (d.fromCompId) {
      const c1 = compMap.get(d.fromCompId);
      if (c1) t1 = c1.getTerminals().find((t) => t.name === d.fromTerm) || c1.t1;
    } else if (d.fromJuncId) {
      const j1 = juncMap.get(d.fromJuncId);
      if (j1) t1 = j1.terminal;
    }

    if (d.toCompId) {
      const c2 = compMap.get(d.toCompId);
      if (c2) t2 = c2.getTerminals().find((t) => t.name === d.toTerm) || c2.t2;
    } else if (d.toJuncId) {
      const j2 = juncMap.get(d.toJuncId);
      if (j2) t2 = j2.terminal;
    }

    if (t1 && t2) {
      const w = new ElasticWire(t1, t2, d.color, d.waypoints || []);
      w.id = d.id;
      wires.push(w);
    }
  });

  return { components, junctions, wires };
}

export const EXPERIMENT_PRESETS = {
  series: {
    key: "series",
    title: "التوصيل على التوالي (Series)",
    desc: "مصباحان (كل منهما 10Ω) على التوالي مع بطارية 9V. المقاومة الكلية = 20Ω ← التيار = 9÷20 = 0.45A ← كل مصباح يستهلك 4.5V ← سطوع متساوٍ ولكن منخفض. إذا فُصل أحدهما تنطفئ الدائرة كاملة.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 9V → Switch → Bulb1(10Ω) → Bulb2(10Ω) → Ammeter → back to Battery
      // Expected: I = 9V / (10+10)Ω = 0.45A, V_each = 4.5V
      const b = new Component("battery", -120, -60);
      b.val = 9;
      const sw = new Component("switch", 0, -60);
      sw.isOpen = false;
      const b1 = new Component("bulb", 120, -60);
      b1.val = 10;
      const b2 = new Component("bulb", 120, 60);
      b2.val = 10;
      b2.rotation = Math.PI;
      const amm = new Component("ammeter", -120, 60);
      amm.rotation = Math.PI;
      components.push(b, sw, b1, b2, amm);

      // Top path: battery(+) → switch → bulb1
      wires.push(new ElasticWire(b.t2, sw.t1, "#1B7340"));
      wires.push(new ElasticWire(sw.t2, b1.t1, "#1B7340"));
      // Right corner: bulb1 → bulb2 (downward)
      wires.push(new ElasticWire(b1.t2, b2.t1, "#0284c7", [{ x: 156, y: 0 }]));
      // Bottom path: bulb2 → ammeter → battery(-)
      wires.push(new ElasticWire(b2.t2, amm.t1, "#CE1126"));
      wires.push(new ElasticWire(amm.t2, b.t1, "#CE1126"));

      return { components, junctions, wires };
    },
  },

  parallel: {
    key: "parallel",
    title: "التوصيل على التوازي (Parallel)",
    desc: "مصباحان (كل منهما 10Ω) على التوازي مع بطارية 9V. كل مصباح يحصل على الجهد الكامل 9V ← تيار كل فرع = 0.9A ← التيار الكلي = 1.8A. إذا فُصل أحدهما يبقى الآخر مضيئاً بنفس السطوع.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 9V vertical, two bulbs (10Ω each) in parallel branches
      // Expected: I_each = 9V/10Ω = 0.9A, I_total = 1.8A, V_each = 9V
      const b = new Component("battery", -160, 0);
      b.val = 9;
      b.rotation = Math.PI / 2;

      const b1 = new Component("bulb", 40, -60);
      b1.val = 10;
      const b2 = new Component("bulb", 40, 60);
      b2.val = 10;
      components.push(b, b1, b2);

      // Junction nodes for splitting/merging current
      const jLeft = new JunctionNode(-60, 0);
      const jRight = new JunctionNode(130, 0);
      junctions.push(jLeft, jRight);

      // Battery(+) → jLeft, then split into two branches
      wires.push(new ElasticWire(b.t2, jLeft.terminal, "#1B7340"));

      // Branch 1: jLeft → bulb1 → jRight
      wires.push(new ElasticWire(jLeft.terminal, b1.t1, "#1B7340", [{ x: -60, y: -60 }]));
      wires.push(new ElasticWire(b1.t2, jRight.terminal, "#1B7340", [{ x: 130, y: -60 }]));

      // Branch 2: jLeft → bulb2 → jRight
      wires.push(new ElasticWire(jLeft.terminal, b2.t1, "#0284c7", [{ x: -60, y: 60 }]));
      wires.push(new ElasticWire(b2.t2, jRight.terminal, "#0284c7", [{ x: 130, y: 60 }]));

      // jRight → Battery(-)
      wires.push(new ElasticWire(jRight.terminal, b.t1, "#CE1126", [{ x: 130, y: 120 }, { x: -160, y: 120 }]));

      return { components, junctions, wires };
    },
  },

  ohms: {
    key: "ohms",
    title: "قانون أوم ومجزئ الجهد (Ohm's Law)",
    desc: "بطارية 12V مع مقاومة متغيرة (50Ω) ومصباح (10Ω) على التوالي. حرّك المقبض الأخضر لتغيير مقدار المقاومة ولاحظ كيف يتغير سطوع المصباح والتيار المار في الدائرة وفق قانون أوم: V = I × R.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 12V → Potentiometer(50Ω, wiper=0.5) → Bulb(10Ω) → Battery
      // At wiper=0.5: R_pot_section = 25Ω, R_total ≈ 25+10 = 35Ω, I ≈ 0.34A
      // At wiper=0: R_pot_section ≈ 0Ω, I ≈ 1.2A (bright)
      // At wiper=1: R_pot_section = 50Ω, I ≈ 0.2A (dim)
      const b = new Component("battery", -140, 0);
      b.val = 12;
      b.rotation = Math.PI / 2;

      const pot = new Component("potentiometer", 20, -60);
      pot.val = 50;
      pot.wiper = 0.5;

      const bulb = new Component("bulb", 120, 0);
      bulb.val = 10;
      bulb.rotation = Math.PI / 2;

      const amm = new Component("ammeter", -40, 80);
      components.push(b, pot, bulb, amm);

      // Battery(+) → pot T1
      wires.push(new ElasticWire(b.t2, pot.t1, "#1B7340", [{ x: -140, y: -60 }]));

      // pot Wiper → Bulb
      wires.push(new ElasticWire(pot.tw, bulb.t2, "#1B7340", [{ x: 20, y: -20 }, { x: 120, y: -20 }]));

      // pot T2 → (also connects to the battery side — unused end, just tie to circuit)
      // In a proper voltage divider, T2 connects to the same node as T1's circuit
      // But for simplicity, leave T2 unconnected (open) — the wiper taps off

      // Bulb → Ammeter → Battery(-)
      wires.push(new ElasticWire(bulb.t1, amm.t1, "#CE1126", [{ x: 120, y: 80 }]));
      wires.push(new ElasticWire(amm.t2, b.t1, "#CE1126", [{ x: -140, y: 80 }]));

      // pot T2 ties to battery(-) to complete the divider
      wires.push(new ElasticWire(pot.t2, b.t1, "#CE1126", [{ x: 40, y: 100 }, { x: -160, y: 100 }]));

      return { components, junctions, wires };
    },
  },

  short_circuit: {
    key: "short_circuit",
    title: "الماس الكهربائي (Short Circuit)",
    desc: "مفتاح مفتوح موصول على التوازي مع مصباح 10Ω. أغلق المفتاح ← التيار يسلك المسار الأقل مقاومة (السلك ~0Ω) فينطفئ المصباح ← يرتفع التيار بشكل خطير ← تظهر شرارات تحذيرية.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 9V, Bulb(10Ω) in parallel with Switch(open)
      // Switch open: I = 9/10 = 0.9A through bulb (lit)
      // Switch closed: short circuit! I → very high, bulb bypassed
      const b = new Component("battery", -140, 0);
      b.val = 9;
      b.rotation = Math.PI / 2;

      const bulb = new Component("bulb", 60, -60);
      bulb.val = 10;

      const sw = new Component("switch", 60, 60);
      sw.isOpen = true;
      components.push(b, bulb, sw);

      // Junction nodes
      const jA = new JunctionNode(-40, 0);
      const jB = new JunctionNode(140, 0);
      junctions.push(jA, jB);

      // Battery(+) → jA
      wires.push(new ElasticWire(b.t2, jA.terminal, "#1B7340"));

      // Branch 1: jA → bulb → jB
      wires.push(new ElasticWire(jA.terminal, bulb.t1, "#1B7340", [{ x: -40, y: -60 }]));
      wires.push(new ElasticWire(bulb.t2, jB.terminal, "#1B7340", [{ x: 140, y: -60 }]));

      // Branch 2 (short): jA → switch → jB
      wires.push(new ElasticWire(jA.terminal, sw.t1, "#f59e0b", [{ x: -40, y: 60 }]));
      wires.push(new ElasticWire(sw.t2, jB.terminal, "#f59e0b", [{ x: 140, y: 60 }]));

      // jB → Battery(-)
      wires.push(new ElasticWire(jB.terminal, b.t1, "#CE1126", [{ x: 160, y: 120 }, { x: -140, y: 120 }]));

      return { components, junctions, wires };
    },
  },

  led_polarity: {
    key: "led_polarity",
    title: "اتجاهية الدايود المشع (LED Polarity)",
    desc: "بطارية 9V مع مقاومة حماية 330Ω ودايود LED أحمر (جهد عتبة ~2V). التيار المتوقع ≈ (9−2)÷330 ≈ 21mA. الـ LED يسمح بمرور التيار في اتجاه واحد فقط (من الأنود + إلى الكاثود −). جرّب تدوير الـ LED 180° لتلاحظ أنه لا يضيء عند عكس القطبية.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 9V → Resistor(330Ω) → LED → Battery(-)
      // Expected: I = (9-2)/330 ≈ 21.2mA (safe for standard LED)
      const b = new Component("battery", -120, 0);
      b.val = 9;

      const r = new Component("resistor", 0, -50);
      r.val = 330; // Protection resistor — standard value for LED

      const led = new Component("led", 100, 0);
      led.rotation = Math.PI / 2;
      components.push(b, r, led);

      // Battery(+) → Resistor
      wires.push(new ElasticWire(b.t2, r.t1, "#1B7340", [{ x: -80, y: -50 }]));
      // Resistor → LED (anode)
      wires.push(new ElasticWire(r.t2, led.t2, "#1B7340", [{ x: 100, y: -50 }]));
      // LED (cathode) → Battery(-)
      wires.push(new ElasticWire(led.t1, b.t1, "#CE1126", [{ x: 100, y: 70 }, { x: -120, y: 70 }]));

      return { components, junctions, wires };
    },
  },

  capacitor: {
    key: "capacitor",
    title: "شحن وتفريغ المكثف (RC Circuit)",
    desc: "بطارية 9V مع مقاومة 100Ω ومكثف 4700µF. الثابت الزمني τ = R×C = 100×0.0047 = 0.47 ثانية. عند غلق المفتاح يشحن المكثف تدريجياً حتى يصل جهده إلى جهد البطارية ويتناقص التيار حتى يصبح صفراً. لاحظ المصباح يسطع ثم يخفت تدريجياً.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      // Battery 9V → Switch → Resistor(100Ω) → Capacitor(4700µF) → Battery(-)
      // Also a bulb in series to visually see the charging current
      // τ = RC = 100 × 4700e-6 = 0.47s → takes ~2.35s (5τ) to fully charge
      const b = new Component("battery", -140, 0);
      b.val = 9;
      b.rotation = Math.PI / 2;

      const sw = new Component("switch", -40, -80);
      sw.isOpen = false;

      const r = new Component("resistor", 60, -80);
      r.val = 100;

      const cap = new Component("capacitor", 140, 0);
      cap.val = 4700; // 4700µF
      cap.rotation = Math.PI / 2;

      const bulb = new Component("bulb", 0, 80);
      bulb.val = 10; // Low resistance to see current
      components.push(b, sw, r, cap, bulb);

      // Battery(+) → Switch
      wires.push(new ElasticWire(b.t2, sw.t1, "#1B7340", [{ x: -140, y: -80 }]));
      // Switch → Resistor
      wires.push(new ElasticWire(sw.t2, r.t1, "#1B7340"));
      // Resistor → Capacitor top
      wires.push(new ElasticWire(r.t2, cap.t2, "#0284c7", [{ x: 140, y: -80 }]));
      // Capacitor bottom → Bulb → Battery(-)
      wires.push(new ElasticWire(cap.t1, bulb.t2, "#CE1126", [{ x: 140, y: 80 }]));
      wires.push(new ElasticWire(bulb.t1, b.t1, "#CE1126", [{ x: -140, y: 80 }]));

      return { components, junctions, wires };
    },
  },
};

