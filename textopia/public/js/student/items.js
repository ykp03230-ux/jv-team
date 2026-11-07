// 문장 카드 · 질문 카드 · 책갈피 · 책 표지 등 '내 것'을 보여 주는 조각들
import { h } from '../ui.js';
import { coverIndex } from '../art.js';

export const TEMPLATES = [
  { id: 't1', name: '단선 테두리' },
  { id: 't2', name: '겹선 테두리' },
  { id: 't3', name: '구름 테두리' },
];

/** 책갈피: 모은 문장 + 먹 테두리 템플릿을 앱이 그린다 */
export function bookmarkEl(w) {
  return h('div', { class: `bm ${w.template || 't1'}`, 'data-work': w.id },
    h('div', { class: 'bm-text' }, w.text),
    h('div', { class: 'bm-book' }, `《${w.bookTitle}》`));
}

/** 기본 책 표지: 색과 제목 글자로 그린다 */
export function coverEl(book, { read = false, onclick } = {}) {
  return h('button', { class: `cover cv-${coverIndex(book.id)}${read ? ' read' : ' dim'}`, 'data-book': book.id, onclick, type: 'button', 'aria-label': `${book.title}${read ? ' (읽음)' : ''}` },
    h('span', { class: 'cover-title' }, book.title),
    h('span', { class: 'cover-author' }, book.author),
    read ? h('span', { class: 'stamp' }, '읽음') : null);
}

/** 이미지 파일을 쓰는 작품(그림 독서록·직접 꾸민 표지)은 9단계에서 사진 올리기와 함께 붙는다 */
let imgEl = (id, alt) => h('div', { class: 'img-todo', role: 'img', 'aria-label': alt }, '사진');
export function setImageRenderer(fn) { imgEl = fn; }

/** 항목 하나를 카드로 보여 준다. item.kind: sentence | question | work */
export function itemEl(item, { mini = false } = {}) {
  if (item.kind === 'sentence') {
    return h('div', { class: 'item s-card' + (mini ? ' mini' : ''), 'data-sentence': item.id },
      h('p', { class: 'it-text' }, item.text),
      h('p', { class: 'muted' }, `《${item.bookTitle}》 ${item.page}쪽`),
      mini ? null : h('p', { class: 'muted' }, `고른 이유: ${item.reason}`));
  }
  if (item.kind === 'question') {
    return h('div', { class: 'item q-card' + (mini ? ' mini' : ''), 'data-question': item.id },
      h('p', { class: 'it-text' }, 'Q. ' + item.text),
      h('p', { class: 'muted' }, `《${item.bookTitle}》`));
  }
  if (item.type === 'bookmark') return h('div', { class: 'item' + (mini ? ' mini' : '') }, bookmarkEl(item));
  if (item.type === 'drawing') {
    return h('div', { class: 'item w-card' + (mini ? ' mini' : ''), 'data-work': item.id }, imgEl(item.imgId, '그림 독서록'),
      h('p', { class: 'it-text' }, item.caption), h('p', { class: 'muted' }, `그림 독서록 · 《${item.bookTitle}》`));
  }
  return h('div', { class: 'item w-card' + (mini ? ' mini' : ''), 'data-work': item.id }, imgEl(item.imgId, '책 표지'),
    h('p', { class: 'it-text' }, item.title), h('p', { class: 'muted' }, `내가 꾸민 표지 · 《${item.bookTitle}》`));
}

export const itemLabel = (item) =>
  item.kind === 'sentence' ? '문장 카드' : item.kind === 'question' ? '질문'
    : item.type === 'bookmark' ? '책갈피' : item.type === 'drawing' ? '그림 독서록' : '책 표지';
