/* مختبري — محرك العرض (كيبورد فقط)
   Space / Enter / PageDown / ← التالي · PageUp / → السابق
   F ملء الشاشة · M الصوت · T المؤقت · H شريط التحكم · R عكس الأسهم · 1-9 قفز */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const slides = $$('#deck > .slide');
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
function sfx(n, vol = .5) {
  if (muted || !ctx || !buf[n]) return;
  try {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf[n]; g.gain.value = vol;
    s.connect(g); g.connect(ctx.destination); s.start();
    return s;
  } catch (e) {}
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
    s.later(() => sfx('out', .4), 900);
    outs.forEach((ci, k) => s.later(() => { cells[ci].classList.add('off'); c2.textContent = String(k + 1); },
      1000 + Math.pow(k / outs.length, 1.7) * 2600));
  }
  H.s2 = {
    enter(s, n) {
      if (n === 0) { setC1(0); restore(); s.later(() => { s.tween(1800, e => setC1(Math.round(e * 140))); sfx('tick', .3); }, 600); }
      else { setC1(140); outage(s, false); }
    },
    step(s, n, fwd) { if (n >= 1) { outage(s, fwd); return true; } s.clear(); restore(); return true; },
    leave() { setC1(0); restore(); }
  };
})();

H.s4 = { enter(s) { /* الصوت يصدر من انتقال الضوء */ } };

(() => {
  const imgs = $$('#s5 .scr img'), exps = $$('#s5 .exp');
  const show = i => { imgs.forEach((im, k) => im.classList.toggle('on', k === i)); exps.forEach((e, k) => e.classList.toggle('on', k === i)); };
  H.s5 = { enter(s, n) { show(Math.min(n, 2)); }, step(s, n) { show(Math.min(n, 2)); } };
})();

(() => {
  const lines = $$('#s6 .card span:not(.sizer)'), modes = $$('#s6 .modes span');
  const show = i => { lines.forEach((l, k) => l.classList.toggle('on', k === i)); modes.forEach((m, k) => m.classList.toggle('on', k === i)); };
  H.s6 = { enter(s, n) { show(n); }, step(s, n) { show(n); } };
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
    step(s, n, fwd) { paint(n); if (fwd && n === 1) { sfx('conn', .4); return true; } if (fwd && n === 2) { sfx('pop', .35); return true; } if (fwd && n === 3) { sfx('ok', .35); return true; } }
  };
})();

(() => {
  const d = $('#dots7');
  for (let i = 0; i < 7; i++) d.appendChild(document.createElement('i'));
  const dots = $$('i', d);
  const set = n => dots[0].classList.toggle('on', n >= 1);
  H.s8 = { enter(s, n) { set(n); }, leave() { set(0); }, step(s, n, fwd) { set(n); if (fwd) { sfx(n === 1 ? 'ok' : 'pop', .35); return true; } } };
})();
H.s9 = { step(s, n, fwd) { if (fwd) { sfx('pop', .35); return true; } } };
H.s10 = { step(s, n, fwd) { if (fwd) { sfx('pop', .35); return true; } } };
H.s11 = { enter(s) { s.later(() => sfx('end', .5), 1900); } };

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
    sfx(kind === 'bloom' ? 'bloom' : fwd ? 'next' : 'prev', kind === 'bloom' ? .55 : .22);
    const anims = T[kind](from, next, fwd, !fwd);
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      anims.forEach(a => { try { a.cancel(); } catch (e) {} });
      from.classList.remove('show'); from.style.zIndex = ''; next.style.zIndex = '';
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
  if (!hook(s, 'step', n, fwd) && fwd) sfx('step', .3);
}
function next() { if (idx < 0) return; if (step < maxStep(slides[idx])) setStep(step + 1, true); else go(idx + 1, true); }
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
    setTimeout(() => sfx('gate', .35), 120);
    try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  }
  gate.classList.add('gone');
  setTimeout(() => go(jump || 0, true), jump === undefined ? 450 : 0);
}
$('#go').addEventListener('click', e => { e.stopPropagation(); start(); });
const m = location.hash.match(/^#(\d+)$/);
if (m && +m[1] >= 1 && +m[1] <= N) start(+m[1] - 1);

window.__deck = { go, next, prev, get idx() { return idx; }, get step() { return step; } };
})();
