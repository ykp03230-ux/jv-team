// 시나리오 테스트 도우미. 로컬(wrangler dev)과 배포 주소 모두에 같은 테스트를 돌린다.
//   BASE_URL=https://....workers.dev node tests/run.mjs
export const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

export async function call(action, body = {}, token = null) {
  const res = await fetch(`${BASE}/api/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 본문이 JSON 이 아님 */ }
  return { status: res.status, ok: res.ok && json?.ok === true, ...(json || {}) };
}

export const TEACHER_PW = 'teacher-pass-1';

export async function newClass(name = '테스트 반') {
  const r = await call('class/create', { password: TEACHER_PW, name });
  if (!r.ok) throw new Error('class/create 실패: ' + JSON.stringify(r));
  return { code: r.code, teacher: r.token };
}
export async function seed(cls) {
  const r = await call('teacher/seed', {}, cls.teacher);
  if (!r.ok) throw new Error('seed 실패: ' + JSON.stringify(r));
  return r.summary;
}
export async function join(code, nick, pin) {
  return call('student/join', { code, nick, pin });
}
export async function student(code, nick, pin = '1234') {
  const r = await join(code, nick, pin);
  if (!r.ok) throw new Error('join 실패: ' + JSON.stringify(r));
  return { token: r.token, me: r.me, id: r.me.id, nick };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 아주 작은 시험 틀 ──
export function makeRunner() {
  const results = [];
  async function scenario(num, title, method, fn) {
    const checks = [];
    const t = {
      check(desc, ok, detail = '') { checks.push({ desc, ok: !!ok, detail: ok ? '' : String(detail) }); },
      eq(desc, actual, expected) {
        const ok = JSON.stringify(actual) === JSON.stringify(expected);
        checks.push({ desc, ok, detail: ok ? '' : `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}` });
      },
    };
    try { await fn(t); } catch (e) { checks.push({ desc: '시험 도중 예외 없음', ok: false, detail: String(e && e.stack || e) }); }
    results.push({ num, title, method, checks });
  }
  function report() {
    const lines = ['| 시나리오 | 결과 | 확인한 방법 |', '|---|---|---|'];
    let failed = 0;
    for (const r of results.sort((a, b) => a.num - b.num)) {
      const bad = r.checks.filter((c) => !c.ok);
      if (bad.length) failed++;
      lines.push(`| ${r.num}) ${r.title} | ${bad.length ? '실패' : '통과'} (${r.checks.length - bad.length}/${r.checks.length}) | ${r.method} |`);
    }
    console.log(lines.join('\n'));
    for (const r of results) for (const c of r.checks.filter((x) => !x.ok)) console.log(`\n✗ [${r.num}] ${c.desc}\n   ${c.detail}`);
    return failed;
  }
  return { scenario, report, results };
}
