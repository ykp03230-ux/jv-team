import { call, newClass, seed, student } from './lib.mjs';
import { blankStudent, grant } from '../src/engine/core.js';
import { REWARDS } from '../src/data/rules.js';

export const num = 7;
export const title = '박물관 · 전시 on/off · 투표 · 정산';
export const method = '전시 off 차단, 투표 전/중/후 규칙(1인 3표·내 작품 불가), 6명이 정해진 표를 던져 상위 3개 확인, 보너스 50(상한 제외), 미제출 목록, 숨기기, 달이 바뀐 뒤 목록';

export async function run(t) {
  // ── 보너스는 하루 코인 상한과 별개 (엔진 직접 확인) ──
  {
    const state = { village: { exp: 0 } };
    const st = blankStudent({ id: 'x', nick: 'x', pin: {}, createdAt: 0 });
    st.dayCoins['2027-01-01'] = 100;
    const ctx = { today: '2027-01-01', nowMs: 0 };
    const best = grant(state, st, ctx, { key: 'best:2027-01', rule: REWARDS.monthlyBest, capExempt: true });
    const normal = grant(state, st, ctx, { key: 'sentence:2027-01-01', rule: REWARDS.sentence });
    t.check('하루 코인이 100 이어도 이달의 작품 50 은 지급, 일반 보상은 0코인', best.coins === 50 && normal.coins === 0 && normal.exp === 10 && st.coins === 50, JSON.stringify({ best: best.coins, normal: normal.coins, coins: st.coins }));
    const again = grant(state, st, ctx, { key: 'best:2027-01', rule: REWARDS.monthlyBest, capExempt: true });
    t.check('같은 달에는 이달의 작품 보너스를 또 받을 수 없다', again.granted === false && st.coins === 50, '');
  }

  const A = await newClass(); await seed(A);
  const demo = await student(A.code, '시연', '0000');

  // ── 입구: 전시 off 면 들어갈 수 없다 ──
  t.eq('처음에는 전시가 켜져 있다', (await call('museum/status', {}, demo.token)).status.on, true);
  const listOn = await call('museum/list', {}, demo.token);
  t.check('켜져 있으면 작품 10개가 보인다', listOn.ok && listOn.subs.length === 10, String(listOn.subs?.length));
  t.eq('학생은 전시를 끌 수 없다(403)', (await call('teacher/museum/toggle', { on: false }, demo.token)).status, 403);
  await call('teacher/museum/toggle', { on: false }, A.teacher);
  const off = await call('museum/status', {}, demo.token);
  t.check('off: 입구 상태가 on=false (준비 중)', off.ok && off.status.on === false, JSON.stringify(off));
  t.eq('off: 작품 목록 요청은 403', (await call('museum/list', {}, demo.token)).status, 403);
  t.eq('off: 작품 내기도 403', (await call('museum/submit', { kind: 'sentence', refId: 'demo-s1' }, demo.token)).status, 403);
  t.eq('off: 투표도 403', (await call('museum/vote', { subId: 'sub-v11' }, demo.token)).status, 403);
  await call('teacher/museum/toggle', { on: true }, A.teacher);
  t.eq('다시 on 이면 들어갈 수 있다', (await call('museum/list', {}, demo.token)).ok, true);

  // ── 미제출 목록 ──
  const m0 = await call('teacher/museum', {}, A.teacher);
  t.eq('이달 미제출 학생은 10명(작품을 낸 10명 제외)', m0.missing.length, 10);
  t.check('미제출 목록에 시연이 있다', m0.missing.some((m) => m.nick === '시연'), '');
  t.check('작품을 낸 학생(소나기)은 목록에 없다', !m0.missing.some((m) => m.nick === '소나기'), '');

  // ── 작품 내기 ──
  t.eq('낼 수 없는 종류는 400', (await call('museum/submit', { kind: 'photo', refId: 'x' }, demo.token)).status, 400);
  t.eq('내 것이 아닌 문장은 404', (await call('museum/submit', { kind: 'sentence', refId: 'v11-s1' }, demo.token)).status, 404);
  const sub1 = await call('museum/submit', { kind: 'sentence', refId: 'demo-s1' }, demo.token);
  t.check('문장 카드를 박물관에 낸다', sub1.ok && sub1.sub.mine === true && sub1.sub.snap.text && sub1.sub.snap.bookTitle === '하늘과 바람과 별과 시' && sub1.status.submittedThisMonth, JSON.stringify(sub1).slice(0, 200));
  t.eq('같은 작품을 또 내면 409', (await call('museum/submit', { kind: 'sentence', refId: 'demo-s1' }, demo.token)).status, 409);
  const burst = await Promise.all(Array.from({ length: 5 }, () => call('museum/submit', { kind: 'sentence', refId: 'demo-s2' }, demo.token)));
  t.eq('동시에 5번 눌러도 한 번만 들어간다', burst.filter((r) => r.ok).length, 1);
  const m1 = await call('teacher/museum', {}, A.teacher);
  t.check('낸 뒤 시연은 미제출 목록에서 빠진다(9명)', m1.missing.length === 9 && !m1.missing.some((m) => m.nick === '시연'), String(m1.missing.length));

  // ── 투표 전 ──
  const pre = await call('museum/vote', { subId: 'sub-v11' }, demo.token);
  t.check('투표가 열리기 전에는 투표할 수 없다(409)', pre.status === 409 && pre.error === 'vote_closed', JSON.stringify(pre));
  t.eq('학생은 투표를 열 수 없다(403)', (await call('teacher/vote/open', {}, demo.token)).status, 403);
  t.eq('투표가 열려 있지 않을 때 마감하면 409', (await call('teacher/vote/close', {}, A.teacher)).status, 409);

  const open = await call('teacher/vote/open', {}, A.teacher);
  t.check('교사가 투표를 연다', open.ok && open.vote === 'open', JSON.stringify(open));
  t.eq('이미 열린 투표를 또 열면 409', (await call('teacher/vote/open', {}, A.teacher)).status, 409);
  const stOpen = (await call('museum/status', {}, demo.token)).status;
  t.check('학생 화면: 투표 중, 남은 표 3', stOpen.vote === 'open' && stOpen.votesLeft === 3, JSON.stringify(stOpen));

  // ── 1인 3표, 내 작품 불가 ──
  const own = await call('museum/vote', { subId: sub1.sub.id }, demo.token);
  t.check('내 작품에는 투표할 수 없다(403)', own.status === 403 && own.error === 'own', JSON.stringify(own));
  t.eq('없는 작품은 404', (await call('museum/vote', { subId: 'nope' }, demo.token)).status, 404);
  t.eq('교사 토큰으로는 투표할 수 없다(403)', (await call('museum/vote', { subId: 'sub-v11' }, A.teacher)).status, 403);
  const v1 = await call('museum/vote', { subId: 'sub-v11' }, demo.token);
  t.check('투표 1: 남은 표 2', v1.ok && v1.status.votesLeft === 2, JSON.stringify(v1));
  t.eq('같은 작품에 또 투표하면 409', (await call('museum/vote', { subId: 'sub-v11' }, demo.token)).status, 409);
  await call('museum/vote', { subId: 'sub-v14' }, demo.token);
  const v3 = await call('museum/vote', { subId: 'sub-v16' }, demo.token);
  t.check('투표 3: 남은 표 0', v3.ok && v3.status.votesLeft === 0, JSON.stringify(v3));
  const v4 = await call('museum/vote', { subId: 'sub-v17' }, demo.token);
  t.check('4번째 투표는 막힌다(409)', v4.status === 409 && v4.error === 'no_votes_left', JSON.stringify(v4));
  const un = await call('museum/unvote', { subId: 'sub-v16' }, demo.token);
  t.check('투표를 취소하면 표가 돌아온다', un.ok && un.status.votesLeft === 1, JSON.stringify(un));
  await call('museum/vote', { subId: 'sub-v17' }, demo.token); // 시연: v11, v14, v17

  // ── 나머지 5명이 정해진 표를 던진다. 시연은 A(소나기) B(몽실이) D(포도알)에 던졌다 ──
  const A_ = 'sub-v11', B_ = 'sub-v14', C_ = 'sub-v16', D_ = 'sub-v17', E_ = 'sub-v18', F_ = 'sub-v06';
  const ballots = [[A_, B_, C_], [A_, B_, C_], [A_, C_, E_], [A_, B_, D_], [A_, E_, F_]];
  for (let i = 0; i < ballots.length; i++) {
    const v = await student(A.code, `투표${i + 1}`, '1111');
    for (const id of ballots[i]) {
      const r = await call('museum/vote', { subId: id }, v.token);
      if (!r.ok) t.check(`투표${i + 1}이 ${id}에 투표`, false, JSON.stringify(r));
    }
  }
  // 합계: A 6(시연+5), B 4(시연,투표1,투표2,투표4), C 3(투표1,2,3), D 2(시연,투표4), E 2(투표3,5), F 1

  // 마감 전에는 득표수와 이달의 작품 표시가 보이지 않는다
  const before = (await call('museum/list', {}, demo.token)).subs;
  t.check('마감 전에는 득표수·이달의 작품 표시가 없다', before.every((s) => s.votes === null && s.best === false), JSON.stringify(before.find((s) => s.votes !== null || s.best)));
  const tm = await call('teacher/museum', {}, A.teacher);
  t.eq('교사 화면: 투표한 학생 수 6명', tm.vote.voters, 6);

  const coinsOf = async () => Object.fromEntries((await call('teacher/overview', {}, A.teacher)).students.map((s) => [s.nick, s.coins]));
  const c0 = await coinsOf();
  t.eq('학생은 마감할 수 없다(403)', (await call('teacher/vote/close', {}, demo.token)).status, 403);
  const closed = await call('teacher/vote/close', {}, A.teacher);
  t.eq('마감: 상위 3개는 소나기(6) · 몽실이(4) · 감자(3)', closed.result.map((r) => [r.nick, r.votes]), [['소나기', 6], ['몽실이', 4], ['감자', 3]]);
  const c1 = await coinsOf();
  t.eq('이달의 작품 작가 3명은 보너스 코인 +50', [c1['소나기'] - c0['소나기'], c1['몽실이'] - c0['몽실이'], c1['감자'] - c0['감자']], [50, 50, 50]);
  t.eq('3등 밖(포도알·꼬마별·새벽)은 코인 그대로', [c1['포도알'] - c0['포도알'], c1['꼬마별'] - c0['꼬마별'], c1['새벽'] - c0['새벽']], [0, 0, 0]);
  t.eq('이미 마감한 투표를 또 마감하면 409', (await call('teacher/vote/close', {}, A.teacher)).status, 409);
  t.eq('마감한 달에 투표를 다시 열 수 없다(409)', (await call('teacher/vote/open', {}, A.teacher)).status, 409);
  const c2 = await coinsOf();
  t.eq('두 번 마감해도 보너스는 그대로(중복 지급 없음)', c2['소나기'], c1['소나기']);

  const after = (await call('museum/list', {}, demo.token)).subs;
  const bests = after.filter((s) => s.best).map((s) => [s.nick, s.votes]);
  t.eq('마감 후: 이달의 작품 표시 3개와 득표수가 공개된다', bests.sort(), [['감자', 3], ['몽실이', 4], ['소나기', 6]]);
  t.check('3등 밖 작품의 득표수는 공개하지 않는다', after.filter((s) => !s.best).every((s) => s.votes === null), '');
  const late = await call('museum/vote', { subId: 'sub-v18' }, (await student(A.code, '늦은표', '2222')).token);
  t.check('마감 후에는 투표할 수 없다(409)', late.status === 409, JSON.stringify(late));
  const tm2 = await call('teacher/museum', {}, A.teacher);
  t.eq('교사 화면: 결과 3개 + 전체 득표수(소나기 6)', [tm2.vote.status, tm2.vote.result.length, tm2.subs.find((s) => s.nick === '소나기').tally], ['finished', 3, 6]);

  // ── 달이 바뀌면 새 달 기준으로 미제출이 다시 계산된다 ──
  const ov = await call('teacher/overview', {}, A.teacher);
  const [y, m] = ov.class.today.split('-').map(Number);
  const nextMonth1 = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  await call('teacher/clock', { date: nextMonth1 }, A.teacher);
  const mn = await call('teacher/museum', {}, A.teacher);
  t.check('다음 달: 투표 상태 초기화, 미제출은 전체 학생', mn.vote.status === 'none' && mn.missing.length === ov.students.length, `${mn.vote.status} ${mn.missing.length}/${ov.students.length}`);
  t.eq('다음 달에 작품이 없으면 투표를 열 수 없다(409)', (await call('teacher/vote/open', {}, A.teacher)).status, 409);
  await call('teacher/clock', { date: null }, A.teacher);

  // ── 부적절한 작품 숨기기 ──
  const B = await newClass(); await seed(B);
  const s = await student(B.code, '구경', '1111');
  t.eq('학생은 숨길 수 없다(403)', (await call('teacher/sub/hide', { id: 'sub-v11' }, s.token)).status, 403);
  const hid = await call('teacher/sub/hide', { id: 'sub-v11', hidden: true }, B.teacher);
  t.check('교사가 소나기의 작품을 숨긴다', hid.ok && hid.hidden === true, JSON.stringify(hid));
  const lst = (await call('museum/list', {}, s.token)).subs;
  t.check('숨긴 작품은 학생 목록에서 사라진다(9개)', lst.length === 9 && !lst.some((x) => x.id === 'sub-v11'), String(lst.length));
  const mh = await call('teacher/museum', {}, B.teacher);
  t.check('숨긴 작품만 있는 학생은 이달 미제출로 본다', mh.missing.some((x) => x.nick === '소나기') && mh.subs.find((x) => x.id === 'sub-v11').hidden === true, '');
  await call('teacher/vote/open', {}, B.teacher);
  t.eq('숨긴 작품에는 투표할 수 없다(404)', (await call('museum/vote', { subId: 'sub-v11' }, s.token)).status, 404);
  await call('museum/vote', { subId: 'sub-v14' }, s.token);
  const cl = await call('teacher/vote/close', {}, B.teacher);
  t.eq('마감 결과에 숨긴 작품은 들어가지 않는다', cl.result.map((r) => r.nick), ['몽실이']);
  await call('teacher/sub/hide', { id: 'sub-v11', hidden: false }, B.teacher);
}
