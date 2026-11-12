/* مختبري — محرك العرض (كيبورد فقط)
   Space / Enter / PageDown / ← التالي · PageUp / → السابق
   F ملء الشاشة · M الصوت · T المؤقت · H شريط التحكم · R عكس الأسهم · 1-9 قفز */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const slides = $$('#deck > .slide:not(.skip)');
const N = slides.length;
const EASE = 'cubic-bezier(.22,1,.36,1)';
const gate = $('#gate'), hud = $('#hud'), toastEl = $('#toast'), flash = $('#flash'), clock = $('#clock');
let idx = -1, step = 0, started = false, t0 = 0, pending = null;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
let muted = store.get('deck.muted') === '1';
let flip = store.get('deck.flip') === '1';

function fit() {
  document.documentElement.style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080).toFixed(5));
}
addEventListener('resize', fit);
document.addEventListener('fullscreenchange', fit);
fit();

/* ───── الصوت: WebAudio من بيانات مدمجة (بلا تأخير) ───── */
let ctx = null; const buf = {};
function initAudio() {
  if (ctx || !window.SFXDATA) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    Object.keys(window.SFXDATA).forEach(n => {
      const bin = atob(window.SFXDATA[n]), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      ctx.decodeAudioData(u.buffer, b => { buf[n] = b; }, () => {});
    });
  } catch (e) { ctx = null; }
}
let master = null;
function sfx(n, vol = .5, delay = 0, tries = 12) {
  if (muted || !ctx) return;
  if (!buf[n]) { if (tries > 0 && window.SFXDATA && window.SFXDATA[n]) setTimeout(() => sfx(n, vol, delay, tries - 1), 80); return; }
  try {
    if (ctx.state === 'suspended') ctx.resume();
    if (!master) {           // ضاغط خفيف يمنع التشبع عند تراكب المؤثرات
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
      master = ctx.createGain(); master.gain.value = 1; master.connect(comp); comp.connect(ctx.destination);
    }
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf[n]; g.gain.value = vol;
    s.connect(g); g.connect(master); s.start(ctx.currentTime + delay / 1000);
    const h = { s, g, stop() { try { s.stop(); } catch (e) {} } };
    playing.add(h); s.onended = () => playing.delete(h);
    return h;
  } catch (e) {}
}
const playing = new Set();
function hush(keep) {   // يخفت المؤثرات الجارية بنعومة بدل قطعها
  if (!ctx) return; const t = ctx.currentTime;
  playing.forEach(h => { if (h === keep) return; try { h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + .18); h.s.stop(t + .2); } catch (e) {} playing.delete(h); });
}

/* ───── صور اختيارية: تظهر إن وُجد الملف في assets/photos ───── */
$$('.photo').forEach(p => {
  const im = $('img', p); if (!im) return;
  const ok = () => p.classList.add('has'), no = () => p.classList.add('no');
  if (im.complete) (im.naturalWidth ? ok : no)();
  else { im.addEventListener('load', ok); im.addEventListener('error', no); }
});

