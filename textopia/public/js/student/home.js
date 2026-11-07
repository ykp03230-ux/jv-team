// 홈: 내 상태와 오늘의 퀘스트 3개
import { h, once, fmt } from '../ui.js';
import { S, call, go, toastReward } from './core.js';
import { houseCard } from './house.js';

export async function renderHome(el) {
  const me = S.me;
  const q = me.quests;
  const cap = Math.min(100, (me.todayCoins / me.coinCap) * 100);

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
    h('div', { class: 'row between' },
      h('h2', { id: 'who' }, `${me.nick}의 마을`),
      h('span', { class: 'pill' }, me.stage.name)),
    houseCard(me),
    h('button', { class: 'btn ghost block', id: 'go-shop', style: 'margin-top:8px', onclick: () => go('shop') }, '🏮 장터 가기'),
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
    recordCard(),
  );
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (date) => `${date.slice(5, 7)}/${date.slice(8, 10)}(${WEEKDAY[new Date(date + 'T00:00:00Z').getUTCDay()]})`;

/** 나의 출석·퀘스트 기록: 최근 14일, 내 것만 보인다 */
function recordCard() {
  const box = h('div', { class: 'card stack', style: 'margin-top:12px', id: 'my-record' },
    h('h3', {}, '나의 출석·퀘스트 기록'), h('p', { class: 'muted' }, '불러오는 중…'));
  call('daily/me', { days: 14 }).then((r) => {
    const mark = (on) => h('td', { class: on ? 'yes' : 'no', 'aria-label': on ? '했어요' : '안 했어요' }, on ? '✔' : '–');
    const attended = r.days.filter((d) => d.seen).length;
    box.replaceChildren(
      h('div', { class: 'row between' }, h('h3', {}, '나의 출석·퀘스트 기록'), h('span', { class: 'pill', id: 'record-attend' }, `최근 14일 출석 ${attended}일`)),
      h('div', { class: 'table-scroll' }, h('table', { class: 'daily-table', id: 'record-table' },
        h('thead', {}, h('tr', {}, ['날짜', '출석', '①필사', '②읽기', '③방문', '보너스'].map((x) => h('th', {}, x)))),
        h('tbody', {}, r.days.map((d) => h('tr', { class: d.date === r.today ? 'today' : '', 'data-date': d.date },
          h('td', {}, dayLabel(d.date) + (d.date === r.today ? ' 오늘' : '')), mark(d.seen), mark(d.sentence), mark(d.read), mark(d.visit), mark(d.bonus)))))),
    );
  }).catch((e) => box.replaceChildren(h('h3', {}, '나의 출석·퀘스트 기록'), h('p', { class: 'error' }, e.message)));
  return box;
}

function quest(done, title, sub, action) {
  return h('div', { class: 'quest' },
    h('span', { class: 'check' + (done ? ' on' : '') }, done ? '✔' : '○'),
    h('div', { class: 'grow' }, h('strong', {}, title), h('div', { class: 'muted' }, sub)),
    action);
}
