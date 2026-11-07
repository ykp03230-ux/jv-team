// 서당: 오늘의 문장을 보고 따라 타이핑
import { h, once } from '../ui.js';
import { S, call, toastReward } from './core.js';

export async function renderDang(el) {
  const me = S.me;
  const s = me.sentence;

  const input = h('textarea', { id: 'typed', rows: '3', placeholder: '위 문장을 보고 그대로 따라 써 보세요', autocomplete: 'off', spellcheck: 'false', 'aria-label': '따라 쓰기' });
  input.addEventListener('paste', (ev) => ev.preventDefault()); // 붙여넣기 대신 직접 타이핑
  const result = h('div', { id: 'result', class: 'stack', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn block', id: 'submit-sentence' }, '다 썼어요');

  btn.addEventListener('click', () => once(btn, async () => {
    result.replaceChildren();
    try {
      const r = await call('sentence/submit', { text: input.value });
      if (!r.match) {
        result.replaceChildren(
          h('p', { class: 'error' }, '조금 달라요. 빨간 글자를 확인하고 다시 써 보세요.'),
          h('div', { class: 'marks', id: 'marks' }, r.marks.map((m) => h('span', { class: 'm-' + m.s }, m.s === 'miss' ? '▢' : m.c))),
          h('p', { class: 'muted' }, '밑줄 친 글자는 틀린 글자, ▢는 빠뜨린 글자예요.'),
        );
        return;
      }
      if (r.already) {
        result.replaceChildren(h('p', { class: 'ok', id: 'already' }, '맞게 썼어요! 오늘 보상은 이미 받았어요.'));
      } else {
        toastReward(r.reward, r.bonus);
        result.replaceChildren(h('p', { class: 'ok', id: 'success' }, `잘했어요! 코인 +${r.reward.coins}, EXP +${r.reward.exp}`));
      }
    } catch (e) { result.replaceChildren(h('p', { class: 'error' }, e.message)); }
  }));

  el.replaceChildren(
    h('h2', {}, '서당 · 오늘의 문장'),
    h('p', { class: 'muted' }, s.done ? '오늘의 필사를 마쳤어요. 다시 써 봐도 좋아요.' : '문장을 보고 따라 써요. 띄어쓰기는 맞추고, 문장부호는 신경 쓰지 않아도 돼요.'),
    h('div', { class: 'card ink sentence', id: 'today-sentence' }, h('p', { class: 'sentence-text' }, s.text), h('p', { class: 'muted' }, s.source)),
    h('div', { class: 'stack', style: 'margin-top:12px' }, input, btn, result),
  );
}