/* ───── أدوات لكل شريحة ───── */
slides.forEach(s => {
  s._t = []; s._c = [];
  s.later = (fn, ms) => { s._t.push(setTimeout(fn, ms)); };
  s.tween = (ms, fn) => {
    let raf, st = null;
    const loop = ts => {
      if (st === null) st = ts;
      const p = Math.min(1, (ts - st) / ms);
      fn(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    s._c.push(() => cancelAnimationFrame(raf));
  };
  s.clear = () => { s._t.forEach(clearTimeout); s._c.forEach(f => f()); s._t = []; s._c = []; };
});

const rnd = (a, b) => a + Math.random() * (b - a);
$$('.dust').forEach(d => {
  for (let i = 0; i < 12; i++) {
    const e = document.createElement('i'), z = rnd(2, 4);
    e.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(30, 100)}%;width:${z}px;height:${z}px;--t:${rnd(16, 30)}s;--dl:-${rnd(0, 30)}s;--dx:${rnd(-60, 120)}px;--o:${rnd(.2, .5).toFixed(2)}`;
    d.appendChild(e);
  }
});

/* ═══════════ منطق الشرائح ═══════════ */
const H = {};

/* 1 · صوت الطالبة: يبدأ مع ظهور الجملة ويتوقف عند مغادرة الشريحة */
let voice = null;
const stopVoice = () => { try { if (voice) voice.stop(); } catch (e) {} voice = null; };
H.s1 = {
  enter(s, n, fwd) {
    stopVoice();
    const play = (tries) => {
      if (buf.voice || tries <= 0) voice = sfx('voice', 1) || null;
      else s.later(() => play(tries - 1), 150);   // انتظر فكّ الترميز عند أول تشغيل
    };
    s.later(() => play(12), 700);
  },
  leave: stopVoice
};

(() => {
  const grid = $('#grid'), c1 = $('#c1'), c2 = $('#c2');
  for (let i = 0; i < 100; i++) grid.appendChild(document.createElement('i'));
  const cells = $$('i', grid);
  let seed = 7; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const order = Array.from({ length: 100 }, (_, i) => i);
  for (let i = 99; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const outs = order.slice(12);
  const setC1 = v => { c1.textContent = '+' + v; };
  const restore = () => { cells.forEach(c => c.classList.remove('off')); c2.textContent = '0'; };
  function outage(s, anim) {
    if (!anim) { outs.forEach(i => cells[i].classList.add('off')); c2.textContent = '88'; return; }
    restore();
    sfx('outage', .8);
    outs.forEach((ci, k) => s.later(() => { cells[ci].classList.add('off'); c2.textContent = String(k + 1); },
      1000 + Math.pow(k / outs.length, 1.7) * 2600));
  }
  H.s2 = {
    enter(s, n) {
      if (n === 0) { setC1(0); restore(); s.later(() => { s.tween(1800, e => setC1(Math.round(e * 140))); sfx('count', .85); }, 600); }
      else { setC1(140); outage(s, false); }
    },
    step(s, n, fwd) { if (n >= 1) { outage(s, fwd); return true; } s.clear(); hush(); restore(); return true; },
    leave() { setC1(0); restore(); }
  };
})();

/* 3 · شاشة الهاتف: تُسقط على زوايا الشاشة في الصورة (homography → matrix3d) */
(() => {
  const el = $('#scr3'); if (!el) return;
  const W = 278, Hh = 572;
  const Q = [[247, 219], [531, 221], [525, 798], [255, 795]];   // TL TR BR BL بإحداثيات الصورة 860×1080
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let t = b[i]; for (let c = i + 1; c < n; c++) t -= A[i][c] * x[c]; x[i] = t / A[i][i]; }
    return x;
  }
  const src = [[0, 0], [W, 0], [W, Hh], [0, Hh]], A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = Q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
  el.style.transform = `matrix3d(${m.map(v => +v.toFixed(8)).join(',')})`;
})();
H.s3 = {
  step(s, n, fwd) { if (fwd && n === 1) { sfx('reveal3', .85); return true; } return true; },
  leave(s) { s.classList.remove('diving'); }
};

H.s4 = { enter(s) {} };

/* 5 · التجارب: انتقال خاص لكل تجربة (شرارة · موجة ماء · طيف الحموضة) */
(() => {
  const scr = $('#s5 .scr'), imgs = $$('#s5 .scr img'), exps = $$('#s5 .exp'), phone = $('#s5 .phone');
  const roll = $('#s5 .num5 .roll'), cv = $('#fx5'), g = cv.getContext('2d'), fl = $('#s5 .flash5');
  const CW = cv.width, CH = cv.height;
  let raf = 0, finish = null, cur = 0;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const text = i => { exps.forEach((e, k) => e.classList.toggle('on', k === i)); roll.style.transform = `translateY(${-Math.max(0, i) * 170}px)`; };
  const plain = i => { imgs.forEach((im, k) => { im.classList.remove('top'); im.style.clipPath = ''; im.classList.toggle('on', k === i); }); };
  function stop() { cancelAnimationFrame(raf); if (finish) { const f = finish; finish = null; f(); } g.clearRect(0, 0, CW, CH); fl.style.opacity = 0; phone.classList.remove('zap'); }
  function run(ms, frame, done) {
    stop(); let t0 = null;
    finish = () => { done(); g.clearRect(0, 0, CW, CH); };
    const loop = ts => { if (t0 === null) t0 = ts; const p = Math.min(1, (ts - t0) / ms); frame(p, ts / 1000); if (p < 1) raf = requestAnimationFrame(loop); else stop(); };
    raf = requestAnimationFrame(loop);
  }
  const tilt = () => phone.animate([{ transform: 'none' }, { transform: 'perspective(2200px) rotateY(-5deg) scale(.985)', offset: .35 }, { transform: 'none' }], { duration: 1200, easing: 'cubic-bezier(.4,0,.2,1)' });
  function bolt(x0, y0, x1, y1, dev) {
    let pts = [[x0, y0], [x1, y1]];
    for (let it = 0; it < 6; it++) {
      const n = [pts[0]];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; n.push([(a[0] + b[0]) / 2 + (Math.random() - .5) * dev, (a[1] + b[1]) / 2 + (Math.random() - .5) * dev * .4]); n.push(b); }
      pts = n; dev *= .55;
    }
    return pts;
  }
  /* ⚡ الكهرباء الساكنة: الشاشة تشتعل بشرارات ثم تظهر التجربة */
  function zap() {
    plain(-1); const im = imgs[0]; let shown = false, bolts = [];
    phone.classList.add('zap');
    run(900, p => {
      g.clearRect(0, 0, CW, CH);
      const fr = Math.floor(p * 18);
      if (fr % 3 === 0 && bolts.fr !== fr) { bolts = [0, 1, 2].map(() => bolt(Math.random() * CW, -10, Math.random() * CW, CH + 10, 380)); bolts.fr = fr; }
      const on = p < .62 && (fr % 3 !== 2);
      fl.style.opacity = p < .62 ? (on ? .35 + Math.random() * .35 : 0) : Math.max(0, .8 * (1 - (p - .62) / .38));
      if (on) bolts.forEach(pts => { g.lineJoin = 'round'; g.shadowColor = '#7fd8ff'; g.shadowBlur = 26; g.strokeStyle = 'rgba(210,240,255,.95)'; g.lineWidth = 4;
        g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); });
      if (!shown && p > .3) { shown = true; im.classList.add('cut', 'on'); }
      if (p > .62) phone.classList.remove('zap');
    }, () => { imgs.forEach(i => i.classList.remove('cut')); plain(0); phone.classList.remove('zap'); });
  }
  /* 🌊 الطفو: الماء يرتفع ويكشف التجربة */
  function wave(to) {
    const im = imgs[to]; im.classList.add('top'); im.style.clipPath = 'polygon(0 100%,100% 100%,100% 100%,0 100%)';
    const bub = Array.from({ length: 34 }, () => ({ x: Math.random() * CW, o: Math.random(), r: 3 + Math.random() * 9, s: .4 + Math.random() * .8 }));
    tilt();
    run(1500, (p, t) => {
      const e = ease(p), lvl = CH * (1.06 - 1.2 * e), amp = 26 * Math.sin(Math.PI * Math.min(1, p * 1.15)) + 4 * (1 - p);
      const ys = []; for (let x = 0; x <= CW + 1; x += 18) ys.push([x, lvl + amp * Math.sin(x / CW * 9.4 + t * 7) + amp * .45 * Math.sin(x / CW * 21 - t * 11)]);
      im.style.clipPath = 'polygon(' + ys.map(([x, y]) => `${x}px ${y.toFixed(1)}px`).join(',') + `,${CW}px ${CH + 40}px,0 ${CH + 40}px)`;
      g.clearRect(0, 0, CW, CH);
      const grd = g.createLinearGradient(0, lvl - 40, 0, lvl + 90); grd.addColorStop(0, 'rgba(120,210,255,0)'); grd.addColorStop(.35, 'rgba(120,210,255,.42)'); grd.addColorStop(1, 'rgba(60,150,230,0)');
      g.fillStyle = grd; g.beginPath(); ys.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(CW, lvl + 120); g.lineTo(0, lvl + 120); g.fill();
      g.strokeStyle = 'rgba(235,250,255,.95)'; g.lineWidth = 5; g.shadowColor = 'rgba(160,225,255,.9)'; g.shadowBlur = 14;
      g.beginPath(); ys.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.shadowBlur = 0;
      bub.forEach(b => { const y = lvl + 30 + (1 - ((p * b.s * 2.2 + b.o) % 1)) * (CH - lvl + 40); if (y < lvl + 8 || y > CH) return;
        g.globalAlpha = .75 * (1 - p * .6); g.strokeStyle = '#e6f7ff'; g.lineWidth = 2; g.beginPath(); g.arc(b.x + Math.sin(t * 4 + b.o * 9) * 6, y, b.r, 0, 7); g.stroke(); g.globalAlpha = 1; });
    }, () => plain(to));
  }
  /* 🧪 الرقم الهيدروجيني: شريط طيف الحموضة يمسح الشاشة */
  function spectrum(to) {
    const im = imgs[to]; im.classList.add('top'); im.style.clipPath = 'inset(0 0 0 100%)';
    const cols = ['#e53935', '#f4511e', '#fb8c00', '#fdd835', '#7cb342', '#26a69a', '#1e88e5', '#3949ab', '#7b1fa2'];
    tilt();
    run(1300, (p, t) => {
      const e = ease(p), bw = 150, x = CW + bw / 2 - e * (CW + bw * 1.2);
      im.style.clipPath = `inset(0 0 0 ${Math.max(0, x + 10).toFixed(1)}px)`;
      g.clearRect(0, 0, CW, CH);
      const grd = g.createLinearGradient(0, 0, 0, CH); cols.forEach((c, i) => grd.addColorStop(i / (cols.length - 1), c));
      g.globalAlpha = .9; g.fillStyle = grd; g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = 30;
      g.fillRect(x - bw / 2 + 30, 0, bw - 60, CH);
      const tr = g.createLinearGradient(x + bw / 2 - 30, 0, x + bw * 2.2, 0); tr.addColorStop(0, 'rgba(255,255,255,.45)'); tr.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = .55 * (1 - p); g.globalCompositeOperation = 'overlay'; g.fillStyle = grd; g.fillRect(x + bw / 2 - 30, 0, bw * 1.7, CH); g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - 2, 0, 4, CH);
    }, () => plain(to));
  }
  H.s5 = {
    enter(s, n, fwd) {
      cur = Math.min(n, 2);
      if (fwd && n === 0) { stop(); plain(-1); exps.forEach(e => e.classList.remove('on')); roll.style.transform = '';
        s.later(() => { zap(); sfx('zap5', 1); }, 620); s.later(() => text(0), 880); }
      else { stop(); plain(cur); text(cur); }
    },
    step(s, n, fwd) {
      s.clear();
      const to = Math.min(n, 2);
      if (n === 3) { stop(); sfx('list5', .85); return true; }
      if (!fwd) { stop(); plain(to); text(to); cur = to; return true; }
      if (to === 1) { wave(1); sfx('water5', .8); }
      else if (to === 2) { spectrum(2); sfx('ph5', .75); }
      text(to); cur = to; return true;
    },
    leave() { stop(); }
  };
})();



(() => {
  /* بنفوش: السؤال يظهر، والجواب يُكتب حرفاً حرفاً كأنه يجيب الآن */
  const lines = $$('#s6 .card span:not(.sizer)'), modes = $$('#s6 .modes span');
  let tm = null, cur = -1;
  const stop = () => { clearInterval(tm); tm = null; };
  const show = i => {
    stop(); cur = i;
    lines.forEach((l, k) => l.classList.toggle('on', k === i));
    modes.forEach((m, k) => m.classList.toggle('on', k === i));
    lines.forEach(l => { const a = $('em', l); if (a) a.textContent = a.dataset.t; });
    const a = lines[i] && $('em', lines[i]);
    if (!a) return;
    const t = a.dataset.t; let n = 0;
    a.textContent = '';
    setTimeout(() => {
      tm = setInterval(() => {
        n++;
        a.innerHTML = '';
        a.append(t.slice(0, n));
        const rest = document.createElement('i'); rest.style.cssText = 'opacity:0;font-style:normal'; rest.textContent = t.slice(n); a.append(rest);
        if (n >= t.length) stop();
      }, 34);
    }, 450);
  };
  H.s6 = {
    enter(s, n) { show(Math.min(n, 2)); },
    step(s, n, fwd) { const i = Math.min(n, 2); if (i !== cur) show(i); if (fwd) sfx(n === 3 ? 'strip' : 'msg', .9); return true; },
    leave: stop
  };
})();

(() => {
  const NS = 'http://www.w3.org/2000/svg', net = $('#netsvg'), flows = $('#flows');
  const layers = [{ n: 5, x: 350, y0: 100, dy: 80 }, { n: 6, x: 250, y0: 100, dy: 66 }, { n: 5, x: 150, y0: 100, dy: 80 }, { n: 4, x: 50, y0: 120, dy: 95 }];
  const pts = layers.map(L => Array.from({ length: L.n }, (_, i) => ({ x: L.x, y: L.y0 + i * L.dy })));
  const mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  for (let l = 0; l < pts.length - 1; l++) pts[l].forEach(a => pts[l + 1].forEach(b => net.appendChild(mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }))));
  pts.forEach((col, ci) => col.forEach(p => { const c = mk('circle', { cx: p.x, cy: p.y, r: 8 }); c.style.setProperty('--nd', (ci * .25) + 's'); net.appendChild(c); }));
  for (let i = 0; i < 5; i++) { const cy = 250 + i * 100 + 48, ty = 372 + pts[0][i].y; flows.appendChild(mk('path', { class: 'in', d: `M1230,${cy} C1160,${cy} 1150,${ty} 1078,${ty}` })); }
  for (let j = 0; j < 4; j++) { const sy = 372 + pts[3][j].y, ty = 250 + j * 88 + 42; flows.appendChild(mk('path', { class: 'out', d: `M762,${sy} C700,${sy} 690,${ty} 632,${ty}` })); }
  const paint = n => { $$('path.in', flows).forEach(p => p.classList.toggle('on', n >= 1)); $$('path.out', flows).forEach(p => p.classList.toggle('on', n >= 2)); };
  H.s7 = {
    enter(s, n) { paint(n); }, leave() { paint(0); },
    step(s, n, fwd) { paint(n); if (fwd) sfx(['', 'data7', 'tags7', 'rec7'][n], .85); return true; }
  };
})();

(() => {
  const d = $('#dots7');
  for (let i = 0; i < 7; i++) d.appendChild(document.createElement('i'));
  const dots = $$('i', d);
  const set = n => dots[0].classList.toggle('on', n >= 1);
  H.s8 = { enter(s, n) { set(n); }, leave() { set(0); }, step(s, n, fwd) { set(n); if (fwd) sfx(n === 1 ? 'goal8' : 'strip', .9); return true; } };
})();
H.s9 = { step(s, n, fwd) { if (fwd) sfx(n === 1 ? 'card9' : 'strip', .9); return true; } };
H.s10 = { enter(s, n, fwd) { if (fwd) sfx('room10', .8, 300); }, step(s, n, fwd) { if (fwd) sfx('door' + n, .85); else hush(); return true; } };
H.s11 = { enter(s) { s.later(() => sfx('end', .75), 950); } };

const hook = (s, name, ...a) => { const h = H[s.id]; return h && h[name] ? h[name](s, ...a) : undefined; };

/* ═══════════ الانتقالات (opacity/transform فقط) ═══════════ */
const T = {
  fade(from, to, fwd, fast) {
    const d = fast ? 450 : 850;
    return [to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'ease', fill: 'both' })];
  },
  push(from, to, fwd) {
    const s = fwd ? -1 : 1;
    return [
      from.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-s * 18}%)`, opacity: 0 }], { duration: 850, easing: EASE, fill: 'both' }),
      to.animate([{ transform: `translateX(${s * 100}%)` }, { transform: 'translateX(0)' }], { duration: 850, easing: EASE, fill: 'both' })
    ];
  },
  /* الغوص داخل شاشة الهاتف: الكاميرا تدخل الشاشة فتصبح الشاشة هي الشريحة التالية */
  dive(from, to) {
    const r = $('#scr3').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const S = Math.max(innerWidth / r.width, innerHeight / r.height) * 1.6;
    from.classList.add('diving');
    from.style.transformOrigin = `${cx}px ${cy}px`;
    return [
      from.animate([{ transform: 'scale(1)', filter: 'blur(0)' }, { transform: 'scale(1.06)', offset: .22 }, { transform: `scale(${S})`, filter: 'blur(1.5px)' }],
        { duration: 1350, easing: 'cubic-bezier(.62,0,.32,1)', fill: 'both' }),
      to.animate([{ opacity: 0, transform: 'scale(1.18)' }, { opacity: 0, transform: 'scale(1.18)', offset: .56 }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 1700, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }),
      flash.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(.2)', offset: .55 }, { opacity: .28, transform: 'scale(.7)', offset: .7 }, { opacity: 0, transform: 'scale(1.3)' }],
        { duration: 1700, easing: 'ease-out', fill: 'both' })
    ];
  },
  bloom(from, to) {
    return [
      to.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 1500, easing: 'ease-out', fill: 'both' }),
      flash.animate([{ opacity: 0, transform: 'scale(.15)' }, { opacity: .9, transform: 'scale(.6)', offset: .35 }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 1500, easing: 'ease-out', fill: 'both' })
    ];
  }
};

