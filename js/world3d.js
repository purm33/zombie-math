// 블록 3D 화면 (Three.js) — 캐릭터·좀비·보스·땅을 모두 정육면체 블록으로 만듦
// 모든 무늬는 이 게임을 위해 코드로 새로 그린 것입니다.
import * as THREE from './lib/three.module.min.js';

const GW = 960, GH = 540;      // 게임 논리 좌표 크기
const S = 20;                  // 논리 좌표 20 = 블록 1칸
export const toWorld = (x, y) => ({ X: (x - GW / 2) / S, Z: (y - GH / 2) / S });

// ---------- 픽셀 텍스처 ----------
const TEX = new Map();
function tex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  TEX.set(key, t); return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function speckle(g, w, h, base, cols, n) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1); }
}
const lam = (o) => new THREE.MeshLambertMaterial(o);

// 블록 재질
const T = {
  grassTop: () => tex('grassTop', 16, 16, (g, w, h) => speckle(g, w, h, '#5fa53f', ['#4f9333', '#6fb64c', '#58a03a', '#7cc256'], 120)),
  grassSide: () => tex('grassSide', 16, 16, (g, w, h) => { speckle(g, w, h, '#86603c', ['#6f4e30', '#9a7048', '#7a5634'], 90); g.fillStyle = '#5fa53f'; g.fillRect(0, 0, 16, 4); for (let x = 0; x < 16; x++) if (rnd() < 0.5) g.fillRect(x, 4, 1, 1 + ((rnd() * 2) | 0)); }),
  dirt: () => tex('dirt', 16, 16, (g, w, h) => speckle(g, w, h, '#86603c', ['#6f4e30', '#9a7048', '#7a5634'], 100)),
  stone: () => tex('stone', 16, 16, (g, w, h) => speckle(g, w, h, '#8a8d91', ['#76797d', '#9da0a4', '#6c6f73'], 110)),
  cobble: () => tex('cobble', 16, 16, (g, w, h) => { speckle(g, w, h, '#7d8084', ['#6a6d71', '#94979b'], 60); g.fillStyle = '#55585c'; for (const [x, y, a, b] of [[0, 5, 16, 1], [0, 11, 16, 1], [6, 0, 1, 5], [11, 5, 1, 6], [4, 11, 1, 5]]) g.fillRect(x, y, a, b); }),
  wood: () => tex('wood', 16, 16, (g) => { g.fillStyle = '#6b4a2a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#56391f'; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16); g.fillStyle = '#7d5a35'; for (let i = 0; i < 12; i++) g.fillRect((rnd() * 16) | 0, (rnd() * 16) | 0, 1, 2); }),
  leaves: () => tex('leaves', 16, 16, (g, w, h) => speckle(g, w, h, '#3f9a36', ['#2f7a28', '#4fb044', '#287020', '#5cc04f'], 150)),
  pink: () => tex('pinkLeaves', 16, 16, (g, w, h) => speckle(g, w, h, '#ff9cc8', ['#ff7ab5', '#ffc2de', '#f086b8', '#ffd6ea'], 150)),
  mint: () => tex('mintLeaves', 16, 16, (g, w, h) => speckle(g, w, h, '#7fe0c0', ['#5fcca8', '#a6f0d8', '#4fb896', '#c2f7e6'], 150)),
  sand: () => tex('sand', 16, 16, (g, w, h) => speckle(g, w, h, '#4a3a33', ['#3c2e28', '#5a4840', '#33261f'], 110)),
  lava: () => tex('lava', 16, 16, (g, w, h) => speckle(g, w, h, '#ff7a1a', ['#ffb02e', '#e0480f', '#ffd35a'], 90)),
  darkRock: () => tex('darkRock', 16, 16, (g, w, h) => speckle(g, w, h, '#3a2a35', ['#2c1f28', '#4a3644', '#24181f'], 120)),
};

