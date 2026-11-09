/**
 * GameChrome.jsx — شاشة "أدِر جوالك" للتجارب المركّبة بالعرض عند الجوال الطولي.
 */
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
