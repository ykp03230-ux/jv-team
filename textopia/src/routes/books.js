// 책: 목록·검색, 내 책 등록, 학생의 책 추가, 교사의 책 관리(수정·숨기기)
import { fail, text, nickKey, bookKey, newId } from '../util.js';
import { CATEGORIES } from '../data/catalog.js';
import { DAILY_BOOK_ADDS } from '../data/rules.js';
import { actorStudent } from '../engine/core.js';
import { allBooks, findBook, visibleBooks, bookCard } from '../engine/books.js';
import { studentView } from '../engine/views.js';
import { shelfView } from '../engine/shelf.js';

const matches = (b, q) => {
  const k = nickKey(q);
  return nickKey(b.title).includes(k) || nickKey(b.author).includes(k);
};

export const bookRoutes = {
  'books/list': { auth: 'any', run: async (c) => ({
    books: visibleBooks(c).map(bookCard),
    categories: CATEGORIES,
  }) },

  // 책 검색 (공백은 무시). 결과가 없으면 화면에 '책 추가하기'가 나온다.
  'books/search': { auth: 'student', run: async (c) => {
    const q = typeof c.body.q === 'string' ? c.body.q.trim().slice(0, 50) : '';
    const list = visibleBooks(c).filter((b) => !q || matches(b, q)).map(bookCard);
    return { books: list, canAdd: q.length > 0 && list.length === 0, categories: CATEGORIES };
  } },

  // 내 책으로 등록 (이미 등록했으면 그대로)
  'books/register': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const book = findBook(c, c.body.bookId);
    if (!book || (book.hidden && !st.shelf.includes(book.id))) fail(404, 'no_book', '책을 찾을 수 없어요.');
    if (!st.shelf.includes(book.id)) st.shelf.push(book.id);
    return { shelf: shelfView(c, st), me: studentView(c, st) };
  } },

  'books/shelf': { auth: 'student', run: async (c) => ({ shelf: shelfView(c, actorStudent(c)), me: studentView(c, actorStudent(c)) }) },

  // 학생이 책 추가: 제목·지은이·분류. 코인·EXP 는 주지 않는다. 하루 3권까지.
  'books/add': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const title = text(c.body.title, { name: '제목', min: 1, max: 50 });
    const author = text(c.body.author, { name: '지은이', min: 1, max: 30 });
    const category = c.body.category;
    if (!CATEGORIES.includes(category)) fail(400, 'bad_input', '분류를 골라 주세요.');

    // 공백을 무시하고 제목과 지은이가 같은 책이 이미 있으면 새로 만들지 않는다
    const key = bookKey(title, author);
    const same = allBooks(c).find((b) => bookKey(b.title, b.author) === key);
    if (same) {
      if (same.hidden) fail(409, 'hidden', '선생님이 숨겨 둔 책이에요.');
      fail(409, 'duplicate', '이미 있는 책이에요', { existing: bookCard(same) });
    }
    const mine = Object.values(c.state.books.added).filter((b) => b.addedBy === st.id && b.date === c.today).length;
    if (mine >= DAILY_BOOK_ADDS) fail(409, 'limit', `책은 하루에 ${DAILY_BOOK_ADDS}권까지 추가할 수 있어요.`);

    const book = { id: newId('u'), title, author, category, addedBy: st.id, addedByNick: st.nick, date: c.today, at: c.nowMs, hidden: false };
    c.state.books.added[book.id] = book;
    return { book: bookCard({ ...book, base: false }), left: DAILY_BOOK_ADDS - mine - 1, me: studentView(c, st) };
  } },

  // ── 교사: 학생이 추가한 책 ──
  'teacher/books': { auth: 'teacher', run: async (c) => ({
    books: Object.values(c.state.books.added).sort((a, b) => b.at - a.at)
      .map((b) => ({ id: b.id, title: b.title, author: b.author, category: b.category, addedByNick: b.addedByNick, date: b.date, hidden: !!b.hidden })),
    categories: CATEGORIES,
  }) },

  'teacher/book/edit': { auth: 'teacher', write: true, run: async (c) => {
    const book = c.state.books.added[c.body.id];
    if (!book) fail(c.baseBooks.some((b) => b.id === c.body.id) ? 400 : 404, 'no_book', '학생이 추가한 책만 고칠 수 있어요.');
    const title = text(c.body.title, { name: '제목', min: 1, max: 50 });
    const author = text(c.body.author, { name: '지은이', min: 1, max: 30 });
    if (!CATEGORIES.includes(c.body.category)) fail(400, 'bad_input', '분류를 골라 주세요.');
    const key = bookKey(title, author);
    if (allBooks(c).some((b) => b.id !== book.id && bookKey(b.title, b.author) === key)) fail(409, 'duplicate', '같은 제목과 지은이의 책이 이미 있어요.');
    Object.assign(book, { title, author, category: c.body.category });
    return {};
  } },

  // 숨긴 책은 목록과 검색에서 사라진다. 이미 한 활동 기록과 보상은 그대로 남는다.
  'teacher/book/hide': { auth: 'teacher', write: true, run: async (c) => {
    const book = c.state.books.added[c.body.id];
    if (!book) fail(c.baseBooks.some((b) => b.id === c.body.id) ? 400 : 404, 'no_book', '학생이 추가한 책만 숨길 수 있어요.');
    book.hidden = c.body.hidden !== false;
    return { hidden: book.hidden };
  } },
};
