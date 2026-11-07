// 핵심 규칙: 집 단계, 마을 건물, 학생 기본 틀, 보상 지급.
// 이 파일의 함수는 반 상태(state)를 직접 바꾼다. 요청은 반마다 한 줄로 처리되므로(classroom.js)
// 여기서 '횟수 확인 → 지급'을 한 번에 하면 새로고침·두 번 누르기·동시 요청에도 중복 지급이 없다.
import { STAGES, BUILDINGS, REWARDS, DAILY_COIN_CAP, SLOT_COUNT, DEFAULT_OUTFIT } from '../data/rules.js';
import { nickKey } from '../util.js';

/** 요청한 학생 본인 */
export const actorStudent = (c) => c.state.students[c.actor.sid];

// ── 집 단계 ───────────────────────────────────────────────
export function stageOf(exp) {
  let idx = 0;
  STAGES.forEach((s, i) => { if (exp >= s.at) idx = i; });
  const cur = STAGES[idx];
  const next = STAGES[idx + 1] || null;
  return { index: idx, key: cur.key, name: cur.name, at: cur.at, next: next ? { name: next.name, at: next.at } : null };
}

// ── 마을 건물 ─────────────────────────────────────────────
export const buildingsFor = (villageExp) =>
  BUILDINGS.map((b) => ({ ...b, unlocked: villageExp >= b.at }));
export const unlockedIds = (villageExp) => BUILDINGS.filter((b) => villageExp >= b.at).map((b) => b.id);

// ── 학생 기본 틀 ──────────────────────────────────────────
export function blankStudent({ id, nick, pin, createdAt, virtual = false }) {
  return {
    id, nick, nickKey: nickKey(nick), pin, createdAt, virtual,
    exp: 0, coins: 0,
    claims: {},            // 보상 key → 받은 횟수
    dayCoins: {},          // 날짜 → 그날 받은 코인
    days: {},              // 날짜 → { read:{bookId,pages}, visit:친구id }
    daily: {},             // 날짜 → { seen:출석, visit:친구 방문 } (일자별 출석 현황용)
    ledger: [],            // 최근 보상 기록
    shelf: [],             // 등록한 책 id
    certs: {},             // 책 id → 읽음 인증
    sentences: [],         // 모은 문장
    questions: [],         // 만든 질문
    works: [],             // 책갈피·그림 독서록·책 표지
    slots: Array(SLOT_COUNT).fill(null),
    pickId: null,
    owned: [],
    equipped: { hat: null, hair: null, outfit: DEFAULT_OUTFIT, acc: null, props: [] },
    guestbook: [],         // "○○이 다녀감"
  };
}

// ── 보상 지급 ─────────────────────────────────────────────
/**
 * key 로 받은 횟수가 rule.limit 에 닿았으면 아무것도 주지 않는다.
 * 하루 코인은 DAILY_COIN_CAP 까지(capExempt 면 제외). EXP 는 상한이 없다.
 * 반환: { granted, coins, exp, capped, stageUp, unlocked }
 */
export function grant(state, st, ctx, { key, rule, capExempt = false, note = '' }) {
  const used = st.claims[key] || 0;
  if (used >= rule.limit) return { granted: false, coins: 0, exp: 0, capped: false, stageUp: null, unlocked: [] };
  st.claims[key] = used + 1;

  let coins = rule.coins;
  let capped = false;
  if (!capExempt) {
    const have = st.dayCoins[ctx.today] || 0;
    coins = Math.max(0, Math.min(rule.coins, DAILY_COIN_CAP - have));
    capped = coins < rule.coins;
    if (coins > 0) st.dayCoins[ctx.today] = have + coins;
    // 오래된 날짜는 지운다
    const dates = Object.keys(st.dayCoins).sort();
    while (dates.length > 8) delete st.dayCoins[dates.shift()];
  }

  const stageBefore = stageOf(st.exp);
  const villageBefore = state.village.exp;
  st.coins += coins;
  st.exp += rule.exp;
  state.village.exp += rule.exp;

  const stageAfter = stageOf(st.exp);
  const stageUp = stageAfter.index > stageBefore.index ? { from: stageBefore.name, to: stageAfter.name } : null;
  const before = new Set(unlockedIds(villageBefore));
  const unlocked = BUILDINGS.filter((b) => state.village.exp >= b.at && !before.has(b.id)).map((b) => b.name);

  st.ledger.push({ at: ctx.nowMs, date: ctx.today, key, coins, exp: rule.exp, note });
  if (st.ledger.length > 40) st.ledger.splice(0, st.ledger.length - 40);
  return { granted: true, coins, exp: rule.exp, capped, stageUp, unlocked };
}

// 여러 번의 지급 결과를 하나로 합친다 (화면 알림용)
export function mergeEvents(list) {
  const out = { coins: 0, exp: 0, capped: false, stageUp: null, unlocked: [], granted: false };
  for (const e of list) {
    if (!e) continue;
    out.coins += e.coins; out.exp += e.exp; out.capped ||= e.capped; out.granted ||= e.granted;
    if (e.stageUp) out.stageUp = e.stageUp;
    out.unlocked.push(...e.unlocked);
  }
  return out;
}

export { REWARDS };
