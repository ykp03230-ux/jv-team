// 내 집(나만의 서재): 전시 칸 걸기, pick 문장, 서재 도감
import { fail, int } from '../util.js';
import { SLOT_COUNT } from '../data/rules.js';
import { actorStudent } from '../engine/core.js';
import { libraryView } from '../engine/library.js';
import { studentView } from '../engine/views.js';

export const houseRoutes = {
  'library/get': { auth: 'student', run: async (c) => {
    const st = actorStudent(c);
    return { library: libraryView(c, st), me: studentView(c, st) };
  } },

  // 전시 칸에 걸기 (눌러서 선택). id 가 null 이면 비운다. 내 작품·내 문장만 걸 수 있다.
  'slot/set': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const index = int(c.body.index, { name: '칸', min: 0, max: SLOT_COUNT - 1 });
    if (c.body.id === null) {
      st.slots[index] = null;
    } else {
      const kind = c.body.kind;
      const list = kind === 'work' ? st.works : kind === 'sentence' ? st.sentences : null;
      if (!list) fail(400, 'bad_input', '걸 수 없는 종류예요.');
      if (!list.some((x) => x.id === c.body.id)) fail(404, 'no_item', '내 작품이나 문장만 걸 수 있어요.');
      st.slots = st.slots.map((s) => (s && s.kind === kind && s.id === c.body.id ? null : s)); // 같은 것은 한 칸에만
      st.slots[index] = { kind, id: c.body.id };
    }
    return { library: libraryView(c, st), me: studentView(c, st) };
  } },

  // 집 앞에 거는 pick 문장 (내가 모은 문장 중 하나). id 가 null 이면 내린다.
  'pick/set': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    if (c.body.id === null) st.pickId = null;
    else {
      if (!st.sentences.some((s) => s.id === c.body.id)) fail(404, 'no_item', '내가 모은 문장만 걸 수 있어요.');
      st.pickId = c.body.id;
    }
    return { library: libraryView(c, st), me: studentView(c, st) };
  } },
};
