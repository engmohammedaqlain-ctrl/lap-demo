/**
 * budget.js — سقف صرف صارم لخدمات xAI (محادثة Grok + صوت Grok).
 * كل عملية مدفوعة تُسجَّل بالدولار في .banfoush-cache/usage.json، وأي طلب
 * يتجاوز السقف الأسبوعي أو اليومي يُرفض فيعود بنفوش لدماغه المحفوظ وصوت
 * المتصفح المجاني. الافتراضي: ١٫٩ دولار أسبوعياً و٠٫٤ دولار يومياً.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DAY = 24 * 60 * 60 * 1000;

/** أسعار xAI (نوفمبر ٢٠٢٦): الصوت ١٥$ لكل مليون حرف، grok-4.20 ١٫٢٥$/٢٫٥$ لكل مليون توكن. */
export const PRICE = {
  ttsPerChar: 15 / 1e6,
  inPerToken: 1.25 / 1e6,
  outPerToken: 2.5 / 1e6,
};

export function createBudget(root, { weeklyUsd = 1.9, dailyUsd = 0.4 } = {}) {
  const dir = join(root, ".banfoush-cache");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "usage.json");
  let entries = [];
  try {
    entries = JSON.parse(readFileSync(file, "utf8")).entries || [];
  } catch {
    /* أول تشغيل */
  }

  const prune = () => {
    const t = Date.now();
    entries = entries.filter(([ts]) => t - ts < 7 * DAY);
  };
  const sum = (ms) => {
    const t = Date.now();
    return entries.reduce((a, [ts, usd]) => (t - ts < ms ? a + usd : a), 0);
  };

  return {
    canSpend(usd = 0) {
      prune();
      return sum(7 * DAY) + usd <= weeklyUsd && sum(DAY) + usd <= dailyUsd;
    },
    spend(usd) {
      if (!(usd > 0)) return;
      entries.push([Date.now(), +usd.toFixed(6)]);
      prune();
      try {
        writeFileSync(file, JSON.stringify({ entries }));
      } catch {
        /* ignore */
      }
    },
    status() {
      prune();
      return { weekUsd: +sum(7 * DAY).toFixed(4), dayUsd: +sum(DAY).toFixed(4), weeklyUsd, dailyUsd };
    },
  };
}
