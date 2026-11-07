import { call, newClass, seed, student } from './lib.mjs';
import { addDays } from '../src/util.js';

export const num = 9;
export const title = '학생이 책 추가하기';
export const method = '없는 책 추가 → 같은 반 다른 학생 검색에 즉시 노출 / 중복(공백 무시) 안내 / 코인 불변 / 하루 3권 제한 / 교사 숨기기·수정 / 다른 반 비노출 / 숨겨도 도감 기록 유지';

export async function run(t) {
  const A = await newClass(); await seed(A);
  const B = await newClass(); await seed(B);
  const s1 = await student(A.code, '추가1', '1111');
  const s2 = await student(A.code, '추가2', '2222');

  // 예시 데이터의 기본 30권 + 학생이 추가한 2권
  const all = await call('books/list', {}, s1.token);
  t.eq('예시 데이터: 보이는 책 32권(기본 30 + 추가 2)', all.books.length, 32);
  t.eq('기본 도서 30권은 base 표시', all.books.filter((b) => b.base).length, 30);
  const fromFriend = all.books.filter((b) => !b.base);
  t.check('친구가 추가한 책에는 추가한 학생 닉네임이 붙는다', fromFriend.length === 2 && fromFriend.every((b) => b.addedByNick), JSON.stringify(fromFriend));

  // 검색: 없으면 canAdd
  const none = await call('books/search', { q: '새로운 고전' }, s1.token);
  t.check('없는 책을 검색하면 결과가 없고 "책 추가하기"가 나온다(canAdd)', none.ok && none.books.length === 0 && none.canAdd === true, JSON.stringify(none));
  const some = await call('books/search', { q: '홍길' }, s1.token);
  t.check('있는 책이면 canAdd 가 아니다', some.books.length === 1 && some.canAdd === false, JSON.stringify(some));
  const sp = await call('books/search', { q: '하늘과바람과별과시' }, s1.token);
  t.eq('검색은 공백을 무시한다', sp.books.map((b) => b.title), ['하늘과 바람과 별과 시']);
  const byAuthor = await call('books/search', { q: '윤동주' }, s1.token);
  t.eq('지은이로도 검색된다', byAuthor.books.length, 1);

  // 추가
  const before = (await call('me', {}, s1.token)).me;
  t.eq('분류가 목록에 없으면 400', (await call('books/add', { title: '아무개', author: '누구', category: '만화' }, s1.token)).status, 400);
  t.eq('제목이 비면 400', (await call('books/add', { title: ' ', author: '누구', category: '기타' }, s1.token)).status, 400);
  const add1 = await call('books/add', { title: '새로운 고전', author: '홍 길', category: '기타' }, s1.token);
  t.check('책 추가 성공', add1.ok && add1.book.title === '새로운 고전' && add1.book.addedByNick === '추가1' && add1.book.base === false, JSON.stringify(add1));
  t.check('책을 추가해도 코인·EXP 는 그대로', add1.me.coins === before.coins && add1.me.exp === before.exp, `${add1.me.coins}/${add1.me.exp} vs ${before.coins}/${before.exp}`);

  // 같은 반 다른 학생 검색에 바로 나온다
  const found = await call('books/search', { q: '새로운고전' }, s2.token);
  t.check('같은 반 다른 학생의 검색(공백 없이)에 바로 나온다', found.books.length === 1 && found.books[0].id === add1.book.id && found.books[0].addedByNick === '추가1', JSON.stringify(found.books));
  const list2 = await call('books/list', {}, s2.token);
  t.eq('반 전체 책 목록이 33권으로 는다', list2.books.length, 33);

  // 다른 반에는 보이지 않는다
  const sB = await student(B.code, '다른반', '3333');
  const inB = await call('books/search', { q: '새로운고전' }, sB.token);
  t.check('다른 반에서는 이 책이 보이지 않는다', inB.books.length === 0 && inB.canAdd === true, JSON.stringify(inB.books));
  t.eq('다른 반 목록은 그대로 32권', (await call('books/list', {}, sB.token)).books.length, 32);

  // 중복
  const dup = await call('books/add', { title: ' 새로운   고전 ', author: ' 홍길', category: '세계 고전' }, s2.token);
  t.check('공백만 다른 같은 책은 새로 만들지 않고 "이미 있는 책이에요" + 기존 책을 보여 준다', dup.status === 409 && dup.error === 'duplicate' && dup.message === '이미 있는 책이에요' && dup.existing?.id === add1.book.id, JSON.stringify(dup));
  t.eq('중복 시도 뒤에도 33권', (await call('books/list', {}, s2.token)).books.length, 33);
  const dupBase = await call('books/add', { title: '홍길동전', author: '허균', category: '기타' }, s2.token);
  t.check('기본 도서와 같은 책도 중복으로 안내', dupBase.status === 409 && dupBase.existing?.id === 'b01', JSON.stringify(dupBase));
  const dupSeed = await call('books/add', { title: '양반전', author: '박지원', category: '기타' }, s2.token);
  t.check('친구가 추가해 둔 책과도 중복으로 안내', dupSeed.status === 409 && dupSeed.existing?.id === 'u-seed1', JSON.stringify(dupSeed));
  const sameTitleOtherAuthor = await call('books/add', { title: '새로운 고전', author: '다른 사람', category: '기타' }, s2.token);
  t.check('제목만 같고 지은이가 다르면 다른 책으로 추가된다', sameTitleOtherAuthor.ok, JSON.stringify(sameTitleOtherAuthor));

  // 하루 3권 (중복 시도는 세지 않는다)
  const s3 = await student(A.code, '추가3', '4444');
  for (let i = 1; i <= 3; i++) await call('books/add', { title: `책 ${i}`, author: '저자', category: '기타' }, s3.token);
  const fourth = await call('books/add', { title: '책 4', author: '저자', category: '기타' }, s3.token);
  t.check('하루 4번째 추가는 막힌다', fourth.status === 409 && fourth.error === 'limit', JSON.stringify(fourth));
  const still = await call('books/search', { q: '책4' }, s2.token);
  t.eq('막힌 책은 만들어지지 않았다', still.books.length, 0);
  const s3dup = await call('books/add', { title: '책 1', author: '저자', category: '기타' }, s3.token);
  t.eq('한도에 닿은 뒤 중복을 시도하면 중복 안내(limit 보다 먼저)', s3dup.error, 'duplicate');
  const s3me = (await call('me', {}, s3.token)).me;
  t.check('3권 추가 후에도 코인·EXP 0', s3me.coins === 0 && s3me.exp === 0, '');

  // 날짜가 바뀌면 다시 3권
  const today = (await call('teacher/overview', {}, A.teacher)).class.today;
  await call('teacher/clock', { date: addDays(today, 1) }, A.teacher);
  const nextDay = await call('books/add', { title: '책 4', author: '저자', category: '기타' }, s3.token);
  t.check('다음 날에는 다시 추가할 수 있다', nextDay.ok, JSON.stringify(nextDay));
  await call('teacher/clock', { date: null }, A.teacher);

  // 교사: 보기·수정·숨기기
  t.eq('학생은 교사용 책 목록을 못 본다(403)', (await call('teacher/books', {}, s1.token)).status, 403);
  const tb = await call('teacher/books', {}, A.teacher);
  const mine = tb.books.find((b) => b.id === add1.book.id);
  t.check('교사 화면에 추가한 학생·날짜가 보인다', mine && mine.addedByNick === '추가1' && mine.date === today, JSON.stringify(mine));
  t.eq('기본 도서는 고칠 수 없다(400)', (await call('teacher/book/edit', { id: 'b01', title: 'x', author: 'y', category: '기타' }, A.teacher)).status, 400);
  t.eq('기본 도서는 숨길 수 없다(400)', (await call('teacher/book/hide', { id: 'b01' }, A.teacher)).status, 400);
  const dupEdit = await call('teacher/book/edit', { id: add1.book.id, title: '홍길동전', author: '허균', category: '기타' }, A.teacher);
  t.eq('다른 책과 겹치게 고치면 409', dupEdit.status, 409);
  const edit = await call('teacher/book/edit', { id: add1.book.id, title: '새로운 고전(고침)', author: '홍길', category: '한국 인문·역사' }, A.teacher);
  t.check('교사가 제목·분류를 고친다', edit.ok, JSON.stringify(edit));
  t.eq('고친 제목으로 검색된다', (await call('books/search', { q: '고침' }, s2.token)).books.map((b) => b.category), ['한국 인문·역사']);

  // 숨겨도 이미 한 활동 기록과 보상은 남는다: 책 등록 → 읽음 인증 → 승인 → 숨기기
  await call('books/register', { bookId: add1.book.id }, s1.token);
  await call('cert/submit', { bookId: add1.book.id, sentence: '새로운 고전의 한 줄', page: 3, feeling: '친구들에게 권하고 싶다.' }, s1.token);
  const ap = await call('teacher/cert/approve', { studentId: s1.id, bookId: add1.book.id }, A.teacher);
  t.check('(준비) 추가한 책으로 읽음 인증이 승인되어 +30', ap.ok, JSON.stringify(ap));
  const hide = await call('teacher/book/hide', { id: add1.book.id, hidden: true }, A.teacher);
  t.check('교사가 숨긴다', hide.ok && hide.hidden === true, JSON.stringify(hide));
  t.eq('숨긴 책은 검색에서 사라진다', (await call('books/search', { q: '고침' }, s2.token)).books.length, 0);
  t.check('숨긴 책은 목록에서 사라진다', !(await call('books/list', {}, s2.token)).books.some((b) => b.id === add1.book.id), '');
  t.eq('다른 학생이 숨긴 책을 등록할 수 없다(404)', (await call('books/register', { bookId: add1.book.id }, s2.token)).status, 404);
  const hiddenDup = await call('books/add', { title: '새로운 고전(고침)', author: '홍길', category: '기타' }, s2.token);
  t.eq('숨긴 책과 같은 책을 다시 추가하려 하면 막힌다', hiddenDup.status, 409);
  const lib = (await call('library/get', {}, s1.token)).library;
  const kept = lib.books.find((b) => b.id === add1.book.id);
  t.check('숨겨도 그 책으로 한 활동 기록은 도감에 남는다(읽은 책)', kept && kept.read === true && kept.hidden === true && kept.title === '새로운 고전(고침)', JSON.stringify(kept));
  const me1 = (await call('me', {}, s1.token)).me;
  t.check('숨겨도 이미 받은 보상(30/30)은 그대로', me1.coins === 30 && me1.exp === 30, `${me1.coins}/${me1.exp}`);
  const unhide = await call('teacher/book/hide', { id: add1.book.id, hidden: false }, A.teacher);
  t.eq('숨김을 풀면 다시 검색된다', unhide.ok && (await call('books/search', { q: '고침' }, s2.token)).books.length, 1);

  // 예시 데이터 다시 채우기 후에도 추가 도서 2권만 남는다
  await seed(A);
  t.eq('예시 데이터 다시 채우기 후 책은 32권(내가 추가한 것은 지워짐)', (await call('books/list', {}, (await student(A.code, '시연', '0000')).token)).books.length, 32);
}
