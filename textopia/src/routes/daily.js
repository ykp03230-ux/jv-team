// 매일 할 일: 오늘의 문장 필사, 책 읽기 체크, 친구 방 방문(퀘스트), 교사의 오늘의 문장 관리
import { fail, text, int, newId, isDate, addDays } from '../util.js';
import { REWARDS } from '../data/rules.js';
import { grant, mergeEvents, actorStudent, stageOf } from '../engine/core.js';
import { normalize, diffMarks } from '../engine/text.js';
import { sentenceFor, maybeBonus, dayRecord, markSeen, markVisit } from '../engine/daily.js';
import { findBook } from '../engine/books.js';
import { studentView } from '../engine/views.js';

export const dailyRoutes = {
  // 오늘의 문장 필사: 맞으면 코인 10 · EXP 10 (하루 1회). 틀리면 틀린 글자를 표시하고 보상은 없다.
  'sentence/submit': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const typed = text(c.body.text, { name: '필사한 문장', min: 1, max: 400 });
    const target = sentenceFor(c.state, c.today);
    const want = normalize(target.text);
    const got = normalize(typed);
    const marks = diffMarks(want, got);
    markSeen(st, c.today);
    if (want !== got) return { match: false, marks, reward: null, me: studentView(c, st) };

    const ev = grant(c.state, st, c, { key: `sentence:${c.today}`, rule: REWARDS.sentence, note: '오늘의 문장 필사' });
    const bonus = maybeBonus(c, st);
    return { match: true, marks, already: !ev.granted, reward: mergeEvents([ev, bonus]), bonus: !!bonus?.granted, me: studentView(c, st) };
  } },

  // 책 읽기 체크: 읽은 책과 오늘 읽은 쪽수 → 코인 5 · EXP 5 (하루 1회)
  'read/check': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const pages = int(c.body.pages, { name: '읽은 쪽수', min: 1, max: 2000 });
    const book = findBook(c, c.body.bookId);
    if (!book || (book.hidden && !st.shelf.includes(book.id))) fail(404, 'no_book', '책을 찾을 수 없어요.');
    const day = dayRecord(st, c.today);
    markSeen(st, c.today);
    if (day.read) return { already: true, reward: null, me: studentView(c, st) };
    day.read = { bookId: book.id, pages };
    const ev = grant(c.state, st, c, { key: `read:${c.today}`, rule: REWARDS.readCheck, note: '책 읽기 체크' });
    const bonus = maybeBonus(c, st);
    return { already: false, reward: mergeEvents([ev, bonus]), bonus: !!bonus?.granted, me: studentView(c, st) };
  } },

  // 친구 목록 (이름과 집 단계만)
  'friends/list': { auth: 'student', run: async (c) => ({
    friends: Object.values(c.state.students).filter((s) => s.id !== c.actor.sid)
      .map((s) => ({ id: s.id, nick: s.nick, stage: stageOf(s.exp).name, hasPick: !!s.pickId })),
  }) },

  // 친구 방 방문: 오늘 첫 방문이면 퀘스트 ③ 완료. 친구 집에는 '○○이 다녀감' 기록이 남는다.
  'friends/visit': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const friend = c.state.students[c.body.friendId];
    if (!friend || friend.id === st.id) fail(404, 'no_friend', '놀러 갈 친구를 찾을 수 없어요.');
    if (!friend.guestbook.some((g) => g.sid === st.id && g.date === c.today)) {
      friend.guestbook.push({ sid: st.id, nick: st.nick, date: c.today, at: c.nowMs });
      if (friend.guestbook.length > 50) friend.guestbook.splice(0, friend.guestbook.length - 50);
    }
    const day = dayRecord(st, c.today);
    const first = !day.visit;
    if (first) day.visit = friend.id;
    markVisit(st, c.today);
    const bonus = first ? maybeBonus(c, st) : null;
    return { first, reward: mergeEvents([bonus]), bonus: !!bonus?.granted, me: studentView(c, st) };
  } },

  // ── 교사: 오늘의 문장 관리 ──
  'teacher/sentences': { auth: 'teacher', run: async (c) => {
    const { pool, schedule } = c.state.sentences;
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(c.today, i);
      const s = sentenceFor(c.state, date);
      return { date, id: s.id, text: s.text, source: s.source, scheduled: !!schedule[date] };
    });
    return { today: c.today, pool, days };
  } },

  'teacher/sentence/add': { auth: 'teacher', write: true, run: async (c) => {
    const t = text(c.body.text, { name: '문장', min: 2, max: 200 });
    const source = c.body.source ? text(c.body.source, { name: '출처', min: 1, max: 60 }) : '선생님이 고른 문장';
    const { pool, schedule } = c.state.sentences;
    if (pool.length >= 200) fail(409, 'too_many', '문장이 너무 많아요. 안 쓰는 문장을 지워 주세요.');
    const s = { id: newId('sn-'), kind: 'teacher', source, text: t };
    pool.push(s);
    if (c.body.date) {
      if (!isDate(c.body.date)) fail(400, 'bad_input', '날짜는 YYYY-MM-DD 로 써 주세요.');
      schedule[c.body.date] = s.id;
    }
    return { sentence: s };
  } },

  'teacher/sentence/delete': { auth: 'teacher', write: true, run: async (c) => {
    const { pool, schedule } = c.state.sentences;
    if (pool.length <= 1) fail(409, 'last_one', '문장이 하나는 있어야 해요.');
    const i = pool.findIndex((s) => s.id === c.body.id);
    if (i < 0) fail(404, 'no_item', '문장을 찾을 수 없어요.');
    pool.splice(i, 1);
    for (const d of Object.keys(schedule)) if (schedule[d] === c.body.id) delete schedule[d];
    return {};
  } },

  // 날짜에 문장 지정 (id 가 null 이면 지정을 푼다)
  'teacher/sentence/schedule': { auth: 'teacher', write: true, run: async (c) => {
    if (!isDate(c.body.date)) fail(400, 'bad_input', '날짜는 YYYY-MM-DD 로 써 주세요.');
    const { pool, schedule } = c.state.sentences;
    if (c.body.id === null) delete schedule[c.body.date];
    else {
      if (!pool.some((s) => s.id === c.body.id)) fail(404, 'no_item', '문장을 찾을 수 없어요.');
      schedule[c.body.date] = c.body.id;
    }
    return {};
  } },
};
