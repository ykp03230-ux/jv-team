// 마을 화면(TV)용 자료: 마을 EXP, 건물 해금, 학생 집. 개인 순위·개인 EXP 는 보내지 않는다.
import { stageOf } from '../engine/core.js';
import { villageView } from '../engine/views.js';

export const villageRoutes = {
  'village/get': { auth: 'any', run: async (c) => {
    const { state } = c;
    // 입장한 순서대로(이름순이나 점수순이 아니다) — 순위처럼 보이지 않게
    const students = Object.values(state.students).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return {
      class: { name: state.meta.name, code: state.meta.code },
      village: villageView(state),
      houses: students.map((s) => {
        const st = stageOf(s.exp);
        return { id: s.id, nick: s.nick, stage: { key: st.key, name: st.name }, equipped: s.equipped };
      }),
      today: c.today,
    };
  } },
};
