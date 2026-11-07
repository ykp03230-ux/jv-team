// 책: 내 책장, 책 찾기·등록, 책 추가하기, 책 하나의 화면(읽음 인증)
import { h, once, toast } from '../ui.js';
import { S, call, go, toastReward } from './core.js';
import { coverEl, itemEl, itemLabel, bookmarkEl, TEMPLATES } from './items.js';
import { itemTools } from './item-tools.js';
import { submitButton } from './museum.js';
import { photoPicker } from './images.js';

const CERT_LABEL = { pending: '승인 대기', rejected: '반려됨', approved: '읽음 ✔' };

function bookLine(b, right) {
  return h('div', { class: 'card book-row', 'data-book': b.id },
    h('div', { class: 'grow' },
      h('strong', {}, b.title),
      h('div', { class: 'muted' }, `${b.author} · ${b.category}`),
      b.base ? null : h('div', { class: 'friend-tag' }, `친구가 추가한 책 · ${b.addedByNick}`)),
    right);
}

export async function renderBooks(el, bookId) {
  if (bookId) return renderBook(el, bookId);
  el.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
  let shelf = (await call('books/shelf')).shelf;

  const results = h('div', { class: 'stack', id: 'results' });
  const addBox = h('div', { id: 'add-box' });
  const search = h('input', { id: 'book-q', type: 'search', placeholder: '제목이나 지은이로 찾아요', autocomplete: 'off', maxlength: '50' });

  async function doSearch() {
    const q = search.value.trim();
    addBox.replaceChildren();
    if (!q) { results.replaceChildren(h('p', { class: 'muted' }, '위에 제목이나 지은이를 쓰면 책을 찾아 줘요.')); return; }
    const r = await call('books/search', { q });
    if (search.value.trim() !== q) return; // 그 사이에 글이 바뀌었으면 버린다
    if (r.books.length === 0) {
      results.replaceChildren(h('p', { class: 'muted' }, '찾는 책이 없어요.'));
      const btn = h('button', { class: 'btn block', id: 'show-add' }, '책 추가하기');
      btn.addEventListener('click', () => showAddForm(q, r.categories));
      addBox.replaceChildren(btn);
      return;
    }
    results.replaceChildren(...r.books.map((b) => {
      const on = shelf.some((x) => x.id === b.id);
      const btn = h('button', { class: 'btn small' + (on ? ' ghost' : ''), 'data-register': b.id }, on ? '열기' : '내 책으로 등록');
      btn.addEventListener('click', () => once(btn, async () => {
        try {
          if (!on) { shelf = (await call('books/register', { bookId: b.id })).shelf; toast('내 책으로 등록했어요'); }
          go('books/' + b.id);
        } catch (e) { toast(e.message); }
      }));
      return bookLine(b, btn);
    }));
  }
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch().catch((e) => toast(e.message)), 250); });

  function showAddForm(q, categories) {
    const title = h('input', { id: 'add-title', value: q, maxlength: '50', placeholder: '제목' });
    const author = h('input', { id: 'add-author', maxlength: '30', placeholder: '지은이 (모르면 작자 미상)' });
    const cat = h('select', { id: 'add-cat' }, h('option', { value: '' }, '분류를 골라요'), categories.map((c) => h('option', { value: c }, c)));
    const err = h('div', { class: 'error', role: 'alert' });
    const dupBox = h('div', { class: 'stack' });
    const go2 = h('button', { class: 'btn block', id: 'add-go' }, '책 추가하기');
    go2.addEventListener('click', () => once(go2, async () => {
      err.textContent = ''; dupBox.replaceChildren();
      try {
        const r = await call('books/add', { title: title.value, author: author.value, category: cat.value });
        shelf = (await call('books/register', { bookId: r.book.id })).shelf;
        toast(`《${r.book.title}》을(를) 반 책 목록에 추가했어요`);
        go('books/' + r.book.id);
      } catch (e) {
        if (e.error === 'duplicate' && e.data?.existing) {
          const ex = e.data.existing;
          const pick = h('button', { class: 'btn small', id: 'pick-existing', 'data-book': ex.id }, '이 책 고르기');
          pick.addEventListener('click', () => once(pick, async () => {
            try { shelf = (await call('books/register', { bookId: ex.id })).shelf; go('books/' + ex.id); } catch (e2) { toast(e2.message); }
          }));
          err.textContent = e.message;
          dupBox.replaceChildren(bookLine(ex, pick));
        } else err.textContent = e.message;
      }
    }));
    addBox.replaceChildren(h('div', { class: 'card stack', id: 'add-form' },
      h('h3', {}, '새 책 추가'),
      h('p', { class: 'muted' }, '책을 추가해도 코인이나 EXP 는 없어요. 하루에 3권까지 추가할 수 있어요.'),
      h('div', {}, h('label', { for: 'add-title' }, '제목'), title),
      h('div', {}, h('label', { for: 'add-author' }, '지은이'), author),
      h('div', {}, h('label', { for: 'add-cat' }, '분류'), cat),
      err, dupBox, go2));
  }

  el.replaceChildren(
    h('h2', {}, '책'),
    h('h3', {}, '내 책'),
    shelf.length
      ? h('div', { class: 'stack', id: 'shelf' }, shelf.map((b) => bookLine(b, h('div', { class: 'stack end' },
        b.cert ? h('span', { class: 'pill' + (b.cert.status === 'approved' ? ' accent' : ''), 'data-cert': b.cert.status }, CERT_LABEL[b.cert.status]) : h('span', { class: 'muted' }, '인증 전'),
        h('button', { class: 'btn small ghost', 'data-open': b.id, onclick: () => go('books/' + b.id) }, '열기')))))
      : h('p', { class: 'muted', id: 'shelf-empty' }, '아직 등록한 책이 없어요. 아래에서 책을 찾아 등록해요.'),
    h('h3', { style: 'margin-top:16px' }, '책 찾기'),
    search, results, addBox,
  );
  doSearch();
}

