/**
 * device.js — طبقة "وضع اللعبة" على الجوال: كشف الجهاز واتجاهه، ملء الشاشة،
 * قفل الاتجاه الأفقي، منع خمول الشاشة، واهتزاز لمسي خفيف.
 * الخصائص data-phone / data-orient على <html> هي ما تعتمد عليه mobile.css.
 */
import { useEffect, useState } from "react";

const root = document.documentElement;

function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { phone: Math.min(w, h) <= 560, landscape: w > h };
}

function apply() {
  const { phone, landscape } = measure();
  root.dataset.phone = phone ? "1" : "0";
  root.dataset.orient = landscape ? "landscape" : "portrait";
}

let started = false;
export function initDevice() {
  if (started) return;
  started = true;
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  // iOS: منع تكبير الإيماءة (pinch) الذي يتجاهله user-scalable=no
  ["gesturestart", "gesturechange"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false })
  );
  // منع قائمة الضغط المطوّل على الصور/اللوحات داخل التجارب
  document.addEventListener("contextmenu", (e) => {
    if (root.dataset.phone === "1" && !(e.target instanceof HTMLInputElement)) e.preventDefault();
  });
}

export function useDevice() {
  const [d, setD] = useState(measure);
  useEffect(() => {
    const on = () => setD(measure());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return d;
}

/** اهتزاز لمسي قصير (يُتجاهل حيث لا يُدعم). */
export function haptic(ms = 12) {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

export const canFullscreen = () => !!document.documentElement.requestFullscreen;

/** يُستدعى من لمسة المستخدم (بطاقة التجربة): ملء الشاشة + قفل أفقي. */
export async function enterGame({ landscape }) {
  if (!measure().phone) return;
  try {
    if (!document.fullscreenElement && canFullscreen()) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    /* ignore */
  }
  if (landscape) {
    try {
      await screen.orientation?.lock?.("landscape");
    } catch {
      /* غير مدعوم (iOS) — تظهر رسالة التدوير */
    }
  }
}

export function leaveGame() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
}

/** يبقي الشاشة مضاءة أثناء التجربة. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock.release().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    const onVis = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
