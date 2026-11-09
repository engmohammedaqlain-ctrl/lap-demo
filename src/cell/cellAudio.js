/**
 * cellAudio.js — صوت تجربة «رحلة داخل الخلية».
 *  - المؤثرات اللحظية (نقر، اختيار، غوص، نبضة، فرقعة، صح/خطأ) من مكتبة SFX
 *    الاحترافية عبر audio/sfx.js (ملفات مضغوطة تعمل دون اتصال).
 *  - الأصوات المستمرة فقط مُولّدة رياضياً (Web Audio): طنين الخلية الخافت
 *    startAmbient، وهسيس الزووم updateZoom الذي تتبع شدّته سرعة التكبير.
 */
import { play, setMuted as setSfxMuted } from "../audio/sfx.js";

class CellSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.ambient = null;
    this._last = {};
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
  }

  _resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    setSfxMuted(m);
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (m) {
      this.stopAmbient();
      this.stopZoom();
    }
  }

  /** كبح التكرار السريع لصوت معيّن */
  _gate(key, ms) {
    const now = performance.now();
    if (this._last[key] && now - this._last[key] < ms) return false;
    this._last[key] = now;
    return true;
  }

  startAmbient() {
    this._ensure();
    if (!this.ctx || this.ambient || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, t + 1.2);
    const o1 = this.ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 68;
    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 102;
    // اهتزاز بطيء يعطي إحساس "حياة"
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 0.18;
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(g.gain);
    o1.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.ambient = { o1, o2, lfo, g };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { o1, o2, lfo, g } = this.ambient;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    try {
      o1.stop(t + 0.45);
      o2.stop(t + 0.45);
      lfo.stop(t + 0.45);
    } catch {
      /* ignore */
    }
    this.ambient = null;
  }

  /** whoosh مستمر أثناء الزوم — شدّته وترددّه يتبعان سرعة التكبير */
  updateZoom(speed) {
    this._ensure();
    if (!this.ctx || this.muted) {
      if (this.whoosh) this.stopZoom();
      return;
    }
    const s = Math.min(1, speed);
    if (s < 0.02) {
      if (this.whoosh) this.stopZoom();
      return;
    }
    this._resume();
    const t = this.ctx.currentTime;
    if (!this.whoosh) {
      const src = this.ctx.createBufferSource();
      const n = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      src.buffer = buf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 600;
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.whoosh = { src, bp, g };
    }
    const { bp, g } = this.whoosh;
    g.gain.setTargetAtTime(0.02 + s * 0.14, t, 0.08);
    bp.frequency.setTargetAtTime(400 + s * 2600, t, 0.08);
  }
  stopZoom() {
    if (!this.whoosh || !this.ctx) return;
    const { src, g } = this.whoosh;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.1);
    try {
      src.stop(t + 0.4);
    } catch {
      /* ignore */
    }
    this.whoosh = null;
  }

  /** تحديد عضيّ: نغمة اختيار نظيفة */
  playFantasySelect() {
    play("select", { volume: 0.9 });
  }

  /** الغوص داخل عضيّ: همسة انتقال واسعة */
  playDiveIn() {
    play("cell_iris", { volume: 0.85, throttle: 300 });
  }

  /** عبور حدّ المجهر: صاعدة درامية */
  playDive() {
    play("cell_riser", { volume: 0.9, throttle: 600 });
  }

  /** نبضة طاقة (ATP) */
  playPulse() {
    play("tick", { volume: 0.55, throttle: 120, jitter: 0.12 });
  }

  /** انفصال حويصلة / بناء حلقة بروتين */
  playPop() {
    play("cell_pop", { volume: 0.7, throttle: 90, jitter: 0.1 });
  }

  playSelect() {
    play("select", { volume: 0.85 });
  }

  playClick() {
    play("click");
  }

  playCorrect() {
    play("success", { volume: 0.9 });
    play("sparkle", { volume: 0.5, delay: 0.12 });
  }

  /** خطأ في التحدّي: نغمة لطيفة غير عقابية */
  playWrong() {
    play("back", { volume: 0.7 });
  }
}

export const CellSound = new CellSoundEngine();