function instancedBlocks(positions, mats, tint = 0.12) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.InstancedMesh(geo, mats, positions.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  positions.forEach((p, i) => {
    d.position.set(p[0], p[1], p[2]); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    const v = 1 - rnd() * tint; m.setColorAt(i, c.setRGB(v, v, v));
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}

// ---------- 사람 모양 블록 캐릭터 ----------
const ARMOR = { iron: ['#d3d7dc', '#9aa0a8'], diamond: ['#5fe6dc', '#26b3a9'] };
function charColors(ap) {
  let c;
  if (ap.kind === 'zombie') c = { skin: '#5f9e4d', hair: '#3f7334', shirt: '#2f7d86', pants: '#3b3f78', eye: '#1a1a1a', pupil: '#1a1a1a' };
  else if (ap.kind === 'bonus') c = { skin: '#8f63c4', hair: '#5b3a8a', shirt: '#3a2a6a', pants: '#24204a', eye: '#1a1a1a', pupil: '#ff5af0', helmet: '#f2c230' };
  else c = { skin: '#e2b08a', hair: '#3a2414', shirt: '#d8574c', pants: '#30507e', eye: '#ffffff', pupil: '#2a3c8f' };
  const sk = ap.skin;
  if (sk) { c.shirt = sk.shirt; c.pants = sk.pants; c.accent = sk.accent; }
  if (sk && sk.kind === 'ball') c.cap = sk.accent === '#ffffff' ? sk.shirt : sk.accent;
  if (ap.armor && ap.armor !== 'none') { const [a, b] = ARMOR[ap.armor]; c.armor = a; c.armorDark = b; c.helmet = a; }
  return c;
}
function boxMats(faces) { return faces.map((t) => lam({ map: t })); } // [px, nx, py, ny, pz(front), nz(back)]

function headMats(c, key) {
  const top = c.helmet || c.cap || c.hair;
  const face = tex('hf' + key, 8, 8, (g) => {
    g.fillStyle = c.skin; g.fillRect(0, 0, 8, 8);
    g.fillStyle = c.hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 1); g.fillRect(7, 2, 1, 1);
    if (c.helmet) { g.fillStyle = c.helmet; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 3); g.fillRect(7, 2, 1, 3); }
    if (c.cap) { g.fillStyle = c.cap; g.fillRect(0, 0, 8, 2); }
    g.fillStyle = c.eye; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
    g.fillStyle = c.pupil; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
    g.fillStyle = '#8a4a3a'; g.fillRect(3, 6, 2, 1);
  });
  const side = tex('hs' + key, 8, 8, (g) => { g.fillStyle = c.skin; g.fillRect(0, 0, 8, 8); g.fillStyle = top; g.fillRect(0, 0, 8, 3); g.fillRect(0, 3, 3, 2); });
  const back = tex('hb' + key, 8, 8, (g) => { g.fillStyle = c.hair; g.fillRect(0, 0, 8, 8); g.fillStyle = top; g.fillRect(0, 0, 8, 3); });
  const tp = tex('ht' + key, 8, 8, (g) => { g.fillStyle = top; g.fillRect(0, 0, 8, 8); });
  const bt = tex('hbt' + key, 8, 8, (g) => { g.fillStyle = c.skin; g.fillRect(0, 0, 8, 8); });
  return boxMats([side, side, tp, bt, face, back]);
}
function bodyMats(c, key, ap) {
  const base = c.armor || c.shirt;
  const deco = (g, back) => {
    g.fillStyle = base; g.fillRect(0, 0, 16, 24);
    if (c.armor) { g.fillStyle = c.armorDark; g.fillRect(0, 0, 16, 2); g.fillRect(7, 3, 2, 18); g.fillRect(0, 22, 16, 2); return; }
    if (ap.kind === 'zombie') { g.fillStyle = '#5f9e4d'; g.fillRect(3, 18, 4, 6); g.fillRect(10, 20, 3, 4); }
    const sk = ap.skin;
    if (sk && sk.kind === 'ball') {
      g.fillStyle = sk.accent; g.fillRect(0, 0, 16, 1); g.fillRect(0, 23, 16, 1);
      if (!back) { g.fillRect(7, 1, 2, 22); }
      else { g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(ap.num ?? ''), 8, 13); }
    } else if (sk) { g.fillStyle = sk.accent; g.fillRect(0, 10, 16, 3); if (!back) g.fillRect(6, 4, 4, 4); }
  };
  const f = tex('bf' + key, 16, 24, (g) => deco(g, false));
  const b = tex('bb' + key, 16, 24, (g) => deco(g, true));
  const s = tex('bs' + key, 8, 24, (g) => { g.fillStyle = base; g.fillRect(0, 0, 8, 24); if (c.armor) { g.fillStyle = c.armorDark; g.fillRect(0, 0, 8, 2); } });
  return boxMats([s, s, s, s, f, b]);
}
function limbMats(c, key, part) {
  const t = tex(part + key, 4, 12, (g) => {
    if (part === 'arm') {
      const sleeve = c.armor || c.shirt;
      g.fillStyle = sleeve; g.fillRect(0, 0, 4, 12);
      g.fillStyle = c.skin; g.fillRect(0, c.armor ? 9 : 4, 4, 12);
      if (!c.armor) { g.fillStyle = sleeve; g.fillRect(0, 0, 4, 4); }
    } else {
      g.fillStyle = c.armor ? c.armorDark : c.pants; g.fillRect(0, 0, 4, 12);
      g.fillStyle = '#3a2a1e'; g.fillRect(0, 10, 4, 2);
      if (c.accent && !c.armor) { g.fillStyle = c.accent; g.fillRect(0, 8, 4, 1); }
    }
  });
  return lam({ map: t });
}

