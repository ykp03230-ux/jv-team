// 마을 화면(TV): 10초마다 새로고침해서 마을 EXP, 건물 해금, 집 단계 변화가 보이게 한다.
// 개인 순위나 개인 EXP 는 서버가 보내 주지도 않고, 화면에도 없다.
import { api, teacherSession, studentSession } from './api.js';
import { h, mount, once, fmt } from './ui.js';
import { houseSVG, buildingSVG } from './art.js';
import { itemEl, setImageRenderer } from './student/items.js';
import { zoomable, closeZoom } from './student/zoom.js';

export const REFRESH_MS = 10000; // 10초
const root = document.getElementById('app');
const STAGE_ORDER = ['plot', 'pit', 'thatch', 'tile'];
// 게이지 눈금: 해금 EXP 를 같은 간격으로 늘어놓고 그 사이는 비례해서 채운다
const MARKS = [0, 300, 800, 1500, 3000];

let prev = null;
let timer = null;
let bannerQueue = [];
let bannerBusy = false;

const savedToken = () => (teacherSession.get()?.token || studentSession.get()?.token || null);

async function tick() {
  const token = savedToken();
  if (!token) return showLogin();
  try {
    const d = await api('village/get', {}, token);
    detectChanges(d);
    render(d);
    prev = d;
    loadRoom(); // 집을 열어 보고 있으면 그 집도 같이 새로고침
    document.getElementById('v-updated') && (document.getElementById('v-updated').textContent = `마지막 확인 ${new Date().toLocaleTimeString('ko-KR')}`);
  } catch (e) {
    if (e.status === 401) { teacherSession.clear(); studentSession.clear(); return showLogin(); }
    const el = document.getElementById('v-updated');
    if (el) el.textContent = '연결을 확인하는 중…';
  }
}

function start() {
  clearInterval(timer);
  tick();
  timer = setInterval(tick, REFRESH_MS);
}

function showLogin() {
  clearInterval(timer);
  closeRoom();
  const code = h('input', { id: 'v-code', placeholder: '반 코드', maxlength: '6', autocapitalize: 'characters' });
  const pw = h('input', { id: 'v-pw', type: 'password', placeholder: '선생님 비밀번호' });
  const err = h('div', { class: 'error' });
  const go = h('button', { class: 'btn block', id: 'v-login' }, '마을 화면 열기');
  go.addEventListener('click', () => once(go, async () => {
    try {
      const r = await api('teacher/login', { code: code.value, password: pw.value });
      teacherSession.set({ code: r.code, token: r.token });
      start();
    } catch (e) { err.textContent = e.message; }
  }));
  mount(root, h('div', { class: 'wrap' }, h('h1', { class: 'center' }, 'TEXTOPIA 마을'),
    h('div', { class: 'card stack' }, h('p', { class: 'muted' }, '교사 노트북에서 한 번 로그인하면 이 화면이 열려요.'), code, pw, err, go)));
}

function detectChanges(d) {
  if (!prev) return;
  const was = new Set(prev.village.buildings.filter((b) => b.unlocked).map((b) => b.id));
  for (const b of d.village.buildings) if (b.unlocked && !was.has(b.id)) bannerQueue.push({ text: `마을에 ${b.name}가 열렸어요!`, building: b.id });
  const before = Object.fromEntries(prev.houses.map((x) => [x.id, STAGE_ORDER.indexOf(x.stage.key)]));
  for (const x of d.houses) {
    if (x.id in before && STAGE_ORDER.indexOf(x.stage.key) > before[x.id]) bannerQueue.push({ text: `${x.nick}의 집이 ${x.stage.name}이 되었어요!`, house: x.id });
  }
  showNextBanner();
}

function showNextBanner() {
  if (bannerBusy || !bannerQueue.length) return;
  bannerBusy = true;
  const b = bannerQueue.shift();
  const el = h('div', { class: 'v-banner', role: 'status', id: 'v-banner' }, b.text);
  document.body.append(el);
  setTimeout(() => { el.remove(); bannerBusy = false; showNextBanner(); }, 6000);
}

