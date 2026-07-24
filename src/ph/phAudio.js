/**
 * phAudio.js — مؤثرات صوتية مُولّدة برمجياً (Web Audio API) لتجربة الأس
 * الهيدروجيني: صبّ ماء مستمر، قطرة القطّارة، نغمة "تعادل" عند بلوغ pH ٧،
 * ونقرة واجهة. بلا أي ملفات صوت خارجية (يعمل دون اتصال بالكامل).
 */

export const PhSound = (() => {
  let ctx = null;
  let masterGain = null;
  let isMuted = false;
  let pourNodes = null;
  let drainNodes = null;

  const lastPlayedAt = {};
  function canPlay(key, minIntervalMs) {
    const now = performance.now();
    if (!lastPlayedAt[key] || now - lastPlayedAt[key] > minIntervalMs) {
      lastPlayedAt[key] = now;
      return true;
    }
    return false;
  }

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function createNoiseBuffer(duration) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** صوت صبّ ماء مستمر (حلقة ضوضاء مُرشّحة) — يبدأ ويتوقف مع ضغط الحنفية */
  function startPour() {
    if (isMuted || pourNodes) return;
    ensureContext();
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(2);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    pourNodes = { noise, gain };
  }

  function stopPour() {
    if (!pourNodes) return;
    const { noise, gain } = pourNodes;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noise.stop(now + 0.15);
    pourNodes = null;
  }

  /** قطرة صغيرة (القطّارة) */
  function playDrip() {
    if (isMuted || !canPlay("drip", 70)) return;
    ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const base = 520 + Math.random() * 220;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.2, now + 0.07);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** نغمة "تعادل" ناعمة عند بلوغ pH ٧ */
  function playNeutralChime() {
    if (isMuted || !canPlay("chime", 1500)) return;
    ensureContext();
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t0 = now + i * 0.09;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.16, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  }

  /** صوت تصريف مستمر: ضوضاء مُرشّحة منخفضة (غرغرة خفيفة) تختلف عن صوت الصبّ */
  function startDrainSound() {
    if (isMuted || drainNodes) return;
    ensureContext();
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(2);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    filter.Q.value = 4;

    // مذبذب بطيء يعطي إحساس "غرغرة" التصريف
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    lfo.start();
    drainNodes = { noise, gain, lfo };
  }

  function stopDrainSound() {
    if (!drainNodes) return;
    const { noise, gain, lfo } = drainNodes;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noise.stop(now + 0.15);
    lfo.stop(now + 0.15);
    drainNodes = null;
  }

  function playClick() {
    if (isMuted || !canPlay("click", 50)) return;
    ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function setMuted(muted) {
    isMuted = muted;
    if (muted) {
      stopPour();
      stopDrainSound();
    }
  }

  return {
    startPour,
    stopPour,
    startDrainSound,
    stopDrainSound,
    playDrip,
    playNeutralChime,
    playClick,
    setMuted,
    get muted() {
      return isMuted;
    },
  };
})();
