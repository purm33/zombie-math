import { initDB, db, MODE } from './db.js';
import { ALLOWED_NUMBERS, GROUP_COUNT, PER_ROUND, BONUS_PER_ITEM, MAX_ITEMS_PER_ROUND, WRONG_DAMAGE, MAX_HEARTS } from './config.js';
import { UNITS, PHASE_LABEL, ITEMS, ROUND_ITEMS, SKINS, membersOf, roundDone, advanceGroup, rankingOf, fmtTime } from './game.js';
import { makeQuestion, checkAnswer } from './questions.js';
import { drawHuman, drawZombie, drawBeast, drawDragon, drawHeart } from './sprites.js';

const $ = (id) => document.getElementById(id);
const ITEM_KEYS = ['shield', 'apple', 'bow', 'potion'];

await initDB();
$('modeTag').textContent = MODE === 'local' ? '체험 모드 (이 컴퓨터에서만 연결)' : '';

let me = null;
try { me = JSON.parse(localStorage.getItem('zm_me')); } catch (e) {}
let G = {};
let joinedOnce = false;
let stopPresence = null;
let selGroup = me ? me.group : null;

// ---------------- 입장 화면 ----------------
for (let g = 1; g <= GROUP_COUNT; g++) {
  const b = document.createElement('button'); b.textContent = g; b.dataset.g = g;
  b.onclick = () => { selGroup = g; renderGroupBtns(); };
  $('groupBtns').appendChild(b);
}
function renderGroupBtns() { [...$('groupBtns').children].forEach((b) => b.classList.toggle('on', +b.dataset.g === selGroup)); }
if (me) $('numInput').value = me.num;
renderGroupBtns();
$('numInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
$('joinBtn').onclick = doJoin;

async function doJoin() {
  const num = parseInt($('numInput').value, 10);
  $('joinErr').textContent = '';
  if (!selGroup) return ($('joinErr').textContent = '모둠을 먼저 고르세요.');
  if (!ALLOWED_NUMBERS.includes(num)) return ($('joinErr').textContent = '우리 반 번호를 다시 확인하세요.');
  const ex = G.players && G.players[num];
  let group = selGroup;
  if (ex && ex.group) {
    if (G.phase === 'playing' && ex.group !== selGroup) {
      group = ex.group;
      alert(`게임이 이미 진행 중이라 원래 모둠(${group}모둠)으로 들어가요.`);
    } else if (ex.group !== selGroup) {
      await db.patch(`players/${num}`, { group: selGroup });
    }
  } else {
    await db.put(`players/${num}`, { num, group, hearts: MAX_HEARTS, r1: 0, r2: 0, b1: 0, b2: 0, wrong: 0, joinedAt: Date.now(), online: true, skin: localStorage.getItem('zm_skin_' + num) || '' });
  }
  me = { num, group };
  localStorage.setItem('zm_me', JSON.stringify(me));
  startPresence();
  if (G.phase === 'playing') ensureGroup();
  render();
}
function startPresence() { if (stopPresence) stopPresence(); stopPresence = db.presence(`players/${me.num}`); }
async function ensureGroup() {
  await db.tx(`groups/${me.group}`, (cur) => cur || { phase: 'r1', since: Date.now() });
}
$('leaveBtn').onclick = async () => {
  if (!confirm('모둠이나 번호를 바꿀까요?')) return;
  if (stopPresence) stopPresence(); stopPresence = null;
  await db.del(`players/${me.num}`);
  me = null; localStorage.removeItem('zm_me'); joinedOnce = false; render();
};

// ---------------- 상태 변화 ----------------
db.watch('', (v) => { G = v || {}; onState(); });
if (me) startPresence();

const myP = () => (me && G.players && G.players[me.num]) || null;
const myGroup = () => (me && G.groups && G.groups[me.group]) || null;
const myPhase = () => { if (G.phase !== 'playing') return 'lobby'; const g = myGroup(); return g ? g.phase : 'wait'; };
const mySkin = () => { const p = myP(); const id = (p && p.skin) || (me && localStorage.getItem('zm_skin_' + me.num)); return SKINS.find((s) => s.id === id) || null; };

function onState() {
  if (me) {
    const p = myP();
    if (!p || !p.group) {
      if (joinedOnce) {
        // 선생님이 초기화했거나 내보냄
        if (stopPresence) stopPresence(); stopPresence = null;
        joinedOnce = false; selGroup = me.group; $('numInput').value = me.num;
        me = null; localStorage.removeItem('zm_me');
        closeModal();
        $('joinErr').textContent = '선생님이 게임을 새로 준비했어요. 다시 입장하세요.';
      } else {
        // 저장된 정보가 있지만 기록이 없음 → 입장 화면
        selGroup = me.group; renderGroupBtns(); $('numInput').value = me.num; me = null;
      }
    } else {
      joinedOnce = true;
      if (p.group !== me.group) { me.group = p.group; localStorage.setItem('zm_me', JSON.stringify(me)); }
      if (G.phase === 'playing' && !myGroup()) ensureGroup();
      checkGroupProgress();
    }
  }
  render();
}

let advancing = '';
function checkGroupProgress() {
  const g = myGroup(); if (!g) return;
  const ms = membersOf(G, me.group);
  if ((g.phase === 'r1' || g.phase === 'r2') && ms.length && ms.every((p) => roundDone(p, g.phase))) {
    if (advancing !== g.phase) { advancing = g.phase; advanceGroup(me.group, g.phase, ms.length).finally(() => setTimeout(() => (advancing = ''), 1500)); }
  }
  if ((g.phase === 'ravager' || g.phase === 'dragon') && g.hp && (g.dmg || 0) >= g.hp) {
    if (advancing !== g.phase) { advancing = g.phase; advanceGroup(me.group, g.phase, ms.length).finally(() => setTimeout(() => (advancing = ''), 1500)); }
  }
}

// ---------------- 화면 전환 ----------------
let scene = null;
function show(id) { ['join', 'lobby', 'play', 'done'].forEach((s) => $(s).classList.toggle('hidden', s !== id)); }

function render() {
  if (!me) { show('join'); scene = null; return; }
  const ph = myPhase();
  if (ph === 'lobby') { show('lobby'); renderLobby(); scene = null; return; }
  if (ph === 'done') { if (scene !== 'done') { closeModal(); flushDamage(); } scene = 'done'; show('done'); renderDone(); return; }
  show('play');
  if (scene !== ph) enterScene(ph);
  renderSide();
}

function renderLobby() {
  const u = UNITS[G.unit || 4];
  $('lobbyUnit').textContent = '오늘 단원: ' + u.name;
  $('lobbyMe').textContent = `${me.group}모둠 · ${me.num}번`;
  $('lobbyMates').innerHTML = membersOf(G, me.group).map((p) => `<span class="mate ${p.num === me.num ? 'me' : ''} ${p.online === false ? 'off' : ''}">${p.num}번</span>`).join('');
  const c = $('lobbyChar').getContext('2d'); c.clearRect(0, 0, 120, 130);
  drawHuman(c, 60, 122, 3.3, { skin: mySkin(), num: me.num, walk: performance.now() / 200 });
}
setInterval(() => { if (me && myPhase() === 'lobby') renderLobby(); }, 120);

// ---------------- 캔버스 ----------------
const cv = $('cv'), ctx = cv.getContext('2d');
const W = 960, H = 540;
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (!$('modal').classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k);
  if (scene === 'ravager' || scene === 'dragon') {
    if (k === ' ' || k === 'enter') bossAttack();
    if (k === 's' || k === 'arrowdown') bossDodge();
    if (['1', '2', '3', '4'].includes(k)) useItem(ITEM_KEYS[+k - 1]);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
cv.addEventListener('pointerdown', (e) => {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  if (scene === 'r1' || scene === 'r2') { F.tx = x; F.ty = y; }
  else if (scene === 'ravager' || scene === 'dragon') bossAttack();
});

// 들판 배경 미리 그리기
const bgField = document.createElement('canvas'); bgField.width = W; bgField.height = H;
(function () {
  const c = bgField.getContext('2d'); const T = 32;
  for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) {
    const v = Math.random();
    c.fillStyle = v < 0.3 ? '#5a9a3a' : v < 0.7 ? '#5f9f3f' : '#66a744'; c.fillRect(x, y, T, T);
    for (let i = 0; i < 5; i++) { c.fillStyle = Math.random() < 0.5 ? '#4f8a33' : '#74b34f'; c.fillRect(x + Math.floor(Math.random() * 8) * 4, y + Math.floor(Math.random() * 8) * 4, 4, 4); }
  }
  for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * H; c.fillStyle = ['#ffe14d', '#ff6b6b', '#ffffff', '#9fd4ff'][i % 4]; c.fillRect(x, y, 6, 6); c.fillStyle = '#3f7a2a'; c.fillRect(x + 2, y + 6, 2, 6); }
  // 가장자리 나무
  const tree = (x, y) => { c.fillStyle = '#6b4a2a'; c.fillRect(x + 12, y + 30, 12, 26); c.fillStyle = '#2f6b25'; c.fillRect(x, y, 36, 34); c.fillStyle = '#3a8030'; c.fillRect(x + 4, y + 4, 12, 10); c.fillRect(x + 20, y + 14, 10, 10); };
  for (let x = -10; x < W; x += 70) { tree(x + (x * 7) % 20, -18); tree(x + 20, H - 50); }
})();
const bgBoss = document.createElement('canvas'); bgBoss.width = W; bgBoss.height = H;
function paintBossBg(kind) {
  const c = bgBoss.getContext('2d'); const T = 32;
  if (kind === 'ravager') {
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#6aa7d8'); sky.addColorStop(0.55, '#a7d0ec'); sky.addColorStop(0.56, '#6e5a3e'); sky.addColorStop(1, '#4e3f2b');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let y = 300; y < H; y += T) for (let x = 0; x < W; x += T) { c.fillStyle = Math.random() < 0.5 ? '#77623f' : '#6a5737'; c.fillRect(x, y, T, T); c.fillStyle = '#5a4a30'; c.fillRect(x + 4, y + 4, 6, 6); }
    c.fillStyle = '#8a8f96'; for (let x = 0; x < W; x += 120) { c.fillRect(x, 230, 60, 72); c.fillStyle = '#6c7178'; c.fillRect(x + 10, 220, 40, 12); c.fillStyle = '#8a8f96'; }
  } else {
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a1b3d'); sky.addColorStop(0.6, '#d9663a'); sky.addColorStop(0.61, '#3b2a24'); sky.addColorStop(1, '#22160f');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = '#3d2a35'; c.beginPath(); c.moveTo(0, 330); for (let x = 0; x <= W; x += 80) c.lineTo(x, 200 + ((x * 37) % 110)); c.lineTo(W, 330); c.fill();
    for (let y = 330; y < H; y += T) for (let x = 0; x < W; x += T) { c.fillStyle = Math.random() < 0.5 ? '#4a3a30' : '#3f3128'; c.fillRect(x, y, T, T); if (Math.random() < 0.12) { c.fillStyle = '#ff7a1a'; c.fillRect(x + 6, y + 12, 18, 6); } }
  }
}

