/**
 * cellData.js — بيانات تجربة «رحلة داخل الخلية».
 *
 * يحوي:
 *  - أبعاد المشهد المنطقية ومقاييس الزووم (نطاق ~1e5 عبر مكدّس مراحل).
 *  - تعريف العضيّات: الاسم العربي، الوظيفة بلغة صف سابع، لون التدرّج،
 *    الموضع والحجم في فضاء الخلية المحلي، الطور/السرعة (كي لا تتزامن الحياة)،
 *    شكل الاصطدام (للازدحام والنقر)، ونوع أنيميشن الوظيفة عند الاختيار.
 *  - الفروق بين الخلية الحيوانية والنباتية (جدار، بلاستيدات، فجوة كبيرة).
 *  - نصوص وضع التحدّي (الغلط مجاني: تلميح ومحاولات بلا حدّ).
 *
 * كل الأشكال تُرسم إجرائياً على canvas (متجهي 100%، صفر صور نقطية في مسار
 * الزووم). المورفولوجيا مُنمذجة على مراجع NIH BioArt (ملكية عامة) — انظر
 * ASSETS.md لقائمة المصادر والتراخيص.
 */

/* ===== المشهد ===== */
export const SCENE_W = 960;
export const SCENE_H = 660;
export const CX = SCENE_W / 2;
export const CY = SCENE_H / 2;

/* نصف قطر الخلية في الفضاء المحلي (تُرسم العضيّات نسبةً إليه) */
export const CELL_R = 300;

/* ===== مراحل الزووم =====
 * p ∈ [0,1] تقدّم متصل من نقطة الماء إلى داخل الخلية. كل مرحلة نافذةٌ على p
 * مع تراكب عند الحواف كي يبدو الانتقال ذوباناً متصلاً (تقنية "قوى العشرة").
 * حاصل التكبير التقديري عبر المراحل ~1e5 (نقطة ماء ← عنقود ← خلية ← عضيّات).
 */
export const STAGES = {
  // البداية: المجهر والشريحة عليه. لا مقدّمة وجه/بصلة ولا خطوات تحضير —
  // التكبير يندفع من الشريحة مباشرةً إلى نسيج الخلايا.
  scope: { in: [0.0, 0.0], out: [0.05, 0.19], mag: "×10" },
  cluster: { in: [0.09, 0.2], out: [0.44, 0.54], mag: "×40" },
  cell: { in: [0.46, 0.54], out: [0.62, 0.72], mag: "×400" },
  inside: { in: [0.66, 0.74], out: [1.01, 1.02], mag: "×100,000" },
};

/* حدّ المجهر المدرسي — ذروة العرض الدرامية */
export const MICRO_LIMIT_P = 0.61;

/* عتبة كشف الجسيمات الأدقّ (تفاصيل تتكشّف مع العمق) */
export const FINE_DETAIL_P = 0.9;

/* ===== الازدحام الجزيئي ===== */
export const CROWD = {
  target: 560, // العدد الافتراضي (يُضبط تلقائياً بين min و max)
  min: 300,
  max: 800,
  fine: 220, // جسيمات دقيقة إضافية تظهر عند التكبير العالي
  layers: 3, // طبقات العمق
};

/* ألوان الجسيمات (بروتينات/جزيئات) — تدرّجات هادئة تكسر لون السيتوبلازم */
export const PARTICLE_HUES = [
  "rgba(255,170,120,",
  "rgba(150,205,255,",
  "rgba(190,160,255,",
  "rgba(255,210,140,",
  "rgba(140,225,200,",
  "rgba(255,150,190,",
];

/* ===== لوحة ألوان السيتوبلازم/الإضاءة ===== */
export const PALETTE = {
  cytoTop: "#f6e2ee",
  cytoMid: "#f0cfe4",
  cytoDeep: "#e3b6d6",
  nucleusGlow: "rgba(255,230,150,0.55)",
  membrane: "#c2185b",
  membraneLight: "#f06292",
};

/* ===== أداة: أشكال الاصطدام ===== */
// كل عضي يعطي دائرة/إهليلج مانع للجسيمات وقابل للنقر.

