// 공통 도우미: 오류, 한국 시간(Asia/Seoul) 날짜, 입력 검증, 무작위 id

export class ApiError extends Error {
  constructor(status, code, message, extra = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra; // 화면에 같이 보낼 정보 (예: 이미 있는 책)
  }
}
export const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };

// ── 한국 시간 ─────────────────────────────────────────────
// 한국은 서머타임이 없어 UTC+9 고정이다. '오늘'은 한국 시간 자정에 바뀐다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const kstDate = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
export const monthOf = (date) => date.slice(0, 7);
export const isDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const ms = Date.parse(s + 'T00:00:00Z');
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s; // 13월·32일처럼 없는 날짜는 거른다
};
export const addDays = (date, n) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayNumber = (date) => Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);

// ── 무작위 id ─────────────────────────────────────────────
export const randomHex = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export const newId = (prefix = '') => prefix + randomHex(6);

// 반 코드: 헷갈리는 글자(0 O 1 I L)를 뺀 6자리
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newClassCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
// 반 코드: 자동으로 만든 6자리, 또는 교사가 직접 정한 쉬운 코드(영어 대문자·숫자 4~10자)
export const isClassCode = (s) => typeof s === 'string' && /^[A-Z0-9]{4,10}$/.test(s);
export const normalizeCode = (s) => String(s ?? '').toUpperCase().replace(/\s/g, '');

// ── 입력 검증 ─────────────────────────────────────────────
export function text(v, { name, min = 1, max = 200 }) {
  if (typeof v !== 'string') fail(400, 'bad_input', `${name}을(를) 입력해 주세요.`);
  const t = v.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‍﻿]/g, '').trim();
  if (t.length < min) fail(400, 'bad_input', `${name}을(를) 입력해 주세요.`);
  if (t.length > max) fail(400, 'bad_input', `${name}은(는) ${max}자까지 쓸 수 있어요.`);
  return t;
}
export function int(v, { name, min, max }) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n) || n < min || n > max) fail(400, 'bad_input', `${name}은(는) ${min}~${max} 사이 숫자로 써 주세요.`);
  return n;
}
export const nickKey = (s) => s.normalize('NFC').replace(/\s+/g, '').toLowerCase();
// 책 중복 비교용: 공백을 모두 없애고 소문자로
export const bookKey = (title, author) => `${nickKey(title)}|${nickKey(author)}`;

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
