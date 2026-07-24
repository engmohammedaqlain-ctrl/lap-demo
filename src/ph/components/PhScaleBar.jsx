/**
 * PhScaleBar.jsx — مقياس pH العمودي بأسلوب PhET: شريط متدرّج من الأحمر
 * (حمضي، أسفل) إلى الأزرق (قاعدي، أعلى) مع أبيض عند التعادل (٧)، أرقام
 * ٠..١٤ على اليسار، وكلمتا "قاعدي"/"حمضي" عموديّتان داخل الشريط، وصندوق
 * قراءة pH بمؤشّر ينزلق إلى القيمة الحالية.
 */
import { formatAr } from "../phModel.js";

const TICKS = [0, 2, 4, 6, 7, 8, 10, 12, 14];
const SCALE_GRADIENT =
  "linear-gradient(to top, #d43a3a 0%, #e79a9a 28%, #f6f6f6 50%, #9db4e6 72%, #3652c0 100%)";

export default function PhScaleBar({ pH, empty }) {
  const clamped = Math.max(0, Math.min(14, pH));
  const posPercent = (clamped / 14) * 100;

  return (
    <div className="ph-scalebar">
      <div className="ph-scalebar-track" style={{ background: SCALE_GRADIENT }}>
        <span className="ph-scale-word ph-word-base">قاعدي</span>
        <span className="ph-scale-word ph-word-acid">حمضي</span>

        {TICKS.map((t) => (
          <span
            key={t}
            className={`ph-scale-num${t === 7 ? " seven" : ""}`}
            style={{ bottom: `${(t / 14) * 100}%` }}
          >
            {t.toLocaleString("ar-EG")}
          </span>
        ))}

        {!empty && (
          <div className="ph-scale-readout" style={{ bottom: `${posPercent}%` }}>
            <span className="ph-scale-box">
              <span className="ph-scale-box-label">pH</span>
              <span className="ph-scale-box-value">{formatAr(clamped, 2)}</span>
            </span>
            <span className="ph-scale-connector" />
            <span className="ph-scale-marker" />
          </div>
        )}
      </div>
    </div>
  );
}
