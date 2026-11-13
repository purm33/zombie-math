import { initDB, db, MODE } from './db.js';
import { GROUP_COUNT, PER_ROUND, BONUS_PER_ITEM, MAX_HEARTS } from './config.js';
import { UNITS, PHASE_LABEL, ITEMS, membersOf, advanceGroup, rankingOf, fmtTime } from './game.js';

const $ = (id) => document.getElementById(id);
await initDB();
$('modeTag').textContent = MODE === 'local' ? '체험 모드: 같은 컴퓨터의 다른 탭에서 학생 화면(index.html)을 열어 시험해 보세요' : '';
$('urlHint').textContent = '학생 주소: ' + new URL('./', location.href).href + '  (이 교사 화면 주소는 학생에게 알려 주지 마세요)';

let G = {};
db.watch('', (v) => { G = v || {}; render(); });

// 단원 버튼
Object.entries(UNITS).forEach(([k, u]) => {
  const b = document.createElement('button'); b.textContent = u.name; b.dataset.u = k;
  b.onclick = () => db.put('unit', +k);
  $('unitPick').appendChild(b);
});

$('startBtn').onclick = async () => {
  const up = { phase: 'playing', unit: G.unit || 4, startedAt: db.TS, finishCount: 0 };
  for (let g = 1; g <= GROUP_COUNT; g++) if (membersOf(G, g).length) up[`groups/${g}`] = { phase: 'r1', since: Date.now() };
  if (!Object.keys(up).some((k) => k.startsWith('groups/')) && !confirm('아직 입장한 학생이 없어요. 그래도 시작할까요?')) return;
  await db.patch('', up);
};
$('againBtn').onclick = async () => {
  if (!confirm('입장한 학생은 그대로 두고, 진행 상황을 지우고 대기실로 돌아갈까요?')) return;
  const up = { phase: 'lobby', groups: null, finishCount: 0, startedAt: null };
  Object.keys(G.players || {}).forEach((n) => {
    Object.assign(up, { [`players/${n}/r1`]: 0, [`players/${n}/r2`]: 0, [`players/${n}/b1`]: 0, [`players/${n}/b2`]: 0, [`players/${n}/wrong`]: 0, [`players/${n}/hearts`]: MAX_HEARTS, [`players/${n}/items`]: null });
  });
  await db.patch('', up);
};
$('resetBtn').onclick = async () => {
  if (!confirm('학생 입장 기록까지 모두 지울까요? 학생들은 다시 입장해야 해요.')) return;
  const unit = G.unit || 4;
  await db.put('', { phase: 'lobby', unit });
};

function render() {
  const playing = G.phase === 'playing';
  const ps = Object.values(G.players || {}).filter((p) => p && p.group);
  $('status').textContent = (playing ? '🎮 게임 중' : '⏳ 대기실') + ` · 입장 ${ps.length}명 · ${UNITS[G.unit || 4].name}`;
  [...$('unitPick').children].forEach((b) => { b.classList.toggle('on', +b.dataset.u === (G.unit || 4)); b.disabled = playing; });
  $('startBtn').disabled = playing;

  const box = $('groups'); box.innerHTML = '';
  for (let g = 1; g <= GROUP_COUNT; g++) {
    const ms = membersOf(G, g); const gs = (G.groups || {})[g];
    const ph = playing ? (gs ? gs.phase : '-') : 'wait';
    const card = document.createElement('div'); card.className = 'card gcard';
    let html = `<div class="ghead"><h2 class="jua">${g}모둠 <span class="hint">${ms.length}명</span></h2><span class="badge ${ph}">${PHASE_LABEL[ph] || (playing ? '학생 없음' : '대기 중')}${gs && gs.rank ? ` · ${gs.rank}등` : ''}</span></div>`;
    if (gs && (ph === 'ravager' || ph === 'dragon')) {
      const left = Math.max(0, (gs.hp || 0) - (gs.dmg || 0));
      html += `<div class="hint">보스 체력 ${left} / ${gs.hp}</div><div class="hpbar"><i style="width:${gs.hp ? (left / gs.hp) * 100 : 0}%;background:${ph === 'dragon' ? '#3fbf6f' : '#e8443c'}"></i></div>`;
    }
    html += `<table class="ps"><tr><th>번호</th><th>접속</th><th>❤</th><th>1R</th><th>2R</th><th>보너스</th><th>아이템</th><th>틀림</th><th></th></tr>`;
    html += ms.map((p) => {
      const its = Object.entries(p.items || {}).filter(([, n]) => n > 0).map(([k, n]) => ITEMS[k].icon + (n > 1 ? n : '')).join('') || '-';
      const r1 = p.r1 || 0, r2 = p.r2 || 0;
      return `<tr class="${p.online === false ? 'off' : ''}"><td><b>${p.num}</b></td><td>${p.online === false ? '⚪' : '🟢'}</td><td>${p.hearts ?? MAX_HEARTS}</td>
        <td>${r1 >= PER_ROUND ? '✅' : r1 + '/' + PER_ROUND}</td><td>${r2 >= PER_ROUND ? '✅' : r2 + '/' + PER_ROUND}</td>
        <td>${p.b1 || 0}·${p.b2 || 0}</td><td>${its}</td><td>${p.wrong || 0}</td>
        <td><button class="x" data-kick="${p.num}" title="이 학생 내보내기">✕</button></td></tr>`;
    }).join('');
    if (!ms.length) html += `<tr><td colspan="9" class="hint">아직 아무도 없어요</td></tr>`;
    html += `</table>`;
    const canSkip = playing && gs && ['r1', 'ravager', 'r2', 'dragon'].includes(ph);
    html += `<div class="gfoot"><span>보너스: 1R·2R 맞힌 수 (${BONUS_PER_ITEM}개마다 아이템)</span>${canSkip ? `<button class="btn small blue" data-skip="${g}">다음 단계로 ▶</button>` : ''}</div>`;
    card.innerHTML = html; box.appendChild(card);
  }
  box.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = () => { const n = b.dataset.kick; if (confirm(`${n}번 학생을 내보낼까요? (결석·다른 모둠 등)`)) db.del(`players/${n}`); }));
  box.querySelectorAll('[data-skip]').forEach((b) => (b.onclick = () => {
    const g = +b.dataset.skip; const gs = G.groups[g];
    if (confirm(`${g}모둠을 '${PHASE_LABEL[gs.phase]}'에서 다음 단계로 넘길까요?`)) advanceGroup(g, gs.phase, membersOf(G, g).length);
  }));

  const rk = rankingOf(G);
  $('rank').innerHTML = rk.length ? `<table class="rank-table"><tr><th>순위</th><th>모둠</th><th>걸린 시간</th></tr>${rk.map((r) => `<tr><td>${r.rank}등</td><td>${r.g}모둠</td><td>${fmtTime(r.time)}</td></tr>`).join('')}</table>` : '아직 드래곤을 물리친 모둠이 없어요.';
}
