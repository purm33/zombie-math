// 픽셀 블록 스타일 캐릭터 그리기 (모두 이 게임용으로 새로 만든 디자인)

function R(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); }

const ARMOR = { iron: '#cfd3d8', diamond: '#56e3da' };
const ARMOR_DARK = { iron: '#9aa0a8', diamond: '#24b3aa' };
const BLADE = { iron: '#e3e6ea', diamond: '#7ff5ee', none: null };

// 사람 캐릭터: (x, y) = 발 가운데. s = 픽셀 크기
export function drawHuman(ctx, x, y, s, o = {}) {
  const skin = o.skinColor || '#e2b08a';
  const hair = o.hair || '#3a2414';
  let shirt = o.shirt || '#d8574c', pants = o.pants || '#30507e';
  const sk = o.skin; // 보상 스킨
  if (sk) { shirt = sk.shirt; pants = sk.pants; }
  const armor = o.armor || 'none';
  const t = o.walk || 0;
  const legSwing = Math.sin(t) * 2 * s;
  const W = 16 * s, H = 32 * s;
  const left = x - W / 2, top = y - H;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();

  // 망토/날개 (스킨) — 몸 뒤
  if (sk && sk.tool === 'cape') {
    ctx.fillStyle = sk.accent; ctx.beginPath();
    ctx.moveTo(left + 4 * s, top + 8 * s); ctx.lineTo(left + 12 * s, top + 8 * s);
    ctx.lineTo(left + 15 * s + legSwing * 0.3, y - 1 * s); ctx.lineTo(left + 1 * s - legSwing * 0.3, y - 1 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8'; for (let i = 0; i < 5; i++) R(ctx, left + (3 + i * 2.3) * s, top + (14 + (i % 2) * 7) * s, s, s, '#fff');
  }
  if (sk && sk.tool === 'wings') {
    ctx.fillStyle = sk.accent;
    for (const dir of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x, top + 10 * s);
      ctx.lineTo(x + dir * 17 * s, top + (4 + Math.sin(t * 0.7) * 2) * s);
      ctx.lineTo(x + dir * 15 * s, top + 16 * s); ctx.lineTo(x + dir * 4 * s, top + 18 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8b98a3'; ctx.lineWidth = s; ctx.stroke();
    }
  }

  // 다리
  const legC = armor !== 'none' ? ARMOR_DARK[armor] : pants;
  R(ctx, left + 4 * s, top + 20 * s, 4 * s, 12 * s + Math.min(0, legSwing), legC);
  R(ctx, left + 8 * s, top + 20 * s, 4 * s, 12 * s - Math.max(0, legSwing), legC);
  R(ctx, left + 4 * s, y - 2 * s, 4 * s, 2 * s, '#3a2a1e');
  R(ctx, left + 8 * s, y - 2 * s, 4 * s, 2 * s, '#3a2a1e');
  if (sk && sk.kind === 'ball') { R(ctx, left + 4 * s, top + 26 * s, 8 * s, 2 * s, sk.accent); }
  // 몸통
  const bodyC = armor !== 'none' ? ARMOR[armor] : shirt;
  R(ctx, left + 4 * s, top + 8 * s, 8 * s, 12 * s, bodyC);
  if (armor !== 'none') { R(ctx, left + 4 * s, top + 8 * s, 8 * s, 1.5 * s, ARMOR_DARK[armor]); R(ctx, left + 7 * s, top + 10 * s, 2 * s, 8 * s, ARMOR_DARK[armor]); }
  else if (sk && sk.kind === 'ball') {
    R(ctx, left + 7.5 * s, top + 8 * s, 1 * s, 12 * s, sk.accent);
    ctx.fillStyle = sk.accent; ctx.font = `bold ${5 * s}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(String(o.num ?? ''), x, top + 17 * s);
  } else if (sk) { R(ctx, left + 4 * s, top + 13 * s, 8 * s, 2 * s, sk.accent); }
  // 팔
  const armC = o.armsForward ? (o.skinColor || skin) : bodyC;
  R(ctx, left, top + 8 * s, 4 * s, 12 * s, armC);
  R(ctx, left + 12 * s, top + 8 * s, 4 * s, 12 * s, armC);
  R(ctx, left, top + 18 * s, 4 * s, 2 * s, skin);
  R(ctx, left + 12 * s, top + 18 * s, 4 * s, 2 * s, skin);
  // 머리
  R(ctx, left + 4 * s, top, 8 * s, 8 * s, skin);
  R(ctx, left + 4 * s, top, 8 * s, 2.5 * s, hair);
  R(ctx, left + 4 * s, top, 1.2 * s, 5 * s, hair);
  R(ctx, left + 10.8 * s, top, 1.2 * s, 5 * s, hair);
  R(ctx, left + 5.5 * s, top + 4 * s, 1.8 * s, 1.8 * s, o.eye || '#fff');
  R(ctx, left + 8.7 * s, top + 4 * s, 1.8 * s, 1.8 * s, o.eye || '#fff');
  R(ctx, left + 6.3 * s, top + 4.4 * s, 1 * s, 1.2 * s, o.pupil || '#2a3c8f');
  R(ctx, left + 9.5 * s, top + 4.4 * s, 1 * s, 1.2 * s, o.pupil || '#2a3c8f');
  R(ctx, left + 6.5 * s, top + 6.5 * s, 3 * s, 0.8 * s, '#8a4a3a');
  if (armor !== 'none') { R(ctx, left + 3.5 * s, top - 0.8 * s, 9 * s, 3 * s, ARMOR[armor]); R(ctx, left + 3.5 * s, top + 2 * s, 1.2 * s, 4 * s, ARMOR[armor]); R(ctx, left + 11.3 * s, top + 2 * s, 1.2 * s, 4 * s, ARMOR[armor]); }
  if (sk && sk.kind === 'ball') { R(ctx, left + 3.5 * s, top - 1 * s, 9 * s, 3 * s, sk.accent === '#ffffff' ? shirt : sk.accent); R(ctx, left + 8 * s, top + 1.2 * s, 6 * s, 1.3 * s, sk.accent === '#ffffff' ? shirt : sk.accent); }
  if (o.helmet) { R(ctx, left + 3.5 * s, top - 1 * s, 9 * s, 3.2 * s, o.helmet); }

  // 손에 든 것
  const hx = left + 14 * s, hy = top + 19 * s;
  const swing = o.swing || 0; // 0~1
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.5 + swing * 1.6);
  if (o.sword && BLADE[o.sword]) {
    R(ctx, -1 * s, -1 * s, 2 * s, 3 * s, '#5a3a1e');
    R(ctx, -2.5 * s, -2 * s, 5 * s, 1.2 * s, '#3a2a1e');
    R(ctx, -0.9 * s, -13 * s, 1.8 * s, 11 * s, BLADE[o.sword]);
    R(ctx, -0.3 * s, -12 * s, 0.6 * s, 9 * s, '#ffffff99');
  } else if (sk && sk.tool === 'spear') {
    R(ctx, -0.6 * s, -16 * s, 1.2 * s, 20 * s, '#6b5a3a');
    ctx.fillStyle = sk.accent; ctx.beginPath(); ctx.moveTo(0, -21 * s); ctx.lineTo(2.2 * s, -15 * s); ctx.lineTo(-2.2 * s, -15 * s); ctx.fill();
    ctx.strokeStyle = '#fff59a'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(3 * s, -18 * s); ctx.lineTo(1.5 * s, -15 * s); ctx.lineTo(3.5 * s, -14 * s); ctx.lineTo(2 * s, -11 * s); ctx.stroke();
  } else if (sk && sk.tool === 'bat') {
    ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.moveTo(-0.6 * s, 2 * s); ctx.lineTo(0.6 * s, 2 * s); ctx.lineTo(1.4 * s, -13 * s); ctx.lineTo(-1.4 * s, -13 * s); ctx.fill();
  }
  ctx.restore();
  if (sk && sk.tool === 'glove') {
    for (const gx of [left, left + 12 * s]) {
      R(ctx, gx - 0.5 * s, top + 16 * s, 5 * s, 4.5 * s, sk.accent);
      R(ctx, gx + 0.5 * s, top + (14 - Math.abs(Math.sin(t * 2)) * 1.5) * s, 1.5 * s, 2 * s, '#ffd34d');
      R(ctx, gx + 2.5 * s, top + (13.5 - Math.abs(Math.cos(t * 2)) * 1.5) * s, 1.5 * s, 2.5 * s, '#ff5a2a');
    }
  }
  if (sk && sk.tool === 'iceshield') {
    const cx = left - 1 * s, cy = top + 15 * s, r = 5 * s;
    ctx.fillStyle = sk.accent; ctx.strokeStyle = '#5fb7d8'; ctx.lineWidth = s;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.6); ctx.stroke();
  }
  if (o.shieldOn) {
    ctx.strokeStyle = 'rgba(120,200,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - H / 2, H * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,.15)'; ctx.fill();
  }
  if (o.label) {
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; const tw = ctx.measureText(o.label).width + 10;
    ctx.fillRect(x - tw / 2, top - 20, tw, 17); ctx.fillStyle = '#fff'; ctx.fillText(o.label, x, top - 7);
  }
  ctx.restore();
}

export function drawZombie(ctx, x, y, s, o = {}) {
  const bonus = o.bonus;
  drawHuman(ctx, x, y, s, {
    skinColor: bonus ? '#8f63c4' : '#5f9e4d', hair: bonus ? '#5b3a8a' : '#3f7334',
    shirt: bonus ? '#3a2a6a' : '#2f7d86', pants: bonus ? '#24204a' : '#3b3f78',
    eye: '#111', pupil: bonus ? '#ff5af0' : '#111', armsForward: true, walk: o.walk,
    helmet: bonus ? '#f2c230' : null, alpha: o.alpha,
  });
}

// 파괴수 (커다란 뿔 달린 짐승)
export function drawBeast(ctx, x, y, s, o = {}) {
  const t = o.t || 0, flash = o.flash;
  const body = flash ? '#ff6b5b' : '#6f6a64', dark = flash ? '#c0392b' : '#4c4844', horn = '#e8dcc0';
  const bob = Math.sin(t * 3) * 2 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 80 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
  // 다리
  for (const [lx, ph] of [[-60, 0], [-35, 1], [30, 2], [55, 3]]) R(ctx, x + lx * s, y - 38 * s + Math.sin(t * 6 + ph) * 2 * s, 14 * s, 38 * s, dark);
  // 몸통
  R(ctx, x - 70 * s, y - 100 * s + bob, 130 * s, 66 * s, body);
  R(ctx, x - 70 * s, y - 100 * s + bob, 130 * s, 10 * s, dark);
  for (let i = 0; i < 6; i++) R(ctx, x + (-60 + i * 20) * s, y - 92 * s + bob, 10 * s, 4 * s, '#8a847c');
  // 머리
  const hx = x + 40 * s, hy = y - 112 * s + bob;
  R(ctx, hx, hy, 52 * s, 50 * s, body);
  R(ctx, hx + 6 * s, hy + 14 * s, 9 * s, 7 * s, '#fff'); R(ctx, hx + 30 * s, hy + 14 * s, 9 * s, 7 * s, '#fff');
  R(ctx, hx + 9 * s, hy + 16 * s, 4 * s, 4 * s, '#c01818'); R(ctx, hx + 33 * s, hy + 16 * s, 4 * s, 4 * s, '#c01818');
  R(ctx, hx + 4 * s, hy + 32 * s, 44 * s, 14 * s, '#3a2622');
  for (let i = 0; i < 5; i++) R(ctx, hx + (7 + i * 8) * s, hy + 32 * s, 4 * s, 5 * s, '#f2efe2');
  // 뿔
  R(ctx, hx - 8 * s, hy - 6 * s, 12 * s, 8 * s, horn); R(ctx, hx - 14 * s, hy - 22 * s, 8 * s, 18 * s, horn);
  R(ctx, hx + 48 * s, hy - 6 * s, 12 * s, 8 * s, horn); R(ctx, hx + 58 * s, hy - 22 * s, 8 * s, 18 * s, horn);
  ctx.restore();
}

// 드래곤
export function drawDragon(ctx, x, y, s, o = {}) {
  const t = o.t || 0, flash = o.flash;
  const body = flash ? '#ff6b5b' : '#2f6b4f', dark = flash ? '#a02020' : '#1c4434', eye = '#ffd34d';
  const flap = Math.sin(t * 4);
  const by = y + Math.sin(t * 2) * 8 * s;
  ctx.save();
  // 날개
  for (const dir of [-1, 1]) {
    ctx.fillStyle = dark; ctx.beginPath();
    ctx.moveTo(x + dir * 30 * s, by - 20 * s);
    ctx.lineTo(x + dir * 190 * s, by - (90 + flap * 50) * s);
    ctx.lineTo(x + dir * 170 * s, by + (10 - flap * 20) * s);
    ctx.lineTo(x + dir * 110 * s, by - (5 + flap * 10) * s);
    ctx.lineTo(x + dir * 70 * s, by + 15 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7fbf6a'; ctx.lineWidth = 2 * s; ctx.stroke();
  }
  // 꼬리
  for (let i = 0; i < 8; i++) R(ctx, x - 8 * s + Math.sin(t * 2 + i * 0.6) * 10 * s, by + (20 + i * 12) * s, (16 - i) * s, 12 * s, i % 2 ? body : dark);
  // 몸
  R(ctx, x - 34 * s, by - 34 * s, 68 * s, 64 * s, body);
  for (let i = 0; i < 4; i++) R(ctx, x - 6 * s, by + (-40 + i * 16) * s, 12 * s, 8 * s, '#e0c36a');
  // 목·머리
  R(ctx, x - 14 * s, by - 70 * s, 28 * s, 40 * s, body);
  const hx = x - 36 * s, hy = by - 118 * s;
  R(ctx, hx, hy, 72 * s, 50 * s, body);
  R(ctx, hx + 10 * s, hy + 44 * s, 52 * s, 18 * s, dark);
  R(ctx, hx + 8 * s, hy + 14 * s, 18 * s, 7 * s, eye); R(ctx, hx + 46 * s, hy + 14 * s, 18 * s, 7 * s, eye);
  R(ctx, hx + 4 * s, hy - 12 * s, 8 * s, 14 * s, '#e8dcc0'); R(ctx, hx + 60 * s, hy - 12 * s, 8 * s, 14 * s, '#e8dcc0');
  for (let i = 0; i < 5; i++) R(ctx, hx + (14 + i * 10) * s, hy + 50 * s, 4 * s, 5 * s, '#ffffff');
  ctx.restore();
}

export function drawHeart(ctx, x, y, s, full) {
  const c = full ? '#e8323c' : '#3a2a2a', h = full ? '#ff8f8f' : '#5a4444';
  const map = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  map.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') R(ctx, x + i * s, y + j * s, s, s, c); }));
  R(ctx, x + s, y + s, s, s, h);
}