// ---------------- 들판 장면 ----------------
const F = { x: W / 2, y: H / 2, tx: null, ty: null, walk: 0, inv: 0, faint: 0, zs: [], parts: [] };
function spawnZombie() {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? 40 : side === 1 ? W - 40 : 60 + Math.random() * (W - 120);
  const y = side === 2 ? 80 : side === 3 ? H - 40 : 90 + Math.random() * (H - 150);
  return { x, y, vx: 0, vy: 0, walk: Math.random() * 6, cool: 1, wander: 0, appear: 0 };
}
function fieldState() {
  const p = myP() || {}; const rk = scene; const bk = rk === 'r1' ? 'b1' : 'b2';
  const done = (p[rk] || 0) >= PER_ROUND;
  const bonus = p[bk] || 0;
  const bonusLeft = done && bonus < BONUS_PER_ITEM * MAX_ITEMS_PER_ROUND;
  return { p, rk, bk, done, bonus, bonusLeft };
}

function enterScene(ph) {
  scene = ph; closeModal();
  if (ph === 'r1' || ph === 'r2') {
    F.zs = []; for (let i = 0; i < 5; i++) F.zs.push(spawnZombie());
    F.x = W / 2; F.y = H / 2; F.tx = null; F.inv = 1; F.faint = 0;
    setHearts(MAX_HEARTS);
    $('bossCtrl').classList.add('hidden');
    if (ph === 'r1') bigMessage('1라운드 시작!', '좀비를 만나 문제를 풀어요. 나는 3문제 맞히기!', 2600);
    else bigMessage('파괴수를 물리쳤다! ⚔', '2라운드: 좀비를 만나 각자 3문제 더! (철 칼·철 갑옷 장착)', 3200);
  } else if (ph === 'ravager' || ph === 'dragon') {
    paintBossBg(ph);
    Object.assign(B, { cd: 0, swing: 0, atkT: 3, tele: 0, dodge: 0, dodgeCd: 0, shield: 0, power: 0, arrows: 0, arrowT: 0, flies: [], floats: [], dead: 0, shake: 0, hitFlash: 0, msg: '', msgT: 0 });
    setHearts(MAX_HEARTS);
    $('bossCtrl').classList.remove('hidden');
    if (ph === 'ravager') bigMessage('⚠ 파괴수가 나타났다!', '철 칼과 철 갑옷 획득! 모둠원과 함께 공격하세요', 3000);
    else bigMessage('🐉 드래곤이 나타났다!', '다이아몬드 칼과 갑옷 획득! 마지막 전투!', 3000);
  } else {
    $('bossCtrl').classList.add('hidden');
  }
}

