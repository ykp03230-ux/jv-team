// 화면에 보내는 모양 만들기. 비밀번호·PIN 해시·로그인 토큰은 절대 포함하지 않는다.
import { stageOf, buildingsFor } from './core.js';
import { DAILY_COIN_CAP } from '../data/rules.js';
import { sentenceFor, questsView } from './daily.js';

export function villageView(state) {
  const exp = state.village.exp;
  const buildings = buildingsFor(exp);
  const next = buildings.find((b) => !b.unlocked) || null;
  return { exp, buildings, next: next ? { name: next.name, at: next.at } : null };
}

/** 학생 본인에게 보내는 '내 정보' */
export function studentView(c, st) {
  const { state } = c;
  const s = sentenceFor(state, c.today);
  const quests = questsView(c, st);
  return {
    id: st.id,
    nick: st.nick,
    coins: st.coins,
    exp: st.exp,
    stage: stageOf(st.exp),
    todayCoins: st.dayCoins[c.today] || 0,
    coinCap: DAILY_COIN_CAP,
    class: { code: state.meta.code, name: state.meta.name },
    today: c.today,
    sentence: { id: s.id, text: s.text, source: s.source, done: quests.sentence },
    quests,
    equipped: st.equipped,
    owned: st.owned,
    friendCopies: st.claims[`friend:${c.today}`] || 0,
    village: villageView(state),
  };
}

export function teacherStudentRow(st) {
  return { id: st.id, nick: st.nick, exp: st.exp, coins: st.coins, stage: stageOf(st.exp).name, virtual: !!st.virtual };
}
