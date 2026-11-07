// 홈: 책집으로 표현하는 독서마을과 오늘의 독서 활동
import { h, once, fmt } from '../ui.js';
import { S, call, go, toastReward } from './core.js';
import { loadReadingVillage } from './reading-village.js';

export async function renderHome(el) {
  const me = S.me;
  const q = me.quests;
  const cap = Math.min(100, (me.todayCoins / me.coinCap) * 100);
  const village = h('section', { id: 'reading-village', 'aria-label': '나의 독서마을' });

  // ② 책 읽기 체크 (읽은 책 + 오늘 읽은 쪽)
  const readBox = h('div', { class: 'stack' });
  if (q.read) {
    readBox.append(h('p', { class: 'muted' }, '오늘 읽은 기록을 남겼어요.'));
  } else {
    const sel = h('select', { id: 'read-book', 'aria-label': '읽은 책' }, h('option', { value: '' }, '읽은 책을 골라요'));
    const pages = h('input', { id: 'read-pages', type: 'number', inputmode: 'numeric', min: '1', max: '2000', placeholder: '오늘 읽은 쪽수' });
    const btn = h('button', { class: 'btn', id: 'read-go' }, '읽었어요');
    const err = h('div', { class: 'error', role: 'alert' });
    call('books/list').then((r) => r.books.forEach((b) => sel.append(h('option', { value: b.id }, `${b.title} (${b.author})`)))).catch(() => {});
    btn.addEventListener('click', () => once(btn, async () => {
      err.textContent = '';
      if (!sel.value) { err.textContent = '읽은 책을 골라 주세요.'; return; }
      try {
        const r = await call('read/check', { bookId: sel.value, pages: pages.value });
        toastReward(r.reward, r.bonus);
        renderHome(el);
      } catch (e) { err.textContent = e.message; }
    }));
    readBox.append(sel, h('div', { class: 'row' }, h('div', { class: 'grow' }, pages), btn), err);
  }

  el.replaceChildren(
    h('header', { class: 'rv-heading' },
      h('div', {}, h('p', { class: 'rv-eyebrow' }, 'TEXTOPIA · 나의 취향이 자라는 곳'),
        h('h2', { id: 'who' }, `${me.nick}의 독서마을`),
        h('p', { class: 'rv-subtitle' }, '책 한 권은 작은 집이 되고, 좋아한 문장은 풍경이 돼요.')),
      h('button', { class: 'btn ghost small', onclick: () => go('friends') }, '친구의 서재 구경하기 →')),
    village,
    h('details', { class: 'rv-activities' }, h('summary', {}, '오늘의 독서 활동과 성장 기록'),
    h('div', { class: 'card stats', style: 'margin-top:12px' },
      h('div', {}, h('div', { class: 'num', id: 'coins' }, fmt(me.coins)), h('div', { class: 'lab' }, '코인')),
      h('div', {}, h('div', { class: 'num', id: 'exp' }, fmt(me.exp)), h('div', { class: 'lab' }, 'EXP')),
      h('div', {}, h('div', { class: 'num', id: 'stage' }, me.stage.name), h('div', { class: 'lab' }, '내 집'))),
    h('div', { class: 'card stack', style: 'margin-top:12px', id: 'quests' },
      h('div', { class: 'row between' }, h('h3', {}, '오늘의 퀘스트'), h('span', { class: 'pill accent', id: 'quest-count' }, `${q.count} / 3`)),
      quest(q.sentence, '① 오늘의 문장 필사', q.sentence ? '완료!' : '서당에서 문장을 따라 써요', q.sentence ? null : h('button', { class: 'btn small', onclick: () => go('dang') }, '서당 가기')),
      h('div', { class: 'quest' }, h('span', { class: 'check' + (q.read ? ' on' : '') }, q.read ? '✔' : '○'),
        h('div', { class: 'grow' }, h('strong', {}, '② 책 읽기 체크'), readBox)),
      quest(q.visit, '③ 친구 방 방문 1회', q.visit ? '완료!' : '친구 집에 놀러 가요', q.visit ? null : h('button', { class: 'btn small', onclick: () => go('friends') }, '놀러 가기')),
      h('p', { class: q.bonus ? 'muted' : 'muted' }, q.bonus ? '3개를 모두 마쳐서 보너스 20코인을 받았어요!' : '3개를 모두 하면 보너스 20코인!'),
    ),
    h('div', { class: 'card stack', style: 'margin-top:12px' },
      h('div', { class: 'row between' }, h('strong', {}, '오늘 받은 코인'), h('span', { id: 'today-coins' }, `${me.todayCoins} / ${me.coinCap}`)),
      h('div', { class: 'bar' }, h('i', { style: `width:${cap}%` })),
    ),
    h('button', { class: 'btn ghost block', id: 'go-shop', style: 'margin-top:12px', onclick: () => go('shop') }, '장터 가기')),
  );
  loadReadingVillage(village);
}

function quest(done, title, sub, action) {
  return h('div', { class: 'quest' },
    h('span', { class: 'check' + (done ? ' on' : '') }, done ? '✔' : '○'),
    h('div', { class: 'grow' }, h('strong', {}, title), h('div', { class: 'muted' }, sub)),
    action);
}
