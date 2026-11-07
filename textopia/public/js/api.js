// 서버 호출과 로그인 정보 보관 (로그인 정보는 이 기기의 localStorage 에만 둔다)

export class ApiFail extends Error {
  constructor(status, error, message, data) {
    super(message);
    this.status = status; this.error = error; this.data = data;
  }
}

export function makeSession(key) {
  return {
    get() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
    clear() { try { localStorage.removeItem(key); } catch { /* 저장 불가 환경 */ } },
  };
}
export const studentSession = makeSession('textopia.student');
export const teacherSession = makeSession('textopia.teacher');

export async function api(action, body = {}, token = null) {
  let res;
  try {
    res = await fetch('/api/' + action, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFail(0, 'network', '인터넷 연결을 확인해 주세요.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* JSON 아님 */ }
  if (!res.ok || !data || data.ok !== true) {
    throw new ApiFail(res.status, data?.error || 'error', data?.message || '문제가 생겼어요. 다시 해 보세요.', data);
  }
  return data;
}
