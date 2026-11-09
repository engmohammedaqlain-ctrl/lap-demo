/**
 * engine.js — فيزياء الطفو (مقطع جانبي، وحدات SI).
 * - مستوى السائل يُحسب من حجم الماء الثابت + الحجم المغمور لكل الأجسام
 *   (فيرتفع الماء فعلاً عند الغمر — إزاحة أرخميدس).
 * - الطفو = كثافة السائل × الحجم المغمور × g ، والوزن = كتلة × g.
 * - سطح الماء حقل موجات بسيط؛ رذاذ وفقاعات جسيمات.
 */
import { G, TANK_W, TANK_AREA, WATER_START, LIQUIDS, OBJECTS, halfH, halfW, volumeOf, submergedOf } from "./catalog.js";

const TIME_SCALE = 0.72; // إبطاء لطيف ليُرى الفعل بوضوح
const WALL_T = 0.012;
export const TABLE_Y = -0.03; // سطح الطاولة تحت أرضية الخزان
export const MAX_BODIES = 4;
const N_COLS = 128;

let nextId = 1;

function dampingK(viscosity) {
  const ratio = Math.max(1, viscosity / 0.001);
  return 2.4 * (1 + Math.log10(ratio) * 1.5);
}

export class World {
  constructor() {
    this.tankH = 0.75;
    this.liquid = { ...LIQUIDS.water };
    this.liquidKey = "water";
    this.bodies = [];
    this.drops = [];
    this.bubbles = [];
    this.confetti = [];
    this.events = [];
    this.h = new Float32Array(N_COLS);
    this.v = new Float32Array(N_COLS);
    this.time = 0;
    this.reset();
  }

  reset() {
    this.Vw = WATER_START * TANK_AREA;
    this.bodies = [];
    this.drops = [];
    this.bubbles = [];
    this.confetti = [];
    this.level = WATER_START;
    this.level0 = WATER_START;
    this.h.fill(0);
    this.v.fill(0);
  }

  setTankHeight(m) {
    this.tankH = m;
  }

  setLiquid(key, customDensity) {
    const base = LIQUIDS[key];
    this.liquidKey = key;
    this.liquid = { ...base };
    if (key === "custom") {
      const d = customDensity ?? 1000;
      this.liquid.density = d;
      // اللون يتدرّج من الخفيف (أزرق مخضر) إلى الثقيل (كهرماني)
      const t = Math.max(0, Math.min(1, (d - 500) / 2500));
      const lerp = (a, b) => Math.round(a + (b - a) * t);
      this.liquid.color = [lerp(110, 190), lerp(200, 120), lerp(200, 90)];
      this.liquid.deep = [lerp(30, 110), lerp(110, 60), lerp(130, 40)];
    }
    // تحريك السطح عند تغيير السائل
    this.impulse(TANK_W / 2, 0.06, 0.3);
  }

  /** ينشئ جسماً: spec = مفتاح مادة من OBJECTS أو {…مواصفات} */
  spawn(key, x, y, opts = {}) {
    const spec = opts.spec || OBJECTS[key];
    const o = { ...spec };
    const density = opts.density ?? spec.density;
    const vol = volumeOf(o);
    const b = {
      id: nextId++,
      key,
      o,
      density,
      vol,
      mass: density * vol,
      x,
      y,
      vx: 0,
      vy: 0,
      dragging: !!opts.dragging,
      scale: opts.scale ?? 1,
      angle: 0,
      avel: 0,
      selected: false,
      sub: { v: 0, cy: 0, hs: 0 },
      fg: 0,
      fb: 0,
      mystery: opts.mystery || null,
      wasSubmerged: false,
      born: this.time,
    };
    this.bodies.push(b);
    return b;
  }

  remove(b) {
    this.bodies = this.bodies.filter((x) => x !== b);
  }

  inTank(b) {
    return b.x > 0 && b.x < TANK_W;
  }

  bringToFront(b) {
    this.bodies = this.bodies.filter((x) => x !== b).concat(b);
  }

  /* ---------- مستوى الماء ---------- */
  computeLevel() {
    const A = TANK_AREA;
    const inside = this.bodies.filter((b) => this.inTank(b));
    const volAt = (L) => {
      let s = 0;
      for (const b of inside) s += submergedOf(b.o, b.y, L).v;
      return s;
    };
    const f = (L) => L * A - volAt(L) - this.Vw;
    if (f(this.tankH) < 0) {
      // فيض: الماء يتجاوز حافة الخزان
      const spill = this.Vw - (this.tankH * A - volAt(this.tankH));
      if (spill > 0) {
        this.Vw -= spill;
        this.events.push({ type: "spill", power: Math.min(1, spill * 40) });
        for (let i = 0; i < 14; i++) {
          const left = Math.random() < 0.5;
          this.drops.push({
            x: left ? -0.02 : TANK_W + 0.02,
            y: this.tankH,
            vx: (left ? -1 : 1) * (0.4 + Math.random() * 0.8),
            vy: 0.4 + Math.random() * 0.8,
            r: 2 + Math.random() * 2,
            life: 1.4,
          });
        }
      }
      this.level = this.tankH;
    } else {
      let lo = 0;
      let hi = this.tankH;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      this.level = (lo + hi) / 2;
    }
    this.level0 = this.Vw / A;
  }

