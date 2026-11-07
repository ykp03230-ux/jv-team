// 교사 화면의 칸들: 학생 계정 추가, 읽음 인증, 오늘의 문장, 학생이 추가한 책
import { api, teacherSession } from '../api.js';
import { h, toast, once } from '../ui.js';

const tok = () => teacherSession.get().token;

function panel(id, build) {
  const box = h('div', { class: 'card stack', style: 'margin-top:12px', id });
  const load = async () => {
    try { box.replaceChildren(...(await build(load, box))); } catch (e) { box.replaceChildren(h('p', { class: 'error' }, e.message)); }
  };
  load();
  return box;
}

// ── 학생 계정 추가 (PIN 은 모두 0000) ──────────────────────
let lastRoster = null; // 추가 결과: 대시보드를 새로 그려도 메시지가 남게 한다

export function rosterPanel(onChanged) {
  const box = h('div', { class: 'card stack', style: 'margin-top:12px', id: 'roster-panel' });
  const text = h('textarea', { id: 'roster-nicks', rows: '5', placeholder: '닉네임을 한 줄에 한 명씩 써 주세요\n예)\n다온\n하람\n별이' });
  const result = h('div', { class: 'stack', id: 'roster-result', 'aria-live': 'polite' });
  const show = (r) => result.replaceChildren(
    h('p', { class: 'ok', id: 'roster-added' }, `${r.added.length}명을 추가했어요. (전체 ${r.total}명, PIN 은 모두 0000)`),
    r.skipped.length ? h('p', { class: 'error', id: 'roster-skipped' }, '건너뛴 닉네임: ' + r.skipped.map((s) => `${s.nick} (${s.reason})`).join(', ')) : null);
  if (lastRoster) { show(lastRoster); lastRoster = null; }
  const add = h('button', { class: 'btn', id: 'roster-add' }, '학생 계정 추가');
  add.addEventListener('click', () => once(add, async () => {
    result.replaceChildren();
    try {
      const r = await api('teacher/students/add', { nicks: text.value }, tok());
      text.value = '';
      lastRoster = r;
      show(r);
      onChanged?.(); // 아래 학생 목록을 새로 그린다 (위 메시지는 lastRoster 로 다시 보여 준다)
    } catch (e) { result.replaceChildren(h('p', { class: 'error' }, e.message)); }
  }));

  // 모든 학생 PIN 을 0000 으로 맞추기 (한 번 더 눌러 확인)
  const pinBox = h('div', { class: 'row' });
  const showPinButton = () => {
    const b = h('button', { class: 'btn ghost small', id: 'roster-pin' }, '모든 학생 PIN 을 0000 으로 통일');
    b.addEventListener('click', showPinConfirm);
    pinBox.replaceChildren(b);
  };
  const showPinConfirm = () => {
    const yes = h('button', { class: 'btn small', id: 'roster-pin-confirm' }, '네, 모두 0000 으로');
    const no = h('button', { class: 'btn ghost small', onclick: showPinButton }, '취소');
    yes.addEventListener('click', () => once(yes, async () => {
      try { const r = await api('teacher/students/reset-pin', {}, tok()); toast(`${r.count}명의 PIN 을 0000 으로 맞췄어요`); } catch (e) { toast(e.message); }
      showPinButton();
    }));
    pinBox.replaceChildren(h('span', { class: 'grow' }, '학생이 정했던 PIN 이 모두 사라져요.'), yes, no);
  };
  showPinButton();

  box.replaceChildren(
    h('h2', {}, '학생 계정 추가'),
    h('p', { class: 'muted' }, '만든 계정의 PIN 은 모두 0000 이에요. 학생은 닉네임만 쓰고 들어와요.'),
    text, add, result, h('hr'), pinBox);
  return box;
}

// ── 일자별 퀘스트·출석 현황 (학생 전체) ─────────────────────
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (date) => `${date.slice(5, 7)}/${date.slice(8, 10)}(${WEEKDAY[new Date(date + 'T00:00:00Z').getUTCDay()]})`;
let dailyDays = 14;     // 보는 기간(일)
let dailyDate = null;   // 자세히 볼 날짜 (null 이면 오늘)

