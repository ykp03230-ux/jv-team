// 예시 데이터 다시 채우기: 기존 학생·작품·추가 도서를 지우고 시연용 반을 새로 채운다.
// 같은 id 로 다시 채우므로 몇 번을 눌러도 중복되지 않는다.
// 반 코드와 교사 비밀번호·교사 로그인은 그대로 둔다.
import { DEFAULT_SENTENCES, WEEK_ORDER } from '../data/sentences.js';
import { SHOP_ITEMS } from '../data/rules.js';
import { addDays } from '../util.js';
import { blankStudent } from './core.js';

export const DEMO_NICK = '시연';
export const DEMO_PIN = '0000';
export const SEED_VILLAGE_EXP = 290;

// 닉네임, 개인 EXP, 코인, 등록한 책, 모은 문장(DEFAULT_SENTENCES id)
// 집 단계가 고르게 나오도록: 부지 4 · 움집 6 · 초가집 5(+시연) · 기와집 4
const VIRTUAL = [
  ['달토끼',    0,   0, [],                  []],
  ['호랑이',   20,  15, ['b02', 'u-seed1'],  []],
  ['솔바람',   35,  30, ['b12'],             ['sn06']],
  ['다람쥐',   45,  25, ['b21'],             ['sn12']],
  ['구름이',   55,  40, ['b12'],             ['sn07']],
  ['새벽',     70,  55, ['b11'],             ['sn02']],
  ['청개구리', 85,  20, ['b01', 'u-seed2'],  []],
  ['도토리',  100,  65, ['b21'],             ['sn10', 'sn13']],
  ['반딧불',  120,  35, ['b13'],             ['sn08']],
  ['무지개',  140,  80, ['b15'],             ['sn15']],
  ['소나기',  155,  45, ['b11'],             ['sn01', 'sn03']],
  ['은행잎',  180,  90, ['b21', 'b03'],      ['sn11']],
  ['해바라기', 210, 30, ['b16'],             ['sn17']],
  ['몽실이',  240,  75, ['b13', 'b12'],      ['sn09', 'sn06']],
  ['보리',    270,  55, ['b21'],             ['sn14']],
  ['감자',    300,  60, ['b11', 'b15'],      ['sn04', 'sn16']],
  ['포도알',  320,  95, ['b12', 'b13'],      ['sn07', 'sn08']],
  ['꼬마별',  350,  70, ['b11'],             ['sn05', 'sn02']],
  ['나비',    400, 100, ['b21', 'b16'],      ['sn12', 'sn17']],
];

const REASONS = ['마음에 오래 남아서', '읽으면 힘이 나서', '나도 이렇게 살고 싶어서', '소리 내어 읽으니 좋아서', '친구에게 들려주고 싶어서'];
const QUESTIONS = {
  b11: '별을 바라보며 시인은 어떤 마음이었을까?',
  b12: '꽃이 혼자 피어 있다는 말은 어떤 뜻일까?',
  b13: '님을 보내지 않았다는 말은 무슨 뜻일까?',
  b21: '내가 싫은 일을 남에게 하지 않는 것은 왜 어려울까?',
  b15: '착한 마음을 놓치지 않으려면 어떻게 해야 할까?',
  b16: '부모님께 고마운 마음을 어떻게 전할 수 있을까?',
};
const DEFAULT_QUESTION = '이 책에서 가장 기억에 남는 장면은 무엇이고, 왜일까?';

// 상점 아이템을 가진 학생 (장터가 열리기 전의 시연용 데이터)
const OWNED = {
  '포도알': { owned: ['gat'], equipped: { hat: 'gat' } },
  '나비': { owned: ['hb-pink', 'lantern'], equipped: { outfit: 'hb-pink', props: ['lantern'] } },
  '꼬마별': { owned: ['daenggi'], equipped: { hair: 'daenggi' } },
};

const sentenceById = Object.fromEntries(DEFAULT_SENTENCES.map((s) => [s.id, s]));

