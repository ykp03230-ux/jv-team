// 화면 만들기 도우미 (프레임워크 없이 DOM 을 직접 만든다)

/** h('div', {class:'card', onclick:fn}, '글자', 자식요소...) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // 서버가 준 글자는 쓰지 않는다 — 우리가 만든 SVG 에만 사용
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

export function mount(root, ...children) {
  root.replaceChildren();
  children.forEach((c) => c && root.append(c));
}

let toastTimer;
export function toast(message, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/** 버튼을 한 번만 눌리게 한다 (서버에서도 막지만, 화면에서도 두 번 누르기를 줄인다) */
export async function once(button, fn) {
  if (button.disabled) return;
  button.disabled = true;
  try { return await fn(); } finally { button.disabled = false; }
}

export const fmt = (n) => Number(n).toLocaleString('ko-KR');