const maxStep = s => +(s.dataset.steps || 0);
function paint(s, n) { s.dataset.step = n; $$('.st', s).forEach(el => el.classList.toggle('on', +el.dataset.s <= n)); }
function leave(s) { hook(s, 'leave'); s.clear(); s.classList.remove('active'); paint(s, 0); }

function go(to, fwd) {
  if (to < 0 || to >= N || to === idx) return;
  if (pending) pending();
  const from = idx >= 0 ? slides[idx] : null, next = slides[to];
  if (fwd === undefined) fwd = to > idx;
  idx = to; step = fwd ? 0 : maxStep(next);
  next.classList.add('show', 'active'); next.style.zIndex = 2;
  paint(next, step); hook(next, 'enter', step, fwd);
  if (from) {
    from.style.zIndex = 1;
    const kind = fwd ? (next.dataset.in || 'fade') : 'fade';
    hush();
    if (kind === 'dive') sfx('dive', .9);
    else if (kind === 'push') sfx('push', .8);
    else if (fwd) sfx('next', .75);
    else sfx('prev', .6);
    const anims = T[kind](from, next, fwd, !fwd);
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      anims.forEach(a => { try { a.cancel(); } catch (e) {} });
      from.classList.remove('show'); from.style.zIndex = ''; from.style.transformOrigin = ''; next.style.zIndex = '';
      leave(from); pending = null;
    };
    pending = fin;
    Promise.all(anims.map(a => a.finished)).then(fin).catch(() => {});
  } else next.style.zIndex = '';
  updateUI();
  try { history.replaceState(null, '', '#' + (idx + 1)); } catch (e) {}
}
function setStep(n, fwd) {
  const s = slides[idx]; step = n; paint(s, n);
  if (!hook(s, 'step', n, fwd) && fwd) sfx('strip', .9);
}
function next() { if (idx < 0) return; if (step < maxStep(slides[idx])) setStep(step + 1, true); else if (idx + 1 < N) go(idx + 1, true); }
function prev() { if (idx < 0) return; if (step > 0) setStep(step - 1, false); else go(idx - 1, false); }

