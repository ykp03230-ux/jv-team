import { h } from '../ui.js';
import { call, go } from './core.js';
import { bookAreas, bookMemories, spriteGeometry, HOUSE_COLORS } from './village-layout.js';

const BASE = '/assets/village/v02/';
let manifestRequest;
function getManifest() {
  if (!manifestRequest) manifestRequest = fetch(BASE + 'assets.json')
    .then((r) => { if (!r.ok) throw new Error('마을 그림을 불러오지 못했어요.'); return r.json(); })
    .catch((e) => { manifestRequest = null; throw e; });
  return manifestRequest;
}

export async function loadReadingVillage(host) {
  host.setAttribute('aria-busy', 'true');
  host.replaceChildren(h('p', { class: 'rv-loading', role: 'status' }, '책과 문장으로 마을을 채우는 중…'));
  try {
    const [manifest, { shelf }, { library }] = await Promise.all([
      getManifest(), call('books/shelf'), call('library/get'),
    ]);
    if (host.isConnected) host.replaceChildren(readingVillage(manifest, shelf, library));
  } catch (e) {
    if (host.isConnected) host.replaceChildren(h('div', { class: 'rv-loading' },
      h('p', { role: 'alert' }, e.message),
      h('button', { class: 'btn ghost', onclick: () => loadReadingVillage(host) }, '다시 불러오기')));
  } finally { host.removeAttribute('aria-busy'); }
}