  surfaceAt(xm) {
    const t = Math.max(0, Math.min(1, xm / TANK_W)) * (N_COLS - 1);
    const i = Math.floor(t);
    const f = t - i;
    const h = this.h[i] * (1 - f) + this.h[Math.min(N_COLS - 1, i + 1)] * f;
    return this.level + h;
  }

  impulse(xm, power, width = 0.08) {
    const center = (xm / TANK_W) * (N_COLS - 1);
    const sigma = Math.max(1.2, (width / TANK_W) * (N_COLS - 1));
    for (let i = 0; i < N_COLS; i++) {
      const d = (i - center) / sigma;
      if (Math.abs(d) < 3.2) this.v[i] += power * Math.exp(-d * d) * 0.7;
    }
  }

  /* ---------- خطوة محاكاة ---------- */
  step(dtRaw) {
    const dt = Math.min(dtRaw, 0.05) * TIME_SCALE;
    this.time += dtRaw;
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h);
    this.stepWaves(dt);
    this.stepParticles(dtRaw);
  }

  substep(h) {
    this.computeLevel();
    const L = this.level;
    const rho = this.liquid.density;
    const kFluid = dampingK(this.liquid.viscosity);

    for (const b of this.bodies) {
      const o = b.o;
      const inT = this.inTank(b);
      const s = inT ? submergedOf(o, b.y, L) : { v: 0, cy: b.y - halfH(o), hs: 0 };
      b.sub = s;
      b.fg = b.mass * G;
      b.fb = rho * G * s.v;
      if (b.dragging) continue;

      const frac = Math.min(1, s.v / b.vol);
      const kLin = 0.35 + (kFluid - 0.35) * frac;
      const kQuad = 1.2 * frac;
      let ay = (b.fb - b.fg) / b.mass - kLin * b.vy - kQuad * Math.abs(b.vy) * b.vy;
      const ax = -kLin * 0.8 * b.vx - kQuad * Math.abs(b.vx) * b.vx;
      b.vy += ay * h;
      b.vx += ax * h;
      b.x += b.vx * h;
      b.y += b.vy * h;

      // انحناء لطيف مع الحركة الأفقية (يعطي إحساس الوزن)
      const targetAngle = Math.max(-0.2, Math.min(0.2, b.vx * 0.12)) * (o.shape === "sphere" ? 0 : 1);
      b.avel += (targetAngle - b.angle) * 30 * h - b.avel * 5 * h;
      b.angle += b.avel * h;
    }

    this.collide();

    // أحداث الدخول/الخروج من السطح (رذاذ وموجات)
    for (const b of this.bodies) {
      const bottom = b.y - halfH(b.o);
      const top = b.y + halfH(b.o);
      const touching = this.inTank(b) && bottom < L && top > L;
      if (touching && !b.wasSubmerged && Math.abs(b.vy) > 0.15 && !b.dragging) {
        this.splash(b, Math.abs(b.vy));
      }
      b.wasSubmerged = touching || (this.inTank(b) && top <= L);
    }
  }

  splash(b, speed) {
    const w = halfW(b.o) * 2;
    const x = b.x;
    const power = Math.min(1, speed * 0.45);
    this.impulse(x, -speed * w * 0.9 + 0, Math.max(0.05, w * 0.6));
    const count = Math.round(6 + Math.min(26, speed * 16 * (0.6 + w * 2)));
    for (let i = 0; i < count; i++) {
      const dir = (Math.random() - 0.5) * 2;
      this.drops.push({
        x: x + dir * w * 0.5,
        y: this.level + 0.005,
        vx: dir * (0.25 + speed * 0.35) + (Math.random() - 0.5) * 0.2,
        vy: 0.5 + Math.random() * speed * 0.7,
        r: 1.6 + Math.random() * 2.4,
        life: 1.2,
      });
    }
    // فقاعات تتبع الجسم للأسفل
    const nb = Math.round(3 + speed * 5);
    for (let i = 0; i < nb; i++) {
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * w,
        y: this.level - Math.random() * halfH(b.o),
        vy: 0.12 + Math.random() * 0.2,
        r: 1.5 + Math.random() * 3,
        life: 2.2,
        wob: Math.random() * 6,
      });
    }
    this.events.push({ type: "splash", power, x, mass: b.mass, w });
  }

  collide() {
    const L = this.level;
    const bs = this.bodies;
    for (const b of bs) {
      const o = b.o;
      const hw = halfW(o);
      const hh = halfH(o);
      // جدران الخزان (تُتجاوز فقط من فوق الحافة)
      if (b.y - hh < this.tankH) {
        const c = b.x;
        if (c <= 0) b.x = Math.min(c, -hw - WALL_T / 2);
        else if (c < TANK_W / 2) b.x = Math.max(c, hw + WALL_T / 2);
        else if (c < TANK_W) b.x = Math.min(c, TANK_W - hw - WALL_T / 2);
        else b.x = Math.max(c, TANK_W + hw + WALL_T / 2);
        if (b.x !== c) b.vx = 0;
      }
      // الأرض (أرضية الخزان أو الطاولة)
      const floor = this.inTank(b) ? 0 : TABLE_Y;
      if (b.y - hh < floor) {
        b.y = floor + hh;
        if (b.vy < 0) {
          const hard = Math.abs(b.vy);
          if (!b.dragging && hard > 0.35 && !b.hitFloorAt) {
            this.events.push({ type: "thud", power: Math.min(1, hard * 0.3), key: b.mystery ? b.mystery.key : b.key });
          }
          b.vy = hard > 0.6 && b.sub.v / b.vol < 0.2 ? hard * 0.18 : 0;
        }
        b.vx *= 0.96;
      }
      void L;
    }

    // تصادم الأجسام ببعضها
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const c = bs[j];
        const aw = halfW(a.o);
        const ah = halfH(a.o);
        const cw = halfW(c.o);
        const ch = halfH(c.o);
        const ox = aw + cw - Math.abs(a.x - c.x);
        const oy = ah + ch - Math.abs(a.y - c.y);
        if (ox <= 0 || oy <= 0) continue;
        const aFixed = a.dragging;
        const cFixed = c.dragging;
        if (aFixed && cFixed) continue;
        const narrow = ox < 0.35 * Math.min(aw, cw) * 2;
        if (oy < ox && !narrow) {
          const upper = a.y >= c.y ? a : c;
          const lower = upper === a ? c : a;
          const upFixed = upper.dragging;
          const loFixed = lower.dragging;
          if (!upFixed && !loFixed) {
            upper.y += oy * 0.5;
            lower.y -= oy * 0.5;
          } else if (!upFixed) upper.y += oy;
          else lower.y -= oy;
          if (!upper.dragging && upper.vy < 0) upper.vy = 0;
          if (!lower.dragging && lower.vy > 0) lower.vy = 0;
        } else {
          const dir = a.x < c.x ? -1 : 1;
          if (!aFixed && !cFixed) {
            a.x += dir * ox * 0.5;
            c.x -= dir * ox * 0.5;
            const t = a.vx;
            a.vx = c.vx * 0.5;
            c.vx = t * 0.5;
          } else if (!aFixed) a.x += dir * ox;
          else c.x -= dir * ox;
        }
      }
    }
  }

  stepWaves(dt) {
    const N = N_COLS;
    const K = 5200;
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    const { h: H, v: V } = this;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < N; i++) {
        const l = H[Math.max(0, i - 1)];
        const r = H[Math.min(N - 1, i + 1)];
        V[i] += (l + r - 2 * H[i]) * K * h;
        V[i] *= 1 - 1.8 * h;
      }
      for (let i = 0; i < N; i++) {
        H[i] += V[i] * h;
        H[i] *= 1 - 0.35 * h; // يعود السطح إلى مستواه
      }
    }
  }

  stepParticles(dt) {
    for (const p of this.drops) {
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.y < this.surfaceAt(Math.max(0, Math.min(TANK_W, p.x))) && p.x > 0 && p.x < TANK_W && p.vy < 0) {
        p.life = 0;
        this.impulse(p.x, -0.012, 0.02);
      }
      if (p.y < TABLE_Y) p.life = 0;
    }
    this.drops = this.drops.filter((p) => p.life > 0);

    for (const b of this.bubbles) {
      b.y += b.vy * dt * (1 + (b.r / 6));
      b.wob += dt * 6;
      b.x += Math.sin(b.wob) * 0.0006;
      b.life -= dt;
      if (b.y >= this.level) b.life = 0;
    }
    this.bubbles = this.bubbles.filter((b) => b.life > 0).slice(-90);

    for (const c of this.confetti) {
      c.vy -= 3.2 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0);
  }

  celebrate(x, y) {
    const colors = ["#1b7340", "#e8b923", "#d64545", "#2b7de0", "#9b59b6", "#f08a24"];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.6;
      this.confetti.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.abs(Math.sin(a)) * sp + 0.8,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length],
        life: 2.4 + Math.random() * 0.8,
        w: 0.012 + Math.random() * 0.012,
      });
    }
  }

  /** حقن فقاعات تلقائية: الجليد والفولاذ المغمور يتركان فقاعات صغيرة أحياناً */
  ambient(dt) {
    for (const b of this.bodies) {
      if (b.sub.v > 0 && Math.abs(b.vy) > 0.25 && Math.random() < dt * 12) {
        this.bubbles.push({
          x: b.x + (Math.random() - 0.5) * halfW(b.o) * 1.6,
          y: b.y,
          vy: 0.14 + Math.random() * 0.2,
          r: 1.2 + Math.random() * 2.4,
          life: 2,
          wob: Math.random() * 6,
        });
      }
    }
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
