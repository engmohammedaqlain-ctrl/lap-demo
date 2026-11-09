/**
 * sim.js — فيزياء الكهرباء الساكنة (بإحداثيات تصميمية).
 * العلم: فرك البالون بالسترة ينقل إلكترونات (−) من السترة إلى البالون، فيصبح
 * البالون سالباً والسترة موجبة (تجاذب كولوم ~ ١/د²). الجدار المتعادل يُستقطَب
 * (تتحرك إلكتروناته بعيداً) فينجذب البالون إليه بقوة أضعف تسقط أسرع (~ ١/د³).
 * بالونان سالبان يتنافران. قصاصات الورق الخفيفة تنجذب إلى البالون المشحون.
 */
import { BALLOON_R, BALLOONS, CLAMP, MAX_Q, SWEATER_COLS, SWEATER_ROWS, insideSweater, sweaterPairSlots } from "./staticData.js";

const SLOTS = sweaterPairSlots();
export const PAIR_COUNT = SLOTS.length;
const STRING_N = 9;
const STRING_LEN = 118;

export class StaticWorld {
  constructor(L, balloonCount = 1) {
    this.L = L;
    this.time = 0;
    this.events = [];
    this.build(balloonCount);
  }

  setLayout(L) {
    const old = this.L;
    this.L = L;
    // أعد توزيع البالونات الحرّة نسبةً إلى التخطيط الجديد
    if (old) {
      for (const b of this.balloons) {
        b.x = (b.x / old.dW) * L.dW;
        b.y = L.floorY - (old.floorY - b.y);
        this.resetString(b);
      }
      this.confetti.forEach((c) => {
        c.x = (c.x / old.dW) * L.dW;
        c.y = L.floorY + c.dy;
      });
    }
    this.layoutElectrons();
  }

  build(count) {
    const L = this.L;
    this.balloons = [];
    for (let i = 0; i < 2; i++) this.balloons.push(this.makeBalloon(i, count));
    this.wall = { p: this.wall ? this.wall.p : 1, target: 1 };
    this.electrons = SLOTS.map((s, id) => ({
      id,
      slot: s,
      state: "home", // home | flying | on
      owner: -1,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ox: 0,
      oy: 0,
    }));
    this.layoutElectrons();
    this.sparks = [];
    this.wallRows = Array.from({ length: 11 }, () => ({ infl: 0 }));
    this.confetti = [];
    const colors = ["#f06a6a", "#f2c14e", "#5ec2b7", "#7aa6f5", "#ee8fb3", "#a7d86d"];
    for (let i = 0; i < 9; i++) {
      const dy = 6 + Math.random() * 40;
      this.confetti.push({
        x: L.sweater.cx + 120 + Math.random() * (L.pillarX - L.sweater.cx - 260),
        y: L.floorY + dy,
        dy,
        w: 15 + Math.random() * 7,
        h: 8 + Math.random() * 3,
        rot: (Math.random() - 0.5) * 1.2,
        color: colors[i % colors.length],
        vx: 0,
        vy: 0,
        attached: -1,
        ox: 0,
        oy: 0,
        wob: Math.random() * 6,
      });
    }
    this.hintShown = false;
  }

  makeBalloon(i, count) {
    const L = this.L;
    const spec = BALLOONS[i];
    const span = L.pillarX - L.sweater.cx - 200;
    const x = L.sweater.cx + 210 + (count === 1 ? span * 0.35 : span * (i === 0 ? 0.18 : 0.62));
    const y = L.floorY - 250 - i * 40;
    const b = {
      i,
      spec,
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      r: BALLOON_R,
      held: false,
      stuck: null,
      q: 0,
      angle: 0,
      avel: 0,
      speed: 0,
      rubAcc: 0,
      rubbing: false,
      bob: i * 1.7,
      out: i === 0,
      squish: 0,
      stickPulse: 0,
      target: null,
      trail: [],
      string: [],
      lastSpark: 0,
    };
    if (!b.out) {
      const s = this.basketSlot(i);
      b.x = b.px = s.x;
      b.y = b.py = s.y;
    }
    this.resetString(b);
    return b;
  }

  basketSlot(i) {
    const k = this.L.basket;
    return { x: k.cx + (i === 0 ? -30 : 30), y: k.base - 150 };
  }

  /** يعيد البالون إلى السلّة (ويبقى مشحوناً كما هو) */
  stowBalloon(b) {
    b.out = false;
    b.held = false;
    b.stuck = null;
    b.vx = 0;
    b.vy = 0;
    this.events.push({ type: "stow" });
  }

