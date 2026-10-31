// スクロールをペダルに見立てて、3Dの世界・画面の文字・ハンドルのスマホを動かす。
import { createWorld, L } from './world.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const band = (x, a, b, f) => sstep(a - f, a + f, x) * (1 - sstep(b - f, b + f, x));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth <= 760;

const ride = $('#ride'), stage = $('#stage'), canvas = $('#world'), top = $('#top'), hero = $('#hero');
const cockpit = $('#cockpit'), phone = $('#phone'), flash = $('#flash');
const chaps = $$('.chap').map(el => ({ el, a: +el.dataset.a, b: +el.dataset.b, on: false }));
const routeLis = $$('#routeHud li'), routeFill = $('#routeFill'), routeHud = $('#routeHud'), meter = $('.meter');
const mKm = $('#mKm'), mEl = $('#mEl'), mClock = $('#mClock'), sbClock = $('#sbClock');

let world;
try { world = createWorld(canvas, { quality: isSmall() || /Mobi|Android/.test(navigator.userAgent) ? .6 : 1 }); }
catch (e) { document.documentElement.classList.add('no-webgl'); }

/* ---------- スマホの画面 ---------- */
const SPOTS = world ? world.SPOTS : [];
const screen = $('.screen');
let scName = 'start';
function show(name) {
  if (name === scName) return;
  scName = name;
  $$('.sc').forEach(s => s.classList.toggle('is-on', s.dataset.sc === name));
  screen.dataset.tint = name === 'audio' || name === 'done' ? 'light' : '';
  if (name !== 'audio') stopSpeech();
  if (name === 'chat') enterChat();
}
let toastTimer;
function toast(text) {
  const el = $('#toast'); el.textContent = text; el.classList.add('is-on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// 地図
const mapEl = $('#map'); let routeDone, meDot, meHalo; const pinEls = [];
function buildMap() {
  if (!world) return;
  const pts = world.route, xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const k = Math.min(170 / (maxX - minX || 1), 268 / (maxZ - minZ || 1));
  const ox = 120 - (minX + maxX) / 2 * k, oy = 222 - (minZ + maxZ) / 2 * k;
  mapEl.toProj = (x, z) => [x * k + ox, z * k + oy];
  const d = pts.map(p => mapEl.toProj(p[0], p[1]).map(v => v.toFixed(1)).join(',')).join(' L');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent = mapEl) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([a, b]) => e.setAttribute(a, b)); parent.appendChild(e); return e; };
  el('rect', { class: 'lnd', width: 240, height: 420 });
  [[20, 60, 70, 60], [150, 80, 70, 50], [24, 200, 56, 90], [160, 230, 60, 70], [40, 330, 80, 50], [150, 340, 70, 60]].forEach(b => el('rect', { class: 'blk', x: b[0], y: b[1], width: b[2], height: b[3], rx: 4 }));
  ['M0 150L240 110', 'M0 300L240 330', 'M60 0L90 420', 'M190 0L170 420'].forEach(p => el('path', { class: 'rd', d: p }));
  el('path', { class: 'rt', d: 'M' + d });
  routeDone = el('path', { class: 'rtd', d: 'M' + d });
  const len = routeDone.getTotalLength(); routeDone.style.strokeDasharray = len; routeDone.style.strokeDashoffset = len; routeDone.dataset.len = len;
  SPOTS.forEach(sp => {
    const [x, y] = mapEl.toProj(...world.posAt(sp.t * L));
    const c = el('circle', { class: 'pin', cx: x, cy: y, r: 8.5 });
    const tx = el('text', { x, y: y + 3.4 }); tx.textContent = sp.n; pinEls.push(c);
  });
  meHalo = el('circle', { class: 'halo', r: 15 }); meDot = el('circle', { class: 'me', r: 6 });
}
buildMap();