/* ===== العضيّات ===== */
// x,y بالنسبة لمركز الخلية (0,0). r نصف القطر التقريبي (لمنطقة النقر/الاصطدام).
// draw: مفتاح دالة الرسم في CellScene. anim: نوع أنيميشن الوظيفة عند الاختيار.
// only: 'plant' | 'animal' | undefined (كلاهما).

export const ORGANELLES = [
  {
    id: "nucleus",
    name: "النواة",
    latin: "Nucleus",
    func: "تُخزّن المادة الوراثية (DNA) وتتحكّم في نشاط الخلية كلّه، كأنها غرفة القيادة.",
    color: ["#7e57c2", "#5e35b1", "#4527a0"],
    x: -40,
    y: -20,
    rx: 96,
    ry: 88,
    draw: "nucleus",
    anim: "pulse",
    speed: 0.55,
    phase: 0.0,
    plantShift: { x: 120, y: 120 }, // تدفعها الفجوة الكبيرة إلى الطرف في النبات
  },
  {
    id: "mito1",
    name: "الميتوكوندريا",
    latin: "Mitochondrion",
    func: "تُنتج الطاقة (ATP) بأكسدة الغذاء — لذلك تُسمّى بيت طاقة الخلية.",
    color: ["#ff8a65", "#f4511e", "#bf360c"],
    x: 150,
    y: -110,
    rx: 62,
    ry: 30,
    rot: -0.5,
    draw: "mito",
    anim: "atp",
    speed: 1.15,
    phase: 0.4,
    group: "mitochondria",
  },
  {
    id: "mito2",
    name: "الميتوكوندريا",
    latin: "Mitochondrion",
    func: "تُنتج الطاقة (ATP) بأكسدة الغذاء — لذلك تُسمّى بيت طاقة الخلية.",
    color: ["#ff8a65", "#f4511e", "#bf360c"],
    x: -170,
    y: 120,
    rx: 58,
    ry: 27,
    rot: 0.7,
    draw: "mito",
    anim: "atp",
    speed: 0.95,
    phase: 2.1,
    group: "mitochondria",
  },
  {
    id: "mito3",
    name: "الميتوكوندريا",
    latin: "Mitochondrion",
    func: "تُنتج الطاقة (ATP) بأكسدة الغذاء — لذلك تُسمّى بيت طاقة الخلية.",
    color: ["#ff8a65", "#f4511e", "#bf360c"],
    x: 60,
    y: 170,
    rx: 54,
    ry: 26,
    rot: 0.2,
    draw: "mito",
    anim: "atp",
    speed: 1.35,
    phase: 4.3,
    group: "mitochondria",
  },
  {
    id: "roughER",
    name: "الشبكة الإندوبلازمية الخشنة",
    latin: "Rough ER",
    func: "قنوات مغطّاة بالرايبوسومات تصنع البروتينات وتنقلها داخل الخلية.",
    color: ["#4dd0e1", "#0097a7", "#006064"],
    x: 110,
    y: 70,
    rx: 95,
    ry: 78,
    draw: "roughER",
    anim: "transport",
    speed: 0.8,
    phase: 1.2,
  },
  {
    id: "smoothER",
    name: "الشبكة الإندوبلازمية الملساء",
    latin: "Smooth ER",
    func: "تصنع الدهون وتخلّص الخلية من بعض المواد الضارّة.",
    color: ["#4db6ac", "#00897b", "#004d40"],
    x: -150,
    y: -110,
    rx: 82,
    ry: 66,
    draw: "smoothER",
    anim: "flow",
    speed: 0.7,
    phase: 3.0,
  },
  {
    id: "golgi",
    name: "جهاز جولجي",
    latin: "Golgi apparatus",
    func: "يغلّف المواد في حويصلات ويطلقها إلى وجهتها، كمركز تغليف وشحن.",
    color: ["#ffb74d", "#fb8c00", "#e65100"],
    x: -110,
    y: 150,
    rx: 84,
    ry: 58,
    draw: "golgi",
    anim: "package",
    speed: 0.6,
    phase: 0.9,
  },
  {
    id: "lysosome",
    name: "الليسوسوم",
    latin: "Lysosome",
    func: "يحتوي إنزيمات تهضم الفضلات والأجزاء التالفة وتعيد تدويرها.",
    color: ["#f06292", "#e91e63", "#ad1457"],
    x: 190,
    y: 60,
    rx: 34,
    ry: 34,
    draw: "lysosome",
    anim: "digest",
    speed: 1.5,
    phase: 5.0,
  },
  {
    id: "ribosome",
    name: "الرايبوسوم",
    latin: "Ribosome",
    func: "يبني البروتينات بربط الأحماض الأمينية حلقةً حلقة حسب تعليمات النواة.",
    color: ["#8d6e63", "#5d4037", "#3e2723"],
    x: 40,
    y: -160,
    rx: 30,
    ry: 26,
    draw: "ribosomeCluster",
    anim: "build",
    speed: 1.0,
    phase: 2.6,
  },
  {
    id: "vacuole",
    name: "الفجوة العصارية",
    latin: "Vacuole",
    func: "تخزّن الماء والغذاء والفضلات؛ وهي كبيرة جداً في الخلية النباتية.",
    color: ["#81d4fa", "#29b6f6", "#0288d1"],
    x: 150,
    y: 150,
    rx: 46,
    ry: 44,
    draw: "vacuole",
    anim: "store",
    speed: 0.5,
    phase: 1.7,
    // في النبات تصبح فجوة مركزية ضخمة
    plant: { x: 0, y: 10, rx: 175, ry: 165 },
  },
  {
    id: "chloroplast1",
    name: "البلاستيدة الخضراء",
    latin: "Chloroplast",
    func: "تقوم بالبناء الضوئي: تحوّل ضوء الشمس والماء وCO₂ إلى غذاء وأكسجين.",
    color: ["#81c784", "#43a047", "#1b5e20"],
    x: -180,
    y: 40,
    rx: 52,
    ry: 30,
    rot: 0.5,
    draw: "chloroplast",
    anim: "photo",
    speed: 0.9,
    phase: 0.3,
    only: "plant",
    group: "chloroplast",
  },
  {
    id: "chloroplast2",
    name: "البلاستيدة الخضراء",
    latin: "Chloroplast",
    func: "تقوم بالبناء الضوئي: تحوّل ضوء الشمس والماء وCO₂ إلى غذاء وأكسجين.",
    color: ["#81c784", "#43a047", "#1b5e20"],
    x: 175,
    y: -60,
    rx: 48,
    ry: 28,
    rot: -0.6,
    draw: "chloroplast",
    anim: "photo",
    speed: 1.1,
    phase: 3.4,
    only: "plant",
    group: "chloroplast",
  },
  {
    id: "chloroplast3",
    name: "البلاستيدة الخضراء",
    latin: "Chloroplast",
    func: "تقوم بالبناء الضوئي: تحوّل ضوء الشمس والماء وCO₂ إلى غذاء وأكسجين.",
    color: ["#81c784", "#43a047", "#1b5e20"],
    x: -60,
    y: -175,
    rx: 46,
    ry: 27,
    rot: 0.15,
    draw: "chloroplast",
    anim: "photo",
    speed: 0.8,
    phase: 5.5,
    only: "plant",
    group: "chloroplast",
  },
];

