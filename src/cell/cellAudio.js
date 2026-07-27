/**
 * cellAudio.js — محرّك صوت برمجي (Web Audio) لتجربة «رحلة داخل الخلية».
 * كل الأصوات مُولّدة رياضياً بلا ملفات، فتعمل دون اتصال:
 *  - startAmbient/stopAmbient: طنين حيويّ خافت داخل الخلية (طبقتا أوسسيلاتور).
 *  - playDive: تصاعد صوتي درامي للحظة تجاوز حدّ المجهر.
 *  - playPulse: نبضة طاقة (ATP) للميتوكوندريا.
 *  - playPop: انفصال حويصلة من جولجي / بناء حلقة بروتين.
 *  - playSelect: توهّج اختيار عضي.
 *  - playClick: نقرة أزرار.
 *  - playCorrect/playWrong: تغذية راجعة لطيفة في وضع التحدّي (بلا عقاب).
 */
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

  /** تحديد "خيالي عالمي" — رنين بلّوري متصاعد + انتفاخ عكسي */
  playFantasySelect() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    // أربتيج بلّوري
    [660, 880, 1320, 1760].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const s = t + i * 0.05;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.09, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.55);
    });
    // انتفاخ عكسي (shimmer swell)
    const src = this.ctx.createBufferSource();
    const n = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (i / n);
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(0.08, t + 0.35);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(hp).connect(g2).connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
  }

  /** طقّة استقرار الغطاء الزجاجي على الشريحة + رنين خفيف (نهاية تحضير العيّنة) */
  playSlideClink() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    // طقّة زجاج (نقرتان قصيرتان حادّتان)
    [0, 0.06].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 1600 - i * 300;
      const g = this.ctx.createGain();
      const s = t + d;
      g.gain.setValueAtTime(0.11, s);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.07);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.08);
    });
    // رنين بلّوري خفيف يتلاشى
    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(2200, t + 0.05);
    o2.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.05, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o2.connect(g2).connect(this.master);
    o2.start(t + 0.05);
    o2.stop(t + 0.46);
  }

  /** رنين الغوص داخل عضيّ */
  playDiveIn() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.72);
    this.playFantasySelect();
  }

  playDive() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 1.1);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(4000, t + 1.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.45);
    // "انفجار تفاصيل": رشقة ضجيج ناعمة عند الوصول
    const src = this.ctx.createBufferSource();
    const n = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 1.0);
    g2.gain.linearRampToValueAtTime(0.1, t + 1.15);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    src.connect(bp).connect(g2).connect(this.master);
    src.start(t + 1.0);
    src.stop(t + 1.6);
  }

  playPulse() {
    this._ensure();
    if (!this.ctx || this.muted || !this._gate("pulse", 120)) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.18);
  }

  playPop() {
    this._ensure();
    if (!this.ctx || this.muted || !this._gate("pop", 90)) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }

  playSelect() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.22);
  }

  playClick() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  playCorrect() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const s = t + i * 0.1;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.11, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.3);
    });
  }

  /** خطأ في التحدّي: نغمة لطيفة غير عقابية (لا هبوط حادّ محبِط) */
  playWrong() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(300, t);
    o.frequency.linearRampToValueAtTime(250, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.24);
  }
}

export const CellSound = new CellSoundEngine();
