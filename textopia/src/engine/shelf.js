// 내 책장: 등록한 책 + 읽음 인증 상태 + (7·9단계) 책마다 한 활동
import { findBook, bookCard } from './books.js';

/** 책 한 권에 대한 내 인증 상태 (교사의 반려 사유는 학생에게 보인다) */
export function certView(st, bookId) {
  const c = st.certs[bookId];
  if (!c) return null;
  return { status: c.status, sentence: c.sentence, page: c.page, feeling: c.feeling, reason: c.reason || '', at: c.at, decidedAt: c.decidedAt || null };
}

export function shelfView(c, st) {
  return st.shelf.map((id) => findBook(c, id)).filter(Boolean).map((b) => ({
    ...bookCard(b),
    hidden: !!b.hidden,
    cert: certView(st, b.id),
    done: activitiesDone(st, b.id),
  }));
}

export const ACTIVITY_TYPES = ['sentence', 'question', 'bookmark', 'drawing', 'cover'];

/** 이 책에서 보상을 받은 활동 종류 */
export function activitiesDone(st, bookId) {
  return ACTIVITY_TYPES.filter((t) => (st.claims[`act:${bookId}:${t}`] || 0) >= 1);
}