  takeBalloon(b) {
    b.out = true;
  }

  toggleWall() {
    this.wall.target = this.wall.target > 0.5 ? 0 : 1;
    this.events.push({ type: "wall", open: this.wall.target < 0.5 });
  }

  get wallX() {
    return this.L.pillarX + (1 - this.wall.p) * (this.L.pillarW + 60);
  }

  resetString(b) {
    b.string = [];
    for (let k = 0; k < STRING_N; k++) {
      b.string.push({ x: b.x, y: b.y + b.r * 1.05 + (k * STRING_LEN) / (STRING_N - 1), px: b.x, py: b.y + b.r * 1.05 + (k * STRING_LEN) / (STRING_N - 1) });
    }
  }

  reset() {
    this.build(2);
  }

  /* أماكن الإلكترونات "في بيتها" على السترة */
  layoutElectrons() {
    const { cx, cy } = this.L.sweater;
    for (const e of this.electrons) {
      e.hx = cx + e.slot.x + 7;
      e.hy = cy + e.slot.y;
      if (e.state === "home") {
        e.x = e.hx;
        e.y = e.hy;
      }
    }
  }

  get sweaterCharge() {
    return this.electrons.filter((e) => e.state !== "home").length;
  }

  sweaterLocal(x, y) {
    return { lx: x - this.L.sweater.cx, ly: y - this.L.sweater.cy };
  }

  /** أقرب نقطة (تقريبية) على السترة من نقطة x,y ومسافتها */
  nearestOnSweater(x, y) {
    const { cx, cy } = this.L.sweater;
    const nx = CLAMP(x, cx - 168, cx + 168);
    const ny = CLAMP(y, cy - 118, cy + 132);
    return { x: nx, y: ny, d: Math.hypot(x - nx, y - ny) };
  }

  /* ---------- خطوة المحاكاة ---------- */
  step(dtRaw, opts) {
    const dt = Math.min(dtRaw, 0.04);
    this.time += dt;
    void opts;
    const L = this.L;
    const bs = this.balloons;
    // لوح الجدار المنزلق
    const wl = this.wall;
    wl.p += Math.sign(wl.target - wl.p) * Math.min(Math.abs(wl.target - wl.p), dt * 1.5);
    const wallOn = wl.p > 0.97;
    if (wl.p < 0.93) for (const b of bs) if (b.stuck === "wall") b.stuck = null;
    this.wallOn = wallOn;

    for (const b of bs) {
      if (!b.out) {
        this.stepInBasket(b, dt);
        continue;
      }
      b.rubbing = false;
      b.bob += dt * 1.6;
      b.stickPulse = Math.max(0, b.stickPulse - dt * 2.2);
      const dx = b.x - b.px;
      const dy = b.y - b.py;
      const inst = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
      b.speed += (inst - b.speed) * Math.min(1, dt * 12);
      b.px = b.x;
      b.py = b.y;

      if (b.held) {
        this.handleRub(b, dt);
      } else if (b.stuck) {
        // ملتصق: يبقى ويهتز اهتزازاً خفيفاً بعد الاستقرار
      } else {
        this.freeForces(b, dt, wallOn);
      }
      this.keepInside(b, wallOn);
      this.stepString(b, dt);

      // ميلان خفيف مع الحركة
      const target = CLAMP(b.vx * 0.0006, -0.22, 0.22);
      b.avel += (target - b.angle) * 40 * dt - b.avel * 6 * dt;
      b.angle += b.avel * dt;
    }

    this.collideBalloons(dt);
    this.stepElectrons(dt);
    this.stepWall(wallOn);
    this.stepConfetti(dt);
    this.stepSparks(dt);
  }

  stepInBasket(b, dt) {
    const slot = this.basketSlot(b.i);
    b.bob += dt * 1.4;
    b.px = b.x;
    b.py = b.y;
    b.x += (slot.x - b.x) * Math.min(1, dt * 6);
    b.y += (slot.y + Math.sin(b.bob) * 5 - b.y) * Math.min(1, dt * 6);
    b.speed = 0;
    b.rubbing = false;
    b.angle += ((b.i === 0 ? -0.12 : 0.12) - b.angle) * Math.min(1, dt * 5);
    this.stepString(b, dt);
  }

