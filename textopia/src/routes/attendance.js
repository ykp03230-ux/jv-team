// 일자별 퀘스트·출석 현황: 학생은 자기 것만, 교사는 학생 전체.
import { int } from '../util.js';
import { actorStudent } from '../engine/core.js';
import { dayStatus, recentDates } from '../engine/daily.js';

const count = (s) => [s.sentence, s.read, s.visit].filter(Boolean).length; // 퀘스트 3개 중 한 개수

export const attendanceRoutes = {
  // 내 기록: 오늘부터 거꾸로 며칠 (기본 14일, 최대 60일). 다른 학생 것은 보내지 않는다.
  'daily/me': { auth: 'student', run: async (c) => {
    const st = actorStudent(c);
    const n = c.body.days == null ? 14 : int(c.body.days, { name: '일수', min: 1, max: 60 });
    return { today: c.today, days: recentDates(c.today, n).map((date) => { const s = dayStatus(st, date); return { date, ...s, quests: count(s) }; }) };
  } },

  // 교사: 학생 전체 × 날짜. dates 는 오래된 날부터 오늘까지.
  'teacher/daily': { auth: 'teacher', run: async (c) => {
    const n = c.body.days == null ? 14 : int(c.body.days, { name: '일수', min: 1, max: 60 });
    const dates = recentDates(c.today, n).reverse();
    const students = Object.values(c.state.students).sort((a, b) => a.createdAt - b.createdAt || a.nick.localeCompare(b.nick, 'ko'));
    const rows = students.map((st) => {
      const days = {};
      for (const d of dates) { const s = dayStatus(st, d); days[d] = { ...s, quests: count(s) }; }
      return { id: st.id, nick: st.nick, days };
    });
    const totals = dates.map((d) => {
      const t = { date: d, students: rows.length, seen: 0, sentence: 0, read: 0, visit: 0, bonus: 0 };
      for (const r of rows) { const s = r.days[d]; for (const k of ['seen', 'sentence', 'read', 'visit', 'bonus']) if (s[k]) t[k]++; }
      return t;
    });
    return { today: c.today, dates, rows, totals };
  } },
};
