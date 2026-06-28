/**
 * audio.js
 * نظام صوت كامل مُولَّد برمجياً (Web Audio API) - بدون أي ملفات mp3/wav خارجية
 * كل صوت = دالة تركّب موجات/ضوضاء/مرشحات لحظياً
 */

const SoundEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let isMuted = false;
  let ambientNodes = null;

  // منع تكرار صوت بسرعة مبالغ فيها (audio throttling)
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
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /** ضوضاء بيضاء قصيرة (أساس صوت الغطس والفقاعات) */
  function createNoiseBuffer(duration) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * صوت "غطس" (splash) - يُستخدم عند دخول الجسم في السائل بسرعة
   * يتركّب من: ضوضاء مرشّحة (تشبه رشّ الماء) + نغمة منخفضة قصيرة (الارتطام)
   * @param {number} intensity - 0 إلى 1 (حسب سرعة الاصطدام)
   */
  function playSplash(intensity = 0.6) {
    if (isMuted || !canPlay("splash", 180)) return;
    ensureContext();
    const now = ctx.currentTime;
    const clampedIntensity = Math.max(0.15, Math.min(1, intensity));

    // الطبقة 1: ضوضاء مرشّحة بفلتر تردد ينخفض (يحاكي صوت "شّش" للماء)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(0.4);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.35);
    noiseFilter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5 * clampedIntensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    // الطبقة 2: نغمة "ارتطام" منخفضة قصيرة (sine ينزلق للأسفل)
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(180 * clampedIntensity + 60, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.4 * clampedIntensity, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    thud.connect(thudGain);
    thudGain.connect(masterGain);

    noise.start(now);
    thud.start(now);
    noise.stop(now + 0.4);
    thud.stop(now + 0.2);
  }

  /** نقرة UI ناعمة (اختيار شكل/مادة/سائل) */
  function playClick() {
    if (isMuted || !canPlay("click", 60)) return;
    ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** نغمة "توازن/نجاح" ناعمة - تُشغَّل عند استقرار الجسم تماماً */
  function playSettleChime() {
    if (isMuted || !canPlay("chime", 1200)) return;
    ensureContext();
    const now = ctx.currentTime;

    // ثنائي نغمي هادئ (لا يشبه "فوز لعبة" صاخب، بل تأكيد هادئ)
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.55);
    });
  }

  /** فقاعة صغيرة فردية (تُستخدم بشكل متفرق أثناء الغطس) */
  function playBubble() {
    if (isMuted || !canPlay("bubble", 90)) return;
    ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const baseFreq = 300 + Math.random() * 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** تموّج سائل مستمر وخفيف جداً (ambient loop) - اختياري للتشغيل */
  function startAmbientRipple() {
    if (ambientNodes) return; // يعمل فعلاً
    ensureContext();

    const noise = ctx.createBufferSource();
    const buffer = createNoiseBuffer(2);
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = isMuted ? 0 : 0.025; // خفيف جداً جداً - خلفية فقط

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();

    ambientNodes = { noise, gain };
  }

  function stopAmbientRipple() {
    if (!ambientNodes) return;
    ambientNodes.noise.stop();
    ambientNodes = null;
  }

  function setMuted(muted) {
    isMuted = muted;
    if (ambientNodes) {
      ambientNodes.gain.gain.value = muted ? 0 : 0.025;
    }
  }

  return {
    playSplash,
    playClick,
    playSettleChime,
    playBubble,
    startAmbientRipple,
    stopAmbientRipple,
    setMuted,
    get muted() {
      return isMuted;
    },
  };
})();
