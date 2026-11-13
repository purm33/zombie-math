// 문제 만들기 — 2022 개정 5학년 2학기 4·5·6단원
// 반환: { text, svg?, type: 'num' | 'choice', answer, choices?, unit? }

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- 소수 계산 (정수로 계산해서 오차 없음) ----------
const D = (i, p) => ({ i, p }); // 값 = i / 10^p
const mul = (a, b) => D(a.i * b.i, a.p + b.p);
function fmt(d) {
  if (d.p === 0) return String(d.i);
  let s = String(Math.abs(d.i)).padStart(d.p + 1, '0');
  let ip = s.slice(0, s.length - d.p), fp = s.slice(s.length - d.p).replace(/0+$/, '');
  return (d.i < 0 ? '-' : '') + ip + (fp ? '.' + fp : '');
}
// p자리 소수 (마지막 자리가 0이 아니게)
function decN(p, min, max) { let i; do { i = rnd(min, max); } while (i % 10 === 0); return D(i, p); }
const num = (n) => D(n, 0);
const ans = (d) => fmt(d);

// ================= 4단원 소수의 곱셈 =================
const U4 = {
  dxn() { // 소수 × 자연수
    const a = Math.random() < 0.6 ? decN(1, 2, 99) : decN(2, 11, 299);
    const b = num(rnd(2, 9));
    return { text: `${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) };
  },
  nxd() { // 자연수 × 소수
    const a = num(rnd(2, 25));
    const b = Math.random() < 0.7 ? decN(1, 2, 39) : decN(2, 11, 99);
    return { text: `${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) };
  },
  dxd() { // 소수 × 소수
    let a, b;
    const t = rnd(1, 3);
    if (t === 1) { a = D(rnd(1, 9), 1); b = D(rnd(1, 9), 1); }
    else if (t === 2) { a = decN(1, 11, 59); b = D(rnd(1, 9), 1); }
    else { a = decN(1, 11, 39); b = decN(1, 11, 29); }
    return { text: `${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) };
  },
  point() { // 곱의 소수점 위치
    const t = rnd(1, 3);
    if (t === 1) {
      const a = decN(rnd(1, 3), 101, 9999); const k = pick([10, 100, 1000]);
      return { text: `${fmt(a)} × ${k} = ?`, answer: ans(mul(a, num(k))) };
    }
    if (t === 2) {
      const a = num(rnd(12, 999)); const k = pick([D(1, 1), D(1, 2), D(1, 3)]);
      return { text: `${fmt(a)} × ${fmt(k)} = ?`, answer: ans(mul(a, k)) };
    }
    const x = rnd(12, 48), y = rnd(3, 29);
    const p1 = rnd(0, 2), p2 = rnd(p1 === 0 ? 1 : 0, 2);
    const a = D(x, p1), b = D(y, p2);
    return { text: `${x} × ${y} = ${x * y} 입니다.\n그렇다면 ${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) };
  },
  bonus() {
    const t = rnd(1, 5);
    if (t === 1) { const a = decN(2, 101, 499), b = decN(1, 11, 39); return { text: `${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) }; }
    if (t === 2) { const a = D(rnd(1, 9), 2), b = D(rnd(2, 9), 1); return { text: `${fmt(a)} × ${fmt(b)} = ?`, answer: ans(mul(a, b)) }; }
    if (t === 3) {
      const x = decN(rnd(2, 3), 11, 999); const k = pick([10, 100, 1000]);
      return { text: `□ × ${k} = ${fmt(mul(x, num(k)))}\n□에 알맞은 수는?`, answer: ans(x) };
    }
    if (t === 4) { const a = D(rnd(2, 9), 1), b = D(rnd(2, 9), 1), c = num(rnd(2, 6)); return { text: `${fmt(a)} × ${fmt(b)} × ${fmt(c)} = ?`, answer: ans(mul(mul(a, b), c)) }; }
    const s = pick([
      () => { const w = decN(1, 12, 49), l = decN(1, 12, 49); return { text: `1 m의 무게가 ${fmt(w)} kg인 철근이 있습니다.\n이 철근 ${fmt(l)} m의 무게는 몇 kg인가요?`, answer: ans(mul(w, l)) }; },
      () => { const a = decN(1, 11, 39), b = decN(1, 11, 29); return { text: `가로 ${fmt(a)} m, 세로 ${fmt(b)} m인 직사각형 텃밭의 넓이는 몇 m²인가요?`, answer: ans(mul(a, b)) }; },
      () => { const v = decN(1, 12, 25), n = rnd(3, 9); return { text: `매일 우유를 ${fmt(v)} L씩 마십니다.\n${n}일 동안 마신 우유는 몇 L인가요?`, answer: ans(mul(v, num(n))) }; },
    ])();
    return s;
  },
};
function unit4(round, bonus) {
  if (bonus) return U4.bonus();
  const pool = round === 'r1' ? ['dxn', 'dxn', 'nxd', 'nxd', 'dxd', 'point'] : ['dxd', 'dxd', 'point', 'point', 'dxn', 'nxd'];
  return U4[pick(pool)]();
}

// ================= 5단원 직육면체 =================
// 직육면체 겨냥도 SVG (가로 a, 세로 b, 높이 c)
export function cuboidSVG(a, b, c, opt = {}) {
  const max = Math.max(a, b, c);
  const W = 40 + 110 * (a / max), H = 30 + 90 * (c / max), Dp = 18 + 45 * (b / max);
  const dx = Dp * 0.8, dy = Dp * 0.6;
  const x0 = 40, y0 = 30 + dy;
  const P = {
    A: [x0, y0], B: [x0 + W, y0], C: [x0 + W, y0 + H], Dd: [x0, y0 + H],
    E: [x0 + dx, y0 - dy], F: [x0 + W + dx, y0 - dy], G: [x0 + W + dx, y0 + H - dy], Hh: [x0 + dx, y0 + H - dy],
  };
  const L = (p, q, dash) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#2b2b2b" stroke-width="2.2" ${dash ? 'stroke-dasharray="5 4" stroke-opacity=".7"' : ''}/>`;
  const lab = opt.labels || [`${a} cm`, `${b} cm`, `${c} cm`];
  const T = (x, y, t, anchor = 'middle') => t ? `<text x="${x}" y="${y}" font-size="15" font-weight="700" text-anchor="${anchor}" fill="#1a4fa0">${t}</text>` : '';
  const w = x0 + W + dx + 70, h = y0 + H + 34;
  return `<svg viewBox="0 0 ${w} ${h}" width="${Math.min(300, w)}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${P.A} ${P.B} ${P.C} ${P.Dd}" fill="#ffe9a8"/>
  <polygon points="${P.A} ${P.E} ${P.F} ${P.B}" fill="#fff4cc"/>
  <polygon points="${P.B} ${P.F} ${P.G} ${P.C}" fill="#f5d77a"/>
  ${L(P.A, P.B)}${L(P.B, P.C)}${L(P.C, P.Dd)}${L(P.Dd, P.A)}${L(P.A, P.E)}${L(P.E, P.F)}${L(P.F, P.B)}${L(P.F, P.G)}${L(P.G, P.C)}
  ${L(P.Dd, P.Hh, 1)}${L(P.Hh, P.E, 1)}${L(P.Hh, P.G, 1)}
  ${T((P.Dd[0] + P.C[0]) / 2, P.C[1] + 22, lab[0])}
  ${T((P.C[0] + P.G[0]) / 2 + 8, (P.C[1] + P.G[1]) / 2 + 18, lab[1], 'start')}
  ${T(P.G[0] + 8, (P.F[1] + P.G[1]) / 2 + 5, lab[2], 'start')}
</svg>`;
}

const FACTS = [
  ['직육면체의 면은 모두 몇 개인가요?', 6], ['직육면체의 모서리는 모두 몇 개인가요?', 12], ['직육면체의 꼭짓점은 모두 몇 개인가요?', 8],
  ['정육면체의 면은 모두 몇 개인가요?', 6], ['정육면체의 모서리는 모두 몇 개인가요?', 12], ['정육면체의 꼭짓점은 모두 몇 개인가요?', 8],
  ['직육면체에서 한 면과 평행한 면은 몇 개인가요?', 1], ['직육면체에서 한 면과 수직인 면은 몇 개인가요?', 4],
  ['직육면체에서 서로 평행한 면은 모두 몇 쌍인가요?', 3], ['직육면체의 한 꼭짓점에서 만나는 면은 몇 개인가요?', 3],
  ['직육면체의 한 꼭짓점에서 만나는 모서리는 몇 개인가요?', 3],
  ['직육면체의 겨냥도에서 보이는 모서리는 몇 개인가요?', 9], ['직육면체의 겨냥도에서 보이지 않는 모서리는 몇 개인가요?', 3],
  ['직육면체의 겨냥도에서 보이는 꼭짓점은 몇 개인가요?', 7], ['직육면체의 겨냥도에서 보이지 않는 꼭짓점은 몇 개인가요?', 1],
  ['직육면체의 겨냥도에서 보이는 면은 몇 개인가요?', 3], ['직육면체의 겨냥도에서 보이지 않는 면은 몇 개인가요?', 3],
  ['정육면체의 전개도는 정사각형 몇 개로 이루어져 있나요?', 6],
];
const OX = [
  ['정육면체는 직육면체라고 할 수 있다.', 'O'], ['직육면체는 정육면체라고 할 수 있다.', 'X'],
  ['직육면체의 면은 모두 직사각형이다.', 'O'], ['정육면체의 모서리는 길이가 모두 같다.', 'O'],
  ['직육면체의 모서리는 길이가 모두 같다.', 'X'], ['정육면체의 면은 모두 정사각형이다.', 'O'],
  ['겨냥도에서 보이지 않는 모서리는 점선으로 그린다.', 'O'], ['겨냥도에서 보이는 모서리는 점선으로 그린다.', 'X'],
  ['직육면체에서 서로 평행한 두 면을 밑면이라고 한다.', 'O'], ['직육면체에서 밑면과 수직인 면을 옆면이라고 한다.', 'O'],
  ['직육면체의 옆면은 모두 2개이다.', 'X'], ['전개도를 접었을 때 서로 만나는 선분의 길이는 같다.', 'O'],
  ['직육면체에서 한 면과 수직인 면은 2개이다.', 'X'], ['직육면체의 전개도에서 서로 평행한 면은 이웃하여 붙어 있다.', 'X'],
];
function unit5(round, bonus) {
  if (!bonus) {
    const r = Math.random();
    if (r < 0.35) { const [q, a] = pick(FACTS); return { text: q, answer: String(a) }; }
    if (r < 0.6) { const [q, a] = pick(OX); return { text: `맞으면 O, 틀리면 X\n${q}`, type: 'choice', choices: ['O', 'X'], answer: a }; }
    const t = rnd(1, 3);
    if (t === 1) { const a = rnd(3, 15); return { text: `한 모서리가 ${a} cm인 정육면체의\n모든 모서리 길이의 합은 몇 cm인가요?`, svg: cuboidSVG(a, a, a, { labels: [`${a} cm`, '', ''] }), answer: String(12 * a) }; }
    if (t === 2) { const a = rnd(4, 15), b = rnd(3, 10), c = rnd(3, 12); return { text: '직육면체의 모든 모서리 길이의 합은 몇 cm인가요?', svg: cuboidSVG(a, b, c), answer: String(4 * (a + b + c)) }; }
    const a = rnd(3, 15); return { text: `한 모서리가 ${a} cm인 정육면체에서\n한 면의 둘레는 몇 cm인가요?`, answer: String(4 * a) };
  }
  const t = rnd(1, 5);
  if (t === 1) { const a = rnd(4, 15); return { text: `정육면체의 모든 모서리 길이의 합이 ${12 * a} cm입니다.\n한 모서리는 몇 cm인가요?`, answer: String(a) }; }
  if (t === 2) { const a = rnd(4, 15), b = rnd(3, 10), c = rnd(3, 12); return { text: `직육면체의 모든 모서리 길이의 합이 ${4 * (a + b + c)} cm입니다.\n□는 몇 cm인가요?`, svg: cuboidSVG(a, b, c, { labels: [`${a} cm`, `${b} cm`, '□ cm'] }), answer: String(c) }; }
  if (t === 3) { const a = rnd(4, 15), b = rnd(3, 10), c = rnd(3, 12); return { text: '겨냥도에서 보이지 않는 모서리(점선)\n길이의 합은 몇 cm인가요?', svg: cuboidSVG(a, b, c), answer: String(a + b + c) }; }
  if (t === 4) { const a = rnd(4, 12), b = rnd(3, 9), c = rnd(3, 10); return { text: '겨냥도에서 보이는 모서리(실선)\n길이의 합은 몇 cm인가요?', svg: cuboidSVG(a, b, c), answer: String(3 * (a + b + c)) }; }
  const a = rnd(3, 12); return { text: `정육면체의 한 면의 둘레가 ${4 * a} cm입니다.\n모든 모서리 길이의 합은 몇 cm인가요?`, answer: String(12 * a) };
}

// ================= 6단원 평균과 가능성 =================
function listWithMean(n, mean, spread) {
  let arr;
  do {
    arr = Array.from({ length: n - 1 }, () => mean + rnd(-spread, spread));
    arr.push(mean * n - arr.reduce((s, v) => s + v, 0));
  } while (arr[n - 1] < 0 || Math.abs(arr[n - 1] - mean) > spread * 2);
  return shuffle(arr);
}
const CTX = [
  ['모둠 친구들이 읽은 책', '권'], ['줄넘기 기록', '회'], ['수학 점수', '점'], ['고리 던지기에서 넣은 고리', '개'], ['일주일 동안 운동한 시간', '분'],
];
const WORDS = ['불가능하다', '~아닐 것 같다', '반반이다', '~일 것 같다', '확실하다'];
const EVENTS = [
  ['주사위를 굴렸을 때 7이 나올 가능성', '불가능하다'], ['동전을 던졌을 때 그림 면이 나올 가능성', '반반이다'],
  ['내일 아침 해가 동쪽에서 뜰 가능성', '확실하다'], ['주사위를 굴렸을 때 1이 나올 가능성', '~아닐 것 같다'],
  ['주사위를 굴렸을 때 2 이상이 나올 가능성', '~일 것 같다'], ['주사위를 굴렸을 때 짝수가 나올 가능성', '반반이다'],
  ['주사위를 굴렸을 때 6 이하의 수가 나올 가능성', '확실하다'], ['12월 다음에 1월이 올 가능성', '확실하다'],
  ['빨간 공만 4개 든 주머니에서 파란 공을 꺼낼 가능성', '불가능하다'], ['흰 공 1개, 검은 공 9개가 든 주머니에서 흰 공을 꺼낼 가능성', '~아닐 것 같다'],
  ['흰 공 9개, 검은 공 1개가 든 주머니에서 흰 공을 꺼낼 가능성', '~일 것 같다'], ['동전을 던졌을 때 숫자 면이 나올 가능성', '반반이다'],
];
const NUMEV = [
  ['빨간 공 3개만 든 주머니에서 빨간 공을 꺼낼 가능성', '1'], ['빨간 공 3개만 든 주머니에서 파란 공을 꺼낼 가능성', '0'],
  ['흰 공 2개, 검은 공 2개가 든 주머니에서 흰 공을 꺼낼 가능성', '1/2'], ['동전을 던졌을 때 그림 면이 나올 가능성', '1/2'],
  ['주사위를 굴렸을 때 홀수가 나올 가능성', '1/2'], ['주사위를 굴렸을 때 0이 나올 가능성', '0'],
  ['주사위를 굴렸을 때 1부터 6까지의 수 중 하나가 나올 가능성', '1'], ['절반은 빨강, 절반은 노랑인 회전판을 돌려 빨강에 멈출 가능성', '1/2'],
  ['모두 노란색인 회전판을 돌려 노랑에 멈출 가능성', '1'], ['모두 노란색인 회전판을 돌려 파랑에 멈출 가능성', '0'],
];
function unit6(round, bonus) {
  if (!bonus) {
    const t = rnd(1, 5);
    if (t === 1 || (t === 5 && round === 'r1')) {
      const [c, u] = pick(CTX); const n = rnd(4, 5); const m = rnd(6, 30); const arr = listWithMean(n, m, 5);
      return { text: `${c}입니다.\n${arr.map((v) => v + u).join(', ')}\n평균은 몇 ${u}인가요?`, answer: String(m) };
    }
    if (t === 2) {
      const [c, u] = pick(CTX); const n = rnd(4, 5); const m = rnd(6, 30); const arr = listWithMean(n, m, 5);
      const k = rnd(0, n - 1); const missing = arr[k]; const shown = arr.map((v, i) => (i === k ? '□' : v + u));
      return { text: `${c}의 평균은 ${m}${u}입니다.\n${shown.join(', ')}\n□는 몇 ${u}인가요?`, answer: String(missing) };
    }
    if (t === 3) { const [e, a] = pick(EVENTS); return { text: `일이 일어날 가능성을 말로 나타내면?\n${e}`, type: 'choice', choices: WORDS, answer: a }; }
    if (t === 4) { const [e, a] = pick(NUMEV); return { text: `일이 일어날 가능성을 수로 나타내면?\n${e}`, type: 'choice', choices: ['0', '1/2', '1'], answer: a }; }
    const n = rnd(4, 6), m = rnd(8, 25); return { text: `${n}명이 읽은 책 수의 평균이 ${m}권입니다.\n${n}명이 읽은 책은 모두 몇 권인가요?`, answer: String(n * m) };
  }
  const t = rnd(1, 4);
  if (t === 1) {
    const T = rnd(70, 90), n1 = rnd(2, 4), n2 = rnd(2, 4), k = rnd(1, 3);
    const a = T + k * n2, b = T - k * n1;
    return { text: `가 모둠 ${n1}명의 점수 평균은 ${a}점,\n나 모둠 ${n2}명의 점수 평균은 ${b}점입니다.\n두 모둠 전체의 점수 평균은 몇 점인가요?`, answer: String(T) };
  }
  if (t === 2) {
    const n = rnd(3, 5), m = rnd(78, 88), goal = m + rnd(1, 3);
    return { text: `수학 시험 ${n}번의 평균이 ${m}점입니다.\n한 번 더 시험을 보아 ${n + 1}번의 평균을 ${goal}점으로 만들려면\n다음 시험에서 몇 점을 받아야 하나요?`, answer: String(goal * (n + 1) - m * n) };
  }
  if (t === 3) {
    const n = rnd(4, 6), m = rnd(20, 40), d = rnd(1, 4); const x = m + d * (n + 1);
    return { text: `${n}명의 줄넘기 기록 평균이 ${m}회입니다.\n기록이 ${x}회인 친구가 한 명 더 들어오면\n평균은 몇 회가 되나요?`, answer: String(m + d) };
  }
  const n = rnd(4, 5), m = rnd(10, 20), arr = listWithMean(n, m, 4), k = rnd(1, 3);
  return { text: `${arr.join(', ')}\n위 ${n}개 수의 평균을 ${k}만큼 더 크게 만들려면\n${n}개 수의 합을 얼마나 더 늘려야 하나요?`, answer: String(n * k) };
}

export function makeQuestion(unit, round, bonus) {
  const u = +unit || 4;
  const q = u === 5 ? unit5(round, bonus) : u === 6 ? unit6(round, bonus) : unit4(round, bonus);
  if (!q.type) q.type = 'num';
  return q;
}

export function checkAnswer(q, input) {
  if (q.type === 'choice') return input === q.answer;
  const s = String(input).trim().replace(/,/g, '').replace(/\s/g, '');
  if (s === '' || isNaN(Number(s))) return false;
  return Math.abs(Number(s) - Number(q.answer)) < 1e-9;
}