  handleRub(b, dt) {
    const { lx, ly } = this.sweaterLocal(b.x, b.y);
    const over = insideSweater(lx, ly, b.r * 0.25);
    const speed = b.speed;
    if (!over || speed < 110) {
      b.rubAcc = Math.max(0, b.rubAcc - dt);
      return;
    }
    b.rubbing = true;
    const rate = CLAMP((speed - 110) / 260, 0, 1) * 9; // إلكترونات/ثانية
    b.rubAcc += rate * dt;
    while (b.rubAcc >= 1) {
      b.rubAcc -= 1;
      if (!this.transfer(b)) break;
    }
  }

  /** ينقل إلكتروناً واحداً من أقرب موضع على السترة إلى البالون */
  transfer(b) {
    if (b.q >= MAX_Q) return false;
    let best = null;
    let bd = (b.r + 34) ** 2;
    for (const e of this.electrons) {
      if (e.state !== "home") continue;
      const d2 = (e.hx - b.x) ** 2 + (e.hy - b.y) ** 2;
      if (d2 < bd) {
        bd = d2;
        best = e;
      }
    }
    if (!best) return false;
    const slot = b.q;
    best.state = "flying";
    best.owner = b.i;
    best.x = best.hx;
    best.y = best.hy;
    best.vx = (Math.random() - 0.5) * 60;
    best.vy = -40 - Math.random() * 60;
    best.ox = -27 + (slot % 4) * 18;
    best.oy = 6 + Math.floor(slot / 4) * 16;
    b.q++;
    this.spark(best.hx, best.hy, 4, "elec");
    this.events.push({ type: "transfer", b: b.i, q: b.q });
    return true;
  }

  freeForces(b, dt, wallOn) {
    const L = this.L;
    let ax = 0;
    let ay = 0;
    const q = b.q;
    if (q > 0) {
      // تجاذب مع السترة (شحنة صافية موجبة عليها) ~ ١/د²
      const n = this.nearestOnSweater(b.x, b.y);
      const d = n.d + b.r * 0.5 + 6;
      const a = Math.min(2300, (q * 1.08e7) / (d * d));
      const ux = n.d > 0.5 ? (n.x - b.x) / n.d : 0;
      const uy = n.d > 0.5 ? (n.y - b.y) / n.d : 0;
      ax += ux * a;
      ay += uy * a;
      // استقطاب الجدار (شحنة مستحثّة): أضعف ويسقط أسرع ~ ١/د³
      if (wallOn) {
        const dw = Math.max(8, L.pillarX - b.x);
        const aw = Math.min(2600, (q * 2.16e8) / (dw * dw * dw));
        ax += aw;
      }
    }
    // تنافر بين بالونين مشحونين
    for (const o of this.balloons) {
      if (o === b || !o.out || o.q === 0 || q === 0) continue;
      const dx = b.x - o.x;
      const dy = b.y - o.y;
      const d = Math.hypot(dx, dy) + 10;
      const a = Math.min(2000, (q * o.q * 1.1e6) / (d * d));
      ax += (dx / d) * a;
      ay += (dy / d) * a;
    }
    // عوم متعادل: تأرجح خفيف جداً
    ay += Math.sin(b.bob) * 14;
    b.vx += ax * dt;
    b.vy += ay * dt;
    const damp = Math.exp(-(q > 0 ? 6.2 : 4.4) * dt);
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // التصاق بالسترة أو بالجدار (شحنة سالبة فقط)
    if (q > 0) {
      const n = this.nearestOnSweater(b.x, b.y);
      if (n.d < b.r * 0.62) {
        b.vx = 0;
        b.vy = 0;
        this.setStuck(b, "sweater");
      }
      if (wallOn && b.x + b.r * 0.55 >= L.pillarX) {
        b.x = L.pillarX - b.r * 0.52;
        b.vx = 0;
        b.vy = 0;
        this.setStuck(b, "wall");
      }
    }

    // شرارة عند الاقتراب السريع
    if (q > 0 && this.time - b.lastSpark > 0.6) {
      const n = this.nearestOnSweater(b.x, b.y);
      const closeSweater = n.d < b.r + 26 && n.d > b.r * 0.5 && Math.hypot(b.vx, b.vy) > 160;
      const closeWall = wallOn && L.pillarX - b.x < b.r + 30 && L.pillarX - b.x > b.r * 0.6 && b.vx > 120;
      if (closeSweater || closeWall) {
        b.lastSpark = this.time;
        const sx = closeWall ? L.pillarX : n.x;
        const sy = closeWall ? b.y : n.y;
        this.spark(sx, sy, 10, "bolt");
        this.events.push({ type: "zap" });
      }
    }
  }

