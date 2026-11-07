// 마을 화면(TV)용 자료: 마을 EXP, 건물 해금, 학생 집. 개인 순위·개인 EXP 는 보내지 않는다.
import { stageOf } from '../engine/core.js';
import { villageView } from '../engine/views.js';
import { resolveRef, sentenceView } from '../engine/library.js';
import { fail } from '../util.js';

export const villageRoutes = {
  // 마을 화면에서 학생 집을 눌렀을 때: 집 모습·전시 칸·pick 문장을 '보기만' 한다.
  // 기록(방문 기록, 퀘스트, 코인)은 아무것도 바뀌지 않고(write 아님), 코인·EXP 같은 개인 기록도 보내지 않는다.
  'village/house': { auth: 'any', run: async (c) => {
    const id = typeof c.body.studentId === 'string' ? c.body.studentId : '';
    // __proto__ 같은 이름이 학생으로 잡히지 않게, 이 반 학생 목록에 실제로 있는 id 만 쓴다
    const s = Object.hasOwn(c.state.students, id) ? c.state.students[id] : null;
    if (!s) fail(404, 'no_student', '그 학생의 집을 찾을 수 없어요.');
    const st = stageOf(s.exp);
    const pick = s.pickId ? s.sentences.find((x) => x.id === s.pickId) : null;
    return {
      house: { id: s.id, nick: s.nick, stage: { key: st.key, name: st.name }, equipped: s.equipped },
      slots: s.slots.map((ref) => resolveRef(c, s, ref)),
      pick: pick ? sentenceView(c, pick) : null,
    };
  } },

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
