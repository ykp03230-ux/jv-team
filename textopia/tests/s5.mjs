import { call, newClass, seed, student } from './lib.mjs';

export const num = 5;
export const title = '읽음 인증 · 교사 승인/반려';
export const method = '책 등록 → 인증 제출(코인 그대로) → 교사 승인(+30, 동시 승인 5번에도 한 번만) / 반려(사유 노출) → 재제출 → 승인';

const sub = (token, bookId, extra = {}) => call('cert/submit', { bookId, sentence: '죽는 날까지 하늘을 우러러', page: 12, feeling: '마음이 곧아지는 느낌이 들었다.', ...extra }, token);

export async function run(t) {
  const A = await newClass(); await seed(A);
  const s = await student(A.code, '인증1', '1111');

  const notReg = await sub(s.token, 'b11');
  t.eq('내 책으로 등록하지 않은 책은 인증할 수 없다(409)', notReg.status, 409);
  const reg = await call('books/register', { bookId: 'b11' }, s.token);
  t.check('책 등록: 내 책장에 올라온다', reg.ok && reg.shelf.some((b) => b.id === 'b11'), JSON.stringify(reg.shelf));
  const reg2 = await call('books/register', { bookId: 'b11' }, s.token);
  t.eq('같은 책을 또 등록해도 한 권뿐', reg2.shelf.length, 1);
  t.eq('없는 책 등록은 404', (await call('books/register', { bookId: 'nope' }, s.token)).status, 404);

  t.eq('빈 문장은 400', (await sub(s.token, 'b11', { sentence: ' ' })).status, 400);
  t.eq('쪽수 0 은 400', (await sub(s.token, 'b11', { page: 0 })).status, 400);
  t.eq('느낌이 비면 400', (await sub(s.token, 'b11', { feeling: '' })).status, 400);

  // 제출 → 승인 대기, 코인 그대로
  const before = (await call('me', {}, s.token)).me;
  const submitted = await sub(s.token, 'b11');
  t.check('제출하면 승인 대기(pending)', submitted.ok && submitted.shelf[0].cert.status === 'pending', JSON.stringify(submitted.shelf?.[0]?.cert));
  t.check('승인 전에는 코인·EXP 가 변하지 않는다', submitted.me.coins === before.coins && submitted.me.exp === before.exp && submitted.me.coins === 0, `${submitted.me.coins}/${submitted.me.exp}`);
  t.eq('대기 중에 또 제출하면 409', (await sub(s.token, 'b11')).status, 409);

  // 교사
  t.eq('학생은 교사 목록을 볼 수 없다(403)', (await call('teacher/certs', {}, s.token)).status, 403);
  t.eq('학생은 승인할 수 없다(403)', (await call('teacher/cert/approve', { studentId: s.id, bookId: 'b11' }, s.token)).status, 403);
  const list = await call('teacher/certs', {}, A.teacher);
  const mine = list.pending.find((p) => p.studentId === s.id && p.bookId === 'b11');
  t.check('교사 목록에 닉네임·책·문장·쪽수·느낌이 보인다', mine && mine.nick === '인증1' && mine.bookTitle === '하늘과 바람과 별과 시' && mine.page === 12 && mine.sentence && mine.feeling, JSON.stringify(mine));

  const other = await newClass(); await seed(other);
  t.eq('다른 반 교사는 이 인증을 승인할 수 없다(404)', (await call('teacher/cert/approve', { studentId: s.id, bookId: 'b11' }, other.teacher)).status, 404);

  // 승인: 동시에 5번 눌러도 한 번만
  const burst = await Promise.all(Array.from({ length: 5 }, () => call('teacher/cert/approve', { studentId: s.id, bookId: 'b11' }, A.teacher)));
  t.eq('동시 승인 5번 중 성공은 1번', burst.filter((r) => r.ok).length, 1);
  const after = (await call('me', {}, s.token)).me;
  t.check('승인 후 코인 +30, EXP +30 (한 번만)', after.coins === 30 && after.exp === 30, `${after.coins}/${after.exp}`);
  const lib = (await call('library/get', {}, s.token)).library;
  t.check('도감에 "읽은 책"으로 올라간다', lib.books.find((b) => b.id === 'b11')?.read === true, '');
  t.eq('승인된 책은 다시 제출할 수 없다(409)', (await sub(s.token, 'b11')).status, 409);
  const shelf = await call('books/shelf', {}, s.token);
  t.eq('책장에서 상태가 approved', shelf.shelf[0].cert.status, 'approved');

  // 반려
  const r = await student(A.code, '인증2', '2222');
  await call('books/register', { bookId: 'b12' }, r.token);
  await sub(r.token, 'b12');
  t.eq('반려 사유가 비면 400', (await call('teacher/cert/reject', { studentId: r.id, bookId: 'b12', reason: '  ' }, A.teacher)).status, 400);
  const rej = await call('teacher/cert/reject', { studentId: r.id, bookId: 'b12', reason: '쪽수가 책과 달라요. 다시 확인해 주세요.' }, A.teacher);
  t.check('교사가 반려한다', rej.ok, JSON.stringify(rej));
  const seen = await call('books/shelf', {}, r.token);
  t.check('학생에게 반려 사유가 보인다', seen.shelf[0].cert.status === 'rejected' && seen.shelf[0].cert.reason === '쪽수가 책과 달라요. 다시 확인해 주세요.', JSON.stringify(seen.shelf[0].cert));
  t.check('반려되면 코인·EXP 변화 없음', seen.me.coins === 0 && seen.me.exp === 0, `${seen.me.coins}/${seen.me.exp}`);
  t.eq('이미 처리한 인증을 다시 승인하려 하면 409', (await call('teacher/cert/approve', { studentId: r.id, bookId: 'b12' }, A.teacher)).status, 409);
  const re = await sub(r.token, 'b12', { page: 31 });
  t.check('반려 뒤에는 고쳐서 다시 제출할 수 있다(pending, 사유 지워짐)', re.ok && re.shelf[0].cert.status === 'pending' && re.shelf[0].cert.reason === '' && re.shelf[0].cert.page === 31, JSON.stringify(re.shelf?.[0]?.cert));
  const ok2 = await call('teacher/cert/approve', { studentId: r.id, bookId: 'b12' }, A.teacher);
  const fin = (await call('me', {}, r.token)).me;
  t.check('다시 제출한 뒤 승인되면 +30/+30', ok2.ok && fin.coins === 30 && fin.exp === 30, `${fin.coins}/${fin.exp}`);

  // 마을 EXP 도 올라갔는지 (290 + 30 + 30)
  const ov = await call('teacher/overview', {}, A.teacher);
  t.eq('마을 EXP 에 승인 EXP 가 합쳐진다(290+30+30)', ov.village.exp, 350);
}
