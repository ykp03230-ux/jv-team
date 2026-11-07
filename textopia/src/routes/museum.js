// 박물관: 작품 내기, 전시 on/off, 월말 투표(1인 3표, 내 작품 제외), 정산(상위 3개 '이달의 작품' + 보너스 코인 50)
import { fail, newId } from '../util.js';
import { REWARDS } from '../data/rules.js';
import { grant, actorStudent } from '../engine/core.js';
import { findBook } from '../engine/books.js';
import { buildSnap, newSub, MUSEUM_KINDS } from '../engine/museum.js';
import { studentView } from '../engine/views.js';

const VOTES_EACH = 3;
const TOP_N = 3;

const round = (state, month) => state.museum.votes[month] || null;
const voteStatus = (state, month) => round(state, month)?.status || 'none';
const visibleSubs = (state) => Object.values(state.museum.subs).filter((s) => !s.hidden && state.students[s.sid]);

/** 학생은 전시가 켜져 있을 때만 박물관에 들어갈 수 있다 */
function requireOpen(c) {
  if (!c.state.meta.museumOn) fail(403, 'museum_closed', '박물관이 준비 중이에요.');
}

/** 유효한 내 투표 (숨겨진 작품에 던진 표는 세지 않는다) */
function myBallot(c, month, sid) {
  const r = round(c.state, month);
  const ids = r?.ballots[sid] || [];
  return ids.filter((id) => c.state.museum.subs[id] && !c.state.museum.subs[id].hidden);
}

function snapView(c, snap) {
  return { ...snap, bookTitle: snap.bookId ? findBook(c, snap.bookId)?.title || '' : '' };
}

function subView(c, sub, sid) {
  const r = round(c.state, sub.month);
  const finished = r?.status === 'finished';
  const best = finished && r.result.includes(sub.id);
  return {
    id: sub.id, kind: sub.kind, month: sub.month, at: sub.at,
    nick: c.state.students[sub.sid]?.nick || '(알 수 없음)',
    mine: sub.sid === sid,
    snap: snapView(c, sub.snap),
    best,
    votes: best ? r.tally[sub.id] || 0 : null,         // 결과가 공개된 뒤, 이달의 작품에만 득표수를 보여 준다
    voted: !!sid && myBallot(c, sub.month, sid).includes(sub.id),
    votable: sub.sid !== sid && voteStatus(c.state, sub.month) === 'open',
  };
}

function statusFor(c, st) {
  const { state } = c;
  const month = c.month;
  const ballot = myBallot(c, month, st.id);
  return {
    on: true, month,
    vote: voteStatus(state, month),
    votesLeft: Math.max(0, VOTES_EACH - ballot.length),
    myVotes: ballot,
    submittedThisMonth: visibleSubs(state).some((s) => s.sid === st.id && s.month === month),
  };
}

/** 이달 한 번도 내지 않은 학생 (숨겨진 작품만 있으면 낸 것으로 보지 않는다) */
function missingThisMonth(c) {
  const done = new Set(visibleSubs(c.state).filter((s) => s.month === c.month).map((s) => s.sid));
  return Object.values(c.state.students).filter((s) => !done.has(s.id)).map((s) => ({ id: s.id, nick: s.nick }));
}

