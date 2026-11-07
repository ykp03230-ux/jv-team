// 사진: 브라우저에서 긴 변 1024px, JPEG 로 줄여 올린 한 장(1MB 이하)을 반 저장소에 둔다.
// 반마다 따로 저장되므로 다른 반에서는 볼 수 없다. 보는 사람도 로그인한 같은 반 사람이어야 한다.
import { fail, newId, randomHex } from '../util.js';
import { actorStudent } from '../engine/core.js';
import { jpegSize, MAX_IMAGE_BYTES, MAX_LONG_SIDE } from '../engine/jpeg.js';

const MAX_UNUSED = 5;   // 올려만 두고 아직 작품에 붙이지 않은 사진
const MAX_TOTAL = 40;   // 학생 한 명이 올릴 수 있는 사진

export const imageRoutes = {
  'img/upload': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    if (!(c.request.headers.get('content-type') || '').startsWith('image/jpeg')) fail(415, 'not_jpeg', 'JPEG 사진만 올릴 수 있어요.');
    const bytes = new Uint8Array(await c.request.arrayBuffer());
    if (bytes.length === 0) fail(400, 'empty', '사진이 비어 있어요.');
    if (bytes.length > MAX_IMAGE_BYTES) fail(413, 'too_big', '사진은 한 장에 1MB 이하여야 해요.');
    const size = jpegSize(bytes);
    if (!size) fail(415, 'not_jpeg', 'JPEG 사진만 올릴 수 있어요.');
    if (Math.max(size.w, size.h) > MAX_LONG_SIDE) fail(413, 'too_large_side', `사진의 긴 변은 ${MAX_LONG_SIDE}px 이하여야 해요.`);

    const mine = Object.values(c.state.images).filter((m) => m.sid === st.id);
    if (mine.length >= MAX_TOTAL) fail(409, 'too_many', '올릴 수 있는 사진을 모두 썼어요.');
    if (mine.filter((m) => !m.used).length >= MAX_UNUSED) fail(409, 'too_many_unused', '올려 둔 사진을 먼저 작품에 붙여 주세요.');

    const id = newId('img-') + randomHex(4);
    c.doc.putImage(id, bytes);
    c.state.images[id] = { sid: st.id, size: bytes.length, w: size.w, h: size.h, at: c.nowMs, used: false };
    return { imgId: id, size: bytes.length, w: size.w, h: size.h };
  } },

  // 사진 보기 (같은 반 로그인 사용자). 사진 주소는 추측할 수 없고, 로그인 정보 없이는 열리지 않는다.
  'img/*': { auth: 'any', run: async (c) => {
    const id = c.action.slice(4);
    if (!c.state.images[id]) fail(404, 'no_image', '사진을 찾을 수 없어요.');
    const data = c.doc.getImage(id);
    if (!data) fail(404, 'no_image', '사진을 찾을 수 없어요.');
    return new Response(data, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
  } },
};
