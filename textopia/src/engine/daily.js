// 매일 할 일: 오늘의 문장, 퀘스트 3개, 퀘스트 보너스
import { dayNumber } from '../util.js';
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

/** 오래된 날짜 기록은 지운다 */
export function dayRecord(st, today) {
  const dates = Object.keys(st.days).sort();
  while (dates.length > 8) delete st.days[dates.shift()];
  return (st.days[today] ||= {});
}