let bigT = null;
function bigMessage(t, s, ms) {
  $('bigTitle').textContent = t; $('bigSub').textContent = s; $('bigMsg').classList.remove('hidden');
  clearTimeout(bigT); bigT = setTimeout(() => $('bigMsg').classList.add('hidden'), ms);
}
let bannerT = null;
function banner(t, ms = 2500) { $('banner').textContent = t; $('banner').classList.remove('hidden'); clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => $('banner').classList.add('hidden'), ms); }

// 하트
let hearts = MAX_HEARTS, heartSyncT = null;
function setHearts(h) {
  hearts = Math.max(0, Math.min(MAX_HEARTS, h));
  clearTimeout(heartSyncT); heartSyncT = setTimeout(() => { if (me && myP()) db.patch(`players/${me.num}`, { hearts }); }, 300);
}

function gearOf(ph) { return ph === 'r1' ? 'none' : ph === 'ravager' || ph === 'r2' ? 'iron' : 'diamond'; }

function updateField(dt) {
  const fs = fieldState();
  if (F.faint > 0) { F.faint -= dt; if (F.faint <= 0) { setHearts(MAX_HEARTS); F.inv = 2; banner('다시 일어났다! 💪'); } }
  if (F.inv > 0) F.inv -= dt;
  const modalOpen = !$('modal').classList.contains('hidden');
  if (!modalOpen && F.faint <= 0) {
    let dx = 0, dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1; if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dy -= 1; if (keys.has('arrowdown') || keys.has('s')) dy += 1;
    if (dx || dy) F.tx = null;
    else if (F.tx != null) { const ddx = F.tx - F.x, ddy = F.ty - F.y; const d = Math.hypot(ddx, ddy); if (d < 6) F.tx = null; else { dx = ddx / d; dy = ddy / d; } }
    const len = Math.hypot(dx, dy) || 1, sp = 210;
    if (dx || dy) { F.x += (dx / len) * sp * dt; F.y += (dy / len) * sp * dt; F.walk += dt * 12; }
    F.x = Math.max(24, Math.min(W - 24, F.x)); F.y = Math.max(70, Math.min(H - 10, F.y));
    // 좀비
    const active = !fs.done || fs.bonusLeft;
    for (const z of F.zs) {
      z.appear = Math.min(1, z.appear + dt * 1.5);
      if (z.cool > 0) z.cool -= dt;
      const ddx = F.x - z.x, ddy = F.y - z.y, d = Math.hypot(ddx, ddy);
      let vx, vy;
      if (active && d < 260 && z.cool <= 0) { vx = (ddx / d) * 70; vy = (ddy / d) * 70; }
      else { z.wander -= dt; if (z.wander <= 0) { const a = Math.random() * Math.PI * 2; z.vx = Math.cos(a) * 35; z.vy = Math.sin(a) * 35; z.wander = 1 + Math.random() * 2; } vx = z.vx; vy = z.vy; }
      z.x = Math.max(24, Math.min(W - 24, z.x + vx * dt)); z.y = Math.max(70, Math.min(H - 10, z.y + vy * dt)); z.walk += dt * 8;
      if (active && d < 34 && z.cool <= 0 && F.inv <= 0 && F.faint <= 0 && z.appear >= 1) { openQuestion(z, fs); break; }
    }
  }
  for (const pt of F.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 300 * dt; pt.t -= dt; }
  F.parts = F.parts.filter((p) => p.t > 0);
}