/** state 를 시연용 데이터로 바꾼다. ctx: { nowMs, today, month, env, baseBooks, hashPin, randomSalt } */
export async function seedClass(state, ctx) {
  const { nowMs, today } = ctx;
  const DAY = 86400000;

  // 지우기: 학생, 학생 로그인, 이미지, 학생이 추가한 책, 시험용 날짜 (예전 박물관 자료가 남아 있으면 함께 지운다)
  const teacherSessions = {};
  for (const [h, rec] of Object.entries(state.sessions)) if (rec.role === 'teacher') teacherSessions[h] = rec;
  state.sessions = teacherSessions;
  state.students = {};
  state.images = {};
  delete state.museum;
  delete state.meta.museumOn;
  state.village = { exp: 290 };
  state.meta.clock = null;

  // 오늘의 문장: 기본 목록 + 오늘부터 7일치 일정
  state.sentences = { pool: DEFAULT_SENTENCES.map((s) => ({ id: s.id, kind: s.kind, source: s.source, text: s.text })), schedule: {} };
  WEEK_ORDER.forEach((id, i) => { state.sentences.schedule[addDays(today, i)] = id; });

  // 학생이 추가한 책 2권(가상)
  const nickToId = {};
  const vids = VIRTUAL.map((_, i) => 'v' + String(i + 1).padStart(2, '0'));
  VIRTUAL.forEach(([nick], i) => { nickToId[nick] = vids[i]; });
  state.books = {
    added: {
      'u-seed1': { id: 'u-seed1', title: '양반전', author: '박지원', category: '한국 고전 소설·설화',
        addedBy: nickToId['호랑이'], addedByNick: '호랑이', date: today, at: nowMs, hidden: false },
      'u-seed2': { id: 'u-seed2', title: '동몽선습', author: '박세무', category: '한국 인문·역사',
        addedBy: nickToId['청개구리'], addedByNick: '청개구리', date: today, at: nowMs, hidden: false },
    },
  };

  const bookTitle = Object.fromEntries(ctx.baseBooks.map((b) => [b.id, b.title]));
  for (const b of Object.values(state.books.added)) bookTitle[b.id] = b.title;

  const makePin = async () => {
    const salt = ctx.randomSalt();
    return { salt, hash: await ctx.hashPin(DEMO_PIN, salt) };
  };

  // 가상 학생 19명
  for (let i = 0; i < VIRTUAL.length; i++) {
    const [nick, exp, coins, books, sents] = VIRTUAL[i];
    const id = vids[i];
    const st = blankStudent({ id, nick, pin: await makePin(), createdAt: nowMs - (30 - i) * DAY, virtual: true });
    st.exp = exp; st.coins = coins; st.shelf = [...books];
    sents.forEach((sid, n) => {
      const src = sentenceById[sid];
      st.sentences.push({ id: `${id}-s${n + 1}`, bookId: src.book, text: src.text, page: 8 + i + n * 5, reason: REASONS[(i + n) % REASONS.length], at: nowMs - (20 - i) * DAY });
      st.claims[`act:${src.book}:sentence`] = 1;
    });
    // 읽음 인증: 초가집 이상은 첫 책, 기와집은 둘째 책까지 승인된 상태
    const certCount = exp >= 300 ? 2 : exp >= 150 ? 1 : 0;
    books.slice(0, certCount).forEach((bid, n) => {
      st.certs[bid] = { status: 'approved', sentence: sentenceById[sents[n]]?.text || '', page: 10 + n * 7, feeling: '읽고 나니 마음이 따뜻해졌다.', reason: '', at: nowMs - 12 * DAY, decidedAt: nowMs - 11 * DAY };
      st.claims[`cert:${bid}`] = 1;
    });
    // 질문
    if (exp >= 120 && books.length) {
      const bid = books[0];
      st.questions.push({ id: `${id}-q1`, bookId: bid, text: QUESTIONS[bid] || DEFAULT_QUESTION, at: nowMs - 9 * DAY });
      st.claims[`act:${bid}:question`] = 1;
    }
    // 책갈피
    if (exp >= 100 && st.sentences.length) {
      const s0 = st.sentences[0];
      st.works.push({ id: `${id}-w1`, type: 'bookmark', bookId: s0.bookId, sentenceId: s0.id, text: s0.text, template: ['t1', 't2', 't3'][i % 3], at: nowMs - 8 * DAY });
      st.claims[`act:${s0.bookId}:bookmark`] = 1;
    }
    // 집: 움집 이상이면 전시 칸 채우기, pick 문장
    if (st.sentences.length) st.pickId = st.sentences[0].id;
    if (exp >= 50) {
      if (st.sentences.length) st.slots[0] = { kind: 'sentence', id: st.sentences[0].id };
      if (st.works.length) st.slots[1] = { kind: 'work', id: st.works[0].id };
    }
    const own = OWNED[nick];
    if (own) { st.owned = own.owned; Object.assign(st.equipped, own.equipped); }
    // 최근 7일 출석·퀘스트 기록 (교사의 일자별 현황을 보여 주기 위한 시연용, 날마다 조금씩 다르게)
    for (let d = 1; d <= 7; d++) {
      const date = addDays(today, -d);
      const sentence = (i + d) % 3 !== 0;
      const read = (i * 2 + d) % 4 !== 0;
      const visit = (i + d) % 5 === 0;
      if (!((i + d) % 7 !== 0 || sentence || read || visit)) continue; // 그날 입장하지 않음
      st.daily[date] = visit ? { seen: true, visit: true } : { seen: true };
      if (sentence) st.claims[`sentence:${date}`] = 1;
      if (read) st.claims[`read:${date}`] = 1;
      if (sentence && read && visit) st.claims[`bonus:${date}`] = 1;
    }
    state.students[id] = st;
  }

  // 시연용 학생: EXP 295(초가집) · 코인 40 · 읽음 인증 1권 · 모은 문장 2개
  const demo = blankStudent({ id: 'demo', nick: DEMO_NICK, pin: await makePin(), createdAt: nowMs - 2 * DAY, virtual: false });
  demo.exp = 295; demo.coins = 40;
  demo.shelf = ['b11'];
  demo.certs['b11'] = { status: 'approved', sentence: sentenceById.sn01.text, page: 4, feeling: '부끄럼 없이 살고 싶다는 마음이 느껴졌다.', reason: '', at: nowMs - 3 * DAY, decidedAt: nowMs - 2 * DAY };
  demo.claims['cert:b11'] = 1;
  demo.sentences.push(
    { id: 'demo-s1', bookId: 'b11', text: sentenceById.sn01.text, page: 4, reason: '읽을 때마다 마음이 곧게 서서', at: nowMs - 3 * DAY },
    { id: 'demo-s2', bookId: 'b11', text: sentenceById.sn03.text, page: 5, reason: '내 길을 스스로 걷겠다는 다짐이 멋져서', at: nowMs - 3 * DAY },
  );
  demo.claims['act:b11:sentence'] = 1;
  demo.pickId = 'demo-s1';
  demo.slots[0] = { kind: 'sentence', id: 'demo-s1' };
  // 시연 계정의 지난 3일: 어제는 필사+읽기, 그제는 필사, 3일 전은 입장만 (오늘은 시연 장면에서 직접 한다)
  demo.daily[addDays(today, -1)] = { seen: true }; demo.claims[`sentence:${addDays(today, -1)}`] = 1; demo.claims[`read:${addDays(today, -1)}`] = 1;
  demo.daily[addDays(today, -2)] = { seen: true }; demo.claims[`sentence:${addDays(today, -2)}`] = 1;
  demo.daily[addDays(today, -3)] = { seen: true };
  state.students[demo.id] = demo;

  return summarize(state);
}

export function summarize(state) {
  const students = Object.values(state.students);
  return {
    students: students.length,
    scheduleDays: Object.keys(state.sentences.schedule).length,
    addedBooks: Object.keys(state.books.added).length,
    villageExp: state.village.exp,
  };
}

export const SHOP_IDS = SHOP_ITEMS.map((i) => i.id);
