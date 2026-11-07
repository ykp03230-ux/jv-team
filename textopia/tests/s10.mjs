import { call, newClass, seed, student } from './lib.mjs';

export const num = 10;
export const title = '(추가) 7단계 독서 활동 · 내 것만 수정';
export const method = '문장 모으기·질문·책갈피 보상(책마다 활동별 1회, 동시 10개에도 1번), 다른 책에서는 다시 보상, 남의 문장·작품은 수정/삭제/걸기 불가';

const sentence = (token, bookId, text = '죽는 날까지 하늘을 우러러', extra = {}) =>
  call('activity/submit', { bookId, type: 'sentence', text, page: 5, reason: '마음에 남아서', ...extra }, token);

export async function run(t) {
  const A = await newClass(); await seed(A);
  const s = await student(A.code, '활동1', '1111');

  t.eq('등록하지 않은 책으로는 활동할 수 없다(409)', (await sentence(s.token, 'b11')).status, 409);
  await call('books/register', { bookId: 'b11' }, s.token);
  await call('books/register', { bookId: 'b12' }, s.token);

  // 문장 모으기
  t.eq('문장이 비면 400', (await sentence(s.token, 'b11', ' ')).status, 400);
  t.eq('쪽수 0 은 400', (await sentence(s.token, 'b11', '문장', { page: 0 })).status, 400);
  t.eq('이유가 비면 400', (await sentence(s.token, 'b11', '문장', { reason: '' })).status, 400);
  const a1 = await sentence(s.token, 'b11');
  t.check('문장 모으기: 코인 +15, EXP +15', a1.ok && a1.rewarded && a1.me.coins === 15 && a1.me.exp === 15 && a1.item.kind === 'sentence', JSON.stringify(a1).slice(0, 200));
  t.check('도감 책 정보: 이 책의 활동 중 "sentence" 완료', a1.shelf.find((b) => b.id === 'b11').done.includes('sentence'), JSON.stringify(a1.shelf));
  const a2 = await sentence(s.token, 'b11', '나한테 주어진 길을 걸어가야겠다');
  t.check('같은 책에서 문장을 또 모으면 문장은 쌓이지만 보상은 없다', a2.ok && !a2.rewarded && a2.me.coins === 15 && a2.me.exp === 15, `${a2.me.coins}/${a2.me.exp}`);

  // 질문 만들기
  t.eq('질문이 비면 400', (await call('activity/submit', { bookId: 'b11', type: 'question', text: '' }, s.token)).status, 400);
  const q1 = await call('activity/submit', { bookId: 'b11', type: 'question', text: '시인은 왜 별을 바라보았을까?' }, s.token);
  t.check('질문 만들기: +15/+15 (누적 30/30)', q1.ok && q1.rewarded && q1.me.coins === 30 && q1.me.exp === 30, `${q1.me.coins}/${q1.me.exp}`);

  // 책갈피 만들기
  const b0 = await call('activity/submit', { bookId: 'b11', type: 'bookmark', sentenceId: a1.item.id, template: 'zzz' }, s.token);
  t.eq('없는 테두리는 400', b0.status, 400);
  const bOther = await sentence(s.token, 'b12', '산에는 꽃 피네 꽃이 피네');
  const bWrong = await call('activity/submit', { bookId: 'b11', type: 'bookmark', sentenceId: bOther.item.id, template: 't1' }, s.token);
  t.eq('다른 책에서 모은 문장으로는 만들 수 없다(400)', bWrong.status, 400);
  const bMissing = await call('activity/submit', { bookId: 'b11', type: 'bookmark', sentenceId: 'nope', template: 't1' }, s.token);
  t.eq('없는 문장은 404', bMissing.status, 404);
  const bm = await call('activity/submit', { bookId: 'b11', type: 'bookmark', sentenceId: a1.item.id, template: 't2' }, s.token);
  t.check('책갈피 만들기: 문장+템플릿 t2, 보상 +15/+15', bm.ok && bm.rewarded && bm.item.type === 'bookmark' && bm.item.template === 't2' && bm.item.text === a1.item.text, JSON.stringify(bm).slice(0, 220));
  const me1 = (await call('me', {}, s.token)).me;
  // b11: 문장 15 + 질문 15 + 책갈피 15 = 45, b12 문장 15 = 60
  t.check('누적: b11 세 활동 45 + b12 문장 15 = 60/60', me1.coins === 60 && me1.exp === 60, `${me1.coins}/${me1.exp}`);
  const done = (await call('books/shelf', {}, s.token)).shelf;
  t.eq('책마다 완료한 활동이 따로 기록된다', [done.find((b) => b.id === 'b11').done.sort(), done.find((b) => b.id === 'b12').done], [['bookmark', 'question', 'sentence'], ['sentence']]);

  // 동시 10개
  const p = await student(A.code, '활동2', '2222');
  await call('books/register', { bookId: 'b13' }, p.token);
  const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => sentence(p.token, 'b13', `동시에 쓴 문장 ${i}`)));
  const after = (await call('me', {}, p.token)).me;
  t.eq('동시 10개 중 보상을 받은 것은 1개', burst.filter((r) => r.ok && r.rewarded).length, 1);
  t.check('동시 요청 뒤 코인 15 · EXP 15', after.coins === 15 && after.exp === 15, `${after.coins}/${after.exp}`);
  t.eq('문장 10개는 모두 모였다', (await call('library/get', {}, p.token)).library.sentences.length, 10);

  // 내 것만 수정·삭제·걸기
  const other = await student(A.code, '활동3', '3333');
  await call('books/register', { bookId: 'b11' }, other.token);
  t.eq('남의 문장 고치기는 404', (await call('item/edit', { kind: 'sentence', id: a1.item.id, text: '바꿔치기', page: 1, reason: '장난' }, other.token)).status, 404);
  t.eq('남의 문장 지우기는 404', (await call('item/delete', { kind: 'sentence', id: a1.item.id }, other.token)).status, 404);
  t.eq('남의 책갈피 지우기는 404', (await call('item/delete', { kind: 'work', id: bm.item.id }, other.token)).status, 404);
  t.eq('남의 책갈피 테두리 바꾸기는 404', (await call('item/edit', { kind: 'work', id: bm.item.id, template: 't1' }, other.token)).status, 404);
  t.eq('남의 문장으로 책갈피 만들기는 404', (await call('activity/submit', { bookId: 'b11', type: 'bookmark', sentenceId: a1.item.id, template: 't1' }, other.token)).status, 404);
  t.eq('남의 작품을 내 전시 칸에 걸기는 404', (await call('slot/set', { index: 0, kind: 'work', id: bm.item.id }, other.token)).status, 404);
  const still = (await call('library/get', {}, s.token)).library;
  t.check('(확인) 내 문장·책갈피는 그대로', still.sentences.some((x) => x.id === a1.item.id) && still.works.some((x) => x.id === bm.item.id), '');

  const ed = await call('item/edit', { kind: 'sentence', id: a1.item.id, text: '고친 문장입니다', page: 9, reason: '고쳐 보았어요' }, s.token);
  t.check('내 문장은 고칠 수 있다', ed.library.sentences.find((x) => x.id === a1.item.id)?.text === '고친 문장입니다', '');
  const ed2 = await call('item/edit', { kind: 'work', id: bm.item.id, template: 't3' }, s.token);
  t.eq('내 책갈피 테두리를 바꿀 수 있다', ed2.library.works.find((x) => x.id === bm.item.id)?.template, 't3');

  // 지우고 다시 만들어도 같은 책·활동의 보상은 다시 받을 수 없다
  await call('slot/set', { index: 4, kind: 'sentence', id: a2.item.id }, s.token);
  await call('pick/set', { id: a2.item.id }, s.token);
  const del = await call('item/delete', { kind: 'sentence', id: a2.item.id }, s.token);
  t.check('지우면 전시 칸과 pick 에서도 내려간다', del.library.slots[4] === null && del.library.pick === null && !del.library.sentences.some((x) => x.id === a2.item.id), JSON.stringify(del.library.slots));
  const re = await sentence(s.token, 'b11', '지우고 다시 쓴 문장');
  t.check('지우고 다시 모아도 보상은 다시 나오지 않는다', re.ok && !re.rewarded && re.me.coins === 60, `${re.me.coins}`);
}
