// 교사 화면의 칸들: 읽음 인증, 오늘의 문장, 학생이 추가한 책 (이후 단계에서 박물관 칸이 더해진다)
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

// ── 박물관: 전시 on/off, 투표 열기/마감, 이달 미제출, 작품 숨기기 ─────
export function museumPanel(onChanged) {
  const KIND = { sentence: '문장 카드', question: '질문', work: '작품' };
  const excerpt = (s) => {
    const t = s.snap.text || s.snap.caption || s.snap.title || '';
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  };
  return panel('museum-panel', async (reload) => {
    const d = await api('teacher/museum', {}, tok());
    const run = (btn, action, body, okMsg) => btn.addEventListener('click', () => once(btn, async () => {
      try { const r = await api(action, body, tok()); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); await reload(); onChanged?.(); } catch (e) { toast(e.message); }
    }));

    const toggle = h('button', { class: 'btn' + (d.on ? '' : ' ghost'), id: 'museum-toggle' }, d.on ? '전시 켜짐 (끄려면 누르세요)' : '전시 꺼짐 (켜려면 누르세요)');
    run(toggle, 'teacher/museum/toggle', { on: !d.on }, d.on ? '박물관을 껐어요. 학생 화면에는 ‘준비 중’이 보여요.' : '박물관을 열었어요.');

    const vs = d.vote.status;
    const voteLabel = { none: '투표 전', open: `투표 중 (${d.vote.voters}명 참여)`, finished: '투표 마감 · 결과 공개' }[vs];
    const open = h('button', { class: 'btn', id: 'vote-open' }, '투표 열기');
    run(open, 'teacher/vote/open', {}, '투표를 열었어요.');
    const close = h('button', { class: 'btn', id: 'vote-close' }, '투표 마감');
    run(close, 'teacher/vote/close', {}, (r) => `마감했어요. 이달의 작품 ${r.result.length}개`);
    open.disabled = vs !== 'none';
    close.disabled = vs !== 'open';

    const best = d.vote.result.map((id) => d.subs.find((s) => s.id === id)).filter(Boolean);

    return [
      h('h2', {}, `박물관 · ${d.month}`),
      h('div', { class: 'row' }, toggle),
      h('div', { class: 'row between' }, h('strong', { id: 'vote-state' }, voteLabel), h('div', { class: 'row' }, open, close)),
      best.length ? h('div', { class: 'card stack', id: 'vote-result' }, h('h3', {}, '이달의 작품'), best.map((s, i) => h('p', {}, `${i + 1}. ${s.nick} · ${KIND[s.kind]} “${excerpt(s)}” · ${s.tally}표`))) : null,
      h('div', { class: 'card stack', id: 'missing' },
        h('h3', {}, `이달 미제출 학생 (${d.missing.length})`),
        d.missing.length ? h('p', {}, d.missing.map((m) => m.nick).join(', ')) : h('p', { class: 'muted' }, '모두 냈어요!')),
      h('details', {}, h('summary', {}, `전시 작품 ${d.subs.length}개 · 부적절한 작품 숨기기`),
        h('div', { class: 'stack', style: 'margin-top:8px' }, d.subs.map((s) => {
          const hide = h('button', { class: 'btn small ghost', 'data-hide-sub': s.id }, s.hidden ? '다시 보이기' : '숨기기');
          run(hide, 'teacher/sub/hide', { id: s.id, hidden: !s.hidden });
          return h('div', { class: 'row between' + (s.hidden ? ' is-hidden' : ''), 'data-sub': s.id },
            h('div', { class: 'grow' }, h('strong', {}, s.nick), ` · ${s.month} · ${KIND[s.kind]} “${excerpt(s)}”${s.hidden ? ' (숨김)' : ''}`), hide);
        }))),
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
