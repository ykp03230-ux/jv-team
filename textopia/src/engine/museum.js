// 박물관 작품(전시) 자료 구조. 제출한 순간의 내용을 복사(snap)해 두어서
// 나중에 학생이 내용을 바꿔도, 이미 낸 작품은 그대로 남는다.
import { fail } from '../util.js';

export const MUSEUM_KINDS = ['work', 'sentence', 'question']; // 전시 아이템 / 문장 카드 / 질문

/** 학생 자신의 항목(kind, refId)에서 박물관에 낼 복사본을 만든다. 없으면 오류. */
export function buildSnap(st, kind, refId) {
  if (kind === 'work') {
    const w = st.works.find((x) => x.id === refId);
    if (!w) fail(404, 'no_item', '내 작품을 찾을 수 없어요.');
    const snap = { type: w.type, bookId: w.bookId };
    if (w.type === 'bookmark') Object.assign(snap, { text: w.text, template: w.template });
    if (w.type === 'drawing') Object.assign(snap, { imgId: w.imgId, caption: w.caption });
    if (w.type === 'cover') Object.assign(snap, { imgId: w.imgId, title: w.title });
    return snap;
  }
  if (kind === 'sentence') {
    const s = st.sentences.find((x) => x.id === refId);
    if (!s) fail(404, 'no_item', '내 문장을 찾을 수 없어요.');
    return { bookId: s.bookId, text: s.text, page: s.page, reason: s.reason };
  }
  if (kind === 'question') {
    const q = st.questions.find((x) => x.id === refId);
    if (!q) fail(404, 'no_item', '내 질문을 찾을 수 없어요.');
    return { bookId: q.bookId, text: q.text };
  }
  return fail(400, 'bad_input', '낼 수 없는 종류예요.');
}

export function newSub({ id, sid, kind, refId, month, at, snap }) {
  return { id, sid, kind, refId, month, at, hidden: false, snap };
}
