/**
 * CellInfoPanel.jsx — اللوحة التفسيرية الحيّة:
 *  - بلا اختيار: مؤشّر مرحلة الزووم + tooltip علمي (الخلية مزدحمة عكس الكتب) +
 *    فروق نوع الخلية الحالي.
 *  - عند اختيار عضي: اسمه بالعربي + وظيفته بجملة صف سابع + وصف الأنيميشن
 *    الذي يوضّح وظيفته فعلياً.
 */
import { ORGANELLES, ENVELOPE, DIFFERENCES } from "../cellData.js";

const BY_ID = {};
for (const o of ORGANELLES) BY_ID[o.id] = o;
for (const k in ENVELOPE) BY_ID[ENVELOPE[k].id] = ENVELOPE[k];

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

export default function CellInfoPanel({ selectedId, cellType, zoom, particleCount, perfReduced }) {
  const org = selectedId ? BY_ID[selectedId] : null;
  const diffs = DIFFERENCES[cellType] || [];

  return (
    <div className="cl-info">
      {/* مؤشّر الزووم */}
      <div className="cl-zoom-card">
        <span className="cl-zoom-stage">{zoom.stage}</span>
        <span className="cl-zoom-mag">التكبير {zoom.mag}</span>
        <div className="cl-zoom-bar">
          <div className="cl-zoom-fill" style={{ width: `${zoom.pct}%` }} />
        </div>
      </div>

      {org ? (
        <div className="cl-organelle-card">
          <span className="cl-org-name">{org.name}</span>
          <span className="cl-org-latin">{org.latin}</span>
          <p className="cl-org-func">{org.func}</p>
          <p className="cl-org-anim">🎬 {ANIM_CAPTION[org.anim] || ""}</p>
          <span className="cl-org-hint">اضغط أي مكان فارغ للعودة</span>
        </div>
      ) : (
        <>
          <div className="cl-tooltip">
            <span className="cl-tooltip-emoji">💡</span>
            <div>
              <b>الخلية مزدحمة!</b> عكس رسوم الكتب المدرسية، السيتوبلازم مكتظّ بمئات
              الآلاف من البروتينات والجزيئات في حركة دائمة لا تتوقّف. ما تراه هنا أقرب
              إلى الحقيقة العلمية.
            </div>
          </div>

          <div className="cl-diff-card">
            <span className="cl-diff-head">
              {cellType === "plant" ? "مميّزات الخلية النباتية" : "مميّزات الخلية الحيوانية"}
            </span>
            {diffs.map((d) => (
              <span key={d.label} className="cl-diff-item">
                <span className="cl-diff-emoji">{d.emoji}</span> {d.label}
              </span>
            ))}
          </div>

          <div className="cl-explore-hint">
            👆 اضغط أي عضيّ لتعرف اسمه ووظيفته، ثم «🔬 اغطس داخله» لترى تركيبه — أو مرّر
            المؤشّر فوقه لتنكشف مكوّناته.
          </div>
        </>
      )}

      <div className="cl-perf">
        <span>الجسيمات النشطة: {particleCount.toLocaleString("ar-EG")}</span>
        {perfReduced && <span className="cl-perf-note">⚙️ خُفّض العدد تلقائياً للحفاظ على السلاسة</span>}
      </div>
    </div>
  );
}
