// 입구: /api/* 요청을 반 코드에 맞는 Durable Object(반마다 하나)로 보낸다.
// 정적 화면(public/)은 Cloudflare 가 알아서 내려 준다 (wrangler.jsonc 의 assets 설정).
import { Classroom } from './classroom.js';
import { newClassCode, isClassCode, json } from './util.js';

export { Classroom };

const TOKEN_RE = /^Bearer ([A-HJKMNP-Z2-9]{6})\.[0-9a-f]{48}$/;
const MAX_BODY = 1_500_000; // 이미지(1MB) + 여유
const PUBLIC_ACTIONS = new Set(['student/join', 'teacher/login']);

function stubFor(env, code) {
  return env.CLASSROOM.get(env.CLASSROOM.idFromName(code));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found', message: '없는 주소예요.' }, 404);
    if (!['GET', 'POST'].includes(request.method)) return json({ ok: false, error: 'method', message: '지원하지 않는 요청이에요.' }, 405);

    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BODY) return json({ ok: false, error: 'too_large', message: '내용이 너무 커요.' }, 413);

    const action = url.pathname.slice(5);
    const isBinary = (request.headers.get('content-type') || '').startsWith('image/');
    const raw = request.method === 'POST' ? await request.arrayBuffer() : null;
    if (raw && raw.byteLength > MAX_BODY) return json({ ok: false, error: 'too_large', message: '내용이 너무 커요.' }, 413);

    // 반 만들기: 코드는 서버가 정한다 (겹치면 다시 뽑는다)
    if (action === 'class/create') {
      let body;
      try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ ok: false, error: 'bad_input', message: '요청을 읽을 수 없어요.' }, 400); }
      for (let i = 0; i < 6; i++) {
        const code = newClassCode();
        const res = await stubFor(env, code).fetch(new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, code }),
        }));
        if (res.status !== 409) return res;
      }
      return json({ ok: false, error: 'busy', message: '잠시 뒤 다시 해 보세요.' }, 503);
    }

    // 반 코드: 로그인 토큰 앞부분, 없으면 요청 내용의 code
    let code = null;
    const m = TOKEN_RE.exec(request.headers.get('authorization') || '');
    if (m) code = m[1];
    else if (raw && !isBinary) {
      try { code = String(JSON.parse(new TextDecoder().decode(raw)).code || '').toUpperCase().replace(/\s/g, ''); } catch { /* 아래에서 처리 */ }
    } else if (request.method === 'GET') {
      code = (url.searchParams.get('code') || '').toUpperCase();
    }
    if (!isClassCode(code)) {
      // 입장 화면(반 코드를 직접 쓰는 곳)이 아니면, 로그인 정보가 없다는 뜻이므로 401
      if (!PUBLIC_ACTIONS.has(action)) return json({ ok: false, error: 'auth', message: '다시 입장해 주세요.' }, 401);
      return json({ ok: false, error: 'bad_code', message: '반 코드를 확인해 주세요.' }, 400);
    }

    const headers = new Headers();
    for (const h of ['authorization', 'content-type']) if (request.headers.get(h)) headers.set(h, request.headers.get(h));
    headers.set('x-class-code', code);
    return stubFor(env, code).fetch(new Request(url, { method: request.method, headers, body: raw }));
  },
};