export const museumRoutes = {
  // 입구: 꺼져 있으면 '준비 중'만 알려 준다
  'museum/status': { auth: 'student', run: async (c) => {
    if (!c.state.meta.museumOn) return { status: { on: false } };
    return { status: statusFor(c, actorStudent(c)) };
  } },

  'museum/list': { auth: 'student', run: async (c) => {
    requireOpen(c);
    const st = actorStudent(c);
    const subs = visibleSubs(c.state).sort((a, b) => b.at - a.at).slice(0, 300);
    return { status: statusFor(c, st), subs: subs.map((s) => subView(c, s, st.id)) };
  } },

  // 작품 내기: 내 전시 아이템(책갈피·그림 독서록·책 표지) · 문장 카드 · 질문
  'museum/submit': { auth: 'student', write: true, run: async (c) => {
    requireOpen(c);
    const st = actorStudent(c);
    const { kind, refId } = c.body;
    if (!MUSEUM_KINDS.includes(kind)) fail(400, 'bad_input', '낼 수 없는 종류예요.');
    if (Object.values(c.state.museum.subs).some((s) => s.sid === st.id && s.kind === kind && s.refId === refId)) {
      fail(409, 'already', '이미 박물관에 낸 작품이에요.');
    }
    const mine = Object.values(c.state.museum.subs).filter((s) => s.sid === st.id).length;
    if (mine >= 300) fail(409, 'too_many', '더 낼 수 없어요.');
    const sub = newSub({ id: newId('sub-'), sid: st.id, kind, refId, month: c.month, at: c.nowMs, snap: buildSnap(st, kind, refId) });
    c.state.museum.subs[sub.id] = sub;
    return { sub: subView(c, sub, st.id), status: statusFor(c, st), me: studentView(c, st) };
  } },

  // 투표: 투표가 열려 있을 때만, 1인 3표, 내 작품에는 투표할 수 없다
  'museum/vote': { auth: 'student', write: true, run: async (c) => {
    requireOpen(c);
    const st = actorStudent(c);
    const sub = c.state.museum.subs[c.body.subId];
    if (!sub || sub.hidden || !c.state.students[sub.sid]) fail(404, 'no_sub', '작품을 찾을 수 없어요.');
    const r = round(c.state, sub.month);
    if (r?.status !== 'open') fail(409, 'vote_closed', '지금은 투표 기간이 아니에요.');
    if (sub.sid === st.id) fail(403, 'own', '내 작품에는 투표할 수 없어요.');
    const ballot = myBallot(c, sub.month, st.id);
    if (ballot.includes(sub.id)) fail(409, 'dup', '이미 투표한 작품이에요.');
    if (ballot.length >= VOTES_EACH) fail(409, 'no_votes_left', `투표는 ${VOTES_EACH}번까지 할 수 있어요.`);
    r.ballots[st.id] = [...ballot, sub.id];
    return { status: statusFor(c, st) };
  } },

  // 투표 취소 (투표가 열려 있는 동안)
  'museum/unvote': { auth: 'student', write: true, run: async (c) => {
    requireOpen(c);
    const st = actorStudent(c);
    const sub = c.state.museum.subs[c.body.subId];
    if (!sub) fail(404, 'no_sub', '작품을 찾을 수 없어요.');
    const r = round(c.state, sub.month);
    if (r?.status !== 'open') fail(409, 'vote_closed', '지금은 투표 기간이 아니에요.');
    r.ballots[st.id] = myBallot(c, sub.month, st.id).filter((id) => id !== sub.id);
    return { status: statusFor(c, st) };
  } },

  // ── 교사 ──
  'teacher/museum': { auth: 'teacher', run: async (c) => {
    const { state } = c;
    const r = round(state, c.month);
    const subs = Object.values(state.museum.subs).sort((a, b) => b.at - a.at).map((s) => ({
      ...subView(c, s, null), hidden: s.hidden, sid: s.sid,
      tally: r?.status === 'finished' && s.month === c.month ? r.tally[s.id] || 0 : null,
    }));
    return {
      on: state.meta.museumOn, month: c.month,
      vote: { status: voteStatus(state, c.month), voters: r ? Object.keys(r.ballots).filter((sid) => myBallot(c, c.month, sid).length).length : 0, result: r?.status === 'finished' ? r.result : [] },
      subs,
      missing: missingThisMonth(c),
    };
  } },

  'teacher/museum/toggle': { auth: 'teacher', write: true, run: async (c) => {
    c.state.meta.museumOn = c.body.on === true;
    return { on: c.state.meta.museumOn };
  } },

  'teacher/sub/hide': { auth: 'teacher', write: true, run: async (c) => {
    const sub = c.state.museum.subs[c.body.id];
    if (!sub) fail(404, 'no_sub', '작품을 찾을 수 없어요.');
    sub.hidden = c.body.hidden !== false;
    return { hidden: sub.hidden };
  } },

  'teacher/vote/open': { auth: 'teacher', write: true, run: async (c) => {
    const cur = voteStatus(c.state, c.month);
    if (cur === 'open') fail(409, 'already_open', '이미 투표가 열려 있어요.');
    if (cur === 'finished') fail(409, 'already_finished', '이달 투표는 이미 마감했어요.');
    if (!visibleSubs(c.state).some((s) => s.month === c.month)) fail(409, 'no_subs', '이달에 낸 작품이 없어요.');
    c.state.museum.votes[c.month] = { status: 'open', openedAt: c.nowMs, closedAt: null, ballots: {}, result: [], tally: {}, awarded: [] };
    return { vote: 'open' };
  } },

  // 마감: 결과 공개. 상위 3개 작품에 '이달의 작품' 표시와 보너스 코인(작가마다 월 1회, 하루 코인 상한과 별개)
  'teacher/vote/close': { auth: 'teacher', write: true, run: async (c) => {
    const r = round(c.state, c.month);
    if (!r || r.status !== 'open') fail(409, 'not_open', '열려 있는 투표가 없어요.');
    const tally = {};
    for (const sid of Object.keys(r.ballots)) for (const id of myBallot(c, c.month, sid)) tally[id] = (tally[id] || 0) + 1;
    const ranked = visibleSubs(c.state).filter((s) => s.month === c.month && tally[s.id] > 0)
      .sort((a, b) => tally[b.id] - tally[a.id] || a.at - b.at); // 같은 표면 먼저 낸 작품이 앞
    const top = ranked.slice(0, TOP_N);
    r.status = 'finished'; r.closedAt = c.nowMs; r.tally = tally; r.result = top.map((s) => s.id);
    const awarded = [];
    for (const s of top) {
      const st = c.state.students[s.sid];
      const ev = grant(c.state, st, c, { key: `best:${c.month}`, rule: REWARDS.monthlyBest, capExempt: true, note: '이달의 작품' });
      if (ev.granted) { awarded.push(st.id); r.awarded.push(st.id); }
    }
    return { result: top.map((s) => ({ id: s.id, nick: c.state.students[s.sid].nick, votes: tally[s.id] })), awarded: awarded.length };
  } },
};
