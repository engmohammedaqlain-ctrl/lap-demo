/**
 * GameChrome.jsx — مكوّنات "اللعبة" المشتركة بين التجارب على الجوال:
 *  - RotatePrompt: شاشة "أدِر جوالك" في الوضع الطولي.
 *  - InfoDrawer: لوحة المعلومات كدُرج يُفتح بزر؛ على الشاشات الكبيرة
 *    يعرض أبناءه في مكانهم كما كانوا (لا أثر له).
 */
import { useState } from "react";
import { haptic } from "./device.js";
import { IconInfo, IconClose } from "../ui/icons.jsx";

export function RotatePrompt({ onDismiss }) {
  return (
    <div className="rotate-prompt" role="dialog" aria-label="أدِر الجوال">
      <div className="rotate-phone" aria-hidden="true">
        <span className="rotate-phone-body" />
      </div>
      <h2>أدِر جوالك أفقياً</h2>
      <p>التجربة أجمل وأوسع بالوضع العرضي</p>
      <button type="button" className="rotate-skip" onClick={onDismiss}>
        متابعة بالوضع الطولي
      </button>
    </div>
  );
}

export function InfoDrawer({ label = "معلومات", children }) {
  const [open, setOpen] = useState(false);
  const toggle = (v) => {
    haptic(8);
    setOpen(v);
  };
  return (
    <div className={`info-drawer${open ? " open" : ""}`}>
      <button type="button" className="info-fab" onClick={() => toggle(!open)} aria-expanded={open}>
        {open ? <IconClose width="20" height="20" /> : <IconInfo width="20" height="20" />}
        <span>{open ? "إغلاق" : label}</span>
      </button>
      <div className="info-scrim" onClick={() => toggle(false)} />
      <div className="info-body">{children}</div>
    </div>
  );
}
