// 학생 화면이 함께 쓰는 상태와 도우미
import { api, studentSession } from '../api.js';
import { toast } from '../ui.js';

export const S = { me: null };

export const token = () => studentSession.get()?.token || null;

/** 서버 호출. 응답에 me 가 있으면 내 정보를 바로 갱신한다. 로그인이 풀렸으면 입장 화면으로 돌아간다. */
export async function call(action, body = {}) {
  try {
    const r = await api(action, body, token());
    if (r.me) { S.me = r.me; window.dispatchEvent(new Event('me-updated')); }
    return r;
  } catch (e) {
    if (e.status === 401) { studentSession.clear(); location.hash = ''; location.reload(); }
    throw e;
  }
}

export const go = (path) => { location.hash = '#/' + path; };

/** 보상 알림 글 */
export function rewardLines(rw) {
  if (!rw) return [];
  const lines = [];
  if (rw.coins || rw.exp) lines.push(`코인 +${rw.coins} · EXP +${rw.exp}`);
  if (rw.capped) lines.push('오늘 받을 수 있는 코인(100)에 닿았어요');
  if (rw.stageUp) lines.push(`내 집이 ${rw.stageUp.to}이 되었어요!`);
  for (const b of rw.unlocked || []) lines.push(`마을에 ${b}가 열렸어요!`);
  return lines;
}
export function toastReward(rw, bonus) {
  const lines = rewardLines(rw);
  if (bonus) lines.push('퀘스트 3개 완료 보너스!');
  if (lines.length) toast(lines.join('\n'), 4200);
}
