/**
 * staticAudio.js — محرّك صوت برمجي (Web Audio) لتجربة الكهرباء الساكنة.
 * كل الأصوات مُولّدة رياضياً بلا ملفات، فتعمل دون اتصال:
 *  - startRub/stopRub: حفيف الفرك (ضجيج ممرّر) طالما يُفرك البالون بالسترة.
 *  - playZap: شرارة قصيرة عند انتقال إلكترون.
 *  - playStick: طقّة سكون كهربائي عند التصاق البالون.
 *  - playWhoosh: اندفاع البالون بعد الإفلات.
 *  - playClick: نقرة أزرار.
 */
class StaticSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.rubNodes = null;
    this._lastZap = 0;
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

  _noiseBuffer(seconds = 1) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (m) this.stopRub();
  }

  startRub() {
    this._ensure();
    if (!this.ctx || this.rubNodes) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 0.05);
    // اهتزاز طفيف يعطي إحساس الاحتكاك الحيّ
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 22;
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(bp.frequency);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.rubNodes = { src, g, lfo };
  }

  stopRub() {
    if (!this.rubNodes || !this.ctx) return;
    const { src, g, lfo } = this.rubNodes;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.08);
    try {
      src.stop(t + 0.1);
      lfo.stop(t + 0.1);
    } catch {
      /* ignore */
    }
    this.rubNodes = null;
  }

  playZap() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._lastZap < 0.04) return; // لا تُغرق المسرح بالشرارات
    this._lastZap = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(hp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.12);
  }

  playStick() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.2);
    // شرارة مرافقة
    this.playZap();
  }

  playWhoosh() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + 0.3);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.4);
  }

  playClick() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(760, now + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.1);
  }
}

export const StaticSound = new StaticSoundEngine();