function drawField() {
  const fs = fieldState();
  ctx.drawImage(bgField, 0, 0);
  const active = !fs.done || fs.bonusLeft;
  const objs = [...F.zs.map((z) => ({ y: z.y, z })), { y: F.y, me: true }].sort((a, b) => a.y - b.y);
  for (const o of objs) {
    if (o.me) {
      const blink = F.inv > 0 && Math.floor(F.inv * 10) % 2 === 0;
      drawHuman(ctx, F.x, F.y, 1.7, { skin: mySkin(), num: me.num, walk: F.walk, armor: gearOf(scene), sword: gearOf(scene) === 'none' ? null : gearOf(scene), alpha: F.faint > 0 ? 0.35 : blink ? 0.5 : 1, label: `${me.num}번 (나)` });
    } else {
      drawZombie(ctx, o.z.x, o.z.y, 1.7, { bonus: fs.done, walk: o.z.walk, alpha: (active ? 1 : 0.45) * o.z.appear });
    }
  }
  for (const p of F.parts) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.t); ctx.fillRect(p.x, p.y, 6, 6); ctx.globalAlpha = 1; }
  drawHearts();
  if (F.faint > 0) {
    ctx.fillStyle = 'rgba(120,0,0,.45)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Jua, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('쓰러졌어요!', W / 2, H / 2 - 10); ctx.font = 'bold 22px sans-serif'; ctx.fillText(`${Math.ceil(F.faint)}초 뒤에 다시 일어나요`, W / 2, H / 2 + 26);
  }
}
function drawHearts() {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(8, H - 34, 10 * 26 + 8, 28);
  for (let i = 0; i < MAX_HEARTS; i++) drawHeart(ctx, 14 + i * 26, H - 29, 3, i < hearts);
}
function poof(x, y, c) { for (let i = 0; i < 18; i++) F.parts.push({ x, y: y - 30, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, t: 0.8, c }); }

