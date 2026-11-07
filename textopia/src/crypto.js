// 해시 도우미 (Web Crypto). 비밀값(PEPPER)은 코드에 쓰지 않고 Worker 비밀 변수로만 받는다.
import { fail } from './util.js';

const enc = new TextEncoder();
const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (s) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

export function pepperOf(env) {
  if (!env.PEPPER || env.PEPPER.length < 16) fail(500, 'server_config', '서버 설정이 아직 끝나지 않았어요. 선생님께 알려 주세요.');
  return env.PEPPER;
}

async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

// 학생 PIN: 키(PEPPER)가 있는 해시. DB만 유출돼도 PIN을 되돌릴 수 없다.
export const hashPin = (pin, salt, env) => hmacHex(pepperOf(env), `pin:${salt}:${pin}`);

// 교사 비밀번호: PBKDF2-SHA256
export async function hashPassword(password, salt, env, iterations = 100000) {
  const material = await crypto.subtle.importKey('raw', enc.encode(`${pepperOf(env)}:${password}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, material, 256);
  return toHex(bits);
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