function gaugePercent(exp) {
  const last = MARKS.length - 1;
  if (exp >= MARKS[last]) return 100;
  let i = 0;
  while (exp >= MARKS[i + 1]) i++;
  return ((i + (exp - MARKS[i]) / (MARKS[i + 1] - MARKS[i])) / last) * 100;
}

function render(d) {
  const v = d.village;
  const newly = new Set(prev ? v.buildings.filter((b) => b.unlocked && !prev.village.buildings.find((p) => p.id === b.id)?.unlocked).map((b) => b.id) : []);
  const grewHouse = new Set(prev ? d.houses.filter((x) => { const p = prev.houses.find((y) => y.id === x.id); return p && STAGE_ORDER.indexOf(x.stage.key) > STAGE_ORDER.indexOf(p.stage.key); }).map((x) => x.id) : []);

  const ticks = MARKS.slice(1).map((m, i) => {
    const b = v.buildings.find((x) => x.at === m);
    return h('span', { class: 'v-tick' + (v.exp >= m ? ' on' : ''), style: `left:${((i + 1) / (MARKS.length - 1)) * 100}%` }, `${b ? b.name + ' ' : ''}${fmt(m)}`);
  });

  mount(root, h('div', { class: 'v-wrap' },
    h('div', { class: 'v-head' },
      h('h1', {}, `${d.class.name} 마을`),
      h('div', { class: 'v-gauge-box' },
        h('div', { class: 'v-gauge-top' },
          h('span', { class: 'v-exp', id: 'v-exp' }, `마을 EXP ${fmt(v.exp)}`),
          h('span', { class: 'v-next', id: 'v-next' }, v.next ? `다음 건물 ${v.next.name}까지 ${fmt(v.next.at - v.exp)}` : '모든 건물이 열렸어요!')),
        h('div', { class: 'v-gauge', 'aria-label': '마을 EXP 게이지' }, h('i', { style: `width:${gaugePercent(v.exp)}%`, id: 'v-fill' }), ticks))),
    h('div', { class: 'v-buildings', id: 'v-buildings' }, v.buildings.map((b) =>
      h('div', { class: 'v-building' + (newly.has(b.id) ? ' new' : ''), 'data-building': b.id, 'data-unlocked': String(b.unlocked) },
        h('div', { html: buildingSVG(b.id, b.unlocked) }),
        h('div', { class: 'name' }, b.name),
        h('div', { class: 'req' }, b.unlocked ? b.note : `🔒 EXP ${fmt(b.at)}에 열려요`)))),
    h('div', { class: 'v-houses', id: 'v-houses', style: `--rows:${Math.max(1, Math.ceil(d.houses.length / 5))}` }, d.houses.map((x) =>
      h('div', { class: 'v-house' + (grewHouse.has(x.id) ? ' up' : ''), 'data-house': x.id, 'data-stage': x.stage.key, role: 'button', tabindex: '0', 'aria-label': `${x.nick}의 집 구경하기` },
        h('div', { html: houseSVG(x.stage.key, x.equipped) }),
        h('div', { class: 'nick' }, x.nick)))),
    h('div', { class: 'v-foot' }, h('span', {}, '10초마다 새로고침돼요 · 집을 누르면 구경할 수 있어요'), h('span', { id: 'v-updated' }, ''))));
}

// ── 학생 집 구경: 집을 누르면 그 집의 모습·pick 문장·전시 칸을 크게 보여 준다(보기만, 기록은 바뀌지 않는다) ──
// 창은 #app 바깥(body)에 두어서 10초마다 화면이 새로 그려져도 닫히지 않는다.
const imgCache = new Map(); // 사진 id → 객체 주소
function loadImg(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  const p = fetch('/api/img/' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + savedToken() } })
    .then((r) => { if (!r.ok) throw new Error('사진을 불러오지 못했어요'); return r.blob(); })
    .then((b) => URL.createObjectURL(b));
  imgCache.set(id, p);
  p.catch(() => imgCache.delete(id));
  return p;
}
setImageRenderer((id, alt) => { // 그림 독서록·책 표지의 사진 (교사 또는 학생 로그인 정보를 붙여 불러온다)
  const img = h('img', { class: 'photo', alt: alt || '사진', decoding: 'async', 'data-img': id });
  loadImg(id).then((url) => { img.src = url; }).catch(() => img.replaceWith(h('div', { class: 'img-todo' }, '사진을 불러오지 못했어요')));
  return img;
});

