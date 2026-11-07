// 책 목록: 기본 도서(catalog.js) + 학생이 추가한 책(state.books.added)
// 교사가 숨긴 책은 목록·검색에서만 빠진다. 이미 한 활동 기록과 보상은 그대로 남는다.

export function allBooks(c) {
  const base = c.baseBooks.map((b) => ({ ...b, base: true, hidden: false }));
  const added = Object.values(c.state.books.added).map((b) => ({ ...b, base: false }));
  return [...base, ...added];
}

export function findBook(c, id) {
  if (typeof id !== 'string') return null;
  const b = c.baseBooks.find((x) => x.id === id);
  if (b) return { ...b, base: true, hidden: false };
  const a = c.state.books.added[id];
  return a ? { ...a, base: false } : null;
}

export const visibleBooks = (c) => allBooks(c).filter((b) => !b.hidden);

/** 화면에 보여 줄 책 한 권 (기록에 남은 책이면 숨김 책도 제목은 보인다) */
export function bookCard(b) {
  return { id: b.id, title: b.title, author: b.author, category: b.category, base: b.base, addedByNick: b.base ? null : b.addedByNick };
}
