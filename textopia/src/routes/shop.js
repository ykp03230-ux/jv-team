// 장터(외형 상점)와 친구 방. 장터는 마을 EXP 300 이 되어야 열린다.
import { fail, text } from '../util.js';
import { SHOP_ITEMS, MARKET_UNLOCK_EXP, DEFAULT_OUTFIT, REWARDS } from '../data/rules.js';
import { grant, mergeEvents, actorStudent, stageOf } from '../engine/core.js';
import { normalize, diffMarks } from '../engine/text.js';
import { resolveRef, sentenceView } from '../engine/library.js';
import { studentView } from '../engine/views.js';

const itemOf = (id) => SHOP_ITEMS.find((i) => i.id === id);
const isOn = (st, item) => (item.slot === 'prop' ? st.equipped.props.includes(item.id) : st.equipped[item.slot] === item.id);

function shopView(c, st) {
  const open = c.state.village.exp >= MARKET_UNLOCK_EXP;
  return {
    open, need: MARKET_UNLOCK_EXP, villageExp: c.state.village.exp,
    items: SHOP_ITEMS.map((i) => ({ ...i, owned: st.owned.includes(i.id), on: st.owned.includes(i.id) && isOn(st, i) })),
  };
}

function setEquipped(st, item, on) {
  if (item.slot === 'prop') {
    const set = new Set(st.equipped.props);
    if (on) set.add(item.id); else set.delete(item.id);
    st.equipped.props = SHOP_ITEMS.filter((i) => i.slot === 'prop' && set.has(i.id)).map((i) => i.id);
  } else if (item.slot === 'outfit') {
    st.equipped.outfit = on ? item.id : DEFAULT_OUTFIT;
  } else {
    st.equipped[item.slot] = on ? item.id : null;
  }
}

export const shopRoutes = {
  'shop/list': { auth: 'student', run: async (c) => ({ shop: shopView(c, actorStudent(c)), me: studentView(c, actorStudent(c)) }) },

  // 사기: 장터가 열려 있고, 아직 없는 아이템이며, 코인이 충분할 때만. 산 아이템은 바로 착용한다.
  'shop/buy': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const item = itemOf(c.body.itemId);
    if (!item) fail(404, 'no_item', '없는 아이템이에요.');
    if (c.state.village.exp < MARKET_UNLOCK_EXP) fail(403, 'market_closed', `장터는 마을 EXP ${MARKET_UNLOCK_EXP} 이 되면 열려요.`);
    if (st.owned.includes(item.id)) fail(409, 'owned', '이미 가지고 있어요.');
    if (st.coins < item.price) fail(409, 'no_coins', `코인이 모자라요. (${item.price}코인이 필요해요)`);
    st.coins -= item.price;
    st.owned.push(item.id);
    setEquipped(st, item, true);
    return { shop: shopView(c, st), me: studentView(c, st) };
  } },

  'shop/equip': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const item = itemOf(c.body.itemId);
    if (!item || !st.owned.includes(item.id)) fail(404, 'not_owned', '가지고 있는 아이템만 입을 수 있어요.');
    setEquipped(st, item, c.body.on !== false);
    return { shop: shopView(c, st), me: studentView(c, st) };
  } },

  // ── 친구 방: 보기만 한다 (친구 것은 고칠 수 없다) ──
  'friends/house': { auth: 'student', run: async (c) => {
    const me = actorStudent(c);
    const f = c.state.students[c.body.friendId];
    if (!f || f.id === me.id) fail(404, 'no_friend', '친구를 찾을 수 없어요.');
    const pick = f.pickId ? f.sentences.find((s) => s.id === f.pickId) : null;
    return {
      friend: { id: f.id, nick: f.nick, stage: { key: stageOf(f.exp).key, name: stageOf(f.exp).name }, equipped: f.equipped },
      slots: f.slots.map((ref) => resolveRef(c, f, ref)),
      pick: pick ? sentenceView(c, pick) : null,
      guestbook: f.guestbook.slice(-10).reverse().map((g) => ({ nick: g.nick, date: g.date })),
      copiesLeft: Math.max(0, REWARDS.friendPick.limit - (me.claims[`friend:${c.today}`] || 0)),
    };
  } },

  // 친구의 pick 문장을 따라 쓰면 코인 5 · EXP 5 (하루 3회)
  'friends/copy': { auth: 'student', write: true, run: async (c) => {
    const me = actorStudent(c);
    const f = c.state.students[c.body.friendId];
    if (!f || f.id === me.id) fail(404, 'no_friend', '친구를 찾을 수 없어요.');
    const pick = f.pickId ? f.sentences.find((s) => s.id === f.pickId) : null;
    if (!pick) fail(409, 'no_pick', '이 친구는 아직 pick 문장을 걸지 않았어요.');
    const typed = text(c.body.text, { name: '따라 쓴 문장', min: 1, max: 400 });
    const want = normalize(pick.text);
    const got = normalize(typed);
    const marks = diffMarks(want, got);
    const left = () => Math.max(0, REWARDS.friendPick.limit - (me.claims[`friend:${c.today}`] || 0));
    if (want !== got) return { match: false, marks, reward: null, copiesLeft: left(), me: studentView(c, me) };
    const ev = grant(c.state, me, c, { key: `friend:${c.today}`, rule: REWARDS.friendPick, note: '친구 pick 문장 필사' });
    return { match: true, marks, already: !ev.granted, reward: mergeEvents([ev]), copiesLeft: left(), me: studentView(c, me) };
  } },
};
