// 마을 화면(TV): 10초마다 새로고침해서 마을 EXP, 건물 해금, 집 단계 변화가 보이게 한다.
// 개인 순위나 개인 EXP 는 서버가 보내 주지도 않고, 화면에도 없다.
import { api, teacherSession, studentSession } from './api.js';
import { h, mount, once, fmt } from './ui.js';
import { houseSVG, buildingSVG } from './art.js';

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
      h('div', { class: 'v-house' + (grewHouse.has(x.id) ? ' up' : ''), 'data-house': x.id, 'data-stage': x.stage.key },
        h('div', { html: houseSVG(x.stage.key, x.equipped) }),
        h('div', { class: 'nick' }, x.nick)))),
    h('div', { class: 'v-foot' }, h('span', {}, '10초마다 새로고침돼요'), h('span', { id: 'v-updated' }, ''))));
}

start();
