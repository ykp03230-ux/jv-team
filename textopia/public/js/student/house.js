// 내 집 = 나만의 서재: 집 그림, 전시 칸 6개(눌러서 걸기), pick 문장, 서재 도감(읽은 책 / 모은 문장 / 만든 작품)
import { h, once, toast } from '../ui.js';
import { houseSVG } from '../art.js';
import { S, call } from './core.js';
import { itemEl, itemLabel, coverEl } from './items.js';
import { itemTools } from './item-tools.js';

let tab = 'books';

export function houseCard(me, { big = false } = {}) {
  const st = me.stage;
  const into = st.next ? Math.min(100, ((me.exp - st.at) / (st.next.at - st.at)) * 100) : 100;
  return h('div', { class: 'card house-card' + (big ? ' big' : ''), id: 'house-card' },
    h('div', { class: 'scene', html: houseSVG(st.key, me.equipped) }),
    h('div', { class: 'row between' },
      h('strong', { id: 'house-stage' }, st.name),
      h('span', { class: 'muted', id: 'house-next' }, st.next ? `${st.next.name}까지 EXP ${st.next.at - me.exp}` : '가장 큰 집이에요!')),
    h('div', { class: 'bar' }, h('i', { style: `width:${into}%` })));
}

export async function renderHouse(el) {
  el.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
  let lib = (await call('library/get')).library;

  const draw = () => {
    const me = S.me;

    // 전시 칸 6개
    const slots = h('div', { class: 'slots', id: 'slots' }, lib.slots.map((item, i) => {
      const b = h('button', { class: 'slot' + (item ? ' filled' : ''), type: 'button', 'data-slot': i, 'aria-label': `전시 칸 ${i + 1}` },
        item ? itemEl(item, { mini: true }) : h('span', { class: 'plus' }, '＋'));
      b.addEventListener('click', () => openPicker(i));
      return b;
    }));

    const pickBox = lib.pick
      ? h('div', { class: 'card pick', id: 'pick-box' }, h('div', { class: 'muted' }, '📌 집 앞에 건 pick 문장'), h('p', { class: 'it-text' }, lib.pick.text),
        h('p', { class: 'muted' }, `《${lib.pick.bookTitle}》 ${lib.pick.page}쪽`))
      : h('div', { class: 'card pick', id: 'pick-box' }, h('p', { class: 'muted' }, '📌 모은 문장 중 하나를 pick 으로 걸어 두면, 친구가 놀러 왔을 때 이 문장을 따라 써요.'));

    const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['books', '읽은 책'], ['sentences', '모은 문장'], ['works', '만든 작품']].map(([id, label]) =>
      h('button', { class: 'tab' + (tab === id ? ' on' : ''), role: 'tab', 'data-tab': id, onclick: () => { tab = id; draw(); } }, label)));

    el.replaceChildren(
      h('h2', {}, `${me.nick}의 서재`),
      houseCard(me, { big: true }),
      pickBox,
      h('h3', {}, '전시 칸'),
      h('p', { class: 'muted' }, '칸을 눌러서 작품이나 문장 카드를 걸어요.'),
      slots,
      h('h3', { style: 'margin-top:16px' }, '서재 도감'),
      tabs,
      h('div', { id: 'dogam' }, dogamBody()),
      lib.guestbook.length ? h('div', { class: 'card', id: 'guestbook' }, h('h3', {}, '다녀간 친구'), lib.guestbook.map((g) => h('p', { class: 'muted' }, `${g.nick}이(가) 다녀감 · ${g.date}`))) : null,
    );
  };

  function dogamBody() {
    if (tab === 'books') {
      const read = lib.books.filter((b) => b.read).length;
      return h('div', {}, h('p', { class: 'muted' }, `읽은 책 ${read}권 · 아직 읽지 않은 책은 흐리게 보여요.`),
        h('div', { class: 'cover-grid', id: 'cover-grid' }, lib.books.map((b) => coverEl(b, { read: b.read }))));
    }
    if (tab === 'sentences') {
      if (!lib.sentences.length) return h('p', { class: 'muted' }, '아직 모은 문장이 없어요. 책에서 마음에 드는 문장을 모아 보세요.');
      return h('div', { class: 'stack', id: 'sentence-list' }, lib.sentences.map((s) => {
        const isPick = lib.pick?.id === s.id;
        const b = h('button', { class: 'btn small' + (isPick ? '' : ' ghost'), 'data-pick': s.id }, isPick ? '📌 pick 내리기' : '📌 pick 으로 걸기');
        b.addEventListener('click', () => once(b, async () => {
          try { lib = (await call('pick/set', { id: isPick ? null : s.id })).library; draw(); } catch (e) { toast(e.message); }
        }));
        return h('div', { class: 'stack' }, itemEl(s), h('div', { class: 'row' }, b), itemTools(s, reloadLib));
      }));
    }
    const all = [...lib.works, ...lib.questions];
    if (!all.length) return h('p', { class: 'muted' }, '아직 만든 작품이 없어요. 책에서 활동을 해 보세요.');
    return h('div', { class: 'stack', id: 'work-list' }, all.map((w) => h('div', { class: 'stack' }, h('span', { class: 'pill' }, itemLabel(w)), itemEl(w), itemTools(w, reloadLib))));
  }

  async function reloadLib() { lib = (await call('library/get')).library; draw(); }

  // 전시 칸 고르기 (눌러서 선택)
  function openPicker(index) {
    const cands = [...lib.works, ...lib.sentences];
    const close = () => sheet.remove();
    const choose = (item) => once(sheetBtn(item), async () => {
      try { lib = (await call('slot/set', { index, kind: item.kind, id: item.id })).library; close(); draw(); } catch (e) { toast(e.message); }
    });
    const sheetBtn = (item) => document.querySelector(`[data-pick-item="${item.id}"]`);
    const list = cands.length
      ? cands.map((item) => {
        const b = h('button', { class: 'pick-item', type: 'button', 'data-pick-item': item.id }, h('span', { class: 'pill' }, itemLabel(item)), itemEl(item, { mini: true }));
        b.addEventListener('click', () => choose(item));
        return b;
      })
      : [h('p', { class: 'muted' }, '걸 수 있는 작품이나 문장이 아직 없어요.')];
    const clear = lib.slots[index]
      ? h('button', { class: 'btn ghost block', id: 'slot-clear', onclick: () => once(clear, async () => { lib = (await call('slot/set', { index, id: null })).library; close(); draw(); }) }, '이 칸 비우기')
      : null;
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': '전시 칸 고르기' },
      h('div', { class: 'sheet-body stack' },
        h('div', { class: 'row between' }, h('h3', {}, `전시 칸 ${index + 1}`), h('button', { class: 'btn ghost small', id: 'sheet-close', onclick: close }, '닫기')),
        ...list, clear));
    document.body.append(sheet);
  }

  draw();
}