export function dailyPanel() {
  return panel('daily-panel', async (reload) => {
    const d = await api('teacher/daily', { days: dailyDays }, tok());
    const date = d.dates.includes(dailyDate) ? dailyDate : d.today;
    const tot = d.totals.find((x) => x.date === date);
    const mark = (on) => h('td', { class: on ? 'yes' : 'no', 'aria-label': on ? '했어요' : '안 했어요' }, on ? '✔' : '–');

    const range = h('select', { id: 'daily-range', 'aria-label': '보는 기간' }, [7, 14, 30].map((n) => h('option', { value: String(n), selected: n === dailyDays }, `최근 ${n}일`)));
    range.addEventListener('change', () => { dailyDays = Number(range.value); reload(); });
    const pick = h('select', { id: 'daily-date', 'aria-label': '자세히 볼 날짜' }, [...d.dates].reverse().map((x) => h('option', { value: x, selected: x === date }, dayLabel(x) + (x === d.today ? ' 오늘' : ''))));
    pick.addEventListener('change', () => { dailyDate = pick.value; reload(); });

    const detail = h('table', { class: 'daily-table', id: 'daily-detail' },
      h('thead', {}, h('tr', {}, ['닉네임', '출석', '①필사', '②읽기', '③친구방문', '보너스'].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.rows.map((r) => { const s = r.days[date]; return h('tr', { 'data-student': r.id }, h('td', {}, r.nick), mark(s.seen), mark(s.sentence), mark(s.read), mark(s.visit), mark(s.bonus)); })));

    // 기간 한눈에 보기: 칸에는 그날 한 퀘스트 개수(0~3), 보너스는 ★, 입장하지 않은 날은 ·
    const grid = h('table', { class: 'daily-table grid', id: 'daily-grid' },
      h('thead', {}, h('tr', {}, h('th', {}, '닉네임'), d.dates.map((x) => h('th', { class: x === date ? 'on' : '' }, dayLabel(x).slice(0, 5))))),
      h('tbody', {}, d.rows.map((r) => h('tr', {}, h('td', {}, r.nick), d.dates.map((x) => {
        const s = r.days[x];
        return h('td', { class: s.seen ? 'seen' : 'none', title: s.seen ? `${s.quests}개${s.bonus ? ' · 보너스' : ''}` : '입장 안 함' }, s.seen ? `${s.quests}${s.bonus ? '★' : ''}` : '·');
      })))),
      h('tfoot', {}, h('tr', {}, h('td', {}, '출석'), d.totals.map((x) => h('td', {}, `${x.seen}`)))));

    return [
      h('h2', {}, '일자별 퀘스트·출석 현황'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'daily-date' }, '자세히 볼 날짜'), pick), h('div', { class: 'grow' }, h('label', { for: 'daily-range' }, '한눈에 볼 기간'), range)),
      h('p', { id: 'daily-summary' }, h('strong', {}, dayLabel(date)), ` · 출석 ${tot.seen}/${tot.students}명 · 필사 ${tot.sentence} · 읽기 ${tot.read} · 친구방문 ${tot.visit} · 보너스 ${tot.bonus}`),
      d.rows.length ? h('div', { class: 'table-scroll' }, detail) : h('p', { class: 'muted' }, '아직 입장한 학생이 없어요.'),
      d.rows.length ? h('details', { open: true }, h('summary', {}, `최근 ${dailyDays}일 한눈에 보기 (칸의 숫자 = 그날 한 퀘스트 개수, ★ = 보너스, · = 입장 안 함)`), h('div', { class: 'table-scroll', style: 'margin-top:8px' }, grid)) : null,
    ].filter(Boolean);
  });
}

// ── 읽음 인증 승인/반려 ───────────────────────────────────
export function certPanel(onChanged) {
  return panel('cert-panel', async (reload) => {
    const { pending } = await api('teacher/certs', {}, tok());
    if (!pending.length) return [h('h2', {}, '읽음 인증 승인'), h('p', { class: 'muted', id: 'cert-empty' }, '기다리는 인증이 없어요.')];
    return [
      h('h2', {}, `읽음 인증 승인 (${pending.length})`),
      ...pending.map((p) => {
        const reason = h('input', { placeholder: '반려 사유 (반려할 때만)', maxlength: '100', 'aria-label': '반려 사유' });
        const ok = h('button', { class: 'btn small', 'data-approve': `${p.studentId}:${p.bookId}` }, '승인 (+30)');
        const no = h('button', { class: 'btn small ghost', 'data-reject': `${p.studentId}:${p.bookId}` }, '반려');
        const err = h('div', { class: 'error', role: 'alert' });
        ok.addEventListener('click', () => once(ok, async () => {
          try { await api('teacher/cert/approve', { studentId: p.studentId, bookId: p.bookId }, tok()); toast(`${p.nick}의 인증을 승인했어요`); await reload(); onChanged?.(); } catch (e) { err.textContent = e.message; }
        }));
        no.addEventListener('click', () => once(no, async () => {
          try { await api('teacher/cert/reject', { studentId: p.studentId, bookId: p.bookId, reason: reason.value }, tok()); toast('반려했어요'); await reload(); } catch (e) { err.textContent = e.message; }
        }));
        return h('div', { class: 'card stack', 'data-cert': `${p.studentId}:${p.bookId}` },
          h('div', {}, h('strong', {}, p.nick), ` · 《${p.bookTitle}》 ${p.page}쪽`),
          h('p', { class: 'it-text' }, `“${p.sentence}”`), h('p', { class: 'muted' }, `느낌: ${p.feeling}`),
          reason, err, h('div', { class: 'row' }, ok, no));
      }),
    ];
  });
}

