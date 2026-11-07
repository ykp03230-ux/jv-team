// 매일 할 일: 오늘의 문장, 퀘스트 3개, 퀘스트 보너스
import { dayNumber, addDays } from '../util.js';
import { REWARDS } from '../data/rules.js';
import { grant } from './core.js';

/** 날짜에 맞는 문장. 일정에 없으면 목록을 날짜 순서대로 돌려 쓴다. */
export function sentenceFor(state, date) {
  const { pool, schedule } = state.sentences;
  const scheduled = schedule[date] && pool.find((s) => s.id === schedule[date]);
  if (scheduled) return scheduled;
  const n = pool.length;
  return pool[((dayNumber(date) % n) + n) % n];
}

export const claimedToday = (st, c, kind) => (st.claims[`${kind}:${c.today}`] || 0) >= 1;

export function questsView(c, st) {
  const day = st.days[c.today] || {};
  const sentence = claimedToday(st, c, 'sentence');
  const read = day.read || null;
  const visit = day.visit || null;
  return {
    sentence,
    read: !!read, readInfo: read,
    visit: !!visit,
    bonus: claimedToday(st, c, 'bonus'),
    count: [sentence, !!read, !!visit].filter(Boolean).length,
  };
}

/** 퀘스트 3개를 모두 마쳤으면 보너스(하루 1회). 아직이면 null. */
export function maybeBonus(c, st) {
  const q = questsView(c, st);
  if (q.count < 3) return null;
  return grant(c.state, st, c, { key: `bonus:${c.today}`, rule: REWARDS.questBonus, note: '퀘스트 3개 완료 보너스' });
}

// ── 일자별 퀘스트·출석 기록 ──────────────────────────────
// 필사·읽기·보너스는 이미 날짜가 붙은 보상 기록(claims)에서 읽고, 출석과 친구 방문만 st.daily 에 따로 남긴다.
const KEEP_DAYS = 120;

function dailyRec(st, date) {
  const d = (st.daily ||= {});
  const rec = (d[date] ||= {});
  const dates = Object.keys(d).sort();
  while (dates.length > KEEP_DAYS) delete d[dates.shift()];
  return rec;
}
/** 그날 입장했거나 퀘스트를 했으면 출석 */
export const markSeen = (st, date) => { dailyRec(st, date).seen = true; };
export const markVisit = (st, date) => { const r = dailyRec(st, date); r.seen = true; r.visit = true; };

/** 한 날짜의 퀘스트·출석 상태 */
export function dayStatus(st, date) {
  const claim = (k) => (st.claims[`${k}:${date}`] || 0) >= 1;
  const rec = (st.daily && st.daily[date]) || {};
  const sentence = claim('sentence');
  const read = claim('read') || !!(st.days[date] && st.days[date].read);
  const visit = !!rec.visit || !!(st.days[date] && st.days[date].visit);
  const bonus = claim('bonus');
  const seen = !!rec.seen || sentence || read || visit || bonus || claim('friend');
  return { seen, sentence, read, visit, bonus };
}

/** 오늘부터 거꾸로 n 일 (오늘이 맨 앞) */
export function recentDates(today, n) {
  return Array.from({ length: n }, (_, i) => addDays(today, -i));
}

/** 오래된 날짜 기록은 지운다 */
export function dayRecord(st, today) {
  const dates = Object.keys(st.days).sort();
  while (dates.length > 8) delete st.days[dates.shift()];
  return (st.days[today] ||= {});
}