let roomEl = null;
let roomId = null;
let roomSig = '';

function closeRoom() {
  closeZoom(); // 크게 보던 작품이 있으면 함께 닫는다
  roomEl?.remove();
  roomEl = null; roomId = null; roomSig = '';
}

function roomMessage(text) {
  roomEl?.replaceChildren(h('div', { class: 'v-room' },
    h('button', { class: 'btn ghost v-room-close', id: 'v-room-close', type: 'button', onclick: closeRoom }, '닫기 ✕'),
    h('p', { class: 'v-room-msg', id: 'v-room-msg' }, text)));
}

function paintRoom({ house, slots, pick }, first) {
  const shown = slots.filter(Boolean);
  roomEl.replaceChildren(h('div', { class: 'v-room', tabindex: '-1' },
    h('button', { class: 'btn ghost v-room-close', id: 'v-room-close', type: 'button', onclick: closeRoom }, '닫기 ✕'),
    h('h2', { id: 'v-room-title' }, `${house.nick}의 집`),
    h('div', { class: 'v-room-body' },
      h('div', { class: 'v-room-house' },
        h('div', { class: 'scene', html: houseSVG(house.stage.key, house.equipped) }),
        h('strong', { id: 'v-room-stage' }, house.stage.name),
        pick
          ? h('div', { class: 'v-room-pick', id: 'v-room-pick' },
            h('div', { class: 'muted' }, `📌 ${house.nick}의 pick 문장`),
            h('p', { class: 'sentence-text' }, pick.text),
            h('p', { class: 'muted' }, `《${pick.bookTitle}》 ${pick.page}쪽`))
          : null),
      h('div', { class: 'v-room-side' },
        h('h3', {}, '전시 칸'),
        shown.length
          ? h('div', { class: 'v-room-slots', id: 'v-room-slots' }, shown.map((item) => zoomable(h('div', { class: 'v-slot' }, itemEl(item, { mini: true })), item)))
          : h('p', { class: 'muted', id: 'v-room-empty' }, '아직 전시한 것이 없어요.'),
        shown.length ? h('p', { class: 'muted v-room-hint' }, '작품을 누르면 크게 볼 수 있어요.') : null))));
  if (first) roomEl.querySelector('.v-room')?.focus(); // 창에 둔다(스페이스로 열었을 때 같은 키가 닫기 버튼을 눌러 버리지 않게)
}

/** 열려 있는 집을 불러온다. 내용이 그대로면 다시 그리지 않는다(사진이 깜박이지 않게). */
async function loadRoom(first = false) {
  const id = roomId; const token = savedToken();
  if (!id || !token) return;
  try {
    const d = await api('village/house', { studentId: id }, token);
    if (roomId !== id) return; // 그 사이 닫았거나 다른 집을 열었다
    const sig = JSON.stringify(d);
    if (sig === roomSig) return;
    roomSig = sig;
    paintRoom(d, first);
  } catch (e) {
    if (roomId !== id) return;
    if (e.status === 404) roomMessage('이 학생의 집을 찾을 수 없어요.');
    else if (first) roomMessage('집을 불러오지 못했어요. 닫고 다시 눌러 주세요.');
  }
}

function openRoom(id, nick) {
  closeRoom();
  roomId = id;
  roomEl = h('div', { class: 'v-room-back', id: 'v-room-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${nick}의 집` });
  roomEl.addEventListener('click', (ev) => { if (ev.target === roomEl) closeRoom(); }); // 바깥을 누르면 닫힘
  document.body.append(roomEl);
  roomMessage('집으로 가는 중…');
  loadRoom(true);
}

const houseOf = (ev) => ev.target.closest?.('.v-house');
root.addEventListener('click', (ev) => {
  const el = houseOf(ev);
  if (el) openRoom(el.dataset.house, el.querySelector('.nick')?.textContent || '');
});
root.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const el = houseOf(ev);
  if (!el) return;
  ev.preventDefault();
  openRoom(el.dataset.house, el.querySelector('.nick')?.textContent || '');
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && roomEl) closeRoom(); });

start();