// ── 오늘의 문장 관리 ──────────────────────────────────────
export function sentencePanel() {
  return panel('sentence-panel', async (reload) => {
    const d = await api('teacher/sentences', {}, tok());
    const optionsFor = (cur) => d.pool.map((s) => h('option', { value: s.id, selected: s.id === cur }, s.text.length > 28 ? s.text.slice(0, 28) + '…' : s.text));

    const rows = d.days.map((day) => {
      const sel = h('select', { 'aria-label': `${day.date} 문장`, 'data-date': day.date }, optionsFor(day.id));
      sel.addEventListener('change', async () => {
        try { await api('teacher/sentence/schedule', { date: day.date, id: sel.value }, tok()); toast('바꿨어요'); await reload(); } catch (e) { toast(e.message); }
      });
      return h('tr', {}, h('td', {}, day.date.slice(5) + (day.date === d.today ? ' (오늘)' : '')), h('td', {}, sel));
    });

    const text = h('textarea', { id: 'new-sentence', rows: '2', placeholder: '새 문장 (200자까지)' });
    const source = h('input', { id: 'new-source', placeholder: '출처 (예: 윤동주, 〈서시〉)', maxlength: '60' });
    const date = h('input', { id: 'new-date', type: 'date' });
    const err = h('div', { class: 'error', role: 'alert' });
    const add = h('button', { class: 'btn', id: 'add-sentence' }, '문장 추가');
    add.addEventListener('click', () => once(add, async () => {
      err.textContent = '';
      try {
        await api('teacher/sentence/add', { text: text.value, source: source.value || undefined, date: date.value || undefined }, tok());
        toast('문장을 추가했어요'); await reload();
      } catch (e) { err.textContent = e.message; }
    }));

    const pool = d.pool.map((s) => {
      const del = h('button', { class: 'btn ghost small', 'aria-label': '문장 지우기' }, '지우기');
      del.addEventListener('click', () => once(del, async () => {
        try { await api('teacher/sentence/delete', { id: s.id }, tok()); await reload(); } catch (e) { toast(e.message); }
      }));
      return h('div', { class: 'row between' }, h('div', { class: 'grow' }, s.text, h('div', { class: 'muted' }, s.source)), del);
    });

    return [
      h('h2', {}, '오늘의 문장 (앞으로 7일)'),
      h('div', { class: 'table-scroll' }, h('table', {}, h('tbody', {}, rows))),
      h('details', {}, h('summary', {}, `문장 목록 ${d.pool.length}개 · 새 문장 넣기`),
        h('div', { class: 'stack', style: 'margin-top:8px' },
          h('p', { class: 'muted' }, '저작권이 끝난 작가의 원문이나, 고전을 쉬운 우리말로 직접 풀어 쓴 문장만 넣어 주세요.'),
          text, source, h('div', {}, h('label', { for: 'new-date' }, '이 날짜에 보여 주기 (비워 두면 목록에만 들어가요)'), date), err, add,
          h('hr'), pool)),
    ];
  });
}

// ── 학생이 추가한 책 (수정·숨기기) ─────────────────────────
export function booksPanel() {
  return panel('books-panel', async (reload) => {
    const d = await api('teacher/books', {}, tok());
    if (!d.books.length) return [h('h2', {}, '학생이 추가한 책'), h('p', { class: 'muted' }, '아직 학생이 추가한 책이 없어요.')];
    return [
      h('h2', {}, `학생이 추가한 책 (${d.books.length})`),
      h('p', { class: 'muted' }, '숨긴 책은 목록과 검색에서 사라지지만, 이미 한 활동 기록과 보상은 그대로 남아요.'),
      ...d.books.map((b) => {
        const title = h('input', { value: b.title, maxlength: '50', 'aria-label': '제목' });
        const author = h('input', { value: b.author, maxlength: '30', 'aria-label': '지은이' });
        const cat = h('select', { 'aria-label': '분류' }, d.categories.map((c) => h('option', { value: c, selected: c === b.category }, c)));
        const err = h('div', { class: 'error', role: 'alert' });
        const save = h('button', { class: 'btn small', 'data-save': b.id }, '고치기');
        const hide = h('button', { class: 'btn small ghost', 'data-hide': b.id }, b.hidden ? '다시 보이기' : '숨기기');
        save.addEventListener('click', () => once(save, async () => {
          try { await api('teacher/book/edit', { id: b.id, title: title.value, author: author.value, category: cat.value }, tok()); toast('고쳤어요'); await reload(); } catch (e) { err.textContent = e.message; }
        }));
        hide.addEventListener('click', () => once(hide, async () => {
          try { await api('teacher/book/hide', { id: b.id, hidden: !b.hidden }, tok()); await reload(); } catch (e) { err.textContent = e.message; }
        }));
        return h('div', { class: 'card stack' + (b.hidden ? ' is-hidden' : ''), 'data-book': b.id },
          h('div', { class: 'muted' }, `${b.addedByNick} · ${b.date}${b.hidden ? ' · 숨김' : ''}`),
          title, author, cat, err, h('div', { class: 'row' }, save, hide));
      }),
    ];
  });
}