/* ═══════════ تحكم ═══════════ */
const dotsEl = $('#dots');
slides.forEach((_, i) => { const b = document.createElement('b'); b.addEventListener('click', () => go(i)); dotsEl.appendChild(b); });
function updateUI() { $$('b', dotsEl).forEach((b, i) => b.classList.toggle('cur', i === idx)); }
function setMuteIcon() { $('#bSnd use').setAttribute('href', muted ? '#i-mute' : '#i-snd'); }
setMuteIcon();
function toast(t) { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 1500); }
function toggleFull() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
function toggleMute() { muted = !muted; store.set('deck.muted', muted ? '1' : '0'); setMuteIcon(); toast(muted ? 'الصوت مكتوم' : 'الصوت يعمل'); }

hud.addEventListener('click', e => e.stopPropagation());
$('#bPrev').addEventListener('click', prev);
$('#bNext').addEventListener('click', next);
$('#bFull').addEventListener('click', toggleFull);
$('#bSnd').addEventListener('click', toggleMute);
document.addEventListener('click', e => { if (started && !e.target.closest('#hud') && !e.target.closest('#gate')) next(); });
document.addEventListener('contextmenu', e => { e.preventDefault(); if (started) prev(); });
let idleT;
addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (started) document.body.classList.add('idle'); }, 2000); });