function readingVillage(manifest, books, library) {
  const areas = bookAreas(books);
  const sprites = new Map(manifest.sprites.map((s) => [s.id, s]));
  const places = manifest.placements.filter((p) => p.id.startsWith('home-'));
  const scenery = manifest.placements.filter((p) => !p.id.startsWith('home-') && p.sprite !== 'sentence-frame');
  let area = 0;
  let selected = books[0]?.id;
  const map = h('div', { class: 'rv-map', style: `aspect-ratio:${manifest.map.width}/${manifest.map.height}` });
  const imageError = h('p', { class: 'rv-image-error', role: 'status', hidden: true }, '일부 마을 그림을 불러오지 못했어요. 아래 책 이름으로도 기록을 열 수 있어요.');
  const viewport = h('div', { class: 'rv-viewport', tabindex: '0', role: 'region', 'aria-label': '독서마을 지도. 작은 화면에서는 옆으로 움직여 볼 수 있어요.' }, map);
  const details = h('section', { class: 'rv-detail', 'aria-label': '선택한 책집' });
  const choices = h('div', { class: 'rv-book-choices', 'aria-label': '이 구역의 책집' });
  const count = h('span', { class: 'rv-area-label', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const previous = h('button', { class: 'rv-nav', type: 'button', 'aria-label': '이전 마을 구역', onclick: () => changeArea(area - 1) }, '←');
  const next = h('button', { class: 'rv-nav', type: 'button', 'aria-label': '다음 마을 구역', onclick: () => changeArea(area + 1) }, '→');

  function image(file, attrs = {}) {
    return h('img', { src: BASE + file, alt: '', draggable: 'false', decoding: 'async',
      onerror: () => { imageError.hidden = false; }, ...attrs });
  }

  function sprite(id, placement, attrs = {}, label) {
    const s = sprites.get(id);
    const g = spriteGeometry(s, placement, manifest.map);
    const interactive = !!attrs.onclick;
    return h(interactive ? 'button' : 'div', {
      class: 'rv-object' + (interactive ? ' rv-interactive' : ''),
      ...(interactive ? { type: 'button' } : { 'aria-hidden': 'true' }), ...attrs,
      style: `left:${g.left}%;top:${g.top}%;width:${g.width}%;height:${g.height}%;z-index:${g.depth}`,
    }, image(s.file, { style: `width:${g.imageWidth}%;height:${g.imageHeight}%;left:${g.imageLeft}%;top:${g.imageTop}%` }),
    label ? h('span', { class: 'rv-map-label' }, label) : null);
  }

  function choose(id) {
    selected = id;
    [map, choices].forEach((container) => container.querySelectorAll('[data-book-house]').forEach((el) => {
      const on = el.dataset.bookHouse === id;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-pressed', String(on));
    }));
    drawDetails();
  }

  function changeArea(index) {
    if (index < 0 || index >= areas.length) return;
    area = index;
    selected = areas[area][0]?.id;
    drawMap();
    // 구역의 끝에서 누른 이동 버튼이 비활성화되면 반대 버튼으로 초점을 옮긴다.
    if (document.activeElement === previous && previous.disabled) next.focus();
    if (document.activeElement === next && next.disabled) previous.focus();
  }

  function drawMap() {
    map.replaceChildren(image(manifest.map.file, { class: 'rv-ground', fetchpriority: 'high' }));
    scenery.forEach((p) => map.append(sprite(p.sprite, p)));
    areas[area].forEach((book, i) => {
      const color = HOUSE_COLORS[(area * 3 + i) % HOUSE_COLORS.length];
      map.append(sprite(color, places[i], {
        class: 'rv-object rv-interactive rv-house', 'data-book-house': book.id,
        'aria-label': `${book.title} 책집 선택`, onclick: () => choose(book.id),
      }, book.title));
    });
    const quotePlace = manifest.placements.find((p) => p.sprite === 'sentence-frame');
    // 좁은 화면에서도 책집 이름표와 겹치지 않도록 전시대를 길 아래쪽에 둔다.
    map.append(sprite('sentence-frame', { ...quotePlace, x: 825, y: 830 }, {
      class: 'rv-object rv-interactive rv-quote-stand',
      'aria-label': '내 대표 문장과 서재 열기', onclick: () => go('house'),
    }, '문장 정원'));
    choices.replaceChildren(...areas[area].map((book, i) => h('button', {
      type: 'button', class: 'rv-book-choice', 'data-book-house': book.id, onclick: () => choose(book.id),
    }, h('span', { class: 'rv-book-number', 'aria-hidden': 'true' }, String(area * 3 + i + 1).padStart(2, '0')), book.title)));
    count.textContent = books.length ? `${area + 1} / ${areas.length} 구역 · 책집 ${books.length}채` : '첫 책집을 기다리는 정원';
    previous.disabled = area === 0;
    next.disabled = area === areas.length - 1;
    choose(selected);
  }

  function drawDetails() {
    const book = books.find((b) => b.id === selected);
    if (!book) {
      details.replaceChildren(h('p', { class: 'rv-eyebrow' }, '아직 쓰이지 않은 이야기'),
        h('h3', {}, '첫 책이 오면,\n첫 집이 생겨요.'),
        h('p', { class: 'rv-description' }, '읽고 있거나 마음에 남은 책 한 권을 등록해 보세요. 문장과 생각을 모아 나만의 책집을 채워요.'),
        h('button', { class: 'btn', onclick: () => go('books') }, '첫 책 등록하기'));
      return;
    }
    const memories = bookMemories(book, library);
    const sentence = memories.sentence;
    const status = book.cert?.status === 'approved' ? '읽음 인증 완료' : book.cert?.status === 'pending' ? '읽음 인증 확인 중' : '읽어 가는 중';
    details.replaceChildren(...[
      h('p', { class: 'rv-eyebrow' }, '내가 읽은 이야기의 집'),
      h('span', { class: 'rv-status' }, status),
      h('h3', { id: 'selected-book-title', 'aria-live': 'polite' }, book.title),
      h('p', { class: 'rv-author' }, book.author),
      h('div', { class: 'rv-memory' }, h('p', { class: 'rv-caption' }, sentence ? '간직하고 싶은 문장' : '아직 비어 있는 문장 자리'),
        sentence ? h('blockquote', {}, sentence.text) : h('p', { class: 'rv-description' }, '어떤 문장이 마음에 남았나요? 이 집에 첫 문장을 걸어 주세요.'),
        sentence ? h('p', { class: 'rv-source' }, `${sentence.page}쪽`) : null,
        sentence?.reason ? h('p', { class: 'rv-reason' }, sentence.reason) : null),
      book.cert?.feeling ? h('div', { class: 'rv-feeling' }, h('p', { class: 'rv-caption' }, '이 책을 읽고 남긴 마음'), h('p', {}, book.cert.feeling)) : null,
      h('p', { class: 'rv-records' }, `문장 ${memories.sentences.length} · 질문 ${memories.questions.length} · 작품 ${memories.works.length}`),
      h('button', { class: 'btn rv-open-book', onclick: () => go('books/' + book.id) }, '책집에 기록 남기기 →'),
    ].filter(Boolean));
  }

  drawMap();
  const pick = library.pick;
  return h('div', { class: 'rv-world' },
    h('div', { class: 'rv-layout' },
      h('div', { class: 'rv-map-column' },
        h('div', { class: 'rv-map-frame' }, viewport,
          h('div', { class: 'rv-map-note', 'aria-hidden': 'true' }, '책 한 권, 나의 작은 세계')),
        h('div', { class: 'rv-map-toolbar' }, h('p', {}, books.length ? '집을 눌러 이야기를 만나 보세요' : '책을 등록하면 정원에 책집이 생겨요'),
          h('div', { class: 'rv-area-controls' }, previous, count, next)),
        imageError, choices), details),
    h('div', { class: 'rv-pick-strip' },
      h('span', { class: 'rv-caption' }, '친구에게 보여 줄 나의 문장'),
      h('div', { class: 'rv-pick-copy' }, h('p', {}, pick?.text || '마음에 남은 문장 하나를 골라 마을에 걸어 주세요.'),
        pick ? h('span', { class: 'rv-source' }, `《${pick.bookTitle}》 · ${pick.page}쪽`) : null),
      h('button', { class: 'btn ghost small', onclick: () => go('house') }, '서재에서 고르기')));
}
