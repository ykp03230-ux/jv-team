// 학생 화면: 입장 → 홈/서당/친구 … (화면 이동은 주소의 # 뒷부분으로)
import { api, ApiFail, studentSession } from './api.js';
import { PILOT } from './config.js';
import { h, mount, toast, once, fmt } from './ui.js';
import { S, call } from './student/core.js';
import { renderHome } from './student/home.js';
import { renderDang } from './student/dang.js';
import { renderFriends } from './student/friends.js';
import { renderHouse } from './student/house.js';
import { renderBooks } from './student/books.js';
import { renderMuseum } from './student/museum.js';
import { renderShop } from './student/shop.js';
import { imgEl } from './student/images.js';
import { setImageRenderer } from './student/items.js';

setImageRenderer(imgEl); // 그림 독서록·책 표지의 사진을 보여 주는 방법

const root = document.getElementById('app');

// 하단 탭. 단계가 늘면 화면이 하나씩 더해진다.
const TABS = [
  { id: 'home', label: '홈', icon: '🏡', render: renderHome },
  { id: 'dang', label: '서당', icon: '📜', render: renderDang },
  { id: 'books', label: '책', icon: '📚', render: renderBooks },
  { id: 'house', label: '내 집', icon: '🏠', render: renderHouse },
  { id: 'friends', label: '친구', icon: '🧑‍🤝‍🧑', render: renderFriends },
  { id: 'museum', label: '박물관', icon: '🏛️', render: renderMuseum },
  { id: 'shop', label: '장터', icon: '🏮', render: renderShop, hidden: true }, // 아래 탭에는 없고 홈·내 집에서 들어간다
];

async function boot() {
  const s = studentSession.get();
  if (s?.token) {
    try {
      S.me = (await api('me', {}, s.token)).me;
      return showApp();
    } catch (e) {
      if (e instanceof ApiFail && e.status === 0) { // 인터넷이 잠깐 끊긴 경우: 로그인은 지우지 않는다
        return mount(root, h('p', { class: 'center' }, e.message), h('button', { class: 'btn block', onclick: boot }, '다시 시도'));
      }
      studentSession.clear();
    }
  }
  showLogin(s?.code);
}

// ── 입장 ─────────────────────────────────────────────────
function showLogin(lastCode = '') {
  document.body.classList.remove('in-app');
  // 파일럿: 반 코드와 PIN 은 config.js 의 값으로 자동 입력하고 칸을 보이지 않는다
  const pilot = !!PILOT.classCode;
  const code = h('input', { id: 'code', value: lastCode || '', placeholder: '선생님이 알려 준 코드', autocapitalize: 'characters', autocomplete: 'off', maxlength: '10' });
  const nick = h('input', { id: 'nick', placeholder: '별명 (실명은 쓰지 않아요)', maxlength: '10', autocomplete: 'off' });
  const pin = h('input', { id: 'pin', placeholder: '숫자 4자리', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', type: 'password', autocomplete: 'off' });
  const err = h('div', { class: 'error', role: 'alert' });
  const go = h('button', { class: 'btn block', id: 'join' }, '들어가기');

  go.addEventListener('click', () => once(go, async () => {
    err.textContent = '';
    try {
      const sendCode = pilot ? PILOT.classCode : code.value;
      const r = await api('student/join', { code: sendCode, nick: nick.value, pin: pilot ? PILOT.pin : pin.value });
      studentSession.set({ code: sendCode.trim().toUpperCase(), token: r.token, nick: nick.value.trim() });
      S.me = r.me;
      location.hash = '#/home';
      showApp();
      if (r.created) toast(`${S.me.nick}, 마을에 온 것을 환영해요!`);
    } catch (e) { err.textContent = e.message; }
  }));
  [code, nick, pin].forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go.click(); }));
  if (pilot) setTimeout(() => nick.focus(), 0);

  mount(root,
    h('div', { class: 'center' }, h('h1', {}, 'TEXTOPIA'), h('p', { class: 'muted' }, '책과 문장으로 나의 취향이 담긴 독서마을을 만들어요')),
    h('div', { class: 'card stack' },
      pilot ? null : h('div', {}, h('label', { for: 'code' }, '반 코드'), code),
      h('div', {}, h('label', { for: 'nick' }, '닉네임'), nick),
      pilot ? null : h('div', {}, h('label', { for: 'pin' }, 'PIN 4자리'), pin),
      err, go,
      h('p', { class: 'muted' }, '처음 쓰는 닉네임이면 새로 만들어져요. 이름·학번·전화번호는 쓰지 않아요.'),
    ),
  );
}

// ── 앱 틀 (윗줄 + 화면 + 아래 탭) ───────────────────────────
function showApp() {
  document.body.classList.add('in-app');
  const chips = h('div', { class: 'row chips' },
    h('span', { class: 'chip', title: '코인' }, '🪙 ', h('b', { id: 'coins-chip' }, fmt(S.me.coins))),
    h('span', { class: 'chip', title: 'EXP' }, '✨ ', h('b', { id: 'exp-chip' }, fmt(S.me.exp))));
  const out = h('button', { class: 'btn ghost small', id: 'logout' }, '나가기');
  out.addEventListener('click', () => once(out, async () => {
    try { await call('logout'); } catch { /* 이미 만료됨 */ }
    studentSession.clear(); S.me = null; location.hash = ''; showLogin();
  }));
  const view = h('div', { id: 'view', class: 'stack' });
  const nav = h('nav', { class: 'tabbar', 'aria-label': '메뉴' }, TABS.filter((t) => !t.hidden).map((t) =>
    h('a', { href: '#/' + t.id, 'data-tab': t.id }, h('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon), h('span', {}, t.label))));
  mount(root, h('div', { class: 'row between topbar' }, chips, out), view, nav);

  window.onhashchange = () => draw(view, nav);
  window.addEventListener('me-updated', () => {
    if (!S.me) return;
    document.getElementById('coins-chip')?.replaceChildren(fmt(S.me.coins));
    document.getElementById('exp-chip')?.replaceChildren(fmt(S.me.exp));
  });
  draw(view, nav);
}

async function draw(view, nav) {
  const m = location.hash.match(/^#\/([a-z]+)(?:\/([A-Za-z0-9_-]+))?/) || [];
  const tab = TABS.find((t) => t.id === m[1]) || TABS[0];
  root.classList.toggle('village-wide', tab.id === 'home');
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab.id));
  try { await tab.render(view, m[2]); } catch (e) { view.replaceChildren(h('p', { class: 'error' }, e.message)); }
  window.scrollTo(0, 0);
}

boot();
