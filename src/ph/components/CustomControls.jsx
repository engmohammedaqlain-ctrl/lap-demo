/**
 * CustomControls.jsx — وضع "حضّر محلولك": شريط تمرير يضبط pH مباشرة (٠..١٤)
 * وشريط آخر للحجم. يرى الطالب اللون والوصف يتغيّران فوراً مع كل تحريك.
 */
import { universalGradientCSS } from "../phColor.js";
import { formatAr, MAX_VOLUME } from "../phModel.js";

export default function CustomControls({ customPH, customVolume, onPHChange, onVolumeChange }) {
  return (
    <div className="ph-custom">
      <div className="ph-panel-heading">حضّر محلولك</div>

      <div className="ph-custom-field">
        <div className="ph-custom-row">
          <span className="ph-custom-label">قيمة pH</span>
          <span className="ph-custom-value">{formatAr(customPH, 1)}</span>
        </div>
        <input
          type="range"
          className="ph-slider ph-slider-ph"
          min="0"
          max="14"
          step="0.1"
          value={customPH}
          onChange={(e) => onPHChange(parseFloat(e.target.value))}
          style={{ background: universalGradientCSS("to left") }}
        />
        <div className="ph-slider-ends">
          <span>حمضي ٠</span>
          <span>١٤ قاعدي</span>
        </div>
      </div>

      <div className="ph-custom-field">
        <div className="ph-custom-row">
          <span className="ph-custom-label">الحجم</span>
          <span className="ph-custom-value">{formatAr(customVolume, 2)} لتر</span>
        </div>
        <input
          type="range"
          className="ph-slider"
          min="0"
          max={MAX_VOLUME}
          step="0.05"
          value={customVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