function addTool(armR, armL, body, ap, c) {
  const sk = ap.skin;
  const hand = new THREE.Group(); hand.position.set(0, -0.68, 0.1); armR.add(hand);
  if (ap.sword && ARMOR[ap.sword]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.16), lam({ color: ap.sword === 'diamond' ? '#7ff5ee' : '#e6e9ed', emissive: ap.sword === 'diamond' ? '#0d4a46' : '#202020' }));
    blade.position.set(0, 0, 0.45); blade.rotation.x = Math.PI / 2;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.35), lam({ color: '#3a2a1e' })); guard.position.set(0, 0, 0.08); guard.rotation.x = Math.PI / 2;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), lam({ color: '#5a3a1e' }));
    hand.add(blade, guard, grip);
  } else if (sk && sk.tool === 'spear') {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.6, 0.07), lam({ color: '#6b5a3a' })); pole.position.y = 0.3;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), lam({ color: sk.accent, emissive: '#5a4a00' })); tip.position.y = 1.25;
    hand.add(pole, tip);
  } else if (sk && sk.tool === 'bat') {
    const bat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), lam({ color: '#c99a5b' })); bat.position.y = 0.4; bat.rotation.z = 0.3;
    hand.add(bat);
  }
  if (sk && sk.tool === 'glove') {
    for (const a of [armR, armL]) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.32), lam({ color: sk.accent, emissive: '#5a1a00' })); gl.position.y = -0.62; a.add(gl);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd34d' : '#ff5a2a' })); f.position.set(-0.1 + i * 0.1, -0.85, 0); f.userData.flame = i; a.add(f); }
    }
  }
  if (sk && sk.tool === 'iceshield') {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 6), lam({ color: sk.accent, emissive: '#1a4a5a', transparent: true, opacity: 0.9 }));
    sh.rotation.z = Math.PI / 2; sh.position.set(-0.2, -0.45, 0); armL.add(sh);
  }
  if (sk && sk.tool === 'cape') {
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.04), lam({ color: sk.accent, emissive: '#3a2a00' }));
    cape.geometry.translate(0, -0.65, 0); cape.position.set(0, 0.37, -0.16); body.add(cape); body.userData.cape = cape;
  }
  if (sk && sk.tool === 'wings') {
    for (const dir of [-1, 1]) {
      const wg = new THREE.Group(); wg.position.set(dir * 0.12, 0.2, -0.16); body.add(wg);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.04), lam({ color: sk.accent, emissive: '#2a3036' }));
      w.position.set(dir * 0.5, 0.15, 0); w.rotation.z = dir * 0.35; wg.add(w); wg.userData.dir = dir;
      (body.userData.wings = body.userData.wings || []).push(wg);
    }
  }
}

