// 교사 화면
import { api, ApiFail, teacherSession } from './api.js';
import { h, mount, toast, once, fmt } from './ui.js';
import { certPanel, museumPanel, sentencePanel, booksPanel } from './teacher/panels.js';

const root = document.getElementById('app');
let ov = null;

async function boot() {
  const s = teacherSession.get();
  if (s?.token) {
    try { return await refresh(); }
    catch (e) {
      if (e instanceof ApiFail && e.status === 0) return mount(root, h('p', {}, e.message), h('button', { class: 'btn', onclick: boot }, '다시 시도'));
      teacherSession.clear();
    }
  }
  showEntry();
}

async function refresh() {
  ov = await api('teacher/overview', {}, teacherSession.get().token);
  showDashboard();
}

// ── 반 만들기 / 교사 로그인 ───────────────────────────────
function showEntry() {
  const name = h('input', { id: 'class-name', placeholder: '예: 5학년 3반', maxlength: '30' });
  const pw1 = h('input', { id: 'new-pw', type: 'password', placeholder: '6자 이상', autocomplete: 'new-password' });
  const err1 = h('div', { class: 'error', role: 'alert' });
  const create = h('button', { class: 'btn block', id: 'create' }, '반 만들기');
  create.addEventListener('click', () => once(create, async () => {
    err1.textContent = '';
    try {
      const r = await api('class/create', { name: name.value, password: pw1.value });
      teacherSession.set({ code: r.code, token: r.token });
      await refresh();
    } catch (e) { err1.textContent = e.message; }
  }));

  const code = h('input', { id: 'login-code', placeholder: '반 코드', maxlength: '6', autocapitalize: 'characters', value: teacherSession.get()?.code || '' });
  const pw2 = h('input', { id: 'login-pw', type: 'password', placeholder: '비밀번호', autocomplete: 'current-password' });
  const err2 = h('div', { class: 'error', role: 'alert' });
  const login = h('button', { class: 'btn block ghost', id: 'login' }, '로그인');
  login.addEventListener('click', () => once(login, async () => {
    err2.textContent = '';
    try {
      const r = await api('teacher/login', { code: code.value, password: pw2.value });
      teacherSession.set({ code: r.code, token: r.token });
      await refresh();
    } catch (e) { err2.textContent = e.message; }
  }));

  mount(root,
    h('div', { class: 'center' }, h('h1', {}, 'TEXTOPIA'), h('p', { class: 'muted' }, '선생님 화면')),
    h('div', { class: 'row', style: 'align-items:stretch' },
      h('div', { class: 'card stack grow' },
        h('h2', {}, '새 반 만들기'),
        h('div', {}, h('label', { for: 'class-name' }, '반 이름'), name),
        h('div', {}, h('label', { for: 'new-pw' }, '선생님 비밀번호 (처음 한 번만 정해요)'), pw1),
        err1, create),
      h('div', { class: 'card stack grow' },
        h('h2', {}, '이미 만든 반'),
        h('div', {}, h('label', { for: 'login-code' }, '반 코드'), code),
        h('div', {}, h('label', { for: 'login-pw' }, '비밀번호'), pw2),
        err2, login),
    ),
  );
}

// ── 대시보드 ──────────────────────────────────────────────
function showDashboard() {
  const tok = () => teacherSession.get().token;

  // 지우는 버튼은 한 번 더 확인한다 (브라우저 기본 팝업 대신 화면 안에서)
  const seedBox = h('div', { class: 'row' });
  const showSeedButton = () => {
    const b = h('button', { class: 'btn', id: 'seed' }, '예시 데이터 다시 채우기');
    b.addEventListener('click', showSeedConfirm);
    seedBox.replaceChildren(b);
  };
  const showSeedConfirm = () => {
    const yes = h('button', { class: 'btn', id: 'seed-confirm' }, '모두 지우고 다시 채우기');
    const no = h('button', { class: 'btn ghost', id: 'seed-cancel', onclick: showSeedButton }, '취소');
    yes.addEventListener('click', () => once(yes, async () => {
      try {
        const r = await api('teacher/seed', {}, tok());
        toast(`예시 데이터를 채웠어요 (학생 ${r.summary.students}명, 작품 ${r.summary.subs}개)`);
        await refresh();
      } catch (e) { toast(e.message); showSeedButton(); }
    }));
    seedBox.replaceChildren(h('p', { class: 'grow' }, '지금 있는 학생·작품·투표 데이터를 모두 지우고 예시 데이터로 채워요.'), yes, no);
  };
  showSeedButton();

  const out = h('button', { class: 'btn ghost small', id: 'teacher-logout' }, '로그아웃');
  out.addEventListener('click', () => once(out, async () => {
    try { await api('logout', {}, tok()); } catch { /* 이미 만료됨 */ }
    teacherSession.clear(); ov = null; showEntry();
  }));

  mount(root,
    h('div', { class: 'row between' }, h('h1', {}, 'TEXTOPIA'), out),
    h('div', { class: 'card stack' },
      h('p', { class: 'muted' }, `${ov.class.name} · 학생은 이 코드로 입장해요`),
      h('div', { class: 'code-box', id: 'class-code' }, ov.class.code),
      seedBox,
      h('a', { class: 'btn ghost', id: 'open-village', href: '/village.html', target: '_blank', rel: 'noopener' }, '마을 화면 열기 (TV용)'),
      h('p', { class: 'muted' }, `오늘 ${ov.class.today} · 마을 EXP ${fmt(ov.village.exp)}`),
    ),
    certPanel(refresh),
    museumPanel(refresh),
    sentencePanel(),
    booksPanel(),
    h('div', { class: 'card', style: 'margin-top:12px' },
      h('h2', {}, `학생 ${ov.students.length}명`),
      ov.students.length === 0
        ? h('p', { class: 'muted' }, '아직 입장한 학생이 없어요.')
        : h('div', { class: 'table-scroll' }, h('table', { id: 'students' },
            h('thead', {}, h('tr', {}, h('th', {}, '닉네임'), h('th', {}, '집'), h('th', {}, 'EXP'), h('th', {}, '코인'))),
            h('tbody', {}, ov.students.map((s) => h('tr', {}, h('td', {}, s.nick), h('td', {}, s.stage), h('td', {}, fmt(s.exp)), h('td', {}, fmt(s.coins))))))),
    ),
  );
}

boot();
