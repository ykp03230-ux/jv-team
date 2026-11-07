// 내 문장·질문·작품 밑에 붙는 버튼: 고치기 / 지우기 (자기 것만 — 서버에서도 막는다)
import { h, once, toast } from '../ui.js';
import { call } from './core.js';
import { TEMPLATES } from './items.js';

export function itemTools(item, onChange, extraButtons = []) {
  const box = h('div', { class: 'stack' });
  const row = h('div', { class: 'row tools' });

  const edit = h('button', { class: 'btn ghost small', 'data-edit': item.id }, '고치기');
  edit.addEventListener('click', () => {
    if (box.children.length) { box.replaceChildren(); return; }
    box.replaceChildren(editForm(item, async () => { box.replaceChildren(); await onChange(); }));
  });

  const del = h('button', { class: 'btn ghost small', 'data-del': item.id }, '지우기');
  let armed = false;
  del.addEventListener('click', () => once(del, async () => {
    if (!armed) { armed = true; del.textContent = '정말 지울까요?'; setTimeout(() => { armed = false; del.textContent = '지우기'; }, 3500); return; }
    try { await call('item/delete', { kind: item.kind, id: item.id }); toast('지웠어요'); await onChange(); } catch (e) { toast(e.message); }
  }));

  row.append(...extraButtons, edit, del);
  return h('div', { class: 'stack' }, row, box);
}

function editForm(item, done) {
  const err = h('div', { class: 'error', role: 'alert' });
  const save = h('button', { class: 'btn small', 'data-save-edit': item.id }, '저장');
  let collect;

  const fields = [];
  if (item.kind === 'sentence') {
    const text = h('textarea', { rows: '2', maxlength: '200', 'aria-label': '책 속 문장' }); text.value = item.text;
    const page = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '9999', 'aria-label': '쪽수' }); page.value = item.page;
    const reason = h('input', { maxlength: '100', 'aria-label': '고른 이유' }); reason.value = item.reason;
    fields.push(text, page, reason);
    collect = () => ({ text: text.value, page: page.value, reason: reason.value });
  } else if (item.kind === 'question') {
    const text = h('textarea', { rows: '2', maxlength: '150', 'aria-label': '질문' }); text.value = item.text;
    fields.push(text);
    collect = () => ({ text: text.value });
  } else if (item.type === 'bookmark') {
    let chosen = item.template;
    const btns = TEMPLATES.map((t) => {
      const b = h('button', { class: 'tab' + (t.id === chosen ? ' on' : ''), type: 'button', 'data-template': t.id }, t.name);
      b.addEventListener('click', () => { chosen = t.id; btns.forEach((x) => x.classList.toggle('on', x === b)); });
      return b;
    });
    fields.push(h('div', { class: 'tabs' }, btns));
    collect = () => ({ template: chosen });
  } else if (item.type === 'drawing') {
    const caption = h('input', { maxlength: '100', 'aria-label': '한 줄 설명' }); caption.value = item.caption;
    fields.push(caption);
    collect = () => ({ caption: caption.value });
  } else {
    const title = h('input', { maxlength: '40', 'aria-label': '표지 제목' }); title.value = item.title;
    fields.push(title);
    collect = () => ({ title: title.value });
  }

  save.addEventListener('click', () => once(save, async () => {
    err.textContent = '';
    try { await call('item/edit', { kind: item.kind, id: item.id, ...collect() }); toast('고쳤어요'); await done(); } catch (e) { err.textContent = e.message; }
  }));
  return h('div', { class: 'card stack' }, ...fields, err, save);
}