// ---------------- 문제 ----------------
let curQ = null, curZ = null, curFs = null, answering = false;
function openQuestion(z, fs) {
  curZ = z; curFs = fs; answering = false;
  const bonus = fs.done;
  curQ = makeQuestion(G.unit || 4, fs.rk, bonus);
  $('qbox').classList.toggle('bonus', bonus);
  $('qtag').textContent = bonus ? `⭐ 보너스 문제 (틀려도 하트 그대로)` : `🧟 ${fs.rk === 'r1' ? '1' : '2'}라운드 문제 · ${(fs.p[fs.rk] || 0) + 1}번째`;
  $('qtext').textContent = curQ.text;
  $('qsvg').innerHTML = curQ.svg || '';
  $('qfb').textContent = ''; $('qfb').className = 'feedback';
  if (curQ.type === 'choice') {
    $('qnum').classList.add('hidden'); $('qchoices').classList.remove('hidden'); $('qhint').textContent = '알맞은 답을 누르세요';
    $('qchoices').innerHTML = '';
    curQ.choices.forEach((c) => { const b = document.createElement('button'); b.textContent = c; b.onclick = () => submit(c); $('qchoices').appendChild(b); });
  } else {
    $('qnum').classList.remove('hidden'); $('qchoices').classList.add('hidden'); $('qhint').textContent = '답을 쓰고 Enter (소수점은 . 으로)';
    $('qinput').value = '';
  }
  $('modal').classList.remove('hidden');
  keys.clear();
  if (curQ.type !== 'choice') setTimeout(() => $('qinput').focus(), 50);
}
function closeModal() { $('modal').classList.add('hidden'); curQ = null; }
$('qsubmit').onclick = () => submit($('qinput').value);
$('qinput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit($('qinput').value); });

async function submit(val) {
  if (!curQ || answering) return;
  if (curQ.type !== 'choice' && String(val).trim() === '') return;
  answering = true;
  const ok = checkAnswer(curQ, val);
  const fs = curFs, z = curZ, bonus = fs.done, p = myP() || {};
  if (ok) {
    $('qfb').className = 'feedback ok'; $('qfb').textContent = bonus ? '⭐ 정답! 강한 좀비를 물리쳤다!' : '⭕ 정답! 좀비를 물리쳤다!';
    if (!bonus) {
      const n = Math.min(PER_ROUND, (p[fs.rk] || 0) + 1);
      await db.patch(`players/${me.num}`, { [fs.rk]: n });
      if (n === PER_ROUND) setTimeout(() => banner('🎉 3문제 완료! 보라색 강한 좀비를 만나 보너스 문제에 도전하세요. 모둠원이 모두 끝나면 보스가 나타나요!', 6000), 900);
    } else {
      const n = (p[fs.bk] || 0) + 1;
      const up = { [fs.bk]: n };
      if (n % BONUS_PER_ITEM === 0 && n / BONUS_PER_ITEM <= MAX_ITEMS_PER_ROUND) {
        const it = ROUND_ITEMS[fs.rk][n / BONUS_PER_ITEM - 1];
        up[`items/${it}`] = ((p.items && p.items[it]) || 0) + 1;
        setTimeout(() => bigMessage(`${ITEMS[it].icon} ${ITEMS[it].name} 획득!`, ITEMS[it].desc + ' (보스전에서 사용)', 2600), 800);
      }
      await db.patch(`players/${me.num}`, up);
    }
    setTimeout(() => {
      closeModal(); poof(z.x, z.y, bonus ? '#c79bff' : '#7fd35f');
      const i = F.zs.indexOf(z); if (i >= 0) F.zs.splice(i, 1);
      setTimeout(() => { if (scene === 'r1' || scene === 'r2') F.zs.push(spawnZombie()); }, 1200);
      F.inv = 0.6;
    }, 800);
  } else {
    $('qfb').className = 'feedback no';
    $('qfb').textContent = `❌ 틀렸어요! 정답은 ${curQ.answer}` + (bonus ? ' (하트는 그대로)' : ` · 하트 -${WRONG_DAMAGE}`);
    if (!bonus) {
      setHearts(hearts - WRONG_DAMAGE);
      db.patch(`players/${me.num}`, { wrong: (p.wrong || 0) + 1 });
    }
    setTimeout(() => {
      closeModal();
      const a = Math.atan2(z.y - F.y, z.x - F.x); z.x += Math.cos(a) * 120; z.y += Math.sin(a) * 120; z.cool = 2.5; F.inv = 1.5;
      if (hearts <= 0) { F.faint = 3; }
    }, 2000);
  }
}

// ---------------- 보스전 ----------------
const B = { cd: 0, swing: 0, atkT: 3, tele: 0, dodge: 0, dodgeCd: 0, shield: 0, power: 0, arrows: 0, arrowT: 0, flies: [], floats: [], dead: 0, shake: 0, hitFlash: 0, msg: '', msgT: 0 };
let pendingDmg = 0;
function bossKind() { return scene; }
function bossInfo() {
  const g = myGroup() || {}; const hp = g.hp || 1; const dmg = (g.dmg || 0) + pendingDmg;
  return { hp, left: Math.max(0, hp - dmg) };
}
function bossAttack() {
  if (B.cd > 0 || B.dead > 0 || bossInfo().left <= 0) return;
  const base = scene === 'ravager' ? 4 : 6; const d = base * (B.power > 0 ? 2 : 1);
  pendingDmg += d; B.cd = 0.6; B.swing = 1;
  B.floats.push({ x: 600 + Math.random() * 80, y: 200 + Math.random() * 60, t: 1, txt: '-' + d, c: B.power > 0 ? '#ff7bff' : '#fff' });
}
function bossDodge() { if (B.dodgeCd > 0 || B.dead > 0) return; B.dodge = 0.7; B.dodgeCd = 1.3; }
async function useItem(k) {
  if (!(scene === 'ravager' || scene === 'dragon') || B.dead > 0) return;
  const p = myP(); const n = (p && p.items && p.items[k]) || 0; if (n <= 0) return;
  await db.patch(`players/${me.num}`, { [`items/${k}`]: n - 1 });
  if (k === 'shield') { B.shield = 15; say('🛡️ 방패! 15초 동안 공격을 막아요'); }
  if (k === 'apple') { setHearts(MAX_HEARTS); say('🍎 황금 사과! 하트가 모두 찼어요'); }
  if (k === 'bow') { B.arrows += 8; say('🏹 화살 발사!'); }
  if (k === 'potion') { B.power = 15; say('🧪 힘의 물약! 15초 동안 공격력 2배'); }
}
function say(t) { B.msg = t; B.msgT = 2.5; }
let flushT = 0;
function flushDamage() {
  if (pendingDmg > 0 && me) { const d = pendingDmg; pendingDmg = 0; db.inc(`groups/${me.group}/dmg`, d); }
}
function updateBoss(dt) {
  const intro = !$('bigMsg').classList.contains('hidden');
  B.cd = Math.max(0, B.cd - dt); B.swing = Math.max(0, B.swing - dt * 4); B.dodge = Math.max(0, B.dodge - dt); B.dodgeCd = Math.max(0, B.dodgeCd - dt);
  B.shield = Math.max(0, B.shield - dt); B.power = Math.max(0, B.power - dt); B.shake = Math.max(0, B.shake - dt); B.hitFlash = Math.max(0, B.hitFlash - dt); B.msgT -= dt;
  if (B.dead > 0) { B.dead -= dt; if (B.dead <= 0) { setHearts(MAX_HEARTS); say('다시 일어났다! 💪'); } }
  // 화살
  if (B.arrows > 0) { B.arrowT -= dt; if (B.arrowT <= 0) { B.arrowT = 0.25; B.arrows--; B.flies.push({ x: 300, y: 380, t: 0 }); } }
  for (const a of B.flies) { a.t += dt * 2.5; if (a.t >= 1 && !a.hit) { a.hit = true; const d = 8 * (B.power > 0 ? 2 : 1); pendingDmg += d; B.floats.push({ x: 620 + Math.random() * 60, y: 180 + Math.random() * 60, t: 1, txt: '🏹-' + d, c: '#ffd34d' }); } }
  B.flies = B.flies.filter((a) => a.t < 1.05);
  for (const f of B.floats) { f.y -= 50 * dt; f.t -= dt; }
  B.floats = B.floats.filter((f) => f.t > 0);
  // 보스 공격
  if (!intro && bossInfo().left > 0) {
    if (B.tele > 0) {
      B.tele -= dt;
      if (B.tele <= 0) {
        if (B.dead > 0) {}
        else if (B.shield > 0) say('🛡️ 방패로 막았다!');
        else if (B.dodge > 0) say('💨 피했다!');
        else { const dmg = scene === 'ravager' ? 2 : 3; setHearts(hearts - dmg); B.shake = 0.4; B.hitFlash = 0.3; say(`아야! 하트 -${dmg}`); if (hearts <= 0) { B.dead = 5; } }
        B.atkT = scene === 'ravager' ? 2.4 + Math.random() * 1.8 : 1.9 + Math.random() * 1.6;
      }
    } else { B.atkT -= dt; if (B.atkT <= 0) B.tele = 0.95; }
  }
  flushT -= dt; if (flushT <= 0) { flushT = 0.4; flushDamage(); }
}
function drawBoss(t) {
  ctx.save();
  if (B.shake > 0) ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
  ctx.drawImage(bgBoss, 0, 0);
  const { hp, left } = bossInfo();
  const warn = B.tele > 0 && Math.floor(B.tele * 10) % 2 === 0;
  const lunge = B.tele > 0 ? (1 - B.tele) * 40 : 0;
  if (scene === 'ravager') drawBeast(ctx, 660 - lunge, 440, 1.5, { t, flash: warn });
  else drawDragon(ctx, 650 - lunge * 0.5, 300, 1.25, { t, flash: warn });
  // 화살
  for (const a of B.flies) { const x = 300 + (640 - 300) * a.t, y = 380 - Math.sin(a.t * Math.PI) * 90 - 100 * a.t; ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 14, y - 2, 28, 4); ctx.fillStyle = '#ddd'; ctx.fillRect(x + 12, y - 4, 6, 8); }
  // 모둠원 (나는 앞쪽)
  const ms = membersOf(G, me.group).filter((p) => p.num !== me.num);
  ms.forEach((p, i) => {
    const x = 90 + (i % 3) * 70, y = 360 + Math.floor(i / 3) * 40;
    const sk = SKINS.find((s) => s.id === p.skin);
    drawHuman(ctx, x, y, 1.3, { skin: sk, num: p.num, armor: gearOf(scene), sword: gearOf(scene), walk: t * 3 + i, swing: (Math.sin(t * 6 + i * 2) + 1) / 2, alpha: p.online === false ? 0.35 : 0.9, label: `${p.num}번` });
  });
  const px = 300 - (B.dodge > 0 ? Math.sin((0.7 - B.dodge) / 0.7 * Math.PI) * 70 : 0);
  drawHuman(ctx, px, 470, 2.4, { skin: mySkin(), num: me.num, armor: gearOf(scene), sword: gearOf(scene), walk: t * 2, swing: B.swing, shieldOn: B.shield > 0, alpha: B.dead > 0 ? 0.3 : 1, label: `${me.num}번 (나)` });
  // 데미지 숫자
  for (const f of B.floats) { ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.c; ctx.font = 'bold 30px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(f.txt, f.x, f.y); ctx.fillText(f.txt, f.x, f.y); ctx.globalAlpha = 1; }
  ctx.restore();
  // HP 바
  const name = scene === 'ravager' ? '파괴수' : '드래곤';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 250, 14, 500, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${name}  ${Math.ceil(left)} / ${hp}`, W / 2, 32);
  ctx.fillStyle = '#3a1010'; ctx.fillRect(W / 2 - 240, 38, 480, 12);
  ctx.fillStyle = scene === 'ravager' ? '#e8443c' : '#3fbf6f'; ctx.fillRect(W / 2 - 240, 38, 480 * (left / hp), 12);
  if (B.tele > 0 && B.dead <= 0) { ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 34px Jua, sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.strokeText('⚠ 공격이 와요! 피하기!', W / 2, 110); ctx.fillText('⚠ 공격이 와요! 피하기!', W / 2, 110); }
  if (B.msgT > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Jua, sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(B.msg, W / 2, 150); ctx.fillText(B.msg, W / 2, 150); }
  if (B.hitFlash > 0) { ctx.fillStyle = `rgba(255,0,0,${B.hitFlash})`; ctx.fillRect(0, 0, W, H); }
  // 상태
  const st = []; if (B.shield > 0) st.push(`🛡️ ${Math.ceil(B.shield)}초`); if (B.power > 0) st.push(`🧪 ${Math.ceil(B.power)}초`); if (B.arrows > 0) st.push(`🏹 ${B.arrows}발`);
  if (st.length) { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(st.join('   '), 14, H - 44); }
  drawHearts();
  if (B.dead > 0) { ctx.fillStyle = 'rgba(100,0,0,.5)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('쓰러졌어요!', W / 2, H / 2); ctx.font = 'bold 22px sans-serif'; ctx.fillText(`${Math.ceil(B.dead)}초 뒤 다시 싸워요`, W / 2, H / 2 + 36); }
  if (left <= 0) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 54px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${name}를 물리쳤다!`, W / 2, H / 2); }
  $('coolBar').style.width = `${(1 - B.cd / 0.6) * 100}%`;
}
$('atkBtn').onclick = bossAttack;
$('dodgeBtn').onclick = bossDodge;

