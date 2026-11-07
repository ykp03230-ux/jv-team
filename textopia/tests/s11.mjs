import { call, newClass, seed, student, BASE } from './lib.mjs';

export const num = 11;
export const title = '(추가) 9단계 사진 업로드 · 전시 아이템';
export const method = 'JPEG만·긴 변 1024px·1MB 이하를 서버에서 검사, 같은 반만 열람, 그림 독서록·책 표지 보상(+15), 사진 재사용 불가, 박물관에 낸 사진 보기';

// 서버가 확인하는 만큼만 갖춘 JPEG (SOI + SOF0 + 주석 채우기 + EOI)
function fakeJpeg(w, h, totalBytes = 0) {
  const head = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xFF, 0xC0, 0x00, 0x0B, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00];
  const tail = [0xFF, 0xD9];
  const base = head.length + sof.length + tail.length;
  const parts = [Uint8Array.from(head)];
  let pad = Math.max(0, totalBytes - base);
  while (pad > 0) { // 주석(COM) 조각으로 채운다
    const n = Math.min(pad, 60000);
    if (n < 4) break;
    const seg = new Uint8Array(n); seg[0] = 0xFF; seg[1] = 0xFE; seg[2] = ((n - 2) >> 8) & 255; seg[3] = (n - 2) & 255;
    parts.push(seg); pad -= n;
  }
  parts.push(Uint8Array.from(sof), Uint8Array.from(tail));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const upload = async (token, bytes, type = 'image/jpeg') => {
  const res = await fetch(`${BASE}/api/img/upload`, { method: 'POST', headers: { 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: bytes });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ...j };
};
const get = async (token, id) => {
  const res = await fetch(`${BASE}/api/img/${id}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, type: res.headers.get('content-type'), bytes: new Uint8Array(await res.arrayBuffer()) };
};

export async function run(t) {
  const A = await newClass(); await seed(A);
  const B = await newClass();
  const s = await student(A.code, '사진1', '1111');
  const friend = await student(A.code, '사진2', '2222');
  const other = await student(B.code, '다른반', '3333');
  await call('books/register', { bookId: 'b01' }, s.token);
  await call('books/register', { bookId: 'b01' }, friend.token); // 책은 등록해 둔다 (사진 소유만 시험하려고)

  // ── 올리기 검사 ──
  t.eq('로그인 없이는 올릴 수 없다(401)', (await upload(null, fakeJpeg(800, 600))).status, 401);
  t.eq('교사 토큰으로는 올릴 수 없다(403)', (await upload(A.teacher, fakeJpeg(800, 600))).status, 403);
  t.eq('JPEG 가 아니라고 알리면(content-type) 415', (await upload(s.token, fakeJpeg(800, 600), 'image/png')).status, 415);
  t.eq('이름만 JPEG 이고 실제로는 PNG 면 415', (await upload(s.token, Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]))).status, 415);
  t.eq('빈 파일은 400', (await upload(s.token, new Uint8Array(0))).status, 400);
  t.eq('긴 변 2000px 은 413', (await upload(s.token, fakeJpeg(2000, 1500))).status, 413);
  t.eq('세로가 긴 사진도 긴 변 1025px 이면 413', (await upload(s.token, fakeJpeg(10, 1025))).status, 413);
  t.eq('긴 변 1024px 은 통과', (await upload(s.token, fakeJpeg(1024, 768))).status, 200);
  t.eq('1MB(1,048,576바이트)를 넘으면 413', (await upload(s.token, fakeJpeg(800, 600, 1048577))).status, 413);
  const exact = await upload(s.token, fakeJpeg(800, 600, 1048576));
  t.check('정확히 1MB 는 통과', exact.status === 200 && exact.size === 1048576, JSON.stringify(exact));

  // ── 올린 사진 열람 ──
  const up = await upload(s.token, fakeJpeg(800, 600, 3000));
  t.check('올리면 사진 id 와 크기를 돌려준다', up.status === 200 && up.imgId && up.w === 800 && up.h === 600, JSON.stringify(up));
  const mine = await get(s.token, up.imgId);
  t.check('올린 사람은 열어 볼 수 있다(image/jpeg, 같은 크기)', mine.status === 200 && mine.type === 'image/jpeg' && mine.bytes.length === 3000, `${mine.status} ${mine.bytes.length}`);
  t.eq('같은 반 친구도 볼 수 있다', (await get(friend.token, up.imgId)).status, 200);
  t.eq('로그인 없이는 열리지 않는다(401)', (await get(null, up.imgId)).status, 401);
  t.eq('다른 반 학생은 볼 수 없다(404)', (await get(other.token, up.imgId)).status, 404);
  t.eq('없는 사진은 404', (await get(s.token, 'img-nope')).status, 404);

  // ── 그림 독서록 / 책 표지 ──
  const bad1 = await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up.imgId, caption: ' ' }, s.token);
  t.eq('한 줄 설명이 비면 400', bad1.status, 400);
  t.eq('없는 사진 id 는 404', (await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: 'img-nope', caption: '설명' }, s.token)).status, 404);
  t.eq('친구가 올린 사진으로는 작품을 만들 수 없다(404)', (await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up.imgId, caption: '가로채기' }, friend.token)).status, 404);
  const dr = await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up.imgId, caption: '토끼가 거북이를 업고 가는 모습' }, s.token);
  t.check('그림 독서록: 코인 +15 · EXP +15, 전시 아이템(작품)이 된다', dr.ok && dr.rewarded && dr.me.coins === 15 && dr.me.exp === 15 && dr.item.type === 'drawing' && dr.item.imgId === up.imgId, JSON.stringify(dr).slice(0, 220));
  t.eq('같은 사진을 또 쓸 수 없다(409)', (await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up.imgId, caption: '또' }, s.token)).status, 409);

  const up2 = await upload(s.token, fakeJpeg(600, 800, 2000));
  const cv = await call('activity/submit', { bookId: 'b01', type: 'cover', imgId: up2.imgId, title: '내가 붙인 제목: 용왕의 병' }, s.token);
  t.check('책 표지 꾸미기: +15/+15 (누적 30), 붙인 제목이 저장된다', cv.ok && cv.rewarded && cv.me.coins === 30 && cv.item.type === 'cover' && cv.item.title === '내가 붙인 제목: 용왕의 병', JSON.stringify(cv).slice(0, 220));
  const upBlank = await upload(s.token, fakeJpeg(500, 500, 1500));
  t.eq('표지 제목이 비면 400', (await call('activity/submit', { bookId: 'b01', type: 'cover', imgId: upBlank.imgId, title: '' }, s.token)).status, 400);
  t.eq('이미 작품에 붙인 사진은 다시 쓸 수 없다(표지로도 409)', (await call('activity/submit', { bookId: 'b01', type: 'cover', imgId: up2.imgId, title: '또 표지' }, s.token)).status, 409);

  const up3 = await upload(s.token, fakeJpeg(640, 480, 2000));
  const dr2 = await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up3.imgId, caption: '두 번째 그림' }, s.token);
  t.check('같은 책의 그림 독서록을 또 올려도 작품은 쌓이고 보상은 없다', dr2.ok && !dr2.rewarded && dr2.me.coins === 30, JSON.stringify(dr2.reward));

  // ── 내 집·박물관에서 쓰기 ──
  const lib = (await call('library/get', {}, s.token)).library;
  t.check('도감(만든 작품)에 그림 독서록·책 표지가 imgId 와 함께 보인다', lib.works.filter((w) => w.imgId).length === 3, JSON.stringify(lib.works.map((w) => w.type)));
  const hang = await call('slot/set', { index: 1, kind: 'work', id: dr.item.id }, s.token);
  t.eq('전시 칸에 사진 작품을 걸 수 있다', hang.library.slots[1]?.imgId, up.imgId);
  const sub = await call('museum/submit', { kind: 'work', refId: dr.item.id }, s.token);
  t.check('박물관에 내면 사진 id 가 함께 전시된다', sub.ok && sub.sub.snap.imgId === up.imgId && sub.sub.snap.caption, JSON.stringify(sub.sub?.snap));
  const gallery = (await call('museum/list', {}, friend.token)).subs.find((x) => x.id === sub.sub.id);
  t.check('친구가 박물관에서 그 사진을 볼 수 있다', gallery && (await get(friend.token, gallery.snap.imgId)).status === 200, '');
  const ed = await call('item/edit', { kind: 'work', id: dr.item.id, caption: '고친 설명' }, s.token);
  t.eq('내 그림 독서록 설명을 고칠 수 있다', ed.library.works.find((w) => w.id === dr.item.id).caption, '고친 설명');
  t.eq('친구는 내 그림 설명을 고칠 수 없다(404)', (await call('item/edit', { kind: 'work', id: dr.item.id, caption: '장난' }, friend.token)).status, 404);

  // ── 올려만 두는 사진 수 제한 ──
  const s2 = await student(A.code, '사진3', '4444');
  const results = [];
  for (let i = 0; i < 6; i++) results.push((await upload(s2.token, fakeJpeg(300, 200, 500))).status);
  t.eq('작품에 붙이지 않은 사진은 5장까지(6번째는 409)', results, [200, 200, 200, 200, 200, 409]);
}
