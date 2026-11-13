// 학생·교사 화면이 함께 쓰는 게임 규칙
import { db } from './db.js';
import { PER_ROUND, RAVAGER_HP_PER_MEMBER, DRAGON_HP_PER_MEMBER } from './config.js';

export const UNITS = {
  4: { name: '4. 소수의 곱셈', short: '소수의 곱셈' },
  5: { name: '5. 직육면체', short: '직육면체' },
  6: { name: '6. 평균과 가능성', short: '평균과 가능성' },
};

export const PHASES = ['r1', 'ravager', 'r2', 'dragon', 'done'];
export const PHASE_LABEL = {
  wait: '대기 중',
  r1: '1라운드 · 좀비 들판',
  ravager: '파괴수 보스전',
  r2: '2라운드 · 좀비 들판',
  dragon: '드래곤 보스전',
  done: '승리!',
};

export const ITEMS = {
  shield: { icon: '🛡️', name: '방패', desc: '15초 동안 보스 공격을 모두 막아요' },
  apple: { icon: '🍎', name: '황금 사과', desc: '하트를 모두 채워요' },
  bow: { icon: '🏹', name: '활과 화살', desc: '화살 8발을 쏘아 큰 피해를 줘요' },
  potion: { icon: '🧪', name: '힘의 물약', desc: '15초 동안 공격력이 2배가 돼요' },
};
export const ROUND_ITEMS = { r1: ['shield', 'apple'], r2: ['bow', 'potion'] };

// 승리 보상 스킨 (모두 이 게임을 위해 새로 만든 디자인)
export const SKINS = [
  { id: 'thunder', kind: 'hero', name: '번개 창', desc: '번개가 흐르는 창을 든 영웅', shirt: '#2d3e8c', pants: '#1d2550', accent: '#ffd83a', tool: 'spear' },
  { id: 'flame', kind: 'hero', name: '불꽃 장갑', desc: '불꽃이 피어오르는 장갑', shirt: '#9c2b1f', pants: '#4a1410', accent: '#ff9b2f', tool: 'glove' },
  { id: 'ice', kind: 'hero', name: '얼음 방패', desc: '육각형 얼음 결정 방패', shirt: '#2f7fa8', pants: '#174260', accent: '#bff1ff', tool: 'iceshield' },
  { id: 'star', kind: 'hero', name: '별빛 망토', desc: '반짝이는 보랏빛 망토', shirt: '#5a2d8c', pants: '#2c1650', accent: '#f6e27a', tool: 'cape' },
  { id: 'wing', kind: 'hero', name: '강철 날개', desc: '등에 단 강철 날개', shirt: '#5b6670', pants: '#2f363c', accent: '#e6edf2', tool: 'wings' },
  { id: 'bb-blue', kind: 'ball', name: '푸른 파도 유니폼', desc: '가상 야구팀 · 파랑', shirt: '#f4f7fb', pants: '#f4f7fb', accent: '#1e5bd6', tool: 'bat' },
  { id: 'bb-red', kind: 'ball', name: '붉은 호랑이 유니폼', desc: '가상 야구팀 · 빨강', shirt: '#c8242b', pants: '#f2f2f2', accent: '#ffffff', tool: 'bat' },
  { id: 'bb-green', kind: 'ball', name: '초록 숲 유니폼', desc: '가상 야구팀 · 초록', shirt: '#1f7a45', pants: '#e9efe9', accent: '#f4d03f', tool: 'bat' },
  { id: 'bb-black', kind: 'ball', name: '검은 번개 유니폼', desc: '가상 야구팀 · 검정', shirt: '#1d1d22', pants: '#2b2b33', accent: '#f2c400', tool: 'bat' },
  { id: 'bb-orange', kind: 'ball', name: '주황 노을 유니폼', desc: '가상 야구팀 · 주황', shirt: '#ee7a1a', pants: '#fff4e8', accent: '#3a2a1a', tool: 'bat' },
];

export function membersOf(G, g) {
  const ps = (G && G.players) || {};
  return Object.values(ps).filter((p) => p && p.group == g).sort((a, b) => a.num - b.num);
}

export function roundDone(p, phase) {
  return ((phase === 'r1' ? p.r1 : p.r2) || 0) >= PER_ROUND;
}

function nextState(cur, memberCount) {
  const n = Math.max(1, memberCount);
  switch (cur.phase) {
    case 'r1': return { phase: 'ravager', hp: n * RAVAGER_HP_PER_MEMBER, dmg: 0, since: Date.now() };
    case 'ravager': return { phase: 'r2', since: Date.now() };
    case 'r2': return { phase: 'dragon', hp: n * DRAGON_HP_PER_MEMBER, dmg: 0, since: Date.now() };
    case 'dragon': return { phase: 'done', since: Date.now() };
    default: return null;
  }
}

// fromPhase 단계에 있을 때만 다음 단계로 넘김 (여러 기기가 동시에 불러도 한 번만)
export async function advanceGroup(g, fromPhase, memberCount) {
  let moved = null;
  const res = await db.tx(`groups/${g}`, (cur) => {
    moved = null;
    if (!cur || cur.phase !== fromPhase) return cur;
    const nx = nextState(cur, memberCount);
    if (!nx) return cur;
    moved = nx.phase;
    return nx;
  });
  if (res.committed && moved === 'done') {
    await db.put(`groups/${g}/finishedAt`, db.TS);
    const r = await db.tx('finishCount', (c) => (c || 0) + 1);
    await db.put(`groups/${g}/rank`, r.value);
  }
  return moved;
}

export function fmtTime(ms) {
  if (!ms || ms < 0) return '-';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
}

export function rankingOf(G) {
  const gs = (G && G.groups) || {};
  return Object.entries(gs)
    .filter(([, v]) => v && v.phase === 'done' && v.rank)
    .map(([g, v]) => ({ g: +g, rank: v.rank, time: (v.finishedAt || 0) - ((G && G.startedAt) || 0) }))
    .sort((a, b) => a.rank - b.rank);
}