// ---------------- 옆 패널 ----------------
function renderSide() {
  const p = myP() || {}; const ph = scene;
  $('phaseTitle').textContent = PHASE_LABEL[ph] || '';
  const ms = membersOf(G, me.group);
  if (ph === 'r1' || ph === 'r2') {
    const n = p[ph] || 0, b = p[ph === 'r1' ? 'b1' : 'b2'] || 0;
    $('goalText').textContent = n < PER_ROUND ? `좀비를 만나 문제 맞히기: ${n} / ${PER_ROUND}` : `✅ 3문제 완료! 모둠원을 기다리는 중`;
    $('progMain').firstElementChild.style.width = `${(n / PER_ROUND) * 100}%`;
    const maxB = BONUS_PER_ITEM * MAX_ITEMS_PER_ROUND;
    const its = ROUND_ITEMS[ph].map((k) => ITEMS[k].icon + ITEMS[k].name).join(', ');
    $('bonusText').textContent = n < PER_ROUND ? `보너스: 3문제를 먼저 끝내면 도전 (${its})` : b >= maxB ? `⭐ 보너스 아이템 2개 모두 획득!` : `⭐ 보너스 ${b % BONUS_PER_ITEM} / ${BONUS_PER_ITEM} → 다음 아이템: ${ITEMS[ROUND_ITEMS[ph][Math.floor(b / BONUS_PER_ITEM)]].icon}`;
    $('progBonus').firstElementChild.style.width = `${n < PER_ROUND ? 0 : b >= maxB ? 100 : ((b % BONUS_PER_ITEM) / BONUS_PER_ITEM) * 100}%`;
    $('progMain').classList.remove('hidden'); $('progBonus').classList.remove('hidden');
  } else if (ph === 'ravager' || ph === 'dragon') {
    $('goalText').textContent = ph === 'ravager' ? '철 칼·철 갑옷으로 모둠원과 함께 공격!' : '다이아몬드 칼·갑옷으로 드래곤을 물리쳐라!';
    $('bonusText').textContent = '보스가 번쩍이면 피하기!';
    $('progMain').classList.add('hidden'); $('progBonus').classList.add('hidden');
  } else if (ph === 'wait') {
    $('goalText').textContent = '잠깐만 기다리세요...'; $('bonusText').textContent = '';
  }
  // 아이템
  const items = p.items || {};
  $('inv').innerHTML = '';
  ITEM_KEYS.forEach((k, i) => {
    const n = items[k] || 0; const b = document.createElement('button');
    b.className = 'slot' + (n ? '' : ' empty'); b.title = `${i + 1}. ${ITEMS[k].name}: ${ITEMS[k].desc}`;
    b.innerHTML = `${ITEMS[k].icon}${n ? `<span class="cnt">${n}</span>` : ''}`;
    b.onclick = () => useItem(k);
    $('inv').appendChild(b);
  });
  // 모둠원
  $('mateTitle').textContent = `👥 ${me.group}모둠 (${ms.length}명)`;
  $('mateList').innerHTML = ms.map((m) => {
    let st = '';
    if (ph === 'r1' || ph === 'r2') st = roundDone(m, ph) ? '✅' : `${m[ph] || 0}/${PER_ROUND}`;
    else st = `❤ ${m.hearts ?? MAX_HEARTS}`;
    return `<div class="mate-row" style="${m.online === false ? 'opacity:.45' : ''}"><span>${m.num}번${m.num === me.num ? ' (나)' : ''}</span><span class="chk">${st}</span></div>`;
  }).join('');
}