/* عضيّات "محيطية" ليست في مصفوفة الرسم الداخلي لكنها قابلة للاختيار/الشرح */
export const ENVELOPE = {
  membrane: {
    id: "membrane",
    name: "الغشاء البلازمي",
    latin: "Cell membrane",
    func: "يحيط بالخلية ويتحكّم في دخول وخروج المواد — بوّابة الخلية.",
    anim: "gate",
  },
  wall: {
    id: "wall",
    name: "الجدار الخلوي",
    latin: "Cell wall",
    func: "طبقة صلبة من السليلوز تحيط بالخلية النباتية وتمنحها شكلاً وصلابة.",
    anim: "rigid",
    only: "plant",
  },
  cytoplasm: {
    id: "cytoplasm",
    name: "السيتوبلازم",
    latin: "Cytoplasm",
    func: "سائل هلامي مزدحم تسبح فيه العضيّات وتحدث فيه معظم التفاعلات.",
    anim: "crowd",
  },
};

/* الفروق التي تُبرَز عند تبديل نوع الخلية */
export const DIFFERENCES = {
  plant: [
    { id: "wall", label: "جدار خلوي صلب", emoji: "🧱" },
    { id: "chloroplast", label: "بلاستيدات خضراء (بناء ضوئي)", emoji: "🌿" },
    { id: "vacuole", label: "فجوة مركزية ضخمة", emoji: "💧" },
  ],
  animal: [
    { id: "no-wall", label: "بلا جدار — غشاء مرن فقط", emoji: "🚫🧱" },
    { id: "no-chloroplast", label: "بلا بلاستيدات (لا تصنع غذاءها)", emoji: "🚫🌿" },
    { id: "small-vacuole", label: "فجوات صغيرة متعدّدة", emoji: "•" },
  ],
};

