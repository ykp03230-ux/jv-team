// 반 하나 = Durable Object 하나.
// 이 반의 모든 요청은 줄을 서서 하나씩 처리된다 → 보상 횟수 확인과 지급이 쪼개지지 않아
// 새로고침, 버튼 두 번 누르기, 동시 요청에도 같은 보상이 두 번 나가지 않는다.
import { DurableObject } from 'cloudflare:workers';
import { ApiError, json, kstDate, fail } from './util.js';
import { sha256Hex } from './crypto.js';
import { loadBaseBooks } from './data/catalog.js';
import { routes } from './routes/index.js';

const TOKEN_RE = /^Bearer ([A-HJKMNP-Z2-9]{6})\.([0-9a-f]{48})$/;

export class Classroom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS img (id TEXT PRIMARY KEY, data BLOB NOT NULL)');
    this.state = undefined;       // undefined: 아직 안 읽음 / null: 만들어진 반 없음
    this.saved = new Map();
    this.queue = Promise.resolve();
  }

  // 요청을 줄 세운다
  fetch(request) {
    const run = this.queue.then(() => this.handle(request));
    this.queue = run.catch(() => {});
    return run;
  }

  // ── 저장소: 반 상태를 조각(kv)으로 나눠 저장한다 ──
  load() {
    if (this.state !== undefined) return;
    const rows = [...this.sql.exec('SELECT k, v FROM kv')];
    this.saved = new Map();
    if (!rows.length) { this.state = null; return; }
    const s = { students: {} };
    for (const { k, v } of rows) {
      this.saved.set(k, v);
      if (k.startsWith('st:')) s.students[k.slice(3)] = JSON.parse(v);
      else s[k] = JSON.parse(v);
    }
    this.state = s;
  }

  init(state) { this.state = state; }

  persist() {
    if (!this.state) return;
    const out = new Map();
    for (const [k, v] of Object.entries(this.state)) if (k !== 'students') out.set(k, JSON.stringify(v));
    for (const [id, st] of Object.entries(this.state.students)) out.set('st:' + id, JSON.stringify(st));
    this.ctx.storage.transactionSync(() => {
      for (const [k, v] of out) {
        if (this.saved.get(k) !== v) this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
      }
      for (const k of this.saved.keys()) if (!out.has(k)) this.sql.exec('DELETE FROM kv WHERE k = ?', k);
    });
    this.saved = out;
  }

  // 이미지는 반 상태와 따로 저장한다 (한 장 1MB 이하)
  putImage(id, bytes) {
    const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    this.sql.exec('INSERT OR REPLACE INTO img (id, data) VALUES (?, ?)', id, buf);
  }
  getImage(id) {
    const rows = [...this.sql.exec('SELECT data FROM img WHERE id = ?', id)];
    return rows.length ? rows[0].data : null;
  }
  clearImages() { this.sql.exec('DELETE FROM img'); }

  // ── 요청 처리 ──
  async handle(request) {
    try {
      this.load();
      const url = new URL(request.url);
      const action = url.pathname.replace(/^\/api\//, '');
      const route = routes[action] || routes[action.replace(/\/[^/]+$/, '/*')];
      if (!route) fail(404, 'not_found', '없는 기능이에요.');

      const nowMs = Date.now();
      const c = {
        request, url, env: this.env, doc: this, action,
        state: this.state, nowMs,
        today: kstDate(nowMs), month: kstDate(nowMs).slice(0, 7),
        body: {}, actor: null,
        baseBooks: await loadBaseBooks(this.env),
      };
      if (c.state?.meta.clock) { c.today = c.state.meta.clock; c.month = c.today.slice(0, 7); }

      if (request.method === 'POST' && !(request.headers.get('content-type') || '').startsWith('image/')) {
        const text = await request.text();
        try { c.body = text ? JSON.parse(text) : {}; } catch { fail(400, 'bad_input', '요청을 읽을 수 없어요.'); }
        if (c.body === null || typeof c.body !== 'object' || Array.isArray(c.body)) fail(400, 'bad_input', '요청을 읽을 수 없어요.');
      }
      if (route.auth !== 'none') c.actor = await this.authenticate(c, route.auth);

      const result = await route.run(c);
      if (result instanceof Response) return result;
      if (route.write) this.persist();
      return json({ ok: true, ...result });
    } catch (e) {
      this.state = undefined; // 중간까지 바뀐 메모리 상태는 버리고 저장된 것을 다시 읽는다
      if (e instanceof ApiError) return json({ ok: false, error: e.code, message: e.message, ...(e.extra || {}) }, e.status);
      console.error('server error', e && e.stack || e);
      return json({ ok: false, error: 'server', message: '서버에 문제가 생겼어요. 잠시 뒤 다시 해 보세요.' }, 500);
    }
  }

  async authenticate(c, want) {
    const state = c.state;
    if (!state) fail(404, 'no_class', '반을 찾을 수 없어요. 반 코드를 확인해 주세요.');
    const m = TOKEN_RE.exec(c.request.headers.get('authorization') || '');
    if (!m || m[1] !== state.meta.code) fail(401, 'auth', '다시 입장해 주세요.');
    const rec = state.sessions[await sha256Hex(m[2])];
    if (!rec || rec.exp < c.nowMs) fail(401, 'auth', '다시 입장해 주세요.');
    if (rec.role === 'student' && !state.students[rec.sid]) fail(401, 'auth', '다시 입장해 주세요.');
    if (want === 'teacher' && rec.role !== 'teacher') fail(403, 'forbidden', '선생님만 할 수 있어요.');
    if (want === 'student' && rec.role !== 'student') fail(403, 'forbidden', '학생만 할 수 있어요.');
    return rec;
  }
}
