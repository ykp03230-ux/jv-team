// 친구 마을: 친구 목록 → 친구 방(보기만) → 친구의 pick 문장을 따라 쓰면 보상
import { h, once, toast } from '../ui.js';
import { houseSVG } from '../art.js';
import { S, call, go, toastReward } from './core.js';
import { itemEl } from './items.js';
import { zoomable } from './zoom.js';

export async function renderFriends(el, friendId) {
  if (friendId) return renderRoom(el, friendId);
  el.replaceChildren(h('h2', {}, '친구 마을'), h('p', { class: 'muted' }, '불러오는 중…'));
  const { friends } = await call('friends/list');
  el.replaceChildren(
    h('h2', {}, '친구 마을'),
    h('p', { class: 'muted' }, S.me.quests.visit ? '오늘 친구 집에 다녀왔어요.' : '친구 집에 놀러 가면 오늘의 퀘스트 ③이 완료돼요.'),
    h('div', { class: 'stack', id: 'friend-list' }, friends.length === 0
      ? h('p', { class: 'muted' }, '아직 다른 친구가 없어요.')
      : friends.map((f) => h('div', { class: 'card row between' },
        h('div', {}, h('strong', {}, f.nick), h('div', { class: 'muted' }, `${f.stage}${f.hasPick ? ' · 📌 pick 문장 있음' : ''}`)),
        h('button', { class: 'btn small', 'data-friend': f.id, onclick: () => go('friends/' + f.id) }, '놀러 가기')))),
  );
}

async function renderRoom(el, friendId) {
  el.replaceChildren(h('p', { class: 'muted' }, '친구 집으로 가는 중…'));
  // 방문: 오늘 첫 방문이면 퀘스트 ③ 완료, 친구 집에는 '○○이 다녀감'이 남는다
  const visit = await call('friends/visit', { friendId });
  toastReward(visit.reward, visit.bonus);
  const room = await call('friends/house', { friendId });
  const f = room.friend;
  let left = room.copiesLeft;

  const input = h('textarea', { id: 'copy-typed', rows: '3', placeholder: '위 문장을 보고 그대로 따라 써 보세요', autocomplete: 'off', spellcheck: 'false' });
  input.addEventListener('paste', (ev) => ev.preventDefault());
  const result = h('div', { class: 'stack', id: 'copy-result', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn block', id: 'copy-submit' }, '다 썼어요');
  const leftEl = h('p', { class: 'muted', id: 'copies-left' }, `오늘 친구 문장 따라 쓰기 보상: ${left}번 남았어요 (하루 3번)`);
  btn.addEventListener('click', () => once(btn, async () => {
    result.replaceChildren();
    try {
      const r = await call('friends/copy', { friendId, text: input.value });
      left = r.copiesLeft;
      leftEl.textContent = `오늘 친구 문장 따라 쓰기 보상: ${left}번 남았어요 (하루 3번)`;
      if (!r.match) {
        result.replaceChildren(h('p', { class: 'error' }, '조금 달라요. 빨간 글자를 확인하고 다시 써 보세요.'),
          h('div', { class: 'marks', id: 'copy-marks' }, r.marks.map((m) => h('span', { class: 'm-' + m.s }, m.s === 'miss' ? '▢' : m.c))));
        return;
      }
      if (r.already) result.replaceChildren(h('p', { class: 'ok', id: 'copy-already' }, '맞게 썼어요! 오늘 받을 수 있는 보상은 모두 받았어요.'));
      else { toastReward(r.reward); result.replaceChildren(h('p', { class: 'ok', id: 'copy-success' }, `잘했어요! 코인 +${r.reward.coins}, EXP +${r.reward.exp}`)); }
    } catch (e) { result.replaceChildren(h('p', { class: 'error' }, e.message)); }
  }));

  const pickBox = room.pick
    ? h('div', { class: 'stack' },
      h('div', { class: 'card ink sentence', id: 'friend-pick' }, h('div', { class: 'muted' }, `📌 ${f.nick}의 pick 문장`), h('p', { class: 'sentence-text' }, room.pick.text),
        h('p', { class: 'muted' }, `《${room.pick.bookTitle}》 ${room.pick.page}쪽`)),
      leftEl, input, btn, result)
    : h('p', { class: 'muted', id: 'no-pick' }, `${f.nick}은(는) 아직 pick 문장을 걸어 두지 않았어요.`);

  const shown = room.slots.filter(Boolean);
  el.replaceChildren(
    h('button', { class: 'btn ghost small', onclick: () => go('friends') }, '← 친구 목록'),
    h('h2', { id: 'room-title', style: 'margin-top:8px' }, `${f.nick}의 집`),
    h('div', { class: 'card house-card' }, h('div', { class: 'scene', html: houseSVG(f.stage.key, f.equipped) }), h('strong', {}, f.stage.name)),
    pickBox,
    h('h3', { style: 'margin-top:16px' }, '전시 칸'),
    shown.length ? h('div', { class: 'slots', id: 'friend-slots' }, room.slots.map((item) => {
      const slot = h('div', { class: 'slot' + (item ? ' filled' : '') }, item ? itemEl(item, { mini: true }) : h('span', { class: 'plus' }, '·'));
      return item ? zoomable(slot, item) : slot; // 걸린 작품은 누르면 크게 보인다
    })) : h('p', { class: 'muted' }, '아직 전시한 것이 없어요.'),
    shown.length ? h('p', { class: 'muted' }, '작품을 누르면 크게 볼 수 있어요.') : null,
    room.guestbook.length ? h('div', { class: 'card', id: 'friend-guestbook' }, h('h3', {}, '다녀간 친구'), room.guestbook.map((g) => h('p', { class: 'muted' }, `${g.nick}이(가) 다녀감 · ${g.date}`))) : null,
  );
}
