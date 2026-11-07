// 내 서재: 전시 칸, pick 문장, 서재 도감(읽은 책 / 모은 문장 / 만든 작품)
import { findBook, visibleBooks, bookCard } from './books.js';

const titleOf = (c, bookId) => findBook(c, bookId)?.title || '(없어진 책)';

export const sentenceView = (c, s) => ({ kind: 'sentence', id: s.id, bookId: s.bookId, bookTitle: titleOf(c, s.bookId), text: s.text, page: s.page, reason: s.reason, at: s.at });
export const questionView = (c, q) => ({ kind: 'question', id: q.id, bookId: q.bookId, bookTitle: titleOf(c, q.bookId), text: q.text, at: q.at });
export const workView = (c, w) => ({
  kind: 'work', id: w.id, type: w.type, bookId: w.bookId, bookTitle: titleOf(c, w.bookId), at: w.at,
  text: w.text, template: w.template, imgId: w.imgId, caption: w.caption, title: w.title,
});

/** 전시 칸에 걸린 것({kind,id}) → 화면용 내용. 원본이 없으면 null. */
export function resolveRef(c, st, ref) {
  if (!ref) return null;
  if (ref.kind === 'work') { const w = st.works.find((x) => x.id === ref.id); return w ? workView(c, w) : null; }
  if (ref.kind === 'sentence') { const s = st.sentences.find((x) => x.id === ref.id); return s ? sentenceView(c, s) : null; }
  return null;
}

/** 이 학생이 기록(인증·활동·등록)을 남긴 책 id — 교사가 숨긴 책도 도감에는 남는다 */
export function recordedBookIds(st) {
  const ids = new Set(st.shelf);
  Object.keys(st.certs).forEach((id) => ids.add(id));
  st.sentences.forEach((s) => ids.add(s.bookId));
  st.questions.forEach((q) => ids.add(q.bookId));
  st.works.forEach((w) => ids.add(w.bookId));
  return ids;
}

/** 서재 도감의 책 칸: 보이는 책 전체 + 기록이 있는 숨김 책. 읽지 않은 책은 read=false (화면에서 흐리게) */
export function libraryBooks(c, st) {
  const recorded = recordedBookIds(st);
  const list = visibleBooks(c);
  const have = new Set(list.map((b) => b.id));
  for (const id of recorded) {
    if (!have.has(id)) { const b = findBook(c, id); if (b) list.push(b); }
  }
  return list.map((b) => ({
    ...bookCard(b),
    read: st.certs[b.id]?.status === 'approved',
    certStatus: st.certs[b.id]?.status || null,
    shelf: st.shelf.includes(b.id),
    hidden: !!b.hidden,
  }));
}

export function libraryView(c, st) {
  return {
    slots: st.slots.map((ref) => resolveRef(c, st, ref)),
    pick: st.pickId ? (() => { const s = st.sentences.find((x) => x.id === st.pickId); return s ? sentenceView(c, s) : null; })() : null,
    books: libraryBooks(c, st),
    sentences: st.sentences.map((s) => sentenceView(c, s)),
    works: st.works.map((w) => workView(c, w)),
    questions: st.questions.map((q) => questionView(c, q)),
    guestbook: st.guestbook.slice(-10).reverse().map((g) => ({ nick: g.nick, date: g.date })),
  };
}
