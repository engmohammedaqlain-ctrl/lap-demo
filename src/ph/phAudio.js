/**
 * phAudio.js — مؤثرات صوتية مُولّدة برمجياً (Web Audio API) لتجربة الأس
 * الهيدروجيني: صبّ ماء مستمر، قطرة القطّارة، نغمة "تعادل" عند بلوغ pH ٧،
 * ونقرة واجهة، وسكب أنبوب الاختبار في الكأس مُولّد بالكامل عبر Web Audio.
 */

export const PhSound = (() => {
  let ctx = null;
  let masterGain = null;
  let isMuted = false;
  let pourNodes = null;
  let drainNodes = null;
  let pouredNodes = null;

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

  /** سكب أنبوب الاختبار داخل الكأس الكبير — مُولّد: دفقة ماء + فقاعات خفيفة */
  function playPouredIntoWater() {
    if (isMuted || !canPlay("poured-into-water", 250)) return;
    ensureContext();
    const now = ctx.currentTime;
    const dur = 0.85;

    // دفقة الماء: ضوضاء عريضة يمرّرها مرشّح ينزل تدريجياً كأنّ السائل يستقرّ
    const splash = ctx.createBufferSource();
    splash.buffer = createNoiseBuffer(dur + 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + dur);

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.0001, now);
    splashGain.gain.exponentialRampToValueAtTime(0.16, now + 0.06);
    splashGain.gain.setValueAtTime(0.16, now + dur * 0.55);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    splash.connect(filter);
    filter.connect(splashGain);
    splashGain.connect(masterGain);
    splash.start(now);
    splash.stop(now + dur + 0.05);

    // فقاعات: عدّة نغمات جيبية قصيرة تصعد بترددها لإيحاء فقاعات الماء
    const bubbles = [];
    const bubbleCount = 5;
    for (let i = 0; i < bubbleCount; i++) {
      const t0 = now + 0.1 + Math.random() * (dur - 0.2);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const base = 360 + Math.random() * 320;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 1.8, t0 + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.14);
      bubbles.push(osc);
    }

    pouredNodes = { splash, splashGain, bubbles };
  }

  function stopPoured() {
    if (!pouredNodes) return;
    const { splash, splashGain, bubbles } = pouredNodes;
    const now = ctx.currentTime;
    splashGain.gain.cancelScheduledValues(now);
    splashGain.gain.setValueAtTime(splashGain.gain.value, now);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    try {
      splash.stop(now + 0.1);
      bubbles.forEach((osc) => osc.stop(now + 0.1));
    } catch {
      // قد تكون بعض العُقد قد توقّفت تلقائياً؛ نتجاهل الخطأ.
    }
    pouredNodes = null;
  }

  /** قطرة صغيرة (القطّارة) */
  function playDrip() {
    if (isMuted || !canPlay("drip", 150)) return;
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

  /** صوت تعبئة قصير: صعود ناعم يوحي بارتفاع السائل داخل الأنبوب */
  function playFill() {
    if (isMuted || !canPlay("fill", 180)) return;
    ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.28);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  /** طقّة زجاجية خفيفة عند إمساك الأنبوب */
  function playPickUp() {
    if (isMuted || !canPlay("pickup", 100)) return;
    ensureContext();
    const now = ctx.currentTime;
    [1320, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1 + i * 0.03);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
    });
  }

  /** طقّة أخفض عند إعادة الأنبوب إلى الحامل */
  function playPutDown() {
    if (isMuted || !canPlay("putdown", 100)) return;
    ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  function setMuted(muted) {
    isMuted = muted;
    if (muted) {
      stopPour();
      stopDrainSound();
      stopPoured();
    }
  }

  return {
    startPour,
    stopPour,
    playPouredIntoWater,
    startDrainSound,
    stopDrainSound,
    playDrip,
    playNeutralChime,
    playClick,
    playFill,
    playPickUp,
    playPutDown,
    setMuted,
    get muted() {
      return isMuted;
    },
  };
})();
