/**
 * banfoushApi.js — وسيط خادم لـ"بنفوش" داخل Vite (dev + preview).
 *
 * المفتاح XAI_API_KEY يُقرأ من .env.local على الخادم فقط ولا يصل للمتصفح
 * أبداً. المتصفح يرسل الرسائل وسياقاً بسيطاً، والخادم يبني تعليمات النظام
 * بنفسه (حتى لا يستطيع أحد تغيير شخصية بنفوش من المتصفح) ثم يمرّر الرد
 * من xAI كبثّ حيّ (SSE).
 *
 *   GET  /api/banfoush      → { ai, tts, budget }
 *   POST /api/banfoush      → text/event-stream (صيغة OpenAI chat.completions)
 *   POST /api/banfoush/tts  → audio/mpeg (صوت Grok، محفوظ بعد أول مرة)
 *
 * كل صرف (محادثة + صوت) محكوم بسقف أسبوعي/يومي (budget.js).
 */
import { createBudget, PRICE } from "./budget.js";
import { createVoice } from "./voice.js";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";

const EXP_TITLES = {
  buoyancy: "الطفو",
  ph: "الأس الهيدروجيني",
  static: "الكهرباء الساكنة",
  color: "رؤية الألوان",
  cell: "رحلة داخل الخلية",
};

const PERSONA = `أنت "بنفوش"، وحش بنفسجي فروي لطيف، والمساعد الذكي داخل تطبيق "مختبري" — مختبر تجارب علمية تفاعلي للأطفال من ٨ إلى ١٤ سنة.
شخصيتك: مرح، مشجّع، فضولي، بتحب العلوم أكثر من الشوكولاتة، وبتنادي الطالب "يا بطل" أحياناً.

قواعد الرد:
- جاوب على سؤال الطالب نفسه مباشرة وبدقة علمية من أول جملة، بكلمات يفهمها طفل.
- إذا في علاقة علمية واضحة ومباشرة بين السؤال وتجربة من تجارب التطبيق، اذكرها بجملة قصيرة. إذا ما في علاقة واضحة، لا تربط أبداً ولا تخترع تشابه.
- احكِ بلهجة فلسطينية بسيطة وواضحة.
- اكتب ردّك كله بالتشكيل الكامل (الحركات) على كل الحروف كما تُنطق بلهجتك، لأن ردّك سيُقرأ بصوت عالٍ.
- جملتين لثلاث جمل قصيرة فقط (أقل من ٥٥ كلمة).
- إذا بتعرف اسم الطالب، ناديه باسمه أحياناً.
- إذا ما كنت متأكد من معلومة، قول بصراحة إنك مش متأكد.
- بدون إيموجي، بدون ماركداون، بدون قوائم أو عناوين.
- لا تطلب أي معلومات شخصية غير الاسم الأول.
- إذا السؤال مش مناسب للأطفال أو بعيد كثير عن العلوم، رجّع الحديث بلطف للتجارب.

التجارب الموجودة بالتطبيق (اعتمد عليها في إجاباتك):
١) الطفو: مبدأ أرخميدس — قوة الطفو تساوي وزن السائل المُزاح، والجسم يطفو إذا كانت كثافته أقل من كثافة السائل. الطالب يسحب أجساماً (خشب، جليد، طوب، فلين، تفاحة، فولاذ) إلى سوائل (ماء عذب، ماء البحر، زيت زيتون، عسل، جليسرين) ويرى سهم الوزن الأحمر وسهم قوة الطفو الأزرق.
٢) الأس الهيدروجيني: مقياس pH من ٠ إلى ١٤؛ أقل من ٧ حمضي، ٧ متعادل، أكثر من ٧ قاعدي. الطالب يصب سوائل من الرف (عصير ليمون، خل، صابون، ماء...) ويخففها بالماء ويقرأ جهاز الـ pH.
٣) الكهرباء الساكنة: فرك البالون بالكنزة الصوف ينقل إلكترونات إلى البالون فيصبح مشحوناً بالسالب وينجذب للكنزة أو الجدار.
٤) رؤية الألوان: مزج أضواء الأحمر والأخضر والأزرق (مزج جمعي)، في الشبكية ثلاثة أنواع من المخاريط، والدماغ يفسّر إشاراتها؛ أحمر+أخضر=أصفر، والثلاثة معاً=أبيض.
٥) رحلة داخل الخلية: التكبير بالمجهر من قطرة ماء حتى داخل الخلية؛ النواة فيها الـ DNA، الميتوكوندريا تنتج الطاقة، والغشاء يحمي الخلية وينظّم ما يدخل ويخرج.`;

const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

