// 그림판: 손가락·마우스로 그린다. 연필/지우개, 색 8가지, 굵기 3가지, 되돌리기, 모두 지우기.
// 그린 그림은 800 x 600 JPEG(1MB 이하)로 내보내서, 사진 올리기와 같은 길(img/upload)로 올린다.
import { h } from '../ui.js';

const W = 800;
const H = 600;
const MAX_BYTES = 1000000;
const COLORS = [
  ['#1E1B18', '먹색'], ['#B5452B', '주홍'], ['#E8A23C', '주황'], ['#F2D14B', '노랑'],
  ['#6F9A4F', '초록'], ['#4F8FB0', '파랑'], ['#6A5ACD', '보라'], ['#8A5A3C', '갈색'],
];
const SIZES = [['s', 4, '가늘게'], ['m', 10, '보통'], ['l', 24, '굵게']];

export function drawingBoard({ onDraw } = {}) {
  const canvas = h('canvas', { width: String(W), height: String(H), class: 'board-canvas', id: 'board-canvas', role: 'img', 'aria-label': '그림판' });
  const ctx = canvas.getContext('2d');
  const strokes = []; // { color, size, erase, pts:[{x,y}] }
  let tool = 'pen'; let color = COLORS[0][0]; let size = SIZES[1][1]; let cur = null;

  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const style = (s) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = s.erase ? '#fff' : s.color; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = s.size; };
  const dot = (s) => { style(s); ctx.beginPath(); ctx.arc(s.pts[0].x, s.pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill(); };
  // 점들을 부드러운 곡선으로 잇는다. 그리는 중(조각마다)과 되돌리기 뒤 다시 그리기가 같은 길을 그린다.
  const piece = (s, n) => { // n 번째 점이 막 들어왔을 때 새로 생긴 조각
    const p = s.pts; style(s); ctx.beginPath();
    if (n >= 3) { const a = n === 3 ? p[0] : mid(p[n - 3], p[n - 2]); ctx.moveTo(a.x, a.y); const e = mid(p[n - 2], p[n - 1]); ctx.quadraticCurveTo(p[n - 2].x, p[n - 2].y, e.x, e.y); ctx.stroke(); }
  };
  const tail = (s) => { // 손을 뗄 때 마지막 점까지 잇는다
    const p = s.pts; const n = p.length; if (n < 2) return; style(s); ctx.beginPath();
    const a = n === 2 ? p[0] : mid(p[n - 2], p[n - 1]); ctx.moveTo(a.x, a.y); ctx.lineTo(p[n - 1].x, p[n - 1].y); ctx.stroke();
  };
  const whole = (s) => { if (s.pts.length === 1) { dot(s); return; } for (let n = 3; n <= s.pts.length; n++) piece(s, n); tail(s); };
  const redraw = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); strokes.forEach(whole); };
  redraw();

  const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
    cur = { color, size, erase: tool === 'eraser', pts: [at(e)] };
    strokes.push(cur); dot(cur); onDraw?.(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (list.length ? list : [e])) { cur.pts.push(at(ev)); piece(cur, cur.pts.length); }
    e.preventDefault();
  });
  const end = () => { if (!cur) return; tail(cur); cur = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (e.buttons === 0) end(); });

  // ── 도구 ──
  const toolBtns = [['pen', '✏️ 연필'], ['eraser', '🧽 지우개']].map(([id, label]) =>
    h('button', { class: 'tab' + (id === tool ? ' on' : ''), type: 'button', 'data-tool': id, onclick: () => { tool = id; toolBtns.forEach((b) => b.classList.toggle('on', b.dataset.tool === id)); } }, label));
  const sizeBtns = SIZES.map(([id, px, label]) =>
    h('button', { class: 'tab' + (px === size ? ' on' : ''), type: 'button', 'data-size': id, onclick: () => { size = px; sizeBtns.forEach((b) => b.classList.toggle('on', b.dataset.size === id)); } }, label));
  const swatches = COLORS.map(([c, name]) =>
    h('button', { class: 'swatch' + (c === color ? ' on' : ''), type: 'button', 'data-color': c, 'aria-label': name, style: `background:${c}`, onclick: () => { color = c; tool = 'pen'; swatches.forEach((b) => b.classList.toggle('on', b.dataset.color === c)); toolBtns.forEach((b) => b.classList.toggle('on', b.dataset.tool === 'pen')); } }));

  const undo = h('button', { class: 'btn ghost small', type: 'button', id: 'board-undo', onclick: () => { if (strokes.length) { strokes.pop(); redraw(); onDraw?.(); } } }, '↩ 되돌리기');
  const clear = h('button', { class: 'btn ghost small', type: 'button', id: 'board-clear' }, '모두 지우기');
  let armed = false;
  clear.addEventListener('click', () => {
    if (!armed) { armed = true; clear.textContent = '정말 지울까요?'; setTimeout(() => { armed = false; clear.textContent = '모두 지우기'; }, 3500); return; }
    armed = false; clear.textContent = '모두 지우기'; strokes.length = 0; redraw(); onDraw?.();
  });

  const el = h('div', { class: 'board stack', id: 'board' },
    h('div', { class: 'tabs' }, toolBtns),
    h('div', { class: 'swatches' }, swatches),
    h('div', { class: 'tabs' }, sizeBtns),
    canvas,
    h('div', { class: 'row' }, undo, clear));

  return {
    el,
    isBlank: () => strokes.length === 0,
    strokeCount: () => strokes.length,
    /** 800 x 600 JPEG. 1MB 를 넘으면 품질을 낮춘다. */
    async toBlob() {
      let q = 0.9;
      for (;;) {
        const b = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
        if (b && (b.size <= MAX_BYTES || q <= 0.4)) return b;
        q -= 0.15;
      }
    },
  };
}