export function makeHuman(ap) {
  const c = charColors(ap);
  const key = [ap.kind, ap.skin ? ap.skin.id : '', ap.armor || '', ap.num ?? ''].join('|');
  const root = new THREE.Group();
  const inner = new THREE.Group(); root.add(inner);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMats(c, key)); head.position.y = 1.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), bodyMats(c, key, ap)); body.position.y = 1.125;
  const mkLimb = (part, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), limbMats(c, key, part)); m.position.y = -0.375; pivot.add(m);
    return pivot;
  };
  const armL = mkLimb('arm', 0.375, 1.5), armR = mkLimb('arm', -0.375, 1.5);
  const legL = mkLimb('leg', 0.125, 0.75), legR = mkLimb('leg', -0.125, 0.75);
  inner.add(head, body, armL, armR, legL, legR);
  addTool(armR, armL, body, ap, c);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#78c8ff', transparent: true, opacity: 0.22, depthWrite: false }));
  bubble.position.y = 1; bubble.visible = false; root.add(bubble);
  const h = { root, inner, head, body, armL, armR, legL, legR, bubble, ap, key, zombie: ap.kind !== 'player', opacity: 1 };
  h.anim = (o) => animHuman(h, o);
  return h;
}
export function animHuman(h, o) {
  const walk = o.walk || 0, mv = o.moving ? 1 : 0.15;
  h.legL.rotation.x = Math.sin(walk) * 0.7 * mv; h.legR.rotation.x = -Math.sin(walk) * 0.7 * mv;
  if (h.zombie) { h.armL.rotation.x = -Math.PI / 2 + Math.sin(walk * 0.5) * 0.1; h.armR.rotation.x = -Math.PI / 2 - Math.sin(walk * 0.5) * 0.1; }
  else { h.armL.rotation.x = -Math.sin(walk) * 0.6 * mv; h.armR.rotation.x = Math.sin(walk) * 0.6 * mv - (o.swing || 0) * 2.2; }
  h.inner.position.y = o.moving ? Math.abs(Math.sin(walk)) * 0.06 : 0;
  const cape = h.body.userData.cape; if (cape) cape.rotation.x = 0.15 + Math.abs(Math.sin(walk)) * 0.25 * mv;
  (h.body.userData.wings || []).forEach((w) => (w.rotation.y = w.userData.dir * (0.3 + Math.sin(walk * 0.6) * 0.25)));
  h.bubble.visible = !!o.shield;
  setOpacity(h, o.alpha == null ? 1 : o.alpha);
}
function setOpacity(e, op) {
  if (op === e.opacity) return; e.opacity = op;
  e.inner.traverse((m) => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => { mt.transparent = op < 1 || !!mt.userData.glass; mt.opacity = (mt.userData.baseOp ?? 1) * op; }); });
}
function faceTex(key, bg, eye, cheek) {
  return tex('mf' + key, 8, 8, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 8, 8);
    g.fillStyle = eye; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2);
    g.fillStyle = '#ffffff'; g.fillRect(1, 3, 1, 1); g.fillRect(5, 3, 1, 1);
    if (cheek) { g.fillStyle = cheek; g.fillRect(0, 5, 1, 1); g.fillRect(7, 5, 1, 1); }
    g.fillStyle = eye; g.fillRect(3, 6, 2, 1);
  });
}
const MONSTERS = ['slime', 'mushroom', 'gold'];
export function makeMonster(ap) {
  const kind = ap.kind; const key = kind;
  const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner);
  const parts = {};
  if (kind === 'slime' || kind === 'gold') {
    const gold = kind === 'gold';
    const col = gold ? '#ffd34d' : '#6fdc8c', dark = gold ? '#e0a020' : '#3fae5f';
    const side = tex('sl' + key, 8, 8, (g) => speckle(g, 8, 8, col, [dark], 6));
    const face = faceTex(key, col, '#2a2a2a', gold ? '#ff9a3a' : '#ff8fb0');
    const outer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), [side, side, side, side, face, side].map((t) => { const m = lam({ map: t, transparent: true, opacity: 0.88, emissive: gold ? '#5a4000' : '#000000' }); m.userData.glass = true; m.userData.baseOp = 0.88; return m; }));
    outer.position.y = 0.55;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), lam({ color: dark })); core.position.y = 0.5;
    inner.add(core, outer); parts.body = outer;
    if (gold) {
      parts.sparks = [];
      for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#fffbe0' })); inner.add(sp); parts.sparks.push(sp); }
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), lam({ color: '#ffb000', emissive: '#6a4a00' })); crown.position.y = 1.2; inner.add(crown);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), lam({ color: '#ffb000', emissive: '#6a4a00' })); t.position.set(x, 1.38, z); inner.add(t); }
    }
  } else if (kind === 'mushroom') {
    const stemSide = tex('ms', 8, 8, (g) => speckle(g, 8, 8, '#f3e3c3', ['#e2cfa8'], 6));
    const stemFace = faceTex('mush', '#f3e3c3', '#2a2a2a', '#ff9a9a');
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), [stemSide, stemSide, stemSide, stemSide, stemFace, stemSide].map((t) => lam({ map: t }))); stem.position.y = 0.45;
    const capT = tex('mc', 8, 8, (g) => { g.fillStyle = '#e8413c'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#ffffff'; for (const [x, y] of [[1, 1], [5, 2], [2, 5], [6, 6], [4, 4]]) g.fillRect(x, y, 1, 1); });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.3), lam({ map: capT })); cap.position.y = 1.1;
    const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), lam({ map: capT })); cap2.position.y = 1.48;
    const feet = [-0.18, 0.18].map((x) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.3), lam({ color: '#8a5a3a' })); f.position.set(x, 0.06, 0.05); inner.add(f); return f; });
    inner.add(stem, cap, cap2); parts.cap = cap; parts.feet = feet;
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  const e = { root, inner, key, ap, opacity: 1 };
  e.anim = (o) => {
    const w = o.walk || 0;
    if (kind === 'slime' || kind === 'gold') {
      const b = Math.abs(Math.sin(w * 0.8));
      inner.position.y = b * 0.45; inner.scale.set(1 + (1 - b) * 0.12, 1 - (1 - b) * 0.15, 1 + (1 - b) * 0.12);
      if (parts.sparks) parts.sparks.forEach((sp, i) => { const a = w * 0.6 + i * 1.256; sp.position.set(Math.cos(a) * 0.9, 0.6 + Math.sin(w + i) * 0.4, Math.sin(a) * 0.9); });
    } else {
      inner.rotation.z = Math.sin(w) * 0.12; inner.position.y = Math.abs(Math.sin(w)) * 0.08;
      parts.feet[0].position.z = 0.05 + Math.sin(w) * 0.12; parts.feet[1].position.z = 0.05 - Math.sin(w) * 0.12;
    }
    setOpacity(e, o.alpha == null ? 1 : o.alpha);
  };
  return e;
}
function disposeObj(o) { o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => mt.dispose()); }); }

