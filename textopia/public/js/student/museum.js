// 박물관: 입구('준비 중'), 작품 내기, 전시 구경, 투표(1인 3표, 내 작품 제외), 이달의 작품
import { h, once, toast } from '../ui.js';
import { S, call } from './core.js';
import { itemEl, itemLabel } from './items.js';

const KIND_LABEL = { sentence: '문장 카드', question: '질문' };
const labelOf = (s) => (s.kind === 'work' ? itemLabel({ kind: 'work', type: s.snap.type }) : KIND_LABEL[s.kind]);

/** 내 작품 밑에 붙는 '박물관에 내기' 버튼 */
export function submitButton(item) {
  const b = h('button', { class: 'btn small', 'data-museum-submit': item.id }, '박물관에 내기');
  b.addEventListener('click', () => once(b, async () => {
    try {
      const r = await call('museum/submit', { kind: item.kind, refId: item.id });
      b.textContent = '낸 작품 ✔'; b.disabled = true;
      toast(r.status.vote === 'open' ? '박물관에 냈어요! 지금 투표 기간이에요.' : '박물관에 냈어요!');
    } catch (e) { toast(e.message); }
  }));
  return b;
}

export async function renderMuseum(el) {
  el.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
  const { status } = await call('museum/status');

  // 전시가 꺼져 있으면 입구에서 막는다
  if (!status.on) {
    el.replaceChildren(h('h2', {}, '박물관'),
      h('div', { class: 'card center gate', id: 'museum-closed' }, h('div', { class: 'gate-sign' }, '준비 중'),
        h('p', { class: 'muted' }, '박물관을 준비하고 있어요. 조금만 기다려 주세요.')));
    return;
  }

  let data = await call('museum/list');
  const redraw = async () => { data = await call('museum/list'); draw(); };

  function draw() {
    const st = data.status;
    const banner = st.vote === 'open'
      ? h('div', { class: 'card ink', id: 'vote-banner' }, h('strong', {}, '투표 중!'), h('p', { id: 'votes-left' }, `남은 표 ${st.votesLeft}개 · 내 작품에는 투표할 수 없어요.`))
      : st.vote === 'finished' ? h('div', { class: 'card ink', id: 'vote-banner' }, h('strong', {}, '이달의 작품이 정해졌어요'))
        : h('div', { class: 'card', id: 'vote-banner' }, h('p', { class: 'muted' }, '아직 투표 기간이 아니에요.'));
    const must = st.submittedThisMonth
      ? h('p', { class: 'ok', id: 'month-done' }, `✔ ${st.month} 작품을 냈어요`)
      : h('p', { class: 'error', id: 'month-todo' }, `이번 달(${st.month})에 작품을 1개 이상 내야 해요`);

    const groups = {};
    data.subs.forEach((s) => (groups[s.month] ||= []).push(s));
    const months = Object.keys(groups).sort().reverse();

    el.replaceChildren(
      h('h2', {}, '박물관'), must, banner,
      h('button', { class: 'btn block', id: 'open-picker', onclick: openPicker }, '내 작품 내기'),
      ...months.map((m) => h('div', { class: 'stack', style: 'margin-top:16px' }, h('h3', {}, `${m} 전시`), groups[m].map(card))),
      data.subs.length ? null : h('p', { class: 'muted' }, '아직 전시된 작품이 없어요.'),
    );
  }

  function card(s) {
    const item = { ...s.snap, kind: s.kind, id: s.id };
    const actions = [];
    if (s.votable && !s.mine) {
      const b = h('button', { class: 'btn small' + (s.voted ? ' ghost' : ''), 'data-vote': s.id }, s.voted ? '투표 취소' : '투표하기');
      b.addEventListener('click', () => once(b, async () => {
        try { await call(s.voted ? 'museum/unvote' : 'museum/vote', { subId: s.id }); await redraw(); } catch (e) { toast(e.message); }
      }));
      actions.push(b);
    }
    return h('div', { class: 'card stack' + (s.best ? ' best' : ''), 'data-sub': s.id },
      h('div', { class: 'row between' },
        h('span', {}, h('strong', {}, s.nick), ' ', h('span', { class: 'pill' }, labelOf(s)), s.mine ? h('span', { class: 'pill accent' }, '내 작품') : null),
        s.best ? h('span', { class: 'pill accent', 'data-best': '1' }, `이달의 작품 · ${s.votes}표`) : null),
      itemEl(item),
      actions.length ? h('div', { class: 'row' }, actions) : null);
  }

  // 내 작품 고르기 (눌러서 선택)
  async function openPicker() {
    const lib = (await call('library/get')).library;
    const cands = [...lib.works, ...lib.sentences, ...lib.questions];
    const close = () => sheet.remove();
    const list = cands.length ? cands.map((item) => {
      const b = h('button', { class: 'pick-item', type: 'button', 'data-pick-item': item.id }, h('span', { class: 'pill' }, itemLabel(item)), itemEl(item, { mini: true }));
      b.addEventListener('click', () => once(b, async () => {
        try { await call('museum/submit', { kind: item.kind, refId: item.id }); toast('박물관에 냈어요!'); close(); await redraw(); } catch (e) { toast(e.message); }
      }));
      return b;
    }) : [h('p', { class: 'muted' }, '낼 수 있는 작품이 아직 없어요. 책에서 활동을 해 보세요.')];
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': '박물관에 낼 작품' },
      h('div', { class: 'sheet-body stack' },
        h('div', { class: 'row between' }, h('h3', {}, '어떤 작품을 낼까요?'), h('button', { class: 'btn ghost small', id: 'sheet-close', onclick: close }, '닫기')), ...list));
    document.body.append(sheet);
  }

  draw();
}