// 音声ガイド
const CAPTION = ['通りに面した細かな格子は、風を通しながら、外からの視線をやわらげる工夫です。', '軒の低い二階は、かつて荷物を置く場所として使われていました。', '白壁の蔵は、火事から商いの品を守るためのもの。町の歴史が、壁に残っています。'];
const capEl = $('#auCap'); capEl.innerHTML = CAPTION.map(c => `<span>${c}</span>`).join('');
const capSpans = $$('span', capEl);
const wave = $('#wave'); for (let i = 0; i < 26; i++) { const b = document.createElement('i'); b.style.setProperty('--d', (Math.sin(i * 1.7) * .5 + .5).toFixed(2)); wave.appendChild(b); }
const auPlay = $('#auPlay'); const synth = window.speechSynthesis;
function stopSpeech() { if (synth) synth.cancel(); auPlay.classList.remove('is-on'); auPlay.setAttribute('aria-label', '音声を再生'); }
auPlay.addEventListener('click', () => {
  if (!synth) return;
  if (auPlay.classList.contains('is-on')) { stopSpeech(); return; }
  const u = new SpeechSynthesisUtterance(CAPTION.join(''));
  u.lang = 'ja-JP'; u.rate = 1.02; u.onend = stopSpeech;
  auPlay.classList.add('is-on'); auPlay.setAttribute('aria-label', '音声を止める');
  synth.speak(u);
});

// AIガイド（デモの受け答え）
const QA = [
  ['鳥居はなぜ赤いの？', '朱色には魔除けの力があると考えられてきました。朱の塗料は、木を腐りにくくする役割も果たしたと言われています。'],
  ['なぜ、たくさん並んでいるの？', '願いごとのお礼として鳥居を奉納する習わしがあり、それが積み重なって連なった神社があります。'],
  ['五重塔の中はどうなっているの？', '塔の起源は、お釈迦さまの遺骨をまつる建物です。中心には「心柱」という太い柱が通っています。'],
];
const log = $('#chatLog'), chips = $('#chatChips');
let chatStarted = false, chatBusy = false;
function addMsg(text, who) { const m = document.createElement('p'); m.className = 'msg ' + who; m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
function ask(i) {
  if (chatBusy) return; chatBusy = true;
  const [q, a] = QA[i];
  $$('button', chips)[i].disabled = true;
  addMsg(q, 'me');
  const typing = document.createElement('p'); typing.className = 'msg ai typing'; typing.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(typing); log.scrollTop = log.scrollHeight;
  setTimeout(() => {
    typing.remove();
    const m = addMsg('', 'ai');
    let n = 0;
    const tick = () => { n += 2; m.textContent = a.slice(0, n); log.scrollTop = log.scrollHeight; if (n < a.length) setTimeout(tick, 30); else chatBusy = false; };
    if (reduced) { m.textContent = a; chatBusy = false; } else tick();
  }, 780);
}
QA.forEach((qa, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = qa[0]; b.addEventListener('click', () => ask(i)); chips.appendChild(b); });
function enterChat() {
  if (chatStarted) return; chatStarted = true;
  addMsg('森のお社へようこそ。気になることを聞いてくださいね。', 'ai');
  setTimeout(() => ask(0), 1100);
}

// クイズ
const optBtns = $$('#quizOpts button'), quizRes = $('#quizRes'); let answered = false;
function answer(btn) {
  if (answered) return; answered = true;
  optBtns.forEach(b => { if (b.dataset.ok) b.classList.add('is-ok'); else if (b === btn) b.classList.add('is-ng'); b.disabled = true; });
  quizRes.classList.add('is-on');
}
optBtns.forEach(b => b.addEventListener('click', () => answer(b)));

// 評価
$$('#stars button').forEach((b, i, all) => b.addEventListener('click', () => all.forEach((x, j) => x.classList.toggle('is-on', j <= i))));

// ベル
let ac;
function bell() {
  const el = $('#bell'); el.classList.remove('is-ring'); void el.offsetWidth; el.classList.add('is-ring');
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  [[2640, .16], [3960, .08], [5280, .03]].forEach(([f, g]) => {
    [0, .17].forEach(d => {
      const o = ac.createOscillator(), a = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      const t = ac.currentTime + d; a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.0001, t + .7);
      o.connect(a).connect(ac.destination); o.start(t); o.stop(t + .72);
    });
  });
}
$('#bell').addEventListener('click', bell);