// ---------- 보스 ----------
function flashable(meshes) { return meshes.map((m) => m.material).flat(); }
function makeBeast() {
  const g = new THREE.Group();
  const bodyM = lam({ map: T.stone(), color: '#a39a90' }), darkM = lam({ color: '#4c4844' }), hornM = lam({ color: '#e8dcc0' });
  const add = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  add(3.2, 2.4, 5, 0, 3.1, 0, bodyM);
  add(3.3, 0.5, 5.1, 0, 4.35, 0, darkM);
  const legs = [[-1.1, 1.8], [1.1, 1.8], [-1.1, -1.8], [1.1, -1.8]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 2.1, z); const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.9), darkM); l.position.y = -1.05; p.add(l); g.add(p); return p; });
  const head = new THREE.Group(); head.position.set(0, 3.4, 3.1); g.add(head);
  const hm = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); head.add(b); return b; };
  hm(2.2, 2.2, 2, 0, 0, 0.6, bodyM);
  hm(2.0, 0.8, 0.4, 0, -0.8, 1.6, lam({ color: '#3a2622' }));
  for (let i = 0; i < 5; i++) hm(0.2, 0.25, 0.1, -0.8 + i * 0.4, -0.5, 1.82, lam({ color: '#f2efe2' }));
  hm(0.4, 0.3, 0.1, -0.55, 0.35, 1.62, new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
  hm(0.4, 0.3, 0.1, 0.55, 0.35, 1.62, new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
  for (const s of [-1, 1]) { hm(0.5, 0.5, 0.5, s * 1.3, 1.0, 0.6, hornM); hm(0.4, 1.0, 0.4, s * 1.55, 1.6, 0.4, hornM); hm(0.35, 0.4, 0.6, s * 1.55, 2.2, 0.75, hornM); }
  const mats = []; g.traverse((m) => m.material && mats.push(m.material));
  return {
    group: g, head, legs, mats, height: 5.5,
    update(t, flash, lunge) {
      g.position.z = -6 + lunge * 2.5; g.position.y = Math.sin(t * 3) * 0.05;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 5 + i * 1.6) * 0.25));
      head.rotation.x = Math.sin(t * 2) * 0.08 - lunge * 0.4;
      mats.forEach((m) => m.emissive && m.emissive.set(flash ? '#a01010' : '#000000'));
    },
  };
}
function makeDragon() {
  const g = new THREE.Group();
  const scale = lam({ color: '#2f6b4f' }), dark = lam({ color: '#1c4434' }), belly = lam({ color: '#e0c36a' }), horn = lam({ color: '#e8dcc0' });
  const add = (p, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); p.add(b); return b; };
  const bodyG = new THREE.Group(); bodyG.position.y = 4.2; g.add(bodyG);
  add(bodyG, 2.6, 2.2, 4.2, 0, 0, 0, scale);
  add(bodyG, 2.0, 0.3, 3.6, 0, -1.2, 0, belly);
  for (let i = 0; i < 4; i++) add(bodyG, 0.4, 0.5, 0.4, 0, 1.35, -1.5 + i * 1, belly);
  add(bodyG, 1.2, 1.2, 2.4, 0, 0.8, 2.6, scale); // 목
  const head = new THREE.Group(); head.position.set(0, 1.6, 4.4); bodyG.add(head);
  add(head, 2.2, 1.6, 2.2, 0, 0, 0, scale);
  add(head, 1.8, 0.7, 1.6, 0, -0.45, 1.6, dark);
  for (let i = 0; i < 5; i++) add(head, 0.18, 0.25, 0.1, -0.7 + i * 0.35, -0.1, 2.42, lam({ color: '#ffffff' }));
  add(head, 0.5, 0.25, 0.1, -0.6, 0.35, 1.12, new THREE.MeshBasicMaterial({ color: '#ffd34d' }));
  add(head, 0.5, 0.25, 0.1, 0.6, 0.35, 1.12, new THREE.MeshBasicMaterial({ color: '#ffd34d' }));
  for (const s of [-1, 1]) add(head, 0.3, 0.9, 0.3, s * 0.75, 1.1, -0.6, horn);
  const wings = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 1.3, 0.8, 0.3); bodyG.add(p);
    add(p, 4.5, 0.18, 2.8, s * 2.4, 0, 0, dark);
    add(p, 4.5, 0.25, 0.3, s * 2.4, 0.1, 1.3, scale);
    add(p, 2.2, 0.15, 2.0, s * 5.4, -0.1, -0.2, dark);
    p.userData.s = s; return p;
  });
  const tail = []; let prev = bodyG;
  for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0, i === 0 ? -0.2 : 0, i === 0 ? -2.2 : -0.9); prev.add(p); add(p, 1.0 - i * 0.1, 0.9 - i * 0.08, 1.0, 0, 0, -0.45, i % 2 ? scale : dark); tail.push(p); prev = p; }
  const mats = []; g.traverse((m) => m.material && mats.push(m.material));
  return {
    group: g, head, mats, height: 7.5,
    update(t, flash, lunge) {
      bodyG.position.y = 4.2 + Math.sin(t * 2) * 0.4; g.position.z = -11 + lunge * 3;
      wings.forEach((w) => (w.rotation.z = w.userData.s * Math.sin(t * 4) * 0.5));
      tail.forEach((p, i) => (p.rotation.y = Math.sin(t * 2 + i * 0.5) * 0.2));
      head.rotation.x = Math.sin(t * 1.5) * 0.1 + lunge * 0.5;
      mats.forEach((m) => m.emissive && m.emissive.set(flash ? '#a01010' : '#000000'));
    },
  };
}

