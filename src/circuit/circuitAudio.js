/**
 * circuitAudio.js — نظام المؤثرات الصوتية لمختبر الدوائر الكهربائية
 * مبني على Web Audio API ويعمل بالكامل دون ملفات صوتية خارجية ليعمل دون اتصال.
 */

class CircuitAudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.continuityOsc = null;
    this.continuityGain = null;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted && this.continuityOsc) {
      this.setContinuityBuzzer(false);
    }
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(360, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch {
      // Ignore audio errors
    }
  }

  playSnap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore audio errors
    }
  }

  playTrash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.09);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore audio errors
    }
  }

  playShort() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.18);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignore audio errors
    }
  }

  setContinuityBuzzer(state) {
    if (this.muted) {
      state = false;
    }
    this.init();
    if (!this.ctx) return;

    try {
      if (state && !this.continuityOsc) {
        this.continuityOsc = this.ctx.createOscillator();
        this.continuityGain = this.ctx.createGain();

        this.continuityOsc.type = "sine";
        this.continuityOsc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        this.continuityGain.gain.setValueAtTime(0.035, this.ctx.currentTime);

        this.continuityOsc.connect(this.continuityGain);
        this.continuityGain.connect(this.ctx.destination);
        this.continuityOsc.start();
      } else if (!state && this.continuityOsc) {
        this.continuityOsc.stop();
        this.continuityOsc.disconnect();
        this.continuityGain.disconnect();
        this.continuityOsc = null;
        this.continuityGain = null;
      }
    } catch {
      // Ignore audio errors
    }
  }
}

export const CircuitSound = new CircuitAudioSystem();
