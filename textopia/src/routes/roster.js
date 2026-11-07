// 교사가 학생 계정을 직접 만든다. 만든 계정의 PIN 은 모두 0000 이다.
import { fail, text, nickKey, randomHex } from '../util.js';
import { hashPin } from '../crypto.js';
import { DEFAULT_PIN, MAX_STUDENTS } from '../data/rules.js';
import { blankStudent } from '../engine/core.js';

const MAX_PER_CALL = 60;

export const rosterRoutes = {
  // 닉네임을 한 줄에 한 명씩(또는 쉼표로) 적으면 학생 계정이 만들어진다.
  // 이미 있는 닉네임·너무 긴 닉네임은 건너뛰고, 왜 건너뛰었는지 알려 준다.
  'teacher/students/add': { auth: 'teacher', write: true, run: async (c) => {
    let list = c.body.nicks;
    if (typeof list === 'string') list = list.split(/\r?\n|,/);
    if (!Array.isArray(list)) fail(400, 'bad_input', '닉네임을 한 줄에 한 명씩 써 주세요.');
    list = list.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    if (!list.length) fail(400, 'bad_input', '닉네임을 한 줄에 한 명씩 써 주세요.');
    if (list.length > MAX_PER_CALL) fail(400, 'too_many', `한 번에 ${MAX_PER_CALL}명까지 추가할 수 있어요.`);

    const keys = new Set(Object.values(c.state.students).map((s) => s.nickKey));
    const added = [];
    const skipped = [];
    for (const raw of list) {
      let nick;
      try { nick = text(raw, { name: '닉네임', min: 1, max: 10 }); }
      catch { skipped.push({ nick: raw.slice(0, 20), reason: '닉네임은 1~10자로 써 주세요.' }); continue; }
      const key = nickKey(nick);
      if (keys.has(key)) { skipped.push({ nick, reason: '이미 있는 닉네임이에요.' }); continue; }
      if (Object.keys(c.state.students).length >= MAX_STUDENTS) { skipped.push({ nick, reason: '반 인원이 가득 찼어요.' }); continue; }
      const salt = randomHex(16);
      const st = blankStudent({ id: 's' + randomHex(6), nick, pin: { salt, hash: await hashPin(DEFAULT_PIN, salt, c.env) }, createdAt: c.nowMs });
      c.state.students[st.id] = st;
      keys.add(key);
      added.push(nick);
    }
    return { added, skipped, total: Object.keys(c.state.students).length };
  } },

  // 모든 학생의 PIN 을 0000 으로 맞춘다 (PIN 통일)
  'teacher/students/reset-pin': { auth: 'teacher', write: true, run: async (c) => {
    let count = 0;
    for (const st of Object.values(c.state.students)) {
      const salt = randomHex(16);
      st.pin = { salt, hash: await hashPin(DEFAULT_PIN, salt, c.env) };
      count++;
    }
    return { count };
  } },
};