/* ===== قائمة قابلة للاختيار/الاختبار (لكل نوع خلية) ===== */
export function selectableOrganelles(cellType) {
  const base = ORGANELLES.filter((o) => !o.only || o.only === cellType);
  // نُدرج المحيطيات المناسبة
  const env = [ENVELOPE.membrane, ENVELOPE.cytoplasm];
  if (cellType === "plant") env.push(ENVELOPE.wall);
  return [...base, ...env];
}

/* منع تكرار الوظائف في التحدّي: نختار عضيّات فريدة بالاسم */
export function challengePool(cellType) {
  const seen = new Set();
  const pool = [];
  for (const o of selectableOrganelles(cellType)) {
    if (seen.has(o.name)) continue;
    seen.add(o.name);
    pool.push({ id: o.id, name: o.name, func: o.func });
  }
  return pool;
}

/* ===== أدوات صغيرة ===== */
export const CLAMP = (v, a, b) => (v < a ? a : v > b ? b : v);
export const LERP = (a, b, t) => a + (b - a) * t;
/** نافذة صعود/هبوط ناعمة: 0 خارج [a..b]، 1 داخلها، مع smoothstep على الحواف */
export function fade(p, inR, outR) {
  let up = 1;
  if (inR) up = CLAMP((p - inR[0]) / (inR[1] - inR[0] || 1e-6), 0, 1);
  let down = 1;
  if (outR) down = 1 - CLAMP((p - outR[0]) / (outR[1] - outR[0] || 1e-6), 0, 1);
  const v = up * down;
  return v * v * (3 - 2 * v); // smoothstep
}
export const AR = (n) => n.toLocaleString("ar-EG");

/* ===== لقطة البداية: الشريحة تحت المجهر =====
 * لا نعرض مصدر العيّنة (وجه/بصلة) ولا خطوات التحضير — نبدأ من الجهاز نفسه:
 * عنوان يشرح ما على المنضدة، وأسطر شرح تظهر تباعاً، ثم يُكبّر الطالب بنفسه.
 */
export const SCOPE_INFO = {
  animal: {
    title: "شريحة خلايا حيوانية جاهزة",
    accent: "#42a5f5",
    lines: [
      "على منضدة المجهر شريحة زجاجية عليها طبقةٌ رقيقة جداً من خلايا حيوانية، مصبوغة بالميثيلين الأزرق كي تتّضح حدودها ونواتها.",
      "الضوء يصعد من أسفل الشريحة فيمرّ خلال الطبقة الرقيقة، ثم تُكبّر العدسات الشيئيّة الصورة، وتُكبّرها العدسة العينيّة مرّةً أخرى.",
      "الخلية الحيوانية بلا جدار خلوي، لذا تبدو مستديرة ليّنة الحواف، ونواتها ظاهرة كنقطة داكنة في وسطها.",
    ],
    hint: "كبّر بعجلة الماوس أو بإصبعين — ادخل الشريحة حتى داخل الخلية",
  },
  plant: {
    title: "شريحة خلايا نباتية جاهزة",
    accent: "#f2a638",
    lines: [
      "على منضدة المجهر شريحة زجاجية عليها طبقةٌ رقيقة جداً من خلايا نباتية، مصبوغة بكاشف اليود كي تتّضح جدرانها ونواتها.",
      "الضوء يصعد من أسفل الشريحة فيمرّ خلال الطبقة الرقيقة، ثم تُكبّر العدسات الشيئيّة الصورة، وتُكبّرها العدسة العينيّة مرّةً أخرى.",
      "الخلية النباتية لها جدار خلوي صلب، لذا تبدو مستطيلة مرصوصة كالطوب، وفيها فجوة كبيرة وبلاستيدات خضراء.",
    ],
    hint: "كبّر بعجلة الماوس أو بإصبعين — ادخل الشريحة حتى داخل الخلية",
  },
};

