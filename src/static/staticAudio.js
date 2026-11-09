/**
 * staticAudio.js — أصوات تجربة الكهرباء الساكنة من مكتبة المؤثرات الاحترافية
 * (src/audio/sfx.js): فرك البالون بالقماش (حلقة سلسة)، شرارة، التصاق، وشّة،
 * ونقرة واجهة. الواجهة البرمجية كما كانت.
 */
import { play, loop, setMuted as setSfxMuted } from "../audio/sfx.js";

class StaticSoundEngine {
  constructor() {
    this.rub = null;
  }

  setMuted(m) {
    setSfxMuted(m);
    if (m) this.rub = null;
  }

  /** البالون المشحون يطفو: بلا صوت مستمر (يكفي التفاعل البصري) */
  startFloat() {}
  stopFloat() {}

  startRub() {
    if (this.rub) return;
    this.rub = loop("rub_loop", { volume: 0.85 });
  }

  stopRub() {
    this.rub?.stop();
    this.rub = null;
  }

  playZap() {
    play("zap", { volume: 0.55, throttle: 140, jitter: 0.12 });
  }

  playStick() {
    play("grab", { volume: 0.9 });
    play("squeak", { volume: 0.35, delay: 0.04, throttle: 200 });
  }

  playWhoosh() {
    play("whoosh", { volume: 0.7 });
  }

  playClick() {
    play("click");
  }
}

export const StaticSound = new StaticSoundEngine();
