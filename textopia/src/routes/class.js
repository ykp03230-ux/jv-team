// 반 만들기, 로그인(교사·학생), 내 정보, 교사 현황, 예시 데이터 다시 채우기
import { fail, text, nickKey, randomHex, isDate, isClassCode } from '../util.js';
import { sha256Hex, hashPin, hashPassword, safeEqual } from '../crypto.js';
import { DEFAULT_SENTENCES } from '../data/sentences.js';
import { MAX_STUDENTS } from '../data/rules.js';
import { blankStudent } from '../engine/core.js';
import { seedClass } from '../engine/seed.js';
import { studentView, villageView, teacherStudentRow } from '../engine/views.js';

const SESSION_MS = 14 * 24 * 3600 * 1000;

async function openSession(c, role, sid) {
  const { state } = c;
  const secret = randomHex(24);
  state.sessions[await sha256Hex(secret)] = { role, sid: sid || null, at: c.nowMs, exp: c.nowMs + SESSION_MS };
  // 만료된 로그인은 지우고, 학생 한 명당 최근 5개만 남긴다
  const mine = [];
  for (const [h, rec] of Object.entries(state.sessions)) {
    if (rec.exp < c.nowMs) delete state.sessions[h];
    else if (rec.role === role && rec.sid === (sid || null)) mine.push([h, rec.at]);
  }
  mine.sort((a, b) => b[1] - a[1]).slice(5).forEach(([h]) => delete state.sessions[h]);
  return `${state.meta.code}.${secret}`;
}

export const classRoutes = {
  // 교사가 반을 만든다. 반 코드는 서버가 정한다. 비밀번호는 해시로만 저장한다.
  'class/create': { auth: 'none', write: true, run: async (c) => {
    if (!isClassCode(c.body.code)) fail(400, 'bad_code', '반 코드는 영어 대문자와 숫자 4~10자로 정해 주세요.');
    if (c.state) fail(409, 'exists', '이미 있는 코드예요.');
    const password = text(c.body.password, { name: '비밀번호', min: 6, max: 100 });
    const name = c.body.name ? text(c.body.name, { name: '반 이름', min: 1, max: 30 }) : '우리 반';
    const salt = randomHex(16);
    const code = c.body.code;
    c.doc.init({
      meta: { code, name, createdAt: c.nowMs, teacher: { salt, hash: await hashPassword(password, salt, c.env) }, clock: null, museumOn: true },
      village: { exp: 0 },
      sessions: {},
      students: {},
      books: { added: {} },
      sentences: { pool: DEFAULT_SENTENCES.map((s) => ({ id: s.id, kind: s.kind, source: s.source, text: s.text })), schedule: {} },
      museum: { subs: {}, votes: {} },
      images: {},
    });
    c.state = c.doc.state;
    const token = await openSession(c, 'teacher', null);
    return { code, name, token };
  } },

  'teacher/login': { auth: 'none', write: true, run: async (c) => {
    if (!c.state) fail(404, 'no_class', '반을 찾을 수 없어요. 반 코드를 확인해 주세요.');
    const password = String(c.body.password ?? '');
    const t = c.state.meta.teacher;
    if (!safeEqual(await hashPassword(password, t.salt, c.env), t.hash)) fail(401, 'wrong_password', '비밀번호가 달라요.');
    return { code: c.state.meta.code, name: c.state.meta.name, token: await openSession(c, 'teacher', null) };
  } },

  // 학생 입장: 반 코드 + 닉네임 + 4자리 PIN. 처음 쓰는 닉네임이면 새로 만들어진다.
  'student/join': { auth: 'none', write: true, run: async (c) => {
    if (!c.state) fail(404, 'no_class', '반을 찾을 수 없어요. 반 코드를 확인해 주세요.');
    const nick = text(c.body.nick, { name: '닉네임', min: 1, max: 10 });
    const pin = String(c.body.pin ?? '');
    if (!/^\d{4}$/.test(pin)) fail(400, 'bad_pin', 'PIN은 숫자 4자리예요.');
    const key = nickKey(nick);
    let st = Object.values(c.state.students).find((s) => s.nickKey === key);
    let created = false;
    if (st) {
      if (!safeEqual(await hashPin(pin, st.pin.salt, c.env), st.pin.hash)) fail(401, 'wrong_pin', 'PIN이 달라요. 다시 확인해 주세요.');
    } else {
      if (Object.keys(c.state.students).length >= MAX_STUDENTS) fail(409, 'class_full', '이 반은 더 들어올 수 없어요.');
      const salt = randomHex(16);
      st = blankStudent({ id: 's' + randomHex(6), nick, pin: { salt, hash: await hashPin(pin, salt, c.env) }, createdAt: c.nowMs });
      c.state.students[st.id] = st;
      created = true;
    }
    return { token: await openSession(c, 'student', st.id), created, me: studentView(c, st) };
  } },

  'logout': { auth: 'any', write: true, run: async (c) => {
    const secret = (c.request.headers.get('authorization') || '').split('.')[1];
    delete c.state.sessions[await sha256Hex(secret)];
    return {};
  } },

  // 학생 본인 정보 (새로고침해도 로그인이 유지되는지 확인하는 곳)
  'me': { auth: 'student', run: async (c) => ({ me: studentView(c, c.state.students[c.actor.sid]) }) },

  'teacher/overview': { auth: 'teacher', run: async (c) => {
    const { state } = c;
    return {
      class: { code: state.meta.code, name: state.meta.name, museumOn: state.meta.museumOn, clock: state.meta.clock, today: c.today, month: c.month },
      village: villageView(state),
      students: Object.values(state.students).map(teacherStudentRow),
    };
  } },

  // 예시 데이터 다시 채우기
  'teacher/seed': { auth: 'teacher', write: true, run: async (c) => {
    c.doc.clearImages();
    const summary = await seedClass(c.state, {
      nowMs: c.nowMs, today: kstToday(c), month: kstToday(c).slice(0, 7), env: c.env, baseBooks: c.baseBooks,
      randomSalt: () => randomHex(16),
      hashPin: (pin, salt) => hashPin(pin, salt, c.env),
    });
    return { summary };
  } },

  // 자정 테스트용 날짜 바꾸기 (교사 화면에만 있다). null 이면 실제 한국 시간으로 돌아간다.
  'teacher/clock': { auth: 'teacher', write: true, run: async (c) => {
    const d = c.body.date;
    if (d !== null && !isDate(d)) fail(400, 'bad_input', '날짜는 YYYY-MM-DD 로 써 주세요.');
    c.state.meta.clock = d;
    return { clock: d };
  } },
};

// 예시 데이터는 시험용 날짜가 아니라 실제 한국 시간의 오늘을 기준으로 채운다
function kstToday(c) {
  return new Date(c.nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