// ── 책 하나 ──────────────────────────────────────────────
async function renderBook(el, bookId) {
  el.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
  let shelf = (await call('books/shelf')).shelf;
  let lib = (await call('library/get')).library;
  let activity = 'sentence';
  const reload = async () => { shelf = (await call('books/shelf')).shelf; lib = (await call('library/get')).library; draw(); };
  const draw = () => {
    const b = shelf.find((x) => x.id === bookId);
    if (!b) { el.replaceChildren(h('p', { class: 'error' }, '내 책장에 없는 책이에요.'), h('button', { class: 'btn', onclick: () => go('books') }, '책 목록으로')); return; }
    el.replaceChildren(
      h('button', { class: 'btn ghost small', onclick: () => go('books') }, '← 책 목록'),
      h('div', { class: 'row', style: 'margin-top:12px; align-items:flex-start' },
        h('div', { style: 'width:96px; flex:0 0 96px' }, coverEl(b, { read: b.cert?.status === 'approved' })),
        h('div', { class: 'grow' }, h('h2', { id: 'book-title' }, b.title), h('p', { class: 'muted' }, `${b.author} · ${b.category}`),
          b.base ? null : h('div', { class: 'friend-tag' }, `친구가 추가한 책 · ${b.addedByNick}`))),
      certCard(b),
      activityCard(b),
      myItems(b),
    );
  };

  // ── 책 활동 ──
  const ACTS = [['sentence', '문장 모으기'], ['question', '질문 만들기'], ['bookmark', '책갈피 만들기'], ['drawing', '그림 독서록'], ['cover', '책 표지 꾸미기']];

  function activityCard(b) {
    const tabs = h('div', { class: 'tabs act-tabs', role: 'tablist' }, ACTS.map(([id, label]) =>
      h('button', { class: 'tab' + (activity === id ? ' on' : ''), role: 'tab', 'data-act': id, onclick: () => { activity = id; draw(); } },
        label + (b.done.includes(id) ? ' ✔' : ''))));
    return h('div', { class: 'card stack', id: 'activity-card' },
      h('h3', {}, '책 활동'),
      h('p', { class: 'muted' }, '활동마다 처음 한 번 코인 15 · EXP 15 를 받아요. (✔ 는 이미 받은 활동)'),
      tabs, activityForm(b));
  }

  async function submitActivity(btn, err, body, after) {
    await once(btn, async () => {
      err.textContent = '';
      try {
        const r = await call('activity/submit', { bookId, ...body });
        toastReward(r.reward);
        if (!r.rewarded) toast('만들었어요! 이 활동의 보상은 이미 받았어요.');
        after?.();
        await reload();
      } catch (e) { err.textContent = e.message; }
    });
  }

  function activityForm(b) {
    const err = h('div', { class: 'error', role: 'alert' });
    const mark = b.done.includes(activity) ? h('p', { class: 'muted' }, '이 활동의 보상은 이미 받았어요. 더 만들어도 좋아요.') : null;
    if (activity === 'sentence') {
      const text = h('textarea', { id: 'act-text', rows: '2', maxlength: '200', placeholder: '책 속 문장' });
      const page = h('input', { id: 'act-page', type: 'number', inputmode: 'numeric', min: '1', max: '9999', placeholder: '쪽수' });
      const reason = h('input', { id: 'act-reason', maxlength: '100', placeholder: '이 문장을 고른 이유 한 줄' });
      const btn = h('button', { class: 'btn block', id: 'act-submit' }, '문장 모으기');
      btn.addEventListener('click', () => submitActivity(btn, err, { type: 'sentence', text: text.value, page: page.value, reason: reason.value }));
      return h('div', { class: 'stack' }, mark, text, page, reason, err, btn);
    }
    if (activity === 'question') {
      const text = h('textarea', { id: 'act-text', rows: '2', maxlength: '150', placeholder: '이 책을 읽고 친구에게 묻고 싶은 질문 한 개' });
      const btn = h('button', { class: 'btn block', id: 'act-submit' }, '질문 만들기');
      btn.addEventListener('click', () => submitActivity(btn, err, { type: 'question', text: text.value }));
      return h('div', { class: 'stack' }, mark, text, err, btn);
    }
    if (activity === 'drawing' || activity === 'cover') {
      // 종이에 그리거나 꾸민 것을 사진으로 올린다
      const isDrawing = activity === 'drawing';
      const text = h('input', { id: 'act-text', maxlength: isDrawing ? '100' : '40', placeholder: isDrawing ? '그림에 대한 한 줄 설명' : '내가 붙인 책 제목' });
      const btn = h('button', { class: 'btn block', id: 'act-submit', disabled: true }, isDrawing ? '그림 독서록 올리기' : '책 표지 올리기');
      const picker = photoPicker((id) => { btn.disabled = !id; });
      btn.addEventListener('click', () => submitActivity(btn, err, isDrawing
        ? { type: 'drawing', imgId: picker.state.imgId, caption: text.value }
        : { type: 'cover', imgId: picker.state.imgId, title: text.value }));
      return h('div', { class: 'stack' }, mark,
        h('p', { class: 'muted' }, isDrawing ? '책을 읽고 종이에 그린 그림을 사진으로 찍어 올려요.' : '직접 꾸민 책 표지를 사진으로 찍어 올리고, 내가 붙인 제목을 써요.'),
        picker.el, text, err, btn);
    }
    // 책갈피: 이 책에서 모은 문장 하나 + 먹 테두리 템플릿 3종
    const mine = lib.sentences.filter((s) => s.bookId === bookId);
    if (!mine.length) return h('p', { class: 'muted', id: 'bm-need' }, '먼저 이 책에서 문장을 모아야 책갈피를 만들 수 있어요. ‘문장 모으기’를 해 보세요.');
    let sid = mine[mine.length - 1].id;
    let tpl = 't1';
    const preview = h('div', { id: 'bm-preview', class: 'center' });
    const redraw = () => {
      const s = mine.find((x) => x.id === sid);
      preview.replaceChildren(bookmarkEl({ id: 'preview', template: tpl, text: s.text, bookTitle: b.title }));
      list.querySelectorAll('[data-sentence-choice]').forEach((x) => x.classList.toggle('on', x.dataset.sentenceChoice === sid));
      tpls.querySelectorAll('[data-template]').forEach((x) => x.classList.toggle('on', x.dataset.template === tpl));
    };
    const list = h('div', { class: 'stack' }, mine.map((s) => h('button', { class: 'choice', type: 'button', 'data-sentence-choice': s.id, onclick: () => { sid = s.id; redraw(); } }, s.text)));
    const tpls = h('div', { class: 'tabs' }, TEMPLATES.map((t) => h('button', { class: 'tab', type: 'button', 'data-template': t.id, onclick: () => { tpl = t.id; redraw(); } }, t.name)));
    const btn = h('button', { class: 'btn block', id: 'act-submit' }, '책갈피 만들기');
    btn.addEventListener('click', () => submitActivity(btn, err, { type: 'bookmark', sentenceId: sid, template: tpl }));
    queueMicrotask(redraw);
    return h('div', { class: 'stack' }, mark, h('label', {}, '모은 문장 고르기'), list, h('label', {}, '먹 테두리 고르기'), tpls, preview, err, btn);
  }

  // ── 이 책에서 내가 만든 것 ──
  function myItems(b) {
    const items = [
      ...lib.sentences.filter((x) => x.bookId === bookId),
      ...lib.questions.filter((x) => x.bookId === bookId),
      ...lib.works.filter((x) => x.bookId === bookId),
    ];
    if (!items.length) return null;
    return h('div', { class: 'card stack', id: 'my-items' },
      h('h3', {}, '이 책에서 내가 만든 것'),
      items.map((it) => h('div', { class: 'stack' }, h('span', { class: 'pill' }, itemLabel(it)), itemEl(it), itemTools(it, reload, [submitButton(it)]))));
  }

  function certCard(b) {
    const c = b.cert;
    if (c?.status === 'approved') {
      return h('div', { class: 'card stack', id: 'cert-card' }, h('h3', {}, '읽음 인증'), h('p', { class: 'ok', id: 'cert-approved' }, '읽음 인증을 받았어요! 서재 도감에 읽은 책으로 올라가 있어요.'),
        h('p', { class: 'muted' }, `“${c.sentence}” (${c.page}쪽)`));
    }
    if (c?.status === 'pending') {
      return h('div', { class: 'card stack', id: 'cert-card' }, h('h3', {}, '읽음 인증'), h('p', { class: 'ok', id: 'cert-pending' }, '선생님이 확인하고 있어요. 승인되면 코인과 EXP 를 받아요.'),
        h('p', { class: 'muted' }, `“${c.sentence}” (${c.page}쪽)`), h('p', { class: 'muted' }, `내 느낌: ${c.feeling}`));
    }
    const sentence = h('textarea', { id: 'cert-sentence', rows: '2', maxlength: '200', placeholder: '책 속 문장 한 줄' });
    const page = h('input', { id: 'cert-page', type: 'number', inputmode: 'numeric', min: '1', max: '9999', placeholder: '쪽수' });
    const feeling = h('textarea', { id: 'cert-feeling', rows: '2', maxlength: '100', placeholder: '내 느낌 한 줄' });
    const err = h('div', { class: 'error', role: 'alert' });
    const btn = h('button', { class: 'btn block', id: 'cert-submit' }, '읽음 인증 내기');
    if (c) { sentence.value = c.sentence; page.value = c.page; feeling.value = c.feeling; }
    btn.addEventListener('click', () => once(btn, async () => {
      err.textContent = '';
      try {
        shelf = (await call('cert/submit', { bookId, sentence: sentence.value, page: page.value, feeling: feeling.value })).shelf;
        toast('선생님께 보냈어요. 승인을 기다려요.');
        draw();
      } catch (e) { err.textContent = e.message; }
    }));
    return h('div', { class: 'card stack', id: 'cert-card' }, h('h3', {}, '읽음 인증'),
      c?.status === 'rejected' ? h('div', { class: 'reject', id: 'cert-rejected' }, h('strong', {}, '선생님이 돌려보냈어요'), h('p', {}, `사유: ${c.reason}`), h('p', { class: 'muted' }, '고쳐서 다시 낼 수 있어요.')) : null,
      h('p', { class: 'muted' }, '책을 다 읽었다면 문장 한 줄, 쪽수, 내 느낌을 적어 선생님께 인증을 받아요.'),
      h('div', {}, h('label', { for: 'cert-sentence' }, '책 속 문장'), sentence),
      h('div', {}, h('label', { for: 'cert-page' }, '쪽수'), page),
      h('div', {}, h('label', { for: 'cert-feeling' }, '내 느낌'), feeling),
      err, btn);
  }
  draw();
}
