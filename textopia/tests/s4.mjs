import { call, newClass, seed, student } from './lib.mjs';
import { stageOf } from '../src/engine/core.js';
import { addDays } from '../src/util.js';

export const num = 4;
export const title = '집 단계 · 서재 도감';
export const method = '경계값(49/50/149/150/299/300) 단위 검사 + 시험용 날짜로 20일 활동해 EXP 50·150·300 순간의 단계 변화 + 도감·전시 칸·pick API';

export async function run(t) {
  // ── 경계값 ──
  const names = (exp) => stageOf(exp).name;
  t.eq('EXP 0·49 는 부지', [names(0), names(49)], ['부지', '부지']);
  t.eq('EXP 50·149 는 움집', [names(50), names(149)], ['움집', '움집']);
  t.eq('EXP 150·299 는 초가집', [names(150), names(299)], ['초가집', '초가집']);
  t.eq('EXP 300 이상은 기와집', [names(300), names(1000)], ['기와집', '기와집']);

  // ── 실제 활동으로 올리기: 하루에 문장(10)+읽기(5) = 15 EXP, 20일이면 정확히 300 ──
  const A = await newClass(); // 예시 데이터 없이 빈 반 (마을 EXP 0 에서 시작)
  const s = await student(A.code, '집짓기', '1111');
  const base = '2027-03-01';
  const ups = [];
  let villageUnlock = null;
  let stageEveryDay = [];
  for (let i = 0; i < 20; i++) {
    const date = addDays(base, i);
    await call('teacher/clock', { date }, A.teacher);
    const cur = (await call('me', {}, s.token)).me;
    const a = await call('sentence/submit', { text: cur.sentence.text }, s.token);
    const b = await call('read/check', { bookId: 'b01', pages: 5 }, s.token);
    for (const r of [a, b]) {
      if (r.reward?.stageUp) ups.push({ day: i + 1, exp: r.me.exp, ...r.reward.stageUp });
      if (r.reward?.unlocked?.length) villageUnlock = { day: i + 1, exp: r.me.village.exp, names: r.reward.unlocked };
    }
    stageEveryDay.push([i + 1, b.me.exp, b.me.stage.name]);
  }
  await call('teacher/clock', { date: null }, A.teacher);
  // 승급은 50 을 넘는 바로 그 요청에서 알려진다: 4일차 문장 필사로 45→55(움집), 10일차 읽기 체크로 145→150(초가집), 20일차 읽기 체크로 295→300(기와집)
  t.eq('3번 승급: 4일차(EXP 55)에 움집, 10일차(EXP 150)에 초가집, 20일차(EXP 300)에 기와집',
    ups.map((u) => [u.day, u.exp, u.to]), [[4, 55, '움집'], [10, 150, '초가집'], [20, 300, '기와집']]);
  t.eq('3일차(EXP 45)는 아직 부지', stageEveryDay[2], [3, 45, '부지']);
  t.eq('9일차(EXP 135)는 아직 움집', stageEveryDay[8], [9, 135, '움집']);
  t.eq('19일차(EXP 285)는 아직 초가집', stageEveryDay[18], [19, 285, '초가집']);
  t.check('마을 EXP 가 300 이 된 20일차에 장터 해금', villageUnlock && villageUnlock.day === 20 && villageUnlock.exp === 300 && villageUnlock.names.includes('장터'), JSON.stringify(villageUnlock));
  const fin = await call('me', {}, s.token);
  t.eq('새로고침 후에도 단계 유지(기와집)', fin.me.stage.name, '기와집');

  // ── 서재 도감 · 전시 칸 · pick ──
  const B = await newClass(); await seed(B);
  const demo = await student(B.code, '시연', '0000');
  const lib = (await call('library/get', {}, demo.token)).library;
  t.eq('도감: 읽은 책은 시연의 1권뿐', lib.books.filter((b) => b.read).map((b) => b.title), ['하늘과 바람과 별과 시']);
  t.check('도감: 아직 읽지 않은 책이 흐린 칸으로 함께 온다(read=false 30권 이상)', lib.books.filter((b) => !b.read).length >= 30, String(lib.books.length));
  t.eq('도감: 모은 문장 2개', lib.sentences.length, 2);
  t.check('도감: 모은 문장에 글·쪽수·고른 이유·책 제목이 있다', lib.sentences.every((x) => x.text && x.page && x.reason && x.bookTitle === '하늘과 바람과 별과 시'), JSON.stringify(lib.sentences[0]));
  t.eq('pick 문장이 걸려 있다', lib.pick?.id, 'demo-s1');
  t.eq('전시 칸은 6개, 첫 칸에 문장 카드', [lib.slots.length, lib.slots[0]?.id], [6, 'demo-s1']);

  const put = await call('slot/set', { index: 2, kind: 'sentence', id: 'demo-s2' }, demo.token);
  t.eq('3번째 칸에 문장 걸기', put.library.slots[2]?.id, 'demo-s2');
  const moved = await call('slot/set', { index: 3, kind: 'sentence', id: 'demo-s2' }, demo.token);
  t.eq('같은 문장을 다른 칸에 걸면 옮겨진다(한 칸에만)', [moved.library.slots[2], moved.library.slots[3]?.id], [null, 'demo-s2']);
  const cleared = await call('slot/set', { index: 3, id: null }, demo.token);
  t.eq('칸 비우기', cleared.library.slots[3], null);
  t.eq('칸 번호 6 은 400', (await call('slot/set', { index: 6, kind: 'sentence', id: 'demo-s2' }, demo.token)).status, 400);
  t.eq('칸 번호 -1 은 400', (await call('slot/set', { index: -1, kind: 'sentence', id: 'demo-s2' }, demo.token)).status, 400);
  t.eq('없는 문장은 404', (await call('slot/set', { index: 1, kind: 'sentence', id: 'nope' }, demo.token)).status, 404);
  t.eq('친구(소나기)의 문장은 걸 수 없다(404)', (await call('slot/set', { index: 1, kind: 'sentence', id: 'v11-s1' }, demo.token)).status, 404);

  const other = await student(B.code, '구경꾼', '9999');
  t.eq('다른 학생이 내 문장 id 로 걸려 해도 404', (await call('slot/set', { index: 0, kind: 'sentence', id: 'demo-s1' }, other.token)).status, 404);
  t.eq('다른 학생이 내 문장을 pick 으로 걸려 해도 404', (await call('pick/set', { id: 'demo-s1' }, other.token)).status, 404);

  const pick = await call('pick/set', { id: 'demo-s2' }, demo.token);
  t.eq('pick 문장 바꾸기', pick.library.pick?.id, 'demo-s2');
  t.eq('친구의 문장을 pick 으로 걸 수 없다(404)', (await call('pick/set', { id: 'v11-s1' }, demo.token)).status, 404);
  const pickOff = await call('pick/set', { id: null }, demo.token);
  t.eq('pick 내리기', pickOff.library.pick, null);
  const again = (await call('library/get', {}, demo.token)).library;
  t.eq('새로고침 후에도 전시 칸 유지(첫 칸 문장)', again.slots[0]?.id, 'demo-s1');
}
