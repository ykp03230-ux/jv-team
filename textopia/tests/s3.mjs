import { call, newClass, seed, join, student } from './lib.mjs';
import { normalize, sameText, diffMarks } from '../src/engine/text.js';

export const num = 3;
export const title = '오늘의 문장 필사 · 보상 · 퀘스트';
export const method = '한 글자 틀리게/맞게 제출, 같은 학생 재제출, 동시 요청 10개, 공백·문장부호 무시, 책 읽기 체크, 퀘스트 보너스';

const breakOne = (s) => {
  const a = [...s];
  const i = a.findIndex((ch) => /[가-힣]/.test(ch));
  a[i] = a[i] === '뷁' ? '쀍' : '뷁';
  return a.join('');
};

export async function run(t) {
  // ── 비교 규칙(단위) ──
  t.eq('연속 공백은 하나, 문장부호는 무시', normalize('님은   갔습니다.  아아, 사랑하는'), '님은 갔습니다 아아 사랑하는');
  t.check('문장부호만 다르면 같은 글', sameText('안녕, 세상!', '안녕 세상'), '');
  t.check('띄어쓰기가 없어지면 다른 글', !sameText('안녕세상', '안녕 세상'), '');
  t.eq('바꿔 쓴 글자는 bad', diffMarks('가나다', '가라다').map((m) => m.s), ['ok', 'bad', 'ok']);
  const missing = diffMarks('가나다', '가다');
  t.check('빠뜨린 글자는 miss(정답 글자를 보여 줌)', missing.some((m) => m.s === 'miss' && m.c === '나'), JSON.stringify(missing));
  t.check('더 쓴 글자는 bad', diffMarks('가다', '가나다').some((m) => m.s === 'bad' && m.c === '나'), '');

  const A = await newClass(); await seed(A);
  const demo = await student(A.code, '시연', '0000');
  const sentence = demo.me.sentence.text;
  t.check('오늘의 문장이 내려온다', sentence && demo.me.sentence.done === false, JSON.stringify(demo.me.sentence));

  // ── 한 글자 틀리게 → 틀린 글자 표시, 보상 없음 ──
  const wrong = await call('sentence/submit', { text: breakOne(sentence) }, demo.token);
  t.check('한 글자 틀리면 match=false', wrong.ok && wrong.match === false, JSON.stringify(wrong));
  t.check('틀린 글자가 bad 로 표시된다', wrong.marks.some((m) => m.s === 'bad' && m.c === '뷁'), JSON.stringify(wrong.marks));
  t.check('틀렸을 때 보상 없음(코인 40, EXP 295 그대로)', wrong.me.coins === 40 && wrong.me.exp === 295 && wrong.reward === null, `${wrong.me.coins}/${wrong.me.exp}`);
  const empty = await call('sentence/submit', { text: '   ' }, demo.token);
  t.eq('빈 글은 400', empty.status, 400);

  // ── 맞게 → 코인 +10, EXP +10 ──
  const right = await call('sentence/submit', { text: sentence }, demo.token);
  t.check('맞게 쓰면 match=true', right.ok && right.match === true && right.already === false, JSON.stringify(right));
  t.check('코인 +10, EXP +10 (40→50, 295→305)', right.me.coins === 50 && right.me.exp === 305 && right.reward.coins === 10 && right.reward.exp === 10, `${right.me.coins}/${right.me.exp}`);
  t.check('퀘스트 ① 완료 표시', right.me.quests.sentence === true && right.me.sentence.done === true, JSON.stringify(right.me.quests));
  t.check('305 EXP 가 되어 초가집 → 기와집, 마을 EXP 300 으로 장터 해금 알림', right.reward.stageUp?.to === '기와집' && right.reward.unlocked.includes('장터'), JSON.stringify(right.reward));

  // ── 다시 내기 / 연속 두 번 ──
  const again = await call('sentence/submit', { text: sentence }, demo.token);
  t.check('다시 내면 추가 지급 없음(already)', again.ok && again.already === true && again.me.coins === 50 && again.me.exp === 305, JSON.stringify(again.me));
  const refreshed = await call('me', {}, demo.token);
  t.check('새로고침 후에도 코인 50 · EXP 305', refreshed.me.coins === 50 && refreshed.me.exp === 305, '');

  // ── 동시 요청 10개 ──
  const p = await student(A.code, '동시1', '1111');
  const text = p.me.sentence.text;
  const burst = await Promise.all(Array.from({ length: 10 }, () => call('sentence/submit', { text }, p.token)));
  const paid = burst.filter((r) => r.ok && r.match && !r.already).length;
  const after = await call('me', {}, p.token);
  t.eq('동시 10개 중 지급은 1번뿐', paid, 1);
  t.check('동시 요청 뒤 코인 10 · EXP 10', after.me.coins === 10 && after.me.exp === 10, `${after.me.coins}/${after.me.exp}`);

  // ── 공백·문장부호 다르게 써도 같은 글 ──
  const q = await student(A.code, '느슨', '2222');
  const loose = q.me.sentence.text.replace(/[.,!?'"“”‘’·…~]/g, '').replace(/ /g, '    ');
  const lr = await call('sentence/submit', { text: `  ${loose}  ` }, q.token);
  t.check('공백을 늘리고 문장부호를 빼도 맞는 것으로 본다', lr.ok && lr.match === true && lr.me.coins === 10, JSON.stringify(lr).slice(0, 300));

  // ── 책 읽기 체크 ──
  const r1 = await student(A.code, '읽기1', '3333');
  const bad0 = await call('read/check', { bookId: 'b01', pages: 0 }, r1.token);
  t.eq('쪽수 0 은 400', bad0.status, 400);
  const badBook = await call('read/check', { bookId: 'nope', pages: 5 }, r1.token);
  t.eq('없는 책은 404', badBook.status, 404);
  const rc = await call('read/check', { bookId: 'b01', pages: 12 }, r1.token);
  t.check('책 읽기 체크 코인 +5 · EXP +5', rc.ok && rc.me.coins === 5 && rc.me.exp === 5 && rc.me.quests.read === true, JSON.stringify(rc.me));
  const rcBurst = await Promise.all(Array.from({ length: 8 }, () => call('read/check', { bookId: 'b02', pages: 7 }, r1.token)));
  const afterRc = await call('me', {}, r1.token);
  t.check('읽기 체크를 또 해도(동시 8개 포함) 추가 지급 없음', rcBurst.every((x) => x.ok && x.already) && afterRc.me.coins === 5 && afterRc.me.exp === 5, `${afterRc.me.coins}/${afterRc.me.exp}`);

  // ── 퀘스트 3개 보너스 ──
  const b = await student(A.code, '퀘스트', '4444');
  const friends = await call('friends/list', {}, b.token);
  t.check('친구 목록에 나는 없다', friends.ok && friends.friends.length >= 20 && !friends.friends.some((f) => f.id === b.id), '');
  const self = await call('friends/visit', { friendId: b.id }, b.token);
  t.eq('나에게 놀러 갈 수는 없다(404)', self.status, 404);
  const v1 = await call('friends/visit', { friendId: demo.id }, b.token);
  t.check('친구 방문: 퀘스트 ③ 완료, 아직 보너스 없음', v1.ok && v1.first && v1.me.quests.visit && v1.me.coins === 0, JSON.stringify(v1.me.quests));
  const s1 = await call('sentence/submit', { text: b.me.sentence.text }, b.token);
  t.check('문장 필사(+10) 후에도 보너스 아직 없음', s1.me.coins === 10 && !s1.bonus, `${s1.me.coins}`);
  const rcb = await call('read/check', { bookId: 'b03', pages: 3 }, b.token);
  t.check('세 번째 퀘스트를 마치면 보너스 +20 (10+5+20=35코인, EXP 15)', rcb.bonus === true && rcb.me.coins === 35 && rcb.me.exp === 15, `${rcb.me.coins}/${rcb.me.exp}`);
  const v2 = await call('friends/visit', { friendId: demo.id }, b.token);
  const done = await call('me', {}, b.token);
  t.check('보너스는 하루 1회 — 다시 방문해도 그대로', v2.ok && !v2.first && done.me.coins === 35 && done.me.quests.bonus === true && done.me.quests.count === 3, JSON.stringify(done.me.quests));

  // 친구 집에 다녀감 기록 (교사 화면은 단계 10에서 본다) — 방문 기록은 중복되지 않는다
  const demoLogin = await join(A.code, '시연', '0000');
  t.check('시연으로 다시 입장', demoLogin.ok, '');
}
