/**
 * phAudio.js — أصوات تجربة الأس الهيدروجيني من مكتبة المؤثرات الاحترافية
 * (src/audio/sfx.js): صبّ ماء مستمر (حلقة سلسة)، قطرة القطّارة، نغمة
 * "تعادل"، ونقرة واجهة. الواجهة البرمجية كما كانت حتى لا تتغير الاستدعاءات.
 */
import { play, loop, setMuted as setSfxMuted } from "../audio/sfx.js";

export const PhSound = (() => {
  let pour = null;
  let drain = null;

  return {
    startPour() {
      if (pour) return;
      pour = loop("pour_loop", { volume: 0.8 });
    },
    stopPour() {
      pour?.stop();
      pour = null;
    },
    startDrainSound() {
      if (drain) return;
      drain = loop("pour_loop", { volume: 0.7, rate: 0.82 });
    },
    stopDrainSound() {
      drain?.stop();
      drain = null;
    },
    playDrip() {
      play("drop", { volume: 0.7, throttle: 260, jitter: 0.12 });
    },
    playNeutralChime() {
      play("success", { volume: 0.7 });
      play("sparkle", { volume: 0.5, delay: 0.1 });
    },
    playClick() {
      play("click");
    },
    setMuted(m) {
      setSfxMuted(m);
      if (m) {
        pour = null;
        drain = null;
      }
    },
  };
})();
