/**
 * cellAudio.js — صوت تجربة «رحلة داخل الخلية»، كله من مكتبة SFX الاحترافية عبر
 * audio/sfx.js (ملفات مضغوطة تعمل دون اتصال)، بلا أي توليد رياضي:
 *  - المؤثرات اللحظية: نقر، اختيار، غوص، نبضة، فرقعة، صح/خطأ.
 *  - صوتان مستمران بحلقة سلسة: جوّ مائي خافت للخلية (cell_amb) ووشّة هواء تتبع
 *    سرعة الزووم (cell_zoom): شدّتها تزيد مع التكبير السريع وتختفي عند الثبات.
 */
import { play, loop, setMuted as setSfxMuted } from "../audio/sfx.js";

class CellSoundEngine {
  constructor() {
    this.muted = false;
    this.amb = null;
    this.zoomLoop = null;
  }

  setMuted(m) {
    this.muted = m;
    setSfxMuted(m);
    if (m) {
      this.amb = null;
      this.zoomLoop = null;
    }
  }

  startAmbient() {
    if (this.muted || (this.amb && !this.amb.dead)) return;
    this.amb = loop("cell_amb", { volume: 0.3 });
    if (this.amb.dead) this.amb = null; // الملفات لم تُحمَّل بعد: نعيد المحاولة لاحقاً
  }

  stopAmbient() {
    this.amb?.stop();
    this.amb = null;
  }

  /** وشّة مستمرة أثناء الزوم — شدّتها تتبع سرعة التكبير */
  updateZoom(speed) {
    const s = Math.min(1, speed);
    if (this.muted || s < 0.02) {
      this.stopZoom();
      return;
    }
    if (!this.zoomLoop) {
      this.zoomLoop = loop("cell_zoom", { volume: 0.02 });
      if (this.zoomLoop.dead) {
        this.zoomLoop = null;
        return;
      }
    }
    this.zoomLoop.setVolume(0.04 + s * 0.5);
  }

  stopZoom() {
    this.zoomLoop?.stop();
    this.zoomLoop = null;
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
