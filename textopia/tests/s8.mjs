import { call, newClass, seed, student } from './lib.mjs';
import { kstDate, addDays } from '../src/util.js';

export const num = 8;
export const title = '하루 코인 100 상한 · 한국 시간 자정';
export const method = '한국 시간 자정 경계(14:59:59Z/15:00:00Z) 단위 검사 + 서버 오늘 날짜 비교, 활동으로 코인 100까지 채우고 그날 추가 지급 0(EXP는 계속), 동시 요청, 날짜를 바꾸면 문장·퀘스트·코인 한도가 새로 시작';

const act = (token, bookId, type, extra = {}) => call('activity/submit', { bookId, type, text: `${bookId} 문장 ${type}`, page: 3, reason: '그냥 좋아서', ...extra }, token);

export async function run(t) {
  // ── 한국 시간 자정 ──
  t.eq('UTC 14:59:59.999 (한국 23:59:59)는 아직 같은 날', kstDate(Date.parse('2026-11-07T14:59:59.999Z')), '2026-11-07');
  t.eq('UTC 15:00:00 (한국 00:00:00)에 다음 날로 바뀐다', kstDate(Date.parse('2026-11-07T15:00:00.000Z')), '2026-11-08');
  t.eq('연말 자정도 바뀐다 (12-31 15:00Z → 다음 해 1-1)', kstDate(Date.parse('2026-12-31T15:00:00.000Z')), '2027-01-01');
  t.eq('한국 시간 정오는 같은 날(UTC 03:00)', kstDate(Date.parse('2026-11-07T03:00:00.000Z')), '2026-11-07');

  const A = await newClass(); await seed(A);
  const b1 = kstDate(Date.now());
  const ov = await call('teacher/overview', {}, A.teacher);
  const b2 = kstDate(Date.now());
  t.check('서버의 오늘 날짜가 한국 시간 날짜와 같다', ov.class.today === b1 || ov.class.today === b2, `${ov.class.today} vs ${b1}`);
  const today = ov.class.today;

  // ── 코인 100 상한 ──
  const s = await student(A.code, '상한', '1111');
  const friends = await call('friends/list', {}, s.token);
  await call('sentence/submit', { text: s.me.sentence.text }, s.token);                  // 10
  await call('read/check', { bookId: 'b01', pages: 4 }, s.token);                        // 5  → 15
  const bonus = await call('friends/visit', { friendId: friends.friends[0].id }, s.token); // 보너스 20 → 35
  t.eq('퀘스트 3개 보너스까지 35코인', bonus.me.coins, 35);
  for (const b of ['b01', 'b02', 'b03', 'b04']) await call('books/register', { bookId: b }, s.token);
  await act(s.token, 'b01', 'sentence');   // 50
  await act(s.token, 'b01', 'question');   // 65
  const sentenceB1 = (await call('library/get', {}, s.token)).library.sentences[0];
  await call('activity/submit', { bookId: 'b01', type: 'bookmark', sentenceId: sentenceB1.id, template: 't1' }, s.token); // 80
  await act(s.token, 'b02', 'sentence');   // 95
  const near = (await call('me', {}, s.token)).me;
  t.eq('95코인까지는 그대로 지급된다', [near.coins, near.todayCoins], [95, 95]);
  const edge = await act(s.token, 'b02', 'question'); // 15 를 받아야 하지만 100 까지 5만
  t.check('100을 넘는 지급은 남은 만큼(5코인)만, EXP 15 는 그대로', edge.ok && edge.reward.coins === 5 && edge.reward.exp === 15 && edge.reward.capped === true && edge.me.coins === 100, JSON.stringify(edge.reward));
  const expBefore = edge.me.exp;
  const more = await act(s.token, 'b03', 'sentence');
  t.check('100에 닿은 뒤: 코인 0 (그날은 더 지급되지 않음)', more.ok && more.reward.coins === 0 && more.me.coins === 100 && more.me.todayCoins === 100, JSON.stringify(more.reward));
  t.eq('EXP 는 상한이 없어 계속 오른다(+15)', more.me.exp - expBefore, 15);
  const readAgain = await call('sentence/submit', { text: s.me.sentence.text }, s.token);
  t.check('이미 받은 보상(오늘의 문장)은 다시 받지 못하고 코인도 100 그대로', readAgain.already && readAgain.me.coins === 100, '');

  // 읽음 인증 승인도 그날 상한에 포함된다
  await call('cert/submit', { bookId: 'b01', sentence: '한 줄', page: 3, feeling: '좋았다' }, s.token);
  const ap = await call('teacher/cert/approve', { studentId: s.id, bookId: 'b01' }, A.teacher);
  const afterApprove = (await call('me', {}, s.token)).me;
  t.check('읽음 인증 승인(30)도 100 에 닿은 날에는 코인 0, EXP +30', ap.ok && ap.reward.coins === 0 && ap.reward.exp === 30 && afterApprove.coins === 100, JSON.stringify(ap.reward));

  // ── 동시 요청에서도 100을 넘지 않는다 ──
  const T = await student(A.code, '동시상한', '2222');
  const tf = (await call('friends/list', {}, T.token)).friends;
  await call('sentence/submit', { text: T.me.sentence.text }, T.token);
  await call('read/check', { bookId: 'b01', pages: 4 }, T.token);
  await call('friends/visit', { friendId: tf[0].id }, T.token); // 35
  for (const b of ['b01', 'b02', 'b03', 'b04', 'b05', 'b06', 'b07', 'b08']) await call('books/register', { bookId: b }, T.token);
  await act(T.token, 'b01', 'sentence'); await act(T.token, 'b01', 'question');
  const tl = (await call('library/get', {}, T.token)).library.sentences[0];
  await call('activity/submit', { bookId: 'b01', type: 'bookmark', sentenceId: tl.id, template: 't2' }, T.token); // 80
  const burst = await Promise.all(['b02', 'b03', 'b04', 'b05', 'b06', 'b07', 'b08'].map((b) => act(T.token, b, 'sentence')));
  const fin = (await call('me', {}, T.token)).me;
  t.eq('동시 7개 요청 뒤 코인은 정확히 100', [fin.coins, fin.todayCoins], [100, 100]);
  t.eq('동시 요청의 EXP 는 모두 반영(80 쪽 EXP + 7×15)', fin.exp, 35 - 20 + 45 + 7 * 15);
  t.eq('동시 요청에서 코인을 받은 요청의 합은 20', burst.reduce((n, r) => n + r.reward.coins, 0), 20);

  // ── 자정이 지나면 새 하루 ──
  const day1 = (await call('me', {}, s.token)).me;
  t.check('(자정 전) 오늘의 문장·퀘스트는 완료 상태', day1.sentence.done === true && day1.quests.count === 3 && day1.quests.bonus === true, JSON.stringify(day1.quests));
  const sentenceDay1 = day1.sentence.text;
  const tomorrow = addDays(today, 1);
  await call('teacher/clock', { date: tomorrow }, A.teacher);
  const day2 = (await call('me', {}, s.token)).me;
  t.eq('날짜가 바뀌면 today 가 바뀐다', day2.today, tomorrow);
  t.check('새 하루: 오늘의 문장이 다른 문장으로 바뀌고 미완료', day2.sentence.text !== sentenceDay1 && day2.sentence.done === false, `${day2.sentence.text}`);
  t.check('새 하루: 퀘스트가 모두 초기화(0/3, 보너스 가능)', day2.quests.count === 0 && !day2.quests.sentence && !day2.quests.read && !day2.quests.visit && !day2.quests.bonus, JSON.stringify(day2.quests));
  t.eq('새 하루: 오늘 받은 코인이 0 으로 돌아온다', day2.todayCoins, 0);
  const again2 = await call('sentence/submit', { text: day2.sentence.text }, s.token);
  t.check('새 하루: 오늘의 문장을 쓰면 코인 +10, EXP +10 이 다시 지급', again2.match && !again2.already && again2.reward.coins === 10 && again2.reward.exp === 10 && again2.me.coins === 110, JSON.stringify(again2.reward));
  const rd2 = await call('read/check', { bookId: 'b02', pages: 9 }, s.token);
  t.check('새 하루: 책 읽기 체크도 다시 +5', rd2.ok && !rd2.already && rd2.reward.coins === 5, JSON.stringify(rd2.reward));
  const v2 = await call('friends/visit', { friendId: friends.friends[1].id }, s.token);
  t.check('새 하루: 친구 방문 퀘스트 완료 → 보너스 +20 이 다시', v2.first && v2.bonus && v2.reward.coins === 20, JSON.stringify(v2.reward));
  const newAct = await act(s.token, 'b04', 'sentence');
  t.check('새 하루: 코인 한도가 새로 시작되어 활동 보상 15 를 다시 받는다', newAct.reward.coins === 15 && newAct.me.todayCoins === 50, JSON.stringify(newAct.reward));
  // 이틀 뒤에 다시 돌아와도(날짜를 앞으로) 어제 상태는 새 하루로 보인다
  await call('teacher/clock', { date: addDays(today, 2) }, A.teacher);
  const day3 = (await call('me', {}, s.token)).me;
  t.check('또 하루 뒤에도 초기화된다', day3.quests.count === 0 && day3.todayCoins === 0, JSON.stringify(day3.quests));
  await call('teacher/clock', { date: null }, A.teacher);
  const back = (await call('me', {}, s.token)).me;
  t.eq('시험용 날짜를 해제하면 실제 한국 시간 날짜로 돌아온다', back.today, today);
  t.eq('학생은 시험용 날짜를 바꿀 수 없다(403)', (await call('teacher/clock', { date: '2030-01-01' }, s.token)).status, 403);
  t.eq('날짜 모양이 틀리면 400', (await call('teacher/clock', { date: '2026-13-40' }, A.teacher)).status, 400);
}
