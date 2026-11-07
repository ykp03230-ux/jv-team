// 읽음 인증: 학생이 문장·쪽수·느낌을 내면 '승인 대기'. 교사가 승인해야 코인 30 · EXP 30 이 나간다.
import { fail, text, int } from '../util.js';
import { REWARDS } from '../data/rules.js';
import { grant, mergeEvents, actorStudent } from '../engine/core.js';
import { findBook } from '../engine/books.js';
import { studentView } from '../engine/views.js';
import { shelfView } from '../engine/shelf.js';

export const certRoutes = {
  'cert/submit': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const book = findBook(c, c.body.bookId);
    if (!book || !st.shelf.includes(book.id)) fail(409, 'not_registered', '먼저 내 책으로 등록해 주세요.');
    const sentence = text(c.body.sentence, { name: '책 속 문장', min: 2, max: 200 });
    const page = int(c.body.page, { name: '쪽수', min: 1, max: 9999 });
    const feeling = text(c.body.feeling, { name: '내 느낌', min: 2, max: 100 });
    const cur = st.certs[book.id];
    if (cur?.status === 'pending') fail(409, 'pending', '선생님이 확인하고 있어요. 조금만 기다려 주세요.');
    if (cur?.status === 'approved') fail(409, 'approved', '이미 읽음 인증을 받은 책이에요.');
    st.certs[book.id] = { status: 'pending', sentence, page, feeling, reason: '', at: c.nowMs, decidedAt: null };
    return { shelf: shelfView(c, st), me: studentView(c, st) };
  } },

  // ── 교사 ──
  'teacher/certs': { auth: 'teacher', run: async (c) => {
    const pending = [];
    for (const st of Object.values(c.state.students)) {
      for (const [bookId, cert] of Object.entries(st.certs)) {
        if (cert.status !== 'pending') continue;
        pending.push({ studentId: st.id, nick: st.nick, bookId, bookTitle: findBook(c, bookId)?.title || '(없어진 책)', sentence: cert.sentence, page: cert.page, feeling: cert.feeling, at: cert.at });
      }
    }
    pending.sort((a, b) => a.at - b.at);
    return { pending };
  } },

  'teacher/cert/approve': { auth: 'teacher', write: true, run: async (c) => {
    const st = c.state.students[c.body.studentId];
    const cert = st?.certs[c.body.bookId];
    if (!cert) fail(404, 'no_cert', '인증을 찾을 수 없어요.');
    if (cert.status !== 'pending') fail(409, 'not_pending', cert.status === 'approved' ? '이미 승인했어요.' : '이미 처리했어요.');
    cert.status = 'approved'; cert.reason = ''; cert.decidedAt = c.nowMs;
    // 책당 1회: key 가 cert:책 이므로 같은 책으로는 두 번 지급되지 않는다
    const ev = grant(c.state, st, c, { key: `cert:${c.body.bookId}`, rule: REWARDS.cert, note: '읽음 인증 승인' });
    return { reward: mergeEvents([ev]) };
  } },

  'teacher/cert/reject': { auth: 'teacher', write: true, run: async (c) => {
    const st = c.state.students[c.body.studentId];
    const cert = st?.certs[c.body.bookId];
    if (!cert) fail(404, 'no_cert', '인증을 찾을 수 없어요.');
    const reason = text(c.body.reason, { name: '반려 사유', min: 1, max: 100 });
    if (cert.status !== 'pending') fail(409, 'not_pending', cert.status === 'approved' ? '이미 승인했어요.' : '이미 처리했어요.');
    cert.status = 'rejected'; cert.reason = reason; cert.decidedAt = c.nowMs;
    return {};
  } },
};