// ---------------- 결과 ----------------
let skinBuilt = false;
function renderDone() {
  const g = myGroup() || {};
  $('myRank').textContent = g.rank ? `우리 ${me.group}모둠 ${g.rank}등!` : '순위 계산 중...';
  const rk = rankingOf(G);
  const gs = G.groups || {};
  let rows = '<tr><th>순위</th><th>모둠</th><th>걸린 시간</th></tr>';
  rows += rk.map((r) => `<tr class="${r.g === me.group ? 'mine' : ''}"><td>${r.rank}등</td><td>${r.g}모둠</td><td>${fmtTime(r.time)}</td></tr>`).join('');
  Object.entries(gs).filter(([, v]) => v && v.phase !== 'done').sort((a, b) => a[0] - b[0]).forEach(([k, v]) => { rows += `<tr><td>-</td><td>${k}모둠</td><td>${PHASE_LABEL[v.phase] || ''} 진행 중</td></tr>`; });
  $('rankTable').innerHTML = rows;
  if (!skinBuilt) buildSkins();
}
function buildSkins() {
  skinBuilt = true; $('skins').innerHTML = '';
  const cur = mySkin();
  SKINS.forEach((sk) => {
    const d = document.createElement('button'); d.className = 'skin' + (cur && cur.id === sk.id ? ' on' : '');
    const c = document.createElement('canvas'); c.width = 110; c.height = 120; d.appendChild(c);
    d.insertAdjacentHTML('beforeend', `<b>${sk.name}</b><span>${sk.desc}</span>`);
    drawHuman(c.getContext('2d'), 55, 114, 3, { skin: sk, num: me.num });
    d.onclick = async () => {
      localStorage.setItem('zm_skin_' + me.num, sk.id);
      await db.patch(`players/${me.num}`, { skin: sk.id });
      [...$('skins').children].forEach((x) => x.classList.remove('on')); d.classList.add('on');
      $('skinMsg').textContent = `✨ '${sk.name}' 스킨을 골랐어요! 다음 게임에서 이 모습으로 플레이해요.`;
    };
    $('skins').appendChild(d);
  });
}

// ---------------- 게임 루프 ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (scene === 'r1' || scene === 'r2') { updateField(dt); drawField(); }
  else if (scene === 'ravager' || scene === 'dragon') { updateBoss(dt); drawBoss(now / 1000); }
  else if (scene === 'wait') { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '28px Jua'; ctx.textAlign = 'center'; ctx.fillText('준비 중...', W / 2, H / 2); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(() => { if (me && scene && scene !== 'done') renderSide(); }, 500);
render();
