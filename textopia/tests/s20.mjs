import { call, newClass, seed, student, BASE } from './lib.mjs';

export const num = 20;
export const title = '(추가) 전시 칸 작품 크게 보기 (친구 집 · 마을 화면)';
export const method = '친구 집·마을 화면 자료에 크게 보기에 필요한 내용(문장·이유·책갈피·그림·표지)이 모두 있는지, 사진이 열리는지(학생·교사 토큰, 다른 반은 404), 크게 보기 파일이 서버 호출 없이 보기만 하고 Esc·바깥 누르기·창 겹침 순서가 맞는지 확인';

// 서버가 확인하는 만큼만 갖춘 JPEG (SOI + SOF0 + EOI)
function fakeJpeg(w, h) {
  const head = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xFF, 0xC0, 0x00, 0x0B, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00];
  return Uint8Array.from([...head, ...sof, 0xFF, 0xD9]);
}
const upload = async (token, bytes) => {
  const res = await fetch(`${BASE}/api/img/upload`, { method: 'POST', headers: { 'content-type': 'image/jpeg', authorization: `Bearer ${token}` }, body: bytes });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
};
const getImg = async (token, id) => {
  const res = await fetch(`${BASE}/api/img/${id}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, type: res.headers.get('content-type') };
};
const getText = async (path) => { const r = await fetch(`${BASE}${path}`); return { status: r.status, body: await r.text() }; };

export async function run(t) {
  const A = await newClass(); await seed(A);
  const owner = await student(A.code, '작품주인', '1111');
  const friend = await student(A.code, '놀러온친구', '2222');

  // ── 준비: 문장 · 책갈피 · 그림 독서록 · 책 표지를 만들어 전시 칸에 건다 ──
  await call('books/register', { bookId: 'b01' }, owner.token);
  const sent = await call('activity/submit', { bookId: 'b01', type: 'sentence', text: '크게 보고 싶은 문장이에요.', page: 9, reason: '마음에 남아서' }, owner.token);
  const bm = await call('activity/submit', { bookId: 'b01', type: 'bookmark', sentenceId: sent.item.id, template: 't2' }, owner.token);
  const up1 = await upload(owner.token, fakeJpeg(800, 600));
  const up2 = await upload(owner.token, fakeJpeg(640, 480));
  const draw = await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up1.imgId, caption: '토끼가 달리는 그림' }, owner.token);
  const cover = await call('activity/submit', { bookId: 'b01', type: 'cover', imgId: up2.imgId, title: '내가 꾸민 표지' }, owner.token);
  t.check('(준비) 문장·책갈피·그림 독서록·표지 만들기', sent.ok && bm.ok && draw.ok && cover.ok, JSON.stringify([sent.error, bm.error, draw.error, cover.error]));
  await call('slot/set', { index: 0, kind: 'sentence', id: sent.item.id }, owner.token);
  await call('slot/set', { index: 1, kind: 'work', id: bm.item.id }, owner.token);
  await call('slot/set', { index: 2, kind: 'work', id: draw.item.id }, owner.token);
  await call('slot/set', { index: 3, kind: 'work', id: cover.item.id }, owner.token);

  // ── 친구 집(학생 화면)에서 크게 보는 데 필요한 내용이 모두 온다 ──
  const room = await call('friends/house', { friendId: owner.id }, friend.token);
  const [s0, s1, s2, s3] = room.slots;
  t.check('친구 집: 문장 칸에 문장·책 제목·쪽·고른 이유가 있다', s0?.kind === 'sentence' && s0.text === '크게 보고 싶은 문장이에요.' && s0.bookTitle && s0.page === 9 && s0.reason === '마음에 남아서', JSON.stringify(s0));
  t.check('친구 집: 책갈피 칸에 문장·테두리(t2)·책 제목이 있다', s1?.type === 'bookmark' && s1.text === '크게 보고 싶은 문장이에요.' && s1.template === 't2' && s1.bookTitle, JSON.stringify(s1));
  t.check('친구 집: 그림 독서록 칸에 사진 id·설명·책 제목이 있다', s2?.type === 'drawing' && s2.imgId === up1.imgId && s2.caption === '토끼가 달리는 그림' && s2.bookTitle, JSON.stringify(s2));
  t.check('친구 집: 책 표지 칸에 사진 id·표지 제목·책 제목이 있다', s3?.type === 'cover' && s3.imgId === up2.imgId && s3.title === '내가 꾸민 표지' && s3.bookTitle, JSON.stringify(s3));
  t.check('친구 집: 빈 칸(4, 5번)은 null 이라 눌러도 아무 일이 없다', room.slots.length === 6 && room.slots[4] === null && room.slots[5] === null, JSON.stringify(room.slots.map((s) => s && s.kind)));

  // ── 마을 화면(교사)에서도 같은 내용 ──
  const vh = await call('village/house', { studentId: owner.id }, A.teacher);
  t.eq('마을 화면: 같은 칸에 같은 내용이 온다', JSON.stringify(vh.slots), JSON.stringify(room.slots));

  // ── 크게 보는 사진이 열린다 (학생·교사 토큰), 로그인·다른 반은 안 열린다 ──
  const viaFriend = await getImg(friend.token, up1.imgId);
  const viaTeacher = await getImg(A.teacher, up1.imgId);
  t.check('친구(학생 토큰)가 그림 독서록 사진을 열 수 있다', viaFriend.status === 200 && viaFriend.type === 'image/jpeg', JSON.stringify(viaFriend));
  t.check('마을 화면(교사 토큰)이 책 표지 사진을 열 수 있다', (await getImg(A.teacher, up2.imgId)).status === 200 && viaTeacher.status === 200, JSON.stringify(viaTeacher));
  t.eq('로그인 없이는 사진이 열리지 않는다(401)', (await getImg(null, up1.imgId)).status, 401);
  const B = await newClass();
  t.eq('다른 반 교사는 사진을 열 수 없다(404)', (await getImg(B.teacher, up1.imgId)).status, 404);

  // ── 보기만 한다: 크게 봐도 서버에는 아무 요청도 가지 않는다 ──
  const zoom = await getText('/js/student/zoom.js');
  t.check('크게 보기 파일이 있고 openZoom·closeZoom·zoomable 을 내보낸다', zoom.status === 200 && ['export function openZoom', 'export function closeZoom', 'export function zoomable'].every((s) => zoom.body.includes(s)), String(zoom.status));
  t.check('크게 보기는 서버를 부르지 않는다(api·fetch 없음) — 이미 받은 내용을 키워서 보여 줄 뿐', !/\bapi\(|\bfetch\(|XMLHttpRequest|sendBeacon/.test(zoom.body), '');
  t.check('닫기: 닫기 버튼 · Esc · 바깥 누르기, 그리고 Esc 는 이 창만 닫는다(위로 퍼지지 않음)', zoom.body.includes('onclick: closeZoom') && zoom.body.includes("ev.key === 'Escape'") && zoom.body.includes('ev.stopPropagation()') && zoom.body.includes("addEventListener('keydown', onKey, true)") && zoom.body.includes('ev.target === back'), '');
  t.check('칸은 눌리는 버튼으로 표시된다(role=button, tabindex, 읽어 주는 이름)·Enter/스페이스로도 열린다', ["'role', 'button'", "'tabindex', '0'", "ev.key !== 'Enter' && ev.key !== ' '", '크게 보기'].every((s) => zoom.body.includes(s)), '');
  t.check('창은 body 에 붙는다(새로고침되는 영역 바깥)', zoom.body.includes('document.body.append(back)'), '');

  // ── 친구 집 · 마을 화면이 크게 보기를 쓴다 ──
  const friendsJs = await getText('/js/student/friends.js');
  t.check('친구 집: 크게 보기를 가져와 걸린 작품 칸에만 붙인다(빈 칸은 그대로)', friendsJs.body.includes("from './zoom.js'") && /item \? zoomable\(slot, item\) : slot/.test(friendsJs.body), '');
  const vjs = await getText('/js/village.js');
  t.check('마을 화면: 크게 보기를 가져와 전시 칸 작품에 붙이고, 집 구경 창을 닫으면 크게 보기도 닫는다', vjs.body.includes("from './student/zoom.js'") && /zoomable\(h\('div', \{ class: 'v-slot' \}/.test(vjs.body) && /function closeRoom\(\) \{\s*closeZoom\(\)/.test(vjs.body), '');

  // ── 창 겹침 순서: 마을 집 구경 창(80) < 크게 보기(85) < 소식 배너(90) ──
  const appCss = await getText('/css/app.css');
  const vCss = await getText('/css/village.css');
  const z = (css, sel) => Number((css.match(new RegExp(`${sel.replace(/\./g, '\\.')} \\{[^}]*z-index: (\\d+)`)) || [])[1]);
  const roomZ = z(vCss.body, '.v-room-back');
  const zoomZ = z(appCss.body, '.zoom-back');
  const banner = Number((vCss.body.match(/position: fixed; left: 50%; top: 42%;[^}]*z-index: (\d+)/) || [])[1]);
  t.eq('집 구경 창 80 < 크게 보기 85 < 소식 배너 90', [roomZ, zoomZ, banner], [80, 85, 90]);
  t.check('학생 앱의 아래 메뉴(40)·알림(50)·고르는 창(60)보다 위에 뜬다', zoomZ > 60, String(zoomZ));
  t.check('TV 에서도 크게 보이게 글자 크기가 화면 너비에 맞춰 커진다(clamp·vw)', /\.zoom-body \.item \{[^}]*font-size: clamp\([^)]*vw/.test(appCss.body) && /\.zoom-body \.photo \{[^}]*max-height: 62vh/.test(appCss.body), '');
}
