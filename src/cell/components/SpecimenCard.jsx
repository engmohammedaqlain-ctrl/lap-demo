/**
 * SpecimenCard.jsx — بطاقة مثبّتة بجوار المجهر تنقلب بلمسة:
 *  - الوجه الأمامي: دفتر ملاحظات العيّنة (اسم العضيّ ووظيفته، أو فروق نوع الخلية).
 *  - الوجه الخلفي: بطاقة اختبار "من أنا؟" في وضع التحدّي (الغلط مجاني).
 * هذا هو مبدّل وضع الاستكشاف/التحدّي: لا أزرار مجرّدة، بل بطاقة ماديّة.
 */
import { DIFFERENCES } from "../cellData.js";
import { IconHelp, IconBack, IconCheck, IconNext } from "../../ui/icons.jsx";

const ANIM_CAPTION = {
  pulse: "شاهد النواة تنبض وتُضيء الخلية من مركزها.",
  atp: "شاهد الميتوكوندريا تطلق نبضات طاقة ATP.",
  build: "شاهد الرايبوسوم يبني سلسلة بروتين حلقةً حلقة.",
  transport: "شاهد الرايبوسومات على الشبكة تصنع البروتين وتنقله.",
  flow: "شاهد الأنابيب الملساء تموج وتصنع الدهون.",
  package: "شاهد جولجي يغلّف المواد ويطلق حويصلة تسبح بعيداً.",
  digest: "شاهد الإنزيمات تهتزّ داخل الليسوسوم لتهضم الفضلات.",
  store: "شاهد الفجوة تخزّن الماء والمواد.",
  gate: "الغشاء بوّابة الخلية: يتذبذب ويتحكّم بالدخول والخروج.",
  crowd: "لاحظ ازدحام السيتوبلازم — مئات الجزيئات في حركة دائمة.",
  photo: "شاهد البلاستيدة تلتقط الضوء لتصنع الغذاء.",
  rigid: "الجدار صلب لا يتذبذب — يمنح الخلية النباتية شكلها.",
};

export default function SpecimenCard({ rect, scale, mode, onFlip, org, cellType, challenge, onSkip }) {
  const flipped = mode === "challenge";
  const diffs = DIFFERENCES[cellType] || [];
  const { target, feedback, attempts, score } = challenge;

  return (
    <div
      className="cl-card"
      data-flipped={flipped}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, "--s": scale }}
    >
      <div className="cl-card-inner">
        {/* دفتر الملاحظات */}
        <section className="cl-face cl-note" aria-hidden={flipped}>
          <i className="cl-clip" aria-hidden="true" />
          {org ? (
            <div className="cl-note-body" key={org.id}>
              <h3>{org.name}</h3>
              <em>{org.latin}</em>
              <p className="cl-note-func">{org.func}</p>
              <p className="cl-note-anim">{ANIM_CAPTION[org.anim] || ""}</p>
            </div>
          ) : (
            <div className="cl-note-body">
              <h3>{cellType === "plant" ? "خلية نباتية" : "خلية حيوانية"}</h3>
              <ul className="cl-note-diffs">
                {diffs.map((d) => (
                  <li key={d.label}>
                    <span className={`cl-dot ${d.kind}`} aria-hidden="true" />
                    {d.label}
                  </li>
                ))}
              </ul>
              <p className="cl-note-hint">اضغط عضيّاً لتعرف وظيفته</p>
            </div>
          )}
        </section>

        {/* بطاقة الاختبار */}
        <section className="cl-face cl-quiz" aria-hidden={!flipped}>
          <header>
            <span className="cl-quiz-badge">من أنا؟</span>
            <span className="cl-quiz-score">
              <IconCheck width="16" height="16" /> {score.toLocaleString("ar-EG")}
            </span>
          </header>
          {target ? (
            <>
              <p className="cl-quiz-q">
                أيُّ عضيّ <b>{target.func}</b>
              </p>
              <p className={`cl-quiz-fb${feedback ? ` ${feedback.tone}` : ""}`}>
                {feedback ? feedback.text : "ابحث عنه في المجهر"}
              </p>
              <footer>
                <span className="cl-quiz-tries">{attempts > 0 ? attempts.toLocaleString("ar-EG") : ""}</span>
                <button type="button" className="cl-quiz-next" onClick={onSkip} title="سؤال آخر">
                  <span>سؤال آخر</span>
                  <IconNext width="16" height="16" />
                </button>
              </footer>
            </>
          ) : null}
        </section>
      </div>

      <button
        type="button"
        className="cl-ribbon"
        onClick={onFlip}
        aria-label={flipped ? "العودة إلى الدفتر" : "اختبر نفسك"}
        data-tip={flipped ? "العودة إلى الدفتر" : "اختبر نفسك"}
      >
        {flipped ? <IconBack width="22" height="22" /> : <IconHelp width="22" height="22" />}
      </button>
    </div>
  );
}