/* ===== توحيد معرّف العضي (لمجموعات مثل mito/chloroplast) ===== */
export function organelleKind(id) {
  if (!id) return id;
  if (id.startsWith("mito")) return "mito";
  if (id.startsWith("chloroplast")) return "chloroplast";
  return id;
}

/* ===== دواخل العضيّات (للغوص العميق و كشف الـhover) =====
 * kind: نوع الرسم في CellScene.INTERIOR_PART. لكل جزء اسم عربي وموضع محلي
 * ضمن مربّع ~[-100..100].
 */
export const INTERIORS = {
  nucleus: {
    title: "داخل النواة",
    bg: ["#3b1f6e", "#22124a"],
    caption: "مركز التحكّم: هنا تُحفظ شيفرة الحياة (DNA) وتصدر الأوامر.",
    parts: [
      { label: "النوية", latin: "Nucleolus", kind: "core", color: ["#ede7f6", "#9575cd"], x: 20, y: -10, r: 34 },
      { label: "الكروماتين (DNA)", latin: "Chromatin", kind: "helix", color: ["#ce93d8", "#7e57c2"], x: -30, y: 20, r: 70 },
      { label: "مسام الغلاف النووي", latin: "Nuclear pores", kind: "ring-dots", color: ["#b39ddb"], x: 0, y: 0, r: 95 },
      { label: "البلازما النووية", latin: "Nucleoplasm", kind: "fluid", color: ["#5e35b1"], x: 0, y: 0, r: 92 },
    ],
  },
  mito: {
    title: "داخل الميتوكوندريا",
    bg: ["#5d1f0a", "#33130a"],
    caption: "معمل الطاقة: الأعراف الداخلية تصنع ATP عبر سلسلة نقل الإلكترون.",
    parts: [
      { label: "الغشاء الخارجي", latin: "Outer membrane", kind: "capsule-ring", color: ["#ff8a65", "#bf360c"], x: 0, y: 0, r: 96 },
      { label: "الغشاء الداخلي", latin: "Inner membrane", kind: "capsule-ring", color: ["#ffab91", "#e64a19"], x: 0, y: 0, r: 74 },
      { label: "الأعراف (كريستا)", latin: "Cristae", kind: "cristae", color: ["#fff3e0", "#ff7043"], x: 0, y: 0, r: 70 },
      { label: "الحشوة (المطرس)", latin: "Matrix", kind: "fluid", color: ["#e64a19"], x: 0, y: 0, r: 60 },
      { label: "إنزيم ATP", latin: "ATP synthase", kind: "spark-dots", color: ["#fff176"], x: 0, y: 0, r: 66 },
    ],
  },
  chloroplast: {
    title: "داخل البلاستيدة الخضراء",
    bg: ["#14431c", "#0a2410"],
    caption: "مطبخ الغذاء: أكوام الثايلاكويد تلتقط الضوء لصنع السكر.",
    parts: [
      { label: "الغلاف", latin: "Envelope", kind: "capsule-ring", color: ["#81c784", "#1b5e20"], x: 0, y: 0, r: 96 },
      { label: "أكوام الغرانا", latin: "Grana", kind: "grana", color: ["#2e7d32", "#1b5e20"], x: 0, y: 0, r: 70 },
      { label: "الستروما", latin: "Stroma", kind: "fluid", color: ["#43a047"], x: 0, y: 0, r: 80 },
      { label: "أضواء ملتقَطة", latin: "Photons", kind: "spark-dots", color: ["#fff59d"], x: 0, y: 0, r: 78 },
    ],
  },
  roughER: {
    title: "داخل الشبكة الخشنة",
    bg: ["#0d3d44", "#062227"],
    caption: "خطوط إنتاج البروتين: الرايبوسومات تُترجم الشيفرة إلى بروتين.",
    parts: [
      { label: "الصهاريج (اللمعة)", latin: "Cisternae", kind: "membranes", color: ["#4dd0e1", "#006064"], x: 0, y: 0, r: 90 },
      { label: "الرايبوسومات", latin: "Ribosomes", kind: "bump-dots", color: ["#4e342e"], x: 0, y: 0, r: 88 },
      { label: "بروتين قيد الصنع", latin: "Protein", kind: "chain", color: ["#ef5350", "#42a5f5"], x: -10, y: 0, r: 60 },
    ],
  },
  smoothER: {
    title: "داخل الشبكة الملساء",
    bg: ["#0d3f3a", "#062320"],
    caption: "مصنع الدهون: أنابيب ملساء تصنع الدهون وتزيل السموم.",
    parts: [
      { label: "الأنابيب (اللمعة)", latin: "Tubules", kind: "membranes", color: ["#4db6ac", "#004d40"], x: 0, y: 0, r: 90 },
      { label: "قطرات دهنية", latin: "Lipids", kind: "vesicle-dots", color: ["#b2dfdb", "#00897b"], x: 0, y: 0, r: 80 },
      { label: "إنزيمات إزالة السمّ", latin: "Enzymes", kind: "spark-dots", color: ["#80cbc4"], x: 0, y: 0, r: 74 },
    ],
  },
  golgi: {
    title: "داخل جهاز جولجي",
    bg: ["#5a3200", "#2e1900"],
    caption: "مركز التغليف: يعدّل البروتينات ويشحنها في حويصلات.",
    parts: [
      { label: "الصهاريج", latin: "Cisternae", kind: "stack", color: ["#ffb74d", "#e65100"], x: 0, y: 0, r: 90 },
      { label: "حويصلات النقل", latin: "Vesicles", kind: "vesicle-dots", color: ["#ffe0b2", "#fb8c00"], x: 0, y: 0, r: 86 },
    ],
  },
  lysosome: {
    title: "داخل الليسوسوم",
    bg: ["#5a1030", "#2c0817"],
    caption: "مصنع إعادة التدوير: إنزيمات هاضمة تفكّك الفضلات.",
    parts: [
      { label: "الغشاء", latin: "Membrane", kind: "capsule-ring", color: ["#f06292", "#ad1457"], x: 0, y: 0, r: 92 },
      { label: "إنزيمات هاضمة", latin: "Enzymes", kind: "spark-dots", color: ["#f8bbd0"], x: 0, y: 0, r: 74 },
      { label: "فضلات تُهضَم", latin: "Debris", kind: "bump-dots", color: ["#ce93d8"], x: 0, y: 0, r: 60 },
    ],
  },
  vacuole: {
    title: "داخل الفجوة",
    bg: ["#0b3a5a", "#062031"],
    caption: "خزّان الخلية: ماء ومواد مذابة تحفظ امتلاء الخلية.",
    parts: [
      { label: "الغشاء (التونوبلاست)", latin: "Tonoplast", kind: "capsule-ring", color: ["#4fc3f7", "#0277bd"], x: 0, y: 0, r: 94 },
      { label: "العصارة الخلوية", latin: "Cell sap", kind: "fluid", color: ["#29b6f6"], x: 0, y: 0, r: 88 },
      { label: "مواد مذابة", latin: "Solutes", kind: "spark-dots", color: ["#b3e5fc"], x: 0, y: 0, r: 70 },
    ],
  },
  ribosome: {
    title: "داخل الرايبوسوم",
    bg: ["#3a2a1a", "#1e150c"],
    caption: "آلة بناء البروتين: تربط الأحماض الأمينية حسب شيفرة mRNA.",
    parts: [
      { label: "الوحدة الكبيرة", latin: "Large subunit", kind: "core", color: ["#a1887f", "#4e342e"], x: 0, y: -22, r: 52 },
      { label: "الوحدة الصغيرة", latin: "Small subunit", kind: "core", color: ["#bcaaa4", "#5d4037"], x: 0, y: 30, r: 40 },
      { label: "سلسلة البروتين", latin: "Polypeptide", kind: "chain", color: ["#66bb6a", "#ffca28"], x: 0, y: 0, r: 60 },
    ],
  },
};

export function interiorFor(id) {
  return INTERIORS[organelleKind(id)] || null;
}