// ---------- 장면 ----------
function baseScene(sky, fogNear, fogFar) {
  const s = new THREE.Scene(); s.background = new THREE.Color(sky); s.fog = new THREE.Fog(sky, fogNear, fogFar);
  s.add(new THREE.HemisphereLight('#ffffff', '#556644', 1.6));
  const d = new THREE.DirectionalLight('#ffffff', 1.4); d.position.set(8, 20, 10); s.add(d);
  return s;
}
function buildField() {
  const s = baseScene('#a6dcff', 30, 75);
  const ground = [];
  for (let x = -30; x <= 30; x++) for (let z = -20; z <= 22; z++) ground.push([x, -0.5, z]);
  s.add(instancedBlocks(ground, boxMats([T.grassSide(), T.grassSide(), T.grassTop(), T.dirt(), T.grassSide(), T.grassSide()])));
  // 테두리 나무
  const wood = [], leaf = [];
  const tree = (x, z, h = 3) => { for (let y = 0; y < h; y++) wood.push([x, y + 0.5, z]); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 2; dy++) if (!(dx === 0 && dz === 0 && dy === 0)) leaf.push([x + dx, h + dy - 0.5, z + dz]); leaf.push([x, h + 1.5, z]); };
  for (let x = -28; x <= 28; x += 4) { tree(x + (x % 3), -14, 3 + (Math.abs(x) % 2)); tree(x + 1, 17, 3); }
  for (let z = -10; z <= 14; z += 4) { tree(-27, z, 3); tree(27, z + 1, 4); }
  s.add(instancedBlocks(wood, lam({ map: T.wood() })));
  const pastel = [lam({ map: T.leaves() }), lam({ map: T.pink() }), lam({ map: T.mint() })];
  const groups = [[], [], []]; let ti = 0, cnt = 0;
  leaf.forEach((p) => { groups[ti].push(p); if (++cnt >= 18) { cnt = 0; ti = (ti + 1) % 3; } });
  groups.forEach((g, i) => g.length && s.add(instancedBlocks(g, pastel[i], 0.25)));
  // 꽃·풀
  const fl = new THREE.Group();
  const cols = ['#ffe14d', '#ff7aa8', '#ffffff', '#9fd4ff', '#c99bff', '#ffb35a'];
  for (let i = 0; i < 130; i++) {
    const x = (rnd() - 0.5) * 50, z = (rnd() - 0.5) * 28;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), lam({ color: '#3f7a2a' })); stem.position.set(x, 0.15, z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), lam({ color: cols[i % cols.length], emissive: '#222222' })); top.position.set(x, 0.36, z);
    fl.add(stem, top);
  }
  s.add(fl);
  // 돌 덩어리 장식
  const rocks = []; for (let i = 0; i < 10; i++) { const x = Math.round((rnd() - 0.5) * 44), z = Math.round(-12 + rnd() * 2); rocks.push([x, 0.5, z]); if (rnd() < 0.4) rocks.push([x + 1, 0.5, z]); }
  s.add(instancedBlocks(rocks, lam({ map: T.cobble() })));
  return s;
}
function buildArena(kind) {
  if (kind === 'ravager') {
    const s = baseScene('#9fd0ee', 30, 80);
    const g = []; for (let x = -20; x <= 20; x++) for (let z = -22; z <= 16; z++) g.push([x, -0.5, z]);
    s.add(instancedBlocks(g, boxMats([T.dirt(), T.dirt(), T.dirt(), T.dirt(), T.dirt(), T.dirt()]), 0.2));
    const st = [];
    for (let x = -16; x <= 16; x += 4) { const h = 2 + ((x * 7) & 3); for (let y = 0; y < h; y++) st.push([x, y + 0.5, -16]); }
    for (let z = -12; z <= 8; z += 5) for (const x of [-14, 14]) { const h = 1 + ((z * 3) & 1); for (let y = 0; y < h; y++) st.push([x, y + 0.5, z]); }
    s.add(instancedBlocks(st, lam({ map: T.cobble() })));
    return s;
  }
  const s = baseScene('#3a2240', 25, 70);
  s.background = new THREE.Color('#2a1838');
  const g = [], lava = [];
  for (let x = -20; x <= 20; x++) for (let z = -24; z <= 16; z++) { (rnd() < 0.06 && Math.abs(x) > 3 ? lava : g).push([x, -0.5, z]); }
  s.add(instancedBlocks(g, lam({ map: T.darkRock() }), 0.2));
  s.add(instancedBlocks(lava, new THREE.MeshBasicMaterial({ map: T.lava() })));
  const rk = [];
  for (let x = -18; x <= 18; x += 3) { const h = 3 + ((x * 5) & 3); for (let y = 0; y < h; y++) rk.push([x, y + 0.5, -20 + ((x * 3) & 1)]); }
  s.add(instancedBlocks(rk, lam({ map: T.darkRock() })));
  return s;
}

