/**
 * PhScene.jsx — منضدة المختبر (SVG) بشكل احترافي نظيف:
 *  - كأس زجاجي بعلامات حجم واضحة خارجه.
 *  - حنفية ماء بأنبوب منحنٍ (gooseneck) أعلى اليمين.
 *  - قطّارة (ماصّة) أنيقة في الأعلى مملوءة بلون السائل المختار.
 *  - صنبور تصريف أسفل اليسار.
 * كل الأنابيب مرسومة كمسارات بحدٍّ سميك متدرّج (يعطي مظهراً معدنياً أسطوانياً)
 * بدل مستطيلات مصمتة. الأدوات تفاعلية (استمر بالضغط) مع تيّارات متحرّكة.
 */

const LIQUID_BOTTOM = 434;
const LIQUID_SPAN = 274; // يمثّل السعة القصوى (1.2 لتر)
const WATER_SPOUT = { x: 350, y: 146 };
const DROPPER_TIP = { x: 300, y: 150 };
const DRAIN_SPOUT = { x: 150, y: 468 };

function holdHandlers(start, stop, disabled) {
  return {
    onPointerDown: (e) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    style: { cursor: disabled ? "not-allowed" : "pointer" },
  };
}

export default function PhScene({
  empty,
  fillFraction,
  liquidColor,
  dropperColor,
  volumeLabel,
  pouringWater,
  dripping,
  draining,
  onWaterStart,
  onWaterStop,
  onDripStart,
  onDripStop,
  onDrainStart,
  onDrainStop,
  full,
}) {
  const liquidTop = LIQUID_BOTTOM - fillFraction * LIQUID_SPAN;
  const liquidHeight = Math.max(0, fillFraction * LIQUID_SPAN);
  const tickHalf = LIQUID_BOTTOM - (0.5 / 1.2) * LIQUID_SPAN;
  const tickOne = LIQUID_BOTTOM - (1.0 / 1.2) * LIQUID_SPAN;

  return (
    <svg className="ph-scene" viewBox="0 0 620 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="منضدة تجربة الأس الهيدروجيني">
      <defs>
        <linearGradient id="ph-pipe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f5f7" />
          <stop offset="0.42" stopColor="#cdd5da" />
          <stop offset="0.52" stopColor="#f6f9fb" />
          <stop offset="0.62" stopColor="#aab4bb" />
          <stop offset="1" stopColor="#828d95" />
        </linearGradient>
        <radialGradient id="ph-knob" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#8fd0f2" />
          <stop offset="1" stopColor="#2b7bad" />
        </radialGradient>
        <radialGradient id="ph-bulb" cx="0.35" cy="0.28" r="0.9">
          <stop offset="0" stopColor="#ff7676" />
          <stop offset="1" stopColor="#c62828" />
        </radialGradient>
        <linearGradient id="ph-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="0.16" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="0.84" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="1" stopColor="rgba(175,200,212,0.4)" />
        </linearGradient>
        <clipPath id="ph-clip">
          <path d="M204 158 L204 420 Q204 434 218 434 L382 434 Q396 434 396 420 L396 158 Z" />
        </clipPath>
      </defs>

      {/* ===== حنفية الماء (gooseneck، أعلى اليمين) ===== */}
      <g className="ph-tool-group">
        <path
          d="M614 108 L372 108 Q350 108 350 132 L350 148"
          fill="none"
          stroke="#6f787f"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M614 108 L372 108 Q350 108 350 132 L350 148"
          fill="none"
          stroke="url(#ph-pipe)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="470" y="88" className="ph-scene-label" textAnchor="middle">ماء</text>
        {/* المقبض */}
        <g className={`ph-valve${pouringWater ? " on" : ""}`} {...holdHandlers(onWaterStart, onWaterStop, full)}>
          <rect x="454" y="86" width="12" height="24" rx="4" fill="url(#ph-pipe)" />
          <g className="ph-knob">
            <circle cx="460" cy="80" r="15" fill="url(#ph-knob)" stroke="#1f5f86" strokeWidth="1.5" />
            <rect x="446" y="77" width="28" height="6" rx="3" fill="#e8f2f8" opacity="0.85" />
            <circle cx="454" cy="74" r="4" fill="rgba(255,255,255,0.7)" />
          </g>
        </g>
      </g>

      {pouringWater && (
        <g className="ph-flow">
          <rect x={WATER_SPOUT.x - 4} y={WATER_SPOUT.y} width="8" height={Math.max(0, liquidTop - WATER_SPOUT.y)} rx="4" fill="rgba(95,175,228,0.65)" />
          <circle className="ph-flow-drop" cx={WATER_SPOUT.x} cy={WATER_SPOUT.y + 18} r="4" fill="#8fd0f0" />
          <circle className="ph-flow-drop d2" cx={WATER_SPOUT.x} cy={WATER_SPOUT.y + 18} r="3" fill="#c3e7f8" />
        </g>
      )}

      {/* ===== القطّارة (الماصّة) ===== */}
      <g className="ph-dropper" {...holdHandlers(onDripStart, onDripStop, full)}>
        <ellipse
          cx="300"
          cy="52"
          rx="17"
          ry="22"
          fill="url(#ph-bulb)"
          stroke="#9e1b1b"
          strokeWidth="1.5"
          className={dripping ? "ph-bulb-squeeze" : ""}
        />
        <ellipse cx="294" cy="44" rx="5" ry="7" fill="rgba(255,255,255,0.55)" />
        <rect x="293" y="72" width="14" height="9" rx="2" fill="#e9edf0" stroke="#b9c2c8" />
        <rect x="291" y="80" width="18" height="56" rx="5" fill="rgba(255,255,255,0.4)" stroke="#c3ccd2" strokeWidth="1.5" />
        <rect x="294" y="83" width="12" height="50" rx="3" fill={dropperColor} opacity="0.92" />
        <path d="M291 136 L309 136 L302 150 L298 150 Z" fill="#d7dde1" stroke="#b9c2c8" strokeWidth="1" />
      </g>

      {dripping && (
        <g className="ph-flow">
          <circle className="ph-drip" cx={DROPPER_TIP.x} cy={DROPPER_TIP.y} r="5" fill={dropperColor} />
          <circle className="ph-drip d2" cx={DROPPER_TIP.x} cy={DROPPER_TIP.y} r="4" fill={dropperColor} />
        </g>
      )}

      {/* ===== الكأس ===== */}
      <g clipPath="url(#ph-clip)">
        {!empty && (
          <>
            <rect x="204" y={liquidTop} width="192" height={liquidHeight} fill={liquidColor} />
            <rect x="204" y={liquidTop} width="192" height="6" fill="rgba(255,255,255,0.4)" />
            <g>
              <circle className="ph-sb b1" cx="250" cy={LIQUID_BOTTOM - 8} r="4" fill="rgba(255,255,255,0.5)" />
              <circle className="ph-sb b2" cx="300" cy={LIQUID_BOTTOM - 8} r="3" fill="rgba(255,255,255,0.5)" />
              <circle className="ph-sb b3" cx="348" cy={LIQUID_BOTTOM - 8} r="5" fill="rgba(255,255,255,0.45)" />
            </g>
          </>
        )}
      </g>

      {/* زجاج الكأس + الشفة */}
      <path
        d="M204 158 L204 420 Q204 434 218 434 L382 434 Q396 434 396 420 L396 158"
        fill="url(#ph-glass)"
        stroke="rgba(120,160,175,0.75)"
        strokeWidth="4"
      />
      <path d="M194 158 L226 158 M374 158 L406 158" stroke="rgba(120,160,175,0.75)" strokeWidth="5" strokeLinecap="round" />

      {/* علامات الحجم خارج الكأس (يمين) */}
      <g className="ph-scene-ticks">
        <line x1="396" y1={tickHalf} x2="410" y2={tickHalf} />
        <text x="416" y={tickHalf + 5} className="ph-scene-ticklabel">½ لتر</text>
        <line x1="396" y1={tickOne} x2="410" y2={tickOne} />
        <text x="416" y={tickOne + 5} className="ph-scene-ticklabel">١ لتر</text>
      </g>

      {/* حجم السائل الحالي أسفل الكأس */}
      <text x="300" y="466" className="ph-vol-text" textAnchor="middle">
        {empty ? "الكأس فارغ" : `الحجم: ${volumeLabel} لتر`}
      </text>

      {/* ===== صنبور التصريف (أسفل اليسار) ===== */}
      <g className="ph-tool-group">
        <path
          d="M206 420 L168 420 Q150 420 150 440 L150 468"
          fill="none"
          stroke="#6f787f"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M206 420 L168 420 Q150 420 150 440 L150 468"
          fill="none"
          stroke="url(#ph-pipe)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g className={`ph-valve${draining ? " on" : ""}`} {...holdHandlers(onDrainStart, onDrainStop, empty)}>
          <rect x="180" y="410" width="10" height="16" rx="4" fill="url(#ph-pipe)" />
          <g className="ph-knob">
            <circle cx="185" cy="404" r="13" fill="url(#ph-knob)" stroke="#1f5f86" strokeWidth="1.5" />
            <rect x="172" y="401" width="26" height="6" rx="3" fill="#e8f2f8" opacity="0.85" />
            <circle cx="180" cy="399" r="3.5" fill="rgba(255,255,255,0.7)" />
          </g>
        </g>
      </g>

      {draining && !empty && (
        <g className="ph-flow">
          <rect x={DRAIN_SPOUT.x - 4} y={DRAIN_SPOUT.y} width="8" height="30" rx="4" fill={liquidColor} />
          <circle className="ph-flow-drop" cx={DRAIN_SPOUT.x} cy={DRAIN_SPOUT.y + 12} r="4" fill={liquidColor} />
        </g>
      )}
    </svg>
  );
}