function buildSystem(ctx = {}) {
  const lines = [];
  const name = clip(ctx.name, 20).replace(/[^\p{L}\s]/gu, "").trim();
  if (name) lines.push(`اسم الطالب: ${name}.`);
  if (ctx.screen && EXP_TITLES[ctx.screen]) lines.push(`الطالب الآن داخل تجربة "${EXP_TITLES[ctx.screen]}".`);
  else lines.push("الطالب الآن في الشاشة الرئيسية يختار تجربة.");
  if (EXP_TITLES[ctx.selected]) lines.push(`التجربة المحددة في الشاشة الرئيسية: "${EXP_TITLES[ctx.selected]}".`);
  const visited = Array.isArray(ctx.visited) ? ctx.visited.filter((k) => EXP_TITLES[k]).map((k) => EXP_TITLES[k]) : [];
  if (visited.length) lines.push(`التجارب اللي جرّبها: ${visited.join("، ")}.`);
  return `${PERSONA}\n\nالسياق الحالي:\n${lines.join("\n")}`;
}

function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: clip(m.content, 600) }));
}

async function readJson(req, limit = 32 * 1024) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error("too-large");
  }
  return JSON.parse(raw || "{}");
}

export default function banfoushApi(env = {}) {
  const key = env.XAI_API_KEY;
  const model = env.XAI_MODEL || DEFAULT_MODEL;
  const root = process.cwd();
  const budget = createBudget(root, {
    weeklyUsd: Number(env.XAI_WEEKLY_USD) || 1.9,
    dailyUsd: Number(env.XAI_DAILY_USD) || 0.4,
  });
  const voice = key
    ? createVoice({ key, model, voice: env.XAI_TTS_VOICE || "ara", lang: env.XAI_TTS_LANG || "ar-SA", speed: Number(env.XAI_TTS_SPEED) || 1.05 }, budget, root)
    : null;

  const json = (res, code, obj) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
  };

  async function chat(req, res) {
    if (!key) return json(res, 503, { error: "no-key" });
    if (!budget.canSpend(0.006)) return json(res, 429, { error: "budget" });
    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: "bad-json" });
    }
    const messages = cleanMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") return json(res, 400, { error: "no-question" });
    const system = buildSystem(body.context);
    try {
      const upstream = await fetch(XAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.6,
          max_tokens: 320,
          messages: [{ role: "system", content: system }, ...messages],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!upstream.ok || !upstream.body) return json(res, 502, { error: "upstream" });
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive" });
      const dec = new TextDecoder();
      let tail = "";
      let outChars = 0;
      for await (const chunk of upstream.body) {
        res.write(chunk);
        const s = dec.decode(chunk, { stream: true });
        outChars += s.length;
        tail = (tail + s).slice(-4000);
      }
      res.end();
      // التكلفة الفعلية من usage إن وُجد، وإلا تقدير محافظ
      const m = tail.match(/"prompt_tokens"\s*:\s*(\d+)[\s\S]*?"completion_tokens"\s*:\s*(\d+)/);
      const inTok = m ? +m[1] : Math.ceil((system.length + JSON.stringify(messages).length) / 2.5);
      const outTok = m ? +m[2] : Math.ceil(outChars / 12);
      budget.spend(inTok * PRICE.inPerToken + outTok * PRICE.outPerToken);
    } catch {
      if (!res.headersSent) json(res, 504, { error: "timeout" });
      else res.end();
    }
  }

  async function tts(req, res) {
    if (!voice) return json(res, 503, { error: "no-key" });
    let body;
    try {
      body = await readJson(req, 8 * 1024);
    } catch {
      return json(res, 400, { error: "bad-json" });
    }
    const mood = ["talk", "happy", "wow", "sleepy", "think", "hero"].includes(body.mood) ? body.mood : "talk";
    try {
      const { audio, cached } = await voice.speech(clip(body.text, 700), mood);
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audio.length, "X-Banfoush-Cache": cached ? "hit" : "miss" });
      res.end(audio);
    } catch (e) {
      json(res, e.code === "budget" ? 429 : 502, { error: e.code || "tts" });
    }
  }

  async function handler(req, res, next) {
    const path = (req.url || "").split("?")[0];
    if (path !== "/api/banfoush" && path !== "/api/banfoush/tts") return next();
    res.setHeader("Cache-Control", "no-store");
    if (path === "/api/banfoush/tts") {
      if (req.method !== "POST") return json(res, 405, {});
      return tts(req, res);
    }
    if (req.method === "GET") {
      return json(res, 200, { ai: !!key && budget.canSpend(0.006), tts: !!voice && budget.canSpend(0.002), budget: budget.status() });
    }
    if (req.method !== "POST") return json(res, 405, {});
    return chat(req, res);
  }

  return {
    name: "banfoush-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
