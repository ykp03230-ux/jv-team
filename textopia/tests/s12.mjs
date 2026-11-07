import { call, newClass, seed, student } from './lib.mjs';
import { addDays } from '../src/util.js';

export const num = 12;
export const title = '(추가) 10단계 장터 상점 · 친구 방 · pick 문장 필사';
export const method = '장터 잠금/해금(마을 EXP 300), 코인 차감·중복 구매 차단(동시 5번), 착용/벗기, 친구 pick 필사 하루 3회(동시 10개에도 3번), 친구 방은 보기만';

export async function run(t) {
  // ── 장터: 마을 EXP 300 이 되어야 열린다 ──
  const A = await newClass(); await seed(A);
  const demo = await student(A.code, '시연', '0000');
  const lock = await call('shop/list', {}, demo.token);
  t.check('마을 EXP 290 이면 장터는 잠겨 있다(open=false, 필요 300)', lock.ok && lock.shop.open === false && lock.shop.need === 300 && lock.shop.villageExp === 290, JSON.stringify(lock.shop?.open));
  t.eq('아이템은 12개', lock.shop.items.length, 12);
  const early = await call('shop/buy', { itemId: 'gat' }, demo.token);
  t.check('잠겨 있으면 살 수 없다(403)', early.status === 403 && early.error === 'market_closed', JSON.stringify(early));
  const unlock = await call('sentence/submit', { text: demo.me.sentence.text }, demo.token); // 시연 +10 → 마을 300, 코인 50
  t.check('시연이 오늘의 문장을 쓰면 마을 EXP 300 → 장터 해금, 코인 50', unlock.reward.unlocked.includes('장터') && unlock.me.coins === 50, JSON.stringify(unlock.reward));
  t.eq('이제 장터가 열려 있다', (await call('shop/list', {}, demo.token)).shop.open, true);

  // ── 갓 사기 ──
  t.eq('없는 아이템은 404', (await call('shop/buy', { itemId: 'nope' }, demo.token)).status, 404);
  const gat = await call('shop/buy', { itemId: 'gat' }, demo.token);
  t.check('갓(40코인)을 사면 코인 50→10, 바로 착용', gat.ok && gat.me.coins === 10 && gat.me.equipped.hat === 'gat' && gat.me.owned.includes('gat'), JSON.stringify(gat.me));
  const houses = (await call('village/get', {}, demo.token)).houses;
  t.eq('마을 화면 자료에서도 시연의 캐릭터가 갓을 쓴다', houses.find((h) => h.nick === '시연').equipped.hat, 'gat');
  t.eq('같은 아이템을 또 사면 409', (await call('shop/buy', { itemId: 'gat' }, demo.token)).status, 409);
  const poor = await call('shop/buy', { itemId: 'screen' }, demo.token);
  t.check('코인이 모자라면 409, 코인 그대로', poor.status === 409 && poor.error === 'no_coins' && (await call('me', {}, demo.token)).me.coins === 10, JSON.stringify(poor));

  // ── 동시에 5번 눌러도 한 번만 사고 한 번만 차감 ──
  const rich = await student(A.code, '부자', '1111');
  // 코인 만들기: 하루 한도(100) 안에서 책 활동으로 모은다
  for (const b of ['b01', 'b02', 'b03', 'b04']) await call('books/register', { bookId: b }, rich.token);
  await call('sentence/submit', { text: rich.me.sentence.text }, rich.token);
  for (const b of ['b01', 'b02', 'b03', 'b04']) {
    await call('activity/submit', { bookId: b, type: 'sentence', text: `${b} 문장`, page: 1, reason: '그냥' }, rich.token);
    await call('activity/submit', { bookId: b, type: 'question', text: `${b} 질문` }, rich.token);
  }
  const before = (await call('me', {}, rich.token)).me;
  t.eq('(준비) 부자의 코인은 100', before.coins, 100);
  const burst = await Promise.all(Array.from({ length: 5 }, () => call('shop/buy', { itemId: 'lantern' }, rich.token)));
  const afterBuy = (await call('me', {}, rich.token)).me;
  t.eq('동시 5번 구매 중 성공은 1번', burst.filter((r) => r.ok).length, 1);
  t.check('코인은 20만 차감(100→80)', afterBuy.coins === 80 && afterBuy.owned.filter((x) => x === 'lantern').length === 1, `${afterBuy.coins} ${afterBuy.owned}`);

  // ── 착용 ──
  const hb = await call('shop/buy', { itemId: 'hb-pink' }, rich.token);
  t.check('분홍 한복을 사면 한복 색이 바뀐다', hb.me.equipped.outfit === 'hb-pink', JSON.stringify(hb.me.equipped));
  const off = await call('shop/equip', { itemId: 'hb-pink', on: false }, rich.token);
  t.eq('벗으면 기본 흰 한복', off.me.equipped.outfit, 'hb-white');
  const on = await call('shop/equip', { itemId: 'hb-pink', on: true }, rich.token);
  t.eq('다시 입기', on.me.equipped.outfit, 'hb-pink');
  t.eq('없는 아이템은 입을 수 없다(404)', (await call('shop/equip', { itemId: 'fan', on: true }, rich.token)).status, 404);
  const prop = await call('shop/equip', { itemId: 'lantern', on: false }, rich.token);
  t.eq('집 소품(등불)도 켜고 끌 수 있다', prop.me.equipped.props, []);
  t.eq('학생이 아닌 교사 토큰은 살 수 없다(403)', (await call('shop/buy', { itemId: 'fan' }, A.teacher)).status, 403);

  // ── 친구 방 ──
  const room = await call('friends/house', { friendId: 'demo' }, rich.token);
  t.check('친구 방: 닉네임·집 단계·외형·전시 칸·pick 문장이 보인다', room.ok && room.friend.nick === '시연' && room.friend.stage.key === 'tile' && room.friend.equipped.hat === 'gat' && room.slots.length === 6 && room.pick?.text, JSON.stringify(room).slice(0, 200));
  t.check('친구 방에서는 코인·EXP·인증 같은 개인 기록은 보이지 않는다', !/"(coins|exp|certs|claims|pin)"/.test(JSON.stringify(room)), '');
  t.eq('나 자신의 방은 친구 방이 아니다(404)', (await call('friends/house', { friendId: rich.id }, rich.token)).status, 404);
  t.eq('없는 친구는 404', (await call('friends/house', { friendId: 'nope' }, rich.token)).status, 404);
  const visit = await call('friends/visit', { friendId: 'demo' }, rich.token);
  const room2 = await call('friends/house', { friendId: 'demo' }, rich.token);
  t.check('방문하면 친구 집에 "○○이 다녀감" 기록이 남는다(같은 날 중복 없음)', visit.ok && room2.guestbook.filter((g) => g.nick === '부자').length === 1, JSON.stringify(room2.guestbook));
  await call('friends/visit', { friendId: 'demo' }, rich.token);
  t.eq('같은 날 또 가도 기록은 한 줄', (await call('friends/house', { friendId: 'demo' }, rich.token)).guestbook.filter((g) => g.nick === '부자').length, 1);

  // ── 친구 pick 문장 필사: 하루 3회 ──
  const pickText = room.pick.text;
  const c1 = await student(A.code, '필사1', '2222');
  const wrongTxt = await call('friends/copy', { friendId: 'demo', text: pickText.slice(1) + '뷁' }, c1.token);
  t.check('틀리게 쓰면 틀린 글자 표시, 보상 없음', wrongTxt.ok && wrongTxt.match === false && wrongTxt.marks.some((m) => m.s !== 'ok') && wrongTxt.me.coins === 0, JSON.stringify(wrongTxt).slice(0, 160));
  const r1 = await call('friends/copy', { friendId: 'demo', text: pickText }, c1.token);
  t.check('맞게 쓰면 코인 +5 · EXP +5', r1.match && r1.reward.coins === 5 && r1.reward.exp === 5 && r1.me.coins === 5 && r1.copiesLeft === 2, JSON.stringify(r1.reward));
  await call('friends/copy', { friendId: 'demo', text: pickText }, c1.token);
  await call('friends/copy', { friendId: 'demo', text: pickText }, c1.token);
  const r4 = await call('friends/copy', { friendId: 'demo', text: pickText }, c1.token);
  t.check('하루 4번째는 보상 없음(3회 한도): 코인 15 그대로', r4.match && r4.already === true && r4.me.coins === 15 && r4.me.exp === 15 && r4.copiesLeft === 0, `${r4.me.coins}/${r4.me.exp}`);
  t.eq('나 자신의 pick 은 따라 쓸 수 없다(404)', (await call('friends/copy', { friendId: c1.id, text: pickText }, c1.token)).status, 404);
  const noPick = await call('friends/copy', { friendId: 'v01', text: '아무거나' }, c1.token);
  t.check('pick 문장이 없는 친구는 409', noPick.status === 409 && noPick.error === 'no_pick', JSON.stringify(noPick));

  // 동시 10개
  const c2 = await student(A.code, '필사2', '3333');
  const burst2 = await Promise.all(Array.from({ length: 10 }, () => call('friends/copy', { friendId: 'demo', text: pickText }, c2.token)));
  const fin = (await call('me', {}, c2.token)).me;
  t.eq('동시 10개 중 보상은 3번', burst2.filter((r) => r.ok && r.match && !r.already).length, 3);
  t.check('동시 요청 뒤 코인 15 · EXP 15', fin.coins === 15 && fin.exp === 15, `${fin.coins}/${fin.exp}`);

  // 다음 날에는 다시 3회
  const today = (await call('teacher/overview', {}, A.teacher)).class.today;
  await call('teacher/clock', { date: addDays(today, 1) }, A.teacher);
  const next = await call('friends/copy', { friendId: 'demo', text: pickText }, c2.token);
  t.check('날짜가 바뀌면 친구 pick 필사도 다시 보상(+5)', next.match && !next.already && next.reward.coins === 5 && next.copiesLeft === 2, JSON.stringify(next.reward));
  await call('teacher/clock', { date: null }, A.teacher);

  // 친구 pick 을 바꾸면 새 문장을 따라 써야 한다
  await call('pick/set', { id: 'demo-s2' }, demo.token);
  const stale = await call('friends/copy', { friendId: 'demo', text: pickText }, (await student(A.code, '필사3', '4444')).token);
  t.check('친구가 pick 을 바꾸면 예전 문장은 틀린 글이 된다', stale.ok && stale.match === false, JSON.stringify(stale).slice(0, 120));

  // 반 분리: 다른 반 친구 id 는 보이지 않는다
  const B = await newClass(); await seed(B);
  const bs = await student(B.code, '다른반', '5555');
  const sameId = await call('friends/house', { friendId: 'demo' }, bs.token);
  t.check('다른 반에는 같은 id 가 있어도 그 반의 시연만 보인다(자기 반 자료)', sameId.ok && sameId.friend.equipped.hat === null, JSON.stringify(sameId.friend?.equipped));
}