setInterval(() => {
  if (!started || !clock.classList.contains('on')) return;
  const sec = Math.floor((Date.now() - t0) / 1000);
  clock.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  clock.classList.toggle('warn', sec >= 270 && sec < 300);
  clock.classList.toggle('over', sec >= 300);
}, 500);

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, c = e.code;
  if (!started) { if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); } else if (c === 'KeyF') toggleFull(); return; }
  const NEXT = ['PageDown', 'ArrowDown', 'Enter', ' ', flip ? 'ArrowRight' : 'ArrowLeft'];
  const PREV = ['PageUp', 'ArrowUp', 'Backspace', flip ? 'ArrowLeft' : 'ArrowRight'];
  if (NEXT.includes(k)) { e.preventDefault(); if (!e.repeat) next(); }
  else if (PREV.includes(k)) { e.preventDefault(); if (!e.repeat) prev(); }
  else if (k === 'Home') go(0, false);
  else if (k === 'End') go(N - 1, true);
  else if (c === 'KeyF') toggleFull();
  else if (c === 'KeyM') toggleMute();
  else if (c === 'KeyT') clock.classList.toggle('on');
  else if (c === 'KeyH') hud.classList.toggle('show');
  else if (c === 'KeyR') { flip = !flip; store.set('deck.flip', flip ? '1' : '0'); toast(flip ? 'التالي: السهم الأيمن' : 'التالي: السهم الأيسر'); }
  else if (/^[1-9]$/.test(k)) go(+k - 1);
});

function start(jump) {
  if (started) return;
  started = true; t0 = Date.now(); initAudio();
  if (jump === undefined) {
    setTimeout(() => sfx('gate', .9), 60);
    try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  }
  gate.classList.add('gone');
  setTimeout(() => go(jump || 0, true), jump === undefined ? 450 : 0);
}
$('#go').addEventListener('click', e => { e.stopPropagation(); start(); });
const m = location.hash.match(/^#(\d+)$/);
if (m && +m[1] >= 1 && +m[1] <= N) start(+m[1] - 1);

window.__deck = { go, next, prev, get idx() { return idx; }, get step() { return step; }, get sounds() { return Object.keys(buf); } };
})();