/* ---------- 自動走行 ---------- */
let auto = false; const autoBtn = $('#autoBtn'), autoLabel = $('#autoLabel');
function setAuto(on) { auto = on; autoBtn.setAttribute('aria-pressed', on); autoLabel.textContent = on ? '止める' : '自動で走る'; }
function goRide() { if (progress() < .004) scrollTo(0, ride.offsetTop + 4); setAuto(true); }
autoBtn.addEventListener('click', () => { if (auto) setAuto(false); else goRide(); });
$('#startBtn').addEventListener('click', goRide);
$('#phoneStart').addEventListener('click', goRide);
['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, e => { if (auto && !e.target.closest?.('#autoBtn')) setAuto(false); }, { passive: true }));

/* ---------- 視線 ---------- */
let yawT = 0, pitchT = 0, yaw = 0, pitch = 0;
if (matchMedia('(pointer: fine)').matches && !reduced) {
  addEventListener('pointermove', e => { yawT = (e.clientX / innerWidth - .5) * .34; pitchT = -(e.clientY / innerHeight - .5) * .14; }, { passive: true });
}

/* ---------- 1コマごとの処理 ---------- */
function progress() { const span = ride.offsetHeight - stage.offsetHeight; return clamp(-ride.getBoundingClientRect().top / span); }
const T0 = .012, T1 = .972, IRIS = .971;
let sNow = 0, last = performance.now(), speed = 0, slowFrames = 0, frames = 0, spotHit = -1;

function resize() { if (world) world.resize(stage.clientWidth, stage.clientHeight); }
let lastW = 0, lastH = 0;
function maybeResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (w !== lastW || Math.abs(h - lastH) > 130) { lastW = w; lastH = h; resize(); }
}
addEventListener('resize', maybeResize, { passive: true });
maybeResize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const p = progress();
  top.classList.toggle('is-paper', p >= .978 && !inRegion());
  top.classList.toggle('is-dark', inRegion());
  if (auto) { const span = ride.offsetHeight - stage.offsetHeight; scrollBy(0, span / 84 * dt); if (p >= .992) setAuto(false); }
  const rect = ride.getBoundingClientRect();
  if (rect.bottom < -20) return;                 // ライドを過ぎたら描かない

  const target = clamp((p - T0) / (T1 - T0)) * L;
  const prev = sNow;
  sNow += (target - sNow) * (1 - Math.exp(-dt * (reduced ? 20 : 4.6)));
  if (Math.abs(target - sNow) < .002) sNow = target;
  const v = Math.abs(sNow - prev) / Math.max(dt, .001);
  speed += (clamp(v / 150) - speed) * .12;
  const t = clamp(sNow / L);

  yaw += (yawT - yaw) * .06; pitch += (pitchT - pitch) * .06;
  const st = world ? world.render(sNow, dt, { speed: reduced ? 0 : speed, lookYaw: yaw, lookPitch: pitch, fovKick: reduced ? 0 : speed * 8 }) : null;

  // 見出し
  const h = 1 - sstep(.003, .028, t);
  hero.style.opacity = h; hero.style.visibility = h < .01 ? 'hidden' : 'visible'; hero.style.transform = `translateY(${(1 - h) * -40}px)`;
  chaps.forEach(c => {
    const o = band(t, c.a, c.b, .009), onNow = o > .25;
    c.el.style.opacity = o; c.el.style.visibility = o < .01 ? 'hidden' : 'visible';
    if (onNow !== c.on) { c.on = onNow; c.el.classList.toggle('is-in', onNow); }
  });

  // 計器
  const showHud = t > .02 && p < IRIS;
  routeHud.classList.toggle('is-on', showHud); meter.classList.toggle('is-on', showHud);
  top.classList.toggle('is-ride', showHud);
  routeFill.style.transform = `scaleX(${clamp((t - .02) / .95).toFixed(4)})`;
  routeLis.forEach((li, i) => li.classList.toggle('is-on', t >= [.03, .27, .5, .745][i] && t < [.27, .5, .745, 2][i]));
  const mins = 370 + t * 740, hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(Math.floor(mins % 60)).padStart(2, '0'), clock = `${hh}:${mm}`;
  mKm.textContent = (t * 18).toFixed(1); mClock.textContent = clock; sbClock.textContent = clock;
  if (st) { mEl.textContent = Math.round(st.elev * 5); document.documentElement.style.setProperty('--rim', st.sunCss); }

  // トンネルの出口
  flash.style.opacity = (band(t, .2675, .2735, .0035) * .95).toFixed(3);

  // ハンドルの揺れ
  const pedal = sNow * .55, sway = reduced ? 0 : Math.sin(pedal) * 3.4 * speed, roll = st ? clamp(st.curve * 7, -2.4, 2.4) : 0;
  const hide = sstep(.958, .974, p);
  cockpit.style.transform = `translate3d(${-yaw * 26}px, ${sway + Math.abs(Math.cos(pedal)) * 2.4 * speed + hide * 340}px, 0) rotate(${(reduced ? 0 : roll).toFixed(3)}deg)`;

  // スマホ
  show(t < .028 ? 'start' : t < .362 ? 'nav' : t < .5 ? 'audio' : t < .752 ? 'chat' : t < .945 ? 'quiz' : 'done');
  if (scName === 'nav' && world) {
    const [x, z] = world.posAt(sNow), [mx, my] = mapEl.toProj(x, z);
    meDot.setAttribute('cx', mx); meDot.setAttribute('cy', my); meHalo.setAttribute('cx', mx); meHalo.setAttribute('cy', my);
    routeDone.style.strokeDashoffset = routeDone.dataset.len * (1 - t);
    const next = SPOTS.find(s => s.t > t + .002) || SPOTS[3], km = Math.max(0, (next.t - t) * 18);
    $('#navName').textContent = next.name; $('#navKm').textContent = km.toFixed(1); $('#navMin').textContent = Math.max(1, Math.round(km * 5)); $('#navIdx').textContent = `スポット ${next.n} / 4 ・ 次のスポット`;
    pinEls.forEach((c, i) => c.classList.toggle('is-done', SPOTS[i].t <= t));
  }
  if (scName === 'audio') {
    const a = clamp((t - .372) / (.485 - .372));
    $('#auFill').style.transform = `scaleX(${a.toFixed(3)})`;
    const sec = Math.floor(a * 90); $('#auNow').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    capSpans.forEach((sp, i) => sp.classList.toggle('is-on', a >= i / 3 - .001));
  }
  if (t > .925 && !answered) answer(null);
  SPOTS.forEach((sp, i) => {
    if (Math.abs(sp.t - t) < .004 && spotHit !== i) { spotHit = i; toast(i === 1 ? `${sp.name}に近づきました` : `${sp.name}に到着しました`); }
  });

  // アイリスアウト：夕日に向かって世界を閉じる
  if (p > IRIS && st) {
    const w = stage.clientWidth, hh2 = stage.clientHeight, k = sstep(IRIS, .997, p);
    const cx = clamp(st.sunX) * w, cy = clamp(st.sunY) * hh2, far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, hh2 - cy)) * 1.02;
    stage.style.clipPath = `circle(${(far * Math.pow(1 - k, 1.9)).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
  } else if (stage.style.clipPath) stage.style.clipPath = '';

  // 重い端末では解像度を落とす
  if (world && dt > .03) slowFrames++;
  if (world && ++frames === 90) {
    if (slowFrames > 38 && world.pixelRatio > .85) { world.setPixelRatio(Math.max(.85, world.pixelRatio * .8)); }
    frames = 0; slowFrames = 0;
  }
}
const regionEl = $('#region');
function inRegion() { const r = regionEl.getBoundingClientRect(); return r.top < 60; }
requestAnimationFrame(frame);

/* ---------- ライドのあと ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach(el => io.observe(el));

// 重なるカード：次のカードが来たら少し奥へ下がる
const cards = $$('.fc'), imgs = cards.map(c => $('img', c));
function cardsTick() {
  const vh = innerHeight;
  cards.forEach((c, i) => {
    const next = cards[i + 1];
    const r = c.getBoundingClientRect();
    if (!reduced) imgs[i].style.transform = `translate3d(0, ${clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1) * -24}px, 0)`;
    if (!next || reduced) return;
    const n = next.getBoundingClientRect(), k = clamp(1 - (n.top - r.top) / r.height);
    c.style.transform = `scale(${(1 - k * .05).toFixed(4)})`;
    c.style.filter = `brightness(${(1 - k * .14).toFixed(3)})`;
  });
}
addEventListener('scroll', () => requestAnimationFrame(cardsTick), { passive: true });
cardsTick();
