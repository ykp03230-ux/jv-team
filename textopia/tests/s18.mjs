import { call, newClass, seed, student } from './lib.mjs';
import { addDays } from '../src/util.js';

export const num = 18;
export const title = '(추가) 일자별 퀘스트·출석 현황';
export const method = '입장·필사·읽기·친구 방문·보너스가 날짜별로 기록되는지, 학생은 자기 것만/교사는 전체(학생 토큰 403), 시험용 날짜 이동, 예시 데이터의 최근 7일 기록';

export async function run(t) {
  const A = await newClass();
  const a = await student(A.code, '출석가', '1111');
  const b = await student(A.code, '필사만', '2222');
  const c = await student(A.code, '입장만', '3333');
  const today = (await call('teacher/overview', {}, A.teacher)).class.today;

  // ── 입장만 해도 출석 ──
  const first = await call('daily/me', {}, c.token);
  t.check('입장만 한 학생: 오늘 출석, 퀘스트는 0개', first.ok && first.days[0].date === today && first.days[0].seen === true && first.days[0].quests === 0 && !first.days[0].sentence, JSON.stringify(first.days[0]));
  t.eq('기본 14일, 오늘부터 거꾸로', [first.days.length, first.days[1].date], [14, addDays(today, -1)]);
  t.check('어제는 기록이 없다', first.days[1].seen === false && first.days[1].quests === 0, JSON.stringify(first.days[1]));

  // ── 퀘스트를 하면 기록된다 ──
  await call('sentence/submit', { text: a.me.sentence.text }, a.token);
  await call('read/check', { bookId: 'b01', pages: 3 }, a.token);
  const friends = await call('friends/list', {}, a.token);
  await call('friends/visit', { friendId: friends.friends[0].id }, a.token);
  await call('sentence/submit', { text: b.me.sentence.text }, b.token);
  const am = (await call('daily/me', {}, a.token)).days[0];
  t.check('세 퀘스트를 모두 한 학생: 필사·읽기·방문·보너스 모두 표시, 3개', am.sentence && am.read && am.visit && am.bonus && am.quests === 3 && am.seen, JSON.stringify(am));
  const bm = (await call('daily/me', {}, b.token)).days[0];
  t.check('필사만 한 학생: 필사만 표시(자기 기록만 보인다)', bm.sentence && !bm.read && !bm.visit && !bm.bonus && bm.quests === 1, JSON.stringify(bm));
  const wrong = await call('sentence/submit', { text: '틀린 문장' }, c.token);
  const cm = (await call('daily/me', {}, c.token)).days[0];
  t.check('틀리게 쓰기만 한 학생은 필사 표시가 없다(보상도 없음)', wrong.ok && wrong.match === false && !cm.sentence && cm.seen, JSON.stringify(cm));

  // ── 입력 검사·권한 ──
  t.eq('일수 7 이면 7일치', (await call('daily/me', { days: 7 }, a.token)).days.length, 7);
  t.eq('일수 0 은 400', (await call('daily/me', { days: 0 }, a.token)).status, 400);
  t.eq('일수 61 은 400', (await call('daily/me', { days: 61 }, a.token)).status, 400);
  t.eq('로그인 없이는 401', (await call('daily/me', {}, null)).status, 401);
  t.eq('교사 토큰으로 학생용 기록은 403', (await call('daily/me', {}, A.teacher)).status, 403);
  t.check('학생 응답에 다른 학생의 이름·기록이 없다', !/출석가|필사만|입장만/.test(JSON.stringify(await call('daily/me', {}, b.token))), '');

  // ── 교사: 학생 전체 ──
  t.eq('학생은 교사용 현황을 못 본다(403)', (await call('teacher/daily', {}, a.token)).status, 403);
  t.eq('로그인 없이는 401', (await call('teacher/daily', {}, null)).status, 401);
  const td = await call('teacher/daily', { days: 7 }, A.teacher);
  t.check('날짜는 오래된 날부터 오늘까지 7개', td.ok && td.dates.length === 7 && td.dates[6] === today && td.dates[0] === addDays(today, -6), JSON.stringify(td.dates));
  t.eq('학생 3명 전체가 보인다', td.rows.map((r) => r.nick).sort(), ['입장만', '출석가', '필사만']);
  const rowOf = (n) => td.rows.find((r) => r.nick === n).days[today];
  t.check('교사 화면: 출석가 3개·보너스, 필사만 1개, 입장만 0개(출석)', rowOf('출석가').quests === 3 && rowOf('출석가').bonus && rowOf('필사만').quests === 1 && rowOf('입장만').quests === 0 && rowOf('입장만').seen, JSON.stringify([rowOf('출석가'), rowOf('필사만'), rowOf('입장만')]));
  const tot = td.totals.find((x) => x.date === today);
  t.eq('오늘 합계: 출석 3 / 필사 2 / 읽기 1 / 방문 1 / 보너스 1 (학생 3명)', [tot.seen, tot.sentence, tot.read, tot.visit, tot.bonus, tot.students], [3, 2, 1, 1, 1, 3]);
  t.eq('교사도 일수 61 은 400', (await call('teacher/daily', { days: 61 }, A.teacher)).status, 400);

  // ── 날짜가 바뀌면 새 칸에 기록, 지난 기록은 그대로 ──
  const tomorrow = addDays(today, 1);
  await call('teacher/clock', { date: tomorrow }, A.teacher);
  await call('me', {}, a.token); // 다음 날 화면을 열면 그날 출석
  await call('me', {}, a.token); // 여러 번 열어도 한 번
  const td2 = await call('teacher/daily', { days: 3 }, A.teacher);
  t.eq('시험용 날짜: 마지막 날짜가 바뀐 오늘', td2.dates, [addDays(today, -1), today, tomorrow]);
  const t2 = Object.fromEntries(td2.totals.map((x) => [x.date, x]));
  t.eq('다음 날: 화면을 연 1명만 출석, 퀘스트 0', [t2[tomorrow].seen, t2[tomorrow].sentence, t2[tomorrow].bonus], [1, 0, 0]);
  t.eq('지난 날(원래 오늘)의 기록은 그대로: 출석 3, 필사 2, 보너스 1', [t2[today].seen, t2[today].sentence, t2[today].bonus], [3, 2, 1]);
  await call('teacher/clock', { date: null }, A.teacher);

  // ── 예시 데이터: 최근 7일 기록이 채워진다 ──
  const B = await newClass(); await seed(B);
  const demo = await student(B.code, '시연', '0000');
  const dm = (await call('daily/me', { days: 5 }, demo.token)).days;
  t.check('시연: 오늘은 입장(출석)만, 어제는 필사+읽기, 그제는 필사, 3일 전은 입장만',
    dm[0].seen && dm[0].quests === 0 && dm[1].sentence && dm[1].read && !dm[1].visit && dm[1].quests === 2 && dm[2].sentence && !dm[2].read && dm[3].seen && dm[3].quests === 0 && !dm[4].seen, JSON.stringify(dm));
  const sd = await call('teacher/daily', { days: 8 }, B.teacher);
  t.eq('교사 현황: 학생 20명', sd.rows.length, 20);
  const past = sd.totals.filter((x) => x.date !== sd.today);
  t.check('예시 데이터의 지난 7일은 날마다 출석·필사·읽기가 섞여 있다', past.slice(-7).every((x) => x.seen >= 12 && x.sentence > 0 && x.read > 0), JSON.stringify(past.slice(-7)));
  t.check('친구 방문·보너스 기록도 일부 들어 있다', past.reduce((n, x) => n + x.visit, 0) > 0 && past.reduce((n, x) => n + x.bonus, 0) > 0, '');
  t.check('날마다 숫자가 똑같지 않다(모두 같은 값이 아님)', new Set(past.slice(-7).map((x) => x.sentence)).size > 1 || new Set(past.slice(-7).map((x) => x.read)).size > 1, '');
  const again = await seed(B);
  const sd2 = await call('teacher/daily', { days: 8 }, B.teacher);
  // 오늘 칸은 빼고 비교한다: 첫 채우기 뒤에 시연이 입장해 오늘 출석 1이 생겼다가, 다시 채우면 학생이 새로 만들어져 0 이 된다
  const pastRows = (d) => d.totals.filter((x) => x.date !== d.today).map((x) => [x.date, x.seen, x.sentence, x.read, x.visit, x.bonus]);
  t.eq('예시 데이터를 다시 채워도 지난 7일 기록은 같다(중복 없음)', pastRows(sd2), pastRows(sd));
  t.eq('다시 채운 뒤 학생은 여전히 20명', sd2.rows.length, 20);
  void again;
}
