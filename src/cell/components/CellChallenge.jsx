/**
 * CellChallenge.jsx — شريط وضع التحدّي. يُعرض وصف وظيفة والطالب يضغط العضيّ
 * الصحيح على المشهد. فلسفة المنتج: الغلط مجاني — لا عقاب، تلميح ومحاولات بلا
 * حدّ. يعرض السؤال، عدّاد المحاولات، آخر تلميح، وعدد الإجابات الصحيحة.
 */
export default function CellChallenge({ target, feedback, attempts, score, onSkip }) {
  if (!target) return null;
  return (
    <div className={`cl-challenge tone-${feedback ? feedback.tone : "ask"}`}>
      <div className="cl-ch-top">
        <span className="cl-ch-badge">🎯 تحدٍّ</span>
        <span className="cl-ch-score">أحسنت في {score.toLocaleString("ar-EG")} ✓</span>
      </div>

      <p className="cl-ch-question">
        أيُّ عضيّ <b>{target.func}</b>
      </p>

      {feedback ? (
        <p className="cl-ch-feedback">
          {feedback.tone === "correct" ? "🎉 " : "💡 "}
          {feedback.text}
        </p>
      ) : (
        <p className="cl-ch-feedback muted">اضغط العضيّ الصحيح على الخلية…</p>
      )}

      <div className="cl-ch-bottom">
        <span className="cl-ch-attempts">
          {attempts > 0 ? `محاولات: ${attempts.toLocaleString("ar-EG")} — لا بأس، جرّب ثانية!` : "لا عقاب على الخطأ"}
        </span>
        <button type="button" className="cl-ch-skip" onClick={onSkip}>
          سؤال آخر ↻
        </button>
      </div>
    </div>
  );
}