  setStuck(b, where) {
    if (b.stuck === where) return;
    b.stuck = where;
    b.stickPulse = 1;
    const L = this.L;
    const x = where === "wall" ? L.pillarX : b.x - b.r * 0.4;
    this.spark(x, b.y, 14, "bolt");
    this.events.push({ type: "stick", where });
  }

  keepInside(b, wallOn) {
    const L = this.L;
    const minX = b.r * 0.55;
    const maxX = (wallOn ? L.pillarX - b.r * 0.5 : L.dW - b.r * 0.55);
    if (!b.held || true) {
      b.x = CLAMP(b.x, minX, Math.max(minX, maxX));
      b.y = CLAMP(b.y, b.r + 26, L.baseY - b.r * 0.95);
    }
  }

  stepString(b, dt) {
    // سلسلة فيرليه بسيطة: النقطة الأولى عند عقدة البالون
    const kx = b.x + Math.sin(b.angle) * -b.r * 1.02;
    const ky = b.y + Math.cos(b.angle) * b.r * 1.04;
    const pts = b.string;
    pts[0].x = kx;
    pts[0].y = ky;
    const seg = STRING_LEN / (STRING_N - 1);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.97;
      const vy = (p.y - p.py) * 0.97;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + 1400 * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const c = pts[i];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - seg) / d;
        if (i === 1) {
          c.x -= dx * diff;
          c.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          c.x -= dx * diff * 0.5;
          c.y -= dy * diff * 0.5;
        }
      }
      pts[0].x = kx;
      pts[0].y = ky;
    }
    // الأرض
    const floor = this.L.baseY + 14;
    for (const p of pts) if (p.y > floor) p.y = floor;
  }

  collideBalloons(dt) {
    const bs = this.balloons;
    if (bs.length < 2) return;
    const a = bs[0];
    const c = bs[1];
    if (!a.out || !c.out) return;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const min = (a.r + c.r) * 0.92;
    if (d < min) {
      const push = (min - d) * 0.5;
      const ux = dx / d;
      const uy = dy / d;
      if (!a.held && !a.stuck) {
        a.x -= ux * push;
        a.y -= uy * push;
      }
      if (!c.held && !c.stuck) {
        c.x += ux * push;
        c.y += uy * push;
      }
      if (a.held && !c.held && !c.stuck) {
        c.x += ux * push;
        c.y += uy * push;
      }
      if (c.held && !a.held && !a.stuck) {
        a.x -= ux * push;
        a.y -= uy * push;
      }
    }
    void dt;
  }

  stepElectrons(dt) {
    for (const e of this.electrons) {
      if (e.state === "home") continue;
      const b = this.balloons[e.owner];
      if (!b) {
        e.state = "home";
        e.x = e.hx;
        e.y = e.hy;
        continue;
      }
      const tx = b.x + e.ox * Math.cos(b.angle) - e.oy * Math.sin(b.angle) * 0;
      const ty = b.y + e.oy;
      if (e.state === "flying") {
        e.vx += (tx - e.x) * 38 * dt;
        e.vy += (ty - e.y) * 38 * dt;
        const damp = Math.exp(-9 * dt);
        e.vx *= damp;
        e.vy *= damp;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (Math.hypot(tx - e.x, ty - e.y) < 5 && Math.hypot(e.vx, e.vy) < 120) e.state = "on";
      } else {
        // يتبع البالون بنابض ناعم (يعطي إحساس الوزن)
        e.x += (tx - e.x) * Math.min(1, dt * 22);
        e.y += (ty - e.y) * Math.min(1, dt * 22);
      }
    }
  }

  stepWall(wallOn) {
    const L = this.L;
    const rows = this.wallRows;
    const top = L.floorY - 470;
    const bottom = L.floorY - 40;
    for (let i = 0; i < rows.length; i++) {
      const y = top + (i / (rows.length - 1)) * (bottom - top);
      rows[i].y = y;
      let infl = 0;
      if (wallOn) {
        for (const b of this.balloons) {
          if (!b.out || b.q <= 0) continue;
          const d = Math.hypot(L.pillarX - b.x, y - b.y) + 1;
          infl = Math.max(infl, CLAMP((b.q * 28) / d, 0, 1));
        }
      }
      rows[i].infl += (infl - rows[i].infl) * 0.12;
    }
  }

  stepConfetti(dt) {
    const L = this.L;
    for (const c of this.confetti) {
      c.wob += dt * 5;
      if (c.attached >= 0) {
        const b = this.balloons[c.attached];
        if (!b || !b.out) {
          c.attached = -1;
          continue;
        }
        const tx = b.x + c.ox + Math.sin(c.wob) * 1.2;
        const ty = b.y + c.oy;
        c.x += (tx - c.x) * Math.min(1, dt * 18);
        c.y += (ty - c.y) * Math.min(1, dt * 18);
        continue;
      }
      let pulled = false;
      for (const b of this.balloons) {
        if (!b.out || b.q <= 0) continue;
        const dx = b.x - c.x;
        const dy = b.y + b.r * 0.4 - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 300) {
          const a = Math.min(2600, (b.q * 8.5e6) / (d * d + 800));
          c.vx += (dx / d) * a * dt * 0.7;
          c.vy += (dy / d) * a * dt;
          pulled = true;
        }
        if (d < b.r + 8) {
          c.attached = b.i;
          // وزّع القصاصات على قوس السطح السفلي/الجانبي بدل تكتّلها في نقطة واحدة
          const n = this.confetti.filter((o) => o.attached === b.i).length;
          const spread = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0][n % 9];
          const ang = Math.PI / 2 + spread * 0.62 + (Math.random() - 0.5) * 0.18;
          const rad = b.r * (0.9 + (n % 2) * 0.06);
          c.ox = Math.cos(ang) * rad;
          c.oy = Math.sin(ang) * rad * 1.02;
          c.rot = ang + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
          this.events.push({ type: "paper" });
        }
      }
      // سقوط/استقرار على الأرض
      if (!pulled || c.y > L.floorY + 60) c.vy += 900 * dt;
      c.vx *= Math.exp(-3 * dt);
      c.vy *= Math.exp(-1.6 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const floor = L.floorY + c.dy;
      if (c.y > floor) {
        c.y = floor;
        c.vy = 0;
      }
    }
  }

  spark(x, y, n, kind) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 150;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, age: 0, life: 0.35 + Math.random() * 0.35, kind });
    }
    if (kind === "bolt") this.sparks.push({ x, y, bolt: true, age: 0, life: 0.14, ang: Math.random() * 6.28, kind });
  }

  stepSparks(dt) {
    // بالون مشحون: وميض كهربائي خفيف حول سطحه (يُرى بلا عدسة)
    for (const b of this.balloons) {
      if (!b.out || b.q <= 0 || b.held) continue;
      if (Math.random() < dt * (0.5 + b.q * 0.18)) {
        const a = Math.random() * Math.PI * 2;
        this.sparks.push({
          x: b.x + Math.cos(a) * b.r * 1.02,
          y: b.y + Math.sin(a) * b.r * 1.04,
          vx: Math.cos(a) * 24,
          vy: Math.sin(a) * 24 - 12,
          age: 0,
          life: 0.35,
          kind: "elec",
        });
      }
    }
    for (const s of this.sparks) {
      s.age += dt;
      if (!s.bolt) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 200 * dt;
        s.vx *= Math.exp(-3 * dt);
      }
    }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /* ---------- حالة التعليم ---------- */
  status() {
    let phase = "neutral";
    let anyRub = false;
    let stuckW = false;
    let stuckS = false;
    let attract = false;
    let q = 0;
    let repel = false;
    for (const b of this.balloons) {
      if (!b.out) continue;
      q = Math.max(q, b.q);
      if (b.rubbing) anyRub = true;
      if (b.stuck === "wall") stuckW = true;
      if (b.stuck === "sweater") stuckS = true;
      if (!b.held && !b.stuck && b.q > 0) attract = true;
    }
    if (this.balloons.every((b) => b.out && b.q > 0)) {
      const [a, c] = this.balloons;
      if (!a.stuck && !c.stuck && !a.held && !c.held && Math.hypot(a.x - c.x, a.y - c.y) < 280) repel = true;
    }
    if (anyRub) phase = "rubbing";
    else if (stuckW) phase = "wall";
    else if (stuckS) phase = "sweater";
    else if (repel) phase = "repel";
    else if (attract) phase = "attract";
    else if (q > 0) phase = "charged";
    return { phase, q, sweater: this.sweaterCharge };
  }
}

export { SWEATER_COLS, SWEATER_ROWS };
