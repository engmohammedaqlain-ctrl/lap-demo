/**
 * DropIndicator.jsx — شارة "أفلت فوق البركة" أثناء سحب مادة
 * يُعدَّل ظهورها/نصّها مباشرة من MaterialTray (imperatively) أثناء السحب،
 * بمعدل تكرار عالٍ جداً (pointermove) لا يستحق إعادة عرض React لكل حركة إصبع.
 */
export default function DropIndicator() {
  return (
    <div id="drop-indicator" className="drop-indicator" hidden>
      أفلت فوق البركة ↓
    </div>
  );
}
