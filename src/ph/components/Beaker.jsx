/**
 * Beaker.jsx — الكأس الزجاجي والسائل بداخله. مبني بـ HTML/CSS (لا كانفس)
 * حتى ينتقل مستوى السائل ولونه بسلاسة عبر transitions، مع فقاعات متحركة
 * وسطح متموّج وعلامات حجم على الجانب.
 */
import { phColorCSS, phColorDeepCSS } from "../phColor.js";

// فقاعات ثابتة العدد بمواضع/تأخيرات مختلفة (CSS يحرّكها صعوداً)
const BUBBLES = [
  { left: "22%", delay: "0s", dur: "2.6s", size: 7 },
  { left: "38%", delay: "0.8s", dur: "3.1s", size: 5 },
  { left: "52%", delay: "1.5s", dur: "2.3s", size: 9 },
  { left: "66%", delay: "0.4s", dur: "2.9s", size: 6 },
  { left: "78%", delay: "1.1s", dur: "3.4s", size: 5 },
  { left: "30%", delay: "2s", dur: "2.7s", size: 8 },
];

export default function Beaker({ pH, fillFraction, volumeLabel, pouring }) {
  const fillPercent = Math.round(fillFraction * 100);
  const liquidColor = phColorCSS(pH);
  const deep = phColorDeepCSS(pH);
  const empty = fillFraction <= 0.001;

  return (
    <div className="ph-beaker-wrap">
      <div className={`ph-beaker${pouring ? " pouring" : ""}`}>
        {/* علامات الحجم على الجانب */}
        <div className="ph-ticks" aria-hidden="true">
          {[100, 75, 50, 25].map((t) => (
            <span key={t} className="ph-tick" style={{ bottom: `${t}%` }}>
              <span className="ph-tick-line" />
            </span>
          ))}
        </div>

        {/* السائل */}
        <div
          className="ph-liquid"
          style={{
            height: `${fillPercent}%`,
            background: `linear-gradient(to bottom, ${liquidColor}, ${deep})`,
          }}
        >
          {!empty && (
            <>
              <div className="ph-liquid-surface" style={{ background: liquidColor }} />
              <div className="ph-bubbles">
                {BUBBLES.map((b, i) => (
                  <span
                    key={i}
                    className="ph-bubble"
                    style={{
                      left: b.left,
                      width: b.size,
                      height: b.size,
                      animationDelay: b.delay,
                      animationDuration: pouring ? `calc(${b.dur} * 0.6)` : b.dur,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* بريق زجاجي */}
        <div className="ph-glass-shine" aria-hidden="true" />
      </div>

      <div className="ph-volume-label">
        <span className="ph-volume-value">{volumeLabel}</span>
        <span className="ph-volume-unit">لتر</span>
      </div>
    </div>
  );
}