// ---------- 화면 관리 ----------
export class World {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.r.setPixelRatio(1); this.r.setSize(GW, GH, false);
    this.cam = new THREE.PerspectiveCamera(50, GW / GH, 0.1, 200);
    this.scenes = {}; this.mode = null; this.ents = new Map(); this.boss = null;
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.camPos = new THREE.Vector3(0, 10, 14); this.camLook = new THREE.Vector3();
    this.arrows = [];
  }
  setMode(m) {
    if (this.mode === m) return;
    for (const [, e] of this.ents) { e.root.parent && e.root.parent.remove(e.root); disposeObj(e.root); }
    this.ents.clear();
    this.mode = m;
    if (!m) return;
    if (!this.scenes[m]) {
      this.scenes[m] = m === 'field' ? buildField() : buildArena(m);
      if (m !== 'field') {
        const b = m === 'ravager' ? makeBeast() : makeDragon();
        b.group.position.set(0, 0, m === 'dragon' ? -11 : -6); b.baseZ = b.group.position.z; this.scenes[m].add(b.group); this.scenes[m].userData.boss = b;
      }
    }
    this.scene = this.scenes[m]; this.boss = this.scene.userData.boss || null;
    this.arrows.forEach((a) => a.parent && a.parent.remove(a)); this.arrows = [];
  }
  // 같은 id의 캐릭터를 만들거나 모습이 바뀌면 다시 만듦
  ent(id, ap) {
    const key = [ap.kind, ap.skin ? ap.skin.id : '', ap.armor || '', ap.num ?? ''].join('|');
    let e = this.ents.get(id);
    if (e && e.key !== key) { this.scene.remove(e.root); disposeObj(e.root); e = null; }
    if (!e) { e = MONSTERS.includes(ap.kind) ? makeMonster(ap) : makeHuman({ ...ap, sword: ap.armor && ap.armor !== 'none' ? ap.armor : null }); this.scene.add(e.root); this.ents.set(id, e); }
    e.seen = true; return e;
  }
  sweep() { for (const [id, e] of this.ents) { if (!e.seen) { this.scene.remove(e.root); disposeObj(e.root); this.ents.delete(id); } else e.seen = false; } }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.cam);
    return { x: (v.x + 1) / 2 * GW, y: (1 - v.y) / 2 * GH, behind: v.z > 1 };
  }
  // 들판: 논리 좌표(x,y)를 그대로 받아 3D로 배치
  updateField(st, dt) {
    const labels = [];
    for (const o of st.list) {
      const e = this.ent(o.id, o.ap);
      const { X, Z } = toWorld(o.x, o.y);
      e.root.position.set(X, 0, Z);
      if (o.face != null) { let d = o.face - e.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); e.root.rotation.y += d * Math.min(1, dt * 12); }
      e.anim(o);
      if (o.label) { const p = this.project(X, 2.45, Z); labels.push({ text: o.label, ...p }); }
    }
    this.sweep();
    const me = st.list.find((o) => o.me);
    if (me) {
      const { X, Z } = toWorld(me.x, me.y);
      const target = new THREE.Vector3(X, 10.5, Z + 12.5);
      this.camPos.lerp(target, Math.min(1, dt * 4)); this.camLook.lerp(new THREE.Vector3(X, 1, Z + 1), Math.min(1, dt * 5));
      this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook);
    }
    return labels;
  }
  updateBoss(st, dt) {
    const labels = [];
    const b = this.boss; b.update(st.t, st.flash, st.lunge);
    // 나
    const me = this.ent('me', st.me.ap);
    me.root.position.set(st.me.dodge, 0, 6); me.root.rotation.y = Math.PI;
    animHuman(me, { walk: st.t * 2, moving: false, swing: st.me.swing, alpha: st.me.alpha, shield: st.me.shield });
    labels.push({ text: st.me.label, ...this.project(st.me.dodge, 2.45, 6) });
    // 모둠원
    const spots = [[-3, 5.5], [3, 5.5], [-5.5, 4.5], [5.5, 4.5], [-7.5, 3.5], [7.5, 3.5]];
    st.members.forEach((m, i) => {
      const e = this.ent('m' + m.id, m.ap); const [x, z] = spots[i % spots.length];
      e.root.position.set(x, 0, z); e.root.rotation.y = Math.PI + (x < 0 ? -0.2 : 0.2);
      animHuman(e, { walk: st.t * 2 + i, moving: false, swing: m.swing, alpha: m.alpha });
      labels.push({ text: m.label, ...this.project(x, 2.45, z) });
    });
    this.sweep();
    // 화살
    while (this.arrows.length < st.arrows.length) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), lam({ color: '#8a5a2a' })); this.scene.add(a); this.arrows.push(a); }
    while (this.arrows.length > st.arrows.length) { const a = this.arrows.pop(); this.scene.remove(a); disposeObj(a); }
    st.arrows.forEach((t, i) => { const a = this.arrows[i]; a.position.set(st.me.dodge * (1 - t), 1.6 + Math.sin(t * Math.PI) * 3 + t * 2, 6 - t * 10); a.rotation.x = -0.6 + t * 1.2; });
    // 카메라 (흔들림)
    const sh = st.shake ? (Math.random() - 0.5) * 0.4 : 0;
    this.cam.position.set(sh, 7 + sh, 16.5); this.cam.lookAt(0, 3, -4);
    const bz = b.group.position.z;
    const bh = this.project(0, b.height, bz);
    return { labels, bossHead: bh };
  }
  render() { if (this.scene) this.r.render(this.scene, this.cam); }
  // 화면 클릭 → 땅 위 논리 좌표
  pick(px, py) {
    const ndc = new THREE.Vector2(px / GW * 2 - 1, -(py / GH * 2 - 1));
    this.ray.setFromCamera(ndc, this.cam);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    return { x: hit.x * S + GW / 2, y: hit.z * S + GH / 2 };
  }
}

