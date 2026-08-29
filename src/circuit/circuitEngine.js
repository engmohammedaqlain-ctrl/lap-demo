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
          if (Math.abs(src.current) > 35) {
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
    const cA = w.termA.parent;
    w.current = cA instanceof Component ? cA.current : 0.0;
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
    desc: "يمر نفس التيار في جميع المصابيح، ويتقاسم المصباحان فرق الجهد فيقل سطوعهما (4.5V لكل مصباح). إذا فُصل أي مصباح تنطفئ الدائرة كاملة.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -120, -50);
      const sw = new Component("switch", 0, -50);
      const b1 = new Component("bulb", 100, -50);
      const b2 = new Component("bulb", 100, 50);
      b2.rotation = Math.PI;
      const amm = new Component("ammeter", -120, 50);
      amm.rotation = Math.PI;
      components.push(b, sw, b1, b2, amm);

      wires.push(new ElasticWire(b.t2, sw.t1, "#1B7340"));
      wires.push(new ElasticWire(sw.t2, b1.t1, "#1B7340"));
      wires.push(new ElasticWire(b1.t2, b2.t1, "#1B7340"));
      wires.push(new ElasticWire(b2.t2, amm.t1, "#CE1126"));
      wires.push(new ElasticWire(amm.t2, b.t1, "#CE1126"));

      return { components, junctions, wires };
    },
  },
  parallel: {
    key: "parallel",
    title: "التوصيل على التوازي (Parallel)",
    desc: "يحصل كل مصباح على الجهد الكامل للبطارية (9V) ويكون بكامل سطوعه. إذا فُصل أحد المسارين يظل المسار الآخر مضيئاً دون تأثر.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -140, 0);
      b.rotation = Math.PI / 2;
      const b1 = new Component("bulb", 0, -50);
      const b2 = new Component("bulb", 0, 50);
      components.push(b, b1, b2);

      const jTop = new JunctionNode(-60, -50);
      const jBot = new JunctionNode(-60, 50);
      junctions.push(jTop, jBot);

      wires.push(new ElasticWire(b.t1, jTop.terminal, "#1B7340"));
      wires.push(new ElasticWire(jTop.terminal, b1.t1, "#1B7340"));
      wires.push(new ElasticWire(jTop.terminal, b2.t1, "#1B7340"));

      wires.push(new ElasticWire(b.t2, jBot.terminal, "#CE1126"));
      wires.push(new ElasticWire(jBot.terminal, b1.t2, "#CE1126"));
      wires.push(new ElasticWire(jBot.terminal, b2.t2, "#CE1126"));

      return { components, junctions, wires };
    },
  },
  ohms: {
    key: "ohms",
    title: "قانون أوم ومجزئ الجهد (Potentiometer)",
    desc: "حرّك المقبض الأزرق للمقاومة المتغيرة؛ يتقسم جهد البطارية (9V) بين طرفي المقاومة والطرف الأوسط (Wiper) مما يغير قراءة الفولتميتر والسطوع وفق V = I × R.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -140, 0);
      b.rotation = Math.PI / 2;
      const pot = new Component("potentiometer", 0, 0);
      pot.val = 50;
      pot.wiper = 0.5;
      const bulb = new Component("bulb", 120, 0);
      bulb.rotation = Math.PI / 2;
      components.push(b, pot, bulb);

      wires.push(
        new ElasticWire(b.t1, pot.t1, "#1B7340", [
          { x: -140, y: -60 },
          { x: -20, y: -60 },
        ])
      );
      wires.push(
        new ElasticWire(pot.tw, bulb.t1, "#1B7340", [
          { x: 0, y: 60 },
          { x: 120, y: 60 },
        ])
      );
      wires.push(
        new ElasticWire(bulb.t2, b.t2, "#CE1126", [
          { x: 120, y: -80 },
          { x: -140, y: -80 },
        ])
      );
      wires.push(new ElasticWire(pot.t2, b.t2, "#CE1126", [{ x: 20, y: -80 }]));

      return { components, junctions, wires };
    },
  },
  short_circuit: {
    key: "short_circuit",
    title: "الماس الكهربائي (Short Circuit)",
    desc: "أغلق المفتاح الموازي للمصباح؛ ستلاحظ أن التيار يفضل المسار الأسهل (السلك منعدم المقاومة) متجاوزاً المصباح فينطفئ، ويرتفع التيار لمستويات خطيرة ومسبباً شرراً.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -120, 0);
      b.rotation = Math.PI / 2;
      const bulb = new Component("bulb", 40, 0);
      bulb.rotation = Math.PI / 2;
      const sw = new Component("switch", 40, -70);
      sw.isOpen = true;
      components.push(b, bulb, sw);

      const j1 = new JunctionNode(-40, -70);
      const j2 = new JunctionNode(-40, 70);
      junctions.push(j1, j2);

      wires.push(new ElasticWire(b.t1, j1.terminal, "#1B7340"));
      wires.push(new ElasticWire(j1.terminal, bulb.t1, "#1B7340"));
      wires.push(new ElasticWire(j1.terminal, sw.t1, "#1B7340"));

      wires.push(new ElasticWire(b.t2, j2.terminal, "#CE1126"));
      wires.push(new ElasticWire(j2.terminal, bulb.t2, "#CE1126"));
      wires.push(new ElasticWire(sw.t2, j2.terminal, "#CE1126"));

      return { components, junctions, wires };
    },
  },
  led_polarity: {
    key: "led_polarity",
    title: "اتجاهية التيار في الدايود (LED)",
    desc: "الدايود المشع (LED) يسمح بمرور التيار في اتجاه واحد فقط (انحياز أمامي). إذا عكست أطراف الدايود أو قمت بتدوير البطارية فلن يضيء.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -120, 0);
      const r = new Component("resistor", 0, -40);
      r.val = 220;
      const led = new Component("led", 100, 0);
      led.rotation = Math.PI / 2;
      components.push(b, r, led);

      wires.push(new ElasticWire(b.t2, r.t1, "#1B7340"));
      wires.push(new ElasticWire(r.t2, led.t2, "#1B7340"));
      wires.push(new ElasticWire(led.t1, b.t1, "#CE1126"));

      return { components, junctions, wires };
    },
  },
  capacitor: {
    key: "capacitor",
    title: "شحن وتفريغ المكثف (RC Transient)",
    desc: "يقوم المكثف بتخزين الطاقة في صورة مجال كهربائي؛ عند غلق المفتاح يشحن المكثف ثم يفرغ شحنته في المصباح فيضيء بقوة ثم يخفت تدريجياً وفق الثابت الزمني τ = RC.",
    build: () => {
      resetIds();
      const components = [];
      const junctions = [];
      const wires = [];

      const b = new Component("battery", -120, 0);
      const sw = new Component("switch", -20, -50);
      const cap = new Component("capacitor", 60, -50);
      cap.val = 3000;
      const bulb = new Component("bulb", 60, 50);
      bulb.rotation = Math.PI;
      components.push(b, sw, cap, bulb);

      wires.push(new ElasticWire(b.t2, sw.t1, "#1B7340"));
      wires.push(new ElasticWire(sw.t2, cap.t1, "#1B7340"));
      wires.push(new ElasticWire(cap.t2, bulb.t1, "#1B7340"));
      wires.push(new ElasticWire(bulb.t2, b.t1, "#CE1126"));

      return { components, junctions, wires };
    },
  },
};
