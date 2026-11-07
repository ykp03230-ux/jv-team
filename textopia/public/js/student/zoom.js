// 작품 크게 보기: 친구 집(학생 화면)과 마을 화면(TV)의 전시 칸 작품을 누르면 화면 가득 크게 보여 준다.
// 보기만 한다(서버 호출 없음 — 전시 칸 자료에 이미 들어 있는 내용을 키워서 보여 준다).
// 창은 body 에 붙여서, 화면이 새로 그려져도(마을 화면은 10초마다) 닫히지 않는다.
import { h } from '../ui.js';
import { itemEl, itemLabel } from './items.js';

let current = null; // { back, onKey, opener }

export function closeZoom() {
  if (!current) return;
  const { back, onKey, opener } = current;
  document.removeEventListener('keydown', onKey, true);
  back.remove();
  current = null;
  if (opener?.isConnected) opener.focus?.(); // 키보드로 열었다면 원래 자리로 돌아간다
}

export function openZoom(item, opener = null) {
  closeZoom();
  // Esc 는 이 창만 닫는다. (마을 화면의 '집 구경' 창은 그대로 남는다 — 먼저 받아서 위로 퍼지지 않게 한다)
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeZoom(); } };
  const close = h('button', { class: 'btn ghost zoom-close', id: 'zoom-close', type: 'button', onclick: closeZoom }, '닫기 ✕');
  const card = h('div', { class: 'zoom-card', id: 'zoom-card', tabindex: '-1' }, close, h('div', { class: 'zoom-body', id: 'zoom-body' }, itemEl(item)));
  const back = h('div', { class: 'zoom-back', id: 'zoom-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${itemLabel(item)} 크게 보기` }, card);
  back.addEventListener('click', (ev) => { if (ev.target === back) closeZoom(); }); // 바깥을 누르면 닫힘
  document.addEventListener('keydown', onKey, true);
  document.body.append(back);
  current = { back, onKey, opener };
  card.focus(); // 닫기 버튼이 아니라 창에 둔다: 스페이스로 열었을 때 같은 키가 닫기 버튼을 눌러 버리지 않게
}

/** 전시 칸 하나를 '눌러서 크게 보는' 칸으로 만든다. 마우스·손가락·키보드(Enter, 스페이스) 모두 된다. */
export function zoomable(el, item) {
  el.classList.add('zoomable');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${itemLabel(item)} 크게 보기`);
  el.addEventListener('click', () => openZoom(item, el));
  el.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    openZoom(item, el);
  });
  return el;
}