// ---------- 초상화 (대기실·스킨 고르기) ----------
let pr = null;
export function portrait(ctx2d, ap, w, h, turn = 0) {
  if (!pr) {
    const c = document.createElement('canvas');
    pr = { r: new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }), s: new THREE.Scene(), cam: new THREE.PerspectiveCamera(32, 1, 0.1, 50) };
    pr.s.add(new THREE.HemisphereLight('#ffffff', '#667755', 1.8));
    const d = new THREE.DirectionalLight('#ffffff', 1.3); d.position.set(3, 5, 6); pr.s.add(d);
  }
  pr.r.setSize(w, h, false); pr.cam.aspect = w / h; pr.cam.updateProjectionMatrix();
  const hmn = makeHuman({ ...ap, sword: ap.armor && ap.armor !== 'none' ? ap.armor : null });
  hmn.root.rotation.y = 0.5 + turn; hmn.root.children.forEach((c) => { if (c.geometry && c.geometry.type === 'CircleGeometry') c.visible = false; });
  animHuman(hmn, { walk: 0.6, moving: true });
  pr.s.add(hmn.root);
  pr.cam.position.set(0, 1.4, 6.2); pr.cam.lookAt(0, 1.05, 0);
  pr.r.render(pr.s, pr.cam);
  ctx2d.clearRect(0, 0, w, h); ctx2d.drawImage(pr.r.domElement, 0, 0, w, h);
  pr.s.remove(hmn.root); disposeObj(hmn.root);
}


// ---------- 3D 대기실 ----------
export class LobbyView {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    this.r.setPixelRatio(1); this.r.setSize(canvas.width, canvas.height, false);
    this.s = baseScene('#a6dcff', 20, 50);
    const g = []; for (let x = -9; x <= 9; x++) for (let z = -5; z <= 3; z++) g.push([x, -0.5, z]);
    this.s.add(instancedBlocks(g, boxMats([T.grassSide(), T.grassSide(), T.grassTop(), T.dirt(), T.grassSide(), T.grassSide()])));
    const wood = [], leaf = [];
    for (const [x, z] of [[-8, -4], [8, -4], [-5, -5], [5, -5], [0, -5]]) { for (let y = 0; y < 3; y++) wood.push([x, y + 0.5, z]); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 2; dy++) leaf.push([x + dx, 3 + dy - 0.5, z + dz]); }
    this.s.add(instancedBlocks(wood, lam({ map: T.wood() })));
    this.s.add(instancedBlocks(leaf.slice(0, 36), lam({ map: T.pink() }), 0.2));
    this.s.add(instancedBlocks(leaf.slice(36, 54), lam({ map: T.mint() }), 0.2));
    this.s.add(instancedBlocks(leaf.slice(54), lam({ map: T.leaves() }), 0.25));
    this.cam = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
    this.cam.position.set(0, 3.2, 10); this.cam.lookAt(0, 1.1, 0);
    this.ents = new Map();
  }
  update(list, t) {
    const n = list.length, gap = Math.min(1.6, 14 / Math.max(1, n));
    list.forEach((o, i) => {
      const key = [o.ap.kind, o.ap.skin ? o.ap.skin.id : '', o.ap.armor || '', o.ap.num ?? ''].join('|');
      let e = this.ents.get(o.id);
      if (e && e.key !== key) { this.s.remove(e.root); disposeObj(e.root); e = null; }
      if (!e) { e = makeHuman(o.ap); e.drop = 6; this.s.add(e.root); this.ents.set(o.id, e); }
      e.seen = true;
      e.drop = Math.max(0, e.drop - 0.25); // 위에서 쿵 떨어지기
      const x = (i - (n - 1) / 2) * gap;
      e.root.position.set(x, e.drop, o.me ? 0.6 : 0);
      e.root.rotation.y = o.me ? Math.sin(t * 1.2) * 0.6 : Math.sin(t + i) * 0.25;
      animHuman(e, { walk: t * 3 + i, moving: e.drop > 0 || o.me, swing: o.me ? (Math.sin(t * 3) + 1) / 3 : 0, alpha: o.off ? 0.4 : 1 });
    });
    for (const [id, e] of this.ents) { if (!e.seen) { this.s.remove(e.root); disposeObj(e.root); this.ents.delete(id); } else e.seen = false; }
    this.r.render(this.s, this.cam);
  }
  project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.cam); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }
}
