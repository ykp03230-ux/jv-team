// 사진: 보기(로그인 정보를 붙여 불러오기)와 올리기 전 줄이기
import { h } from '../ui.js';
import { token } from './core.js';

const cache = new Map(); // imgId → 객체 주소

async function load(id) {
  if (cache.has(id)) return cache.get(id);
  const p = fetch('/api/img/' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + token() } })
    .then((r) => { if (!r.ok) throw new Error('사진을 불러오지 못했어요'); return r.blob(); })
    .then((b) => URL.createObjectURL(b));
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

/** 사진 한 장. 로그인한 사람만 볼 수 있어서 주소를 바로 쓰지 않고 불러온 뒤 보여 준다. */
export function imgEl(id, alt) {
  const img = h('img', { class: 'photo', alt: alt || '사진', decoding: 'async', 'data-img': id });
  load(id).then((url) => { img.src = url; }).catch(() => img.replaceWith(h('div', { class: 'img-todo' }, '사진을 불러오지 못했어요')));
  return img;
}

/**
 * 올리기 전에 브라우저에서 줄인다: 긴 변 1024px 이하, JPEG, 한 장 1MB 이하.
 * (서버도 같은 기준으로 다시 확인한다.)
 */
export async function shrinkToJpeg(file, { maxSide = 1024, maxBytes = 1000000 } = {}) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('사진을 열 수 없어요. 다른 사진을 골라 주세요.'); }
  let scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(bmp.width * scale));
    const hgt = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);
    ctx.drawImage(bmp, 0, 0, w, hgt);
    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
      if (blob && blob.size <= maxBytes) { bmp.close?.(); return { blob, w, h: hgt }; }
    }
    scale *= 0.8; // 그래도 크면 크기를 더 줄인다
  }
  bmp.close?.();
  throw new Error('사진이 너무 커요. 다른 사진을 골라 주세요.');
}

export async function uploadPhoto(blob) {
  const res = await fetch('/api/img/upload', { method: 'POST', headers: { 'content-type': 'image/jpeg', authorization: 'Bearer ' + token() }, body: blob });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || '사진을 올리지 못했어요.');
  return data;
}

/**
 * 사진 고르기 칸. 고르면 바로 줄여서 올리고, 올린 사진 id 를 state.imgId 로 알려 준다.
 * 안내 문구: 얼굴과 이름이 나오지 않게 찍어요.
 */
export function photoPicker(onChange) {
  const state = { imgId: null };
  const input = h('input', { type: 'file', accept: 'image/*', id: 'photo-input', 'aria-label': '사진 고르기' });
  const status = h('p', { class: 'muted', id: 'photo-status', 'aria-live': 'polite' }, '사진을 골라 주세요.');
  const preview = h('div', { id: 'photo-preview' });
  input.addEventListener('change', async () => {
    state.imgId = null; onChange?.(null);
    const file = input.files?.[0];
    if (!file) return;
    status.className = 'muted'; status.textContent = '사진을 줄이는 중…'; preview.replaceChildren();
    try {
      const { blob, w, h: hh } = await shrinkToJpeg(file);
      status.textContent = '올리는 중…';
      const up = await uploadPhoto(blob);
      state.imgId = up.imgId;
      preview.replaceChildren(h('img', { class: 'photo', alt: '고른 사진', src: URL.createObjectURL(blob) }));
      status.textContent = `준비됐어요 (${w}×${hh}, ${Math.round(blob.size / 1024)}KB)`;
      onChange?.(up.imgId);
    } catch (e) { status.className = 'error'; status.textContent = e.message; }
  });
  const el = h('div', { class: 'stack photo-picker' },
    h('p', { class: 'notice', id: 'photo-notice' }, '📷 얼굴과 이름이 나오지 않게 찍어요'),
    input, status, preview);
  return { el, state };
}
