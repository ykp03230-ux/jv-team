import { call, newClass, seed, student, BASE } from './lib.mjs';

export const num = 19;
export const title = '(추가) 마을 화면에서 학생 집 구경';
export const method = '집 보기 API(교사·학생 토큰, 로그인 없으면 401), 집 모습·pick·전시 칸·그림 독서록 사진(교사 토큰으로 열림), 코인·EXP 등 개인 기록 비노출, 보기만 해서 아무 기록도 안 바뀜, 없는 학생 404, 반 분리, 마을 화면 파일에 클릭·닫기 동작 있음';

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
  const viewer = await student(A.code, '구경꾼', '1111');
  const owner = await student(A.code, '집주인', '2222');

  // ── 시연 학생(예시 데이터): 집 모습·pick·전시 칸 ──
  const stu = await call('village/house', { studentId: 'demo' }, viewer.token);
  t.check('학생 토큰으로 시연의 집을 볼 수 있다: 닉네임·집 단계(초가집, EXP 295)·외형·전시 칸 6개', stu.ok && stu.house.nick === '시연' && stu.house.stage.key === 'thatch' && stu.house.stage.name === '초가집' && stu.house.equipped && stu.slots.length === 6, JSON.stringify(stu).slice(0, 200));
  t.check('시연의 pick 문장이 보인다(문장·책 제목·쪽)', !!stu.pick?.text && !!stu.pick.bookTitle && stu.pick.page > 0, JSON.stringify(stu.pick));
  t.check('시연의 전시 칸에 작품이 걸려 있다(비어 있지 않음)', stu.slots.filter(Boolean).length >= 1, JSON.stringify(stu.slots.map((s) => s && s.kind)));
  const tea = await call('village/house', { studentId: 'demo' }, A.teacher);
  t.eq('교사 토큰(마을 TV 화면)으로도 같은 내용', JSON.stringify(tea.house) + JSON.stringify(tea.slots) + JSON.stringify(tea.pick), JSON.stringify(stu.house) + JSON.stringify(stu.slots) + JSON.stringify(stu.pick));
  t.eq('로그인 없이는 401', (await call('village/house', { studentId: 'demo' }, null)).status, 401);

  // ── 개인 기록은 보내지 않는다 ──
  const raw = JSON.stringify(stu);
  t.check('코인·EXP·인증·보상 횟수·PIN·방문 기록은 응답에 없다', !/"(coins|exp|certs|claims|pin|ledger|dayCoins|guestbook|daily|days)"/.test(raw), raw.slice(0, 160));
  const vgHouse = (await call('village/get', {}, A.teacher)).houses.find((x) => x.id === 'demo');
  t.check('마을 목록의 집 단계와 집 보기의 집 단계가 같다', vgHouse.stage.key === stu.house.stage.key && vgHouse.nick === stu.house.nick, JSON.stringify(vgHouse.stage));

  // ── 보기만 한다: 구경해도 아무 기록도 바뀌지 않는다 ──
  const meBefore = JSON.stringify((await call('me', {}, viewer.token)).me);
  const gbBefore = JSON.stringify((await call('friends/house', { friendId: 'demo' }, owner.token)).guestbook);
  const dailyBefore = JSON.stringify((await call('daily/me', {}, viewer.token)).days[0]);
  for (let i = 0; i < 3; i++) await call('village/house', { studentId: 'demo' }, viewer.token);
  await call('village/house', { studentId: 'demo' }, A.teacher);
  const meAfter = JSON.stringify((await call('me', {}, viewer.token)).me);
  t.eq('구경한 학생의 코인·EXP·퀘스트(친구 방문 ③ 포함)가 그대로다', meAfter, meBefore);
  t.eq('구경해도 친구 집에 "○○이 다녀감" 기록이 남지 않는다', JSON.stringify((await call('friends/house', { friendId: 'demo' }, owner.token)).guestbook), gbBefore);
  t.eq('일자별 출석 기록(친구 방문)도 그대로다', JSON.stringify((await call('daily/me', {}, viewer.token)).days[0]), dailyBefore);
  t.check('구경한 사실이 퀘스트 ③을 완료시키지 않는다', (await call('me', {}, viewer.token)).me.quests.visit === false, '');

  // ── 직접 만든 학생: 아직 아무것도 없을 때 → 걸면 바로 보인다 ──
  const empty = await call('village/house', { studentId: owner.id }, A.teacher);
  t.check('아무것도 안 한 학생의 집: 부지, 전시 칸 6개 모두 비어 있고 pick 없음', empty.ok && empty.house.stage.key === 'plot' && empty.slots.length === 6 && empty.slots.every((s) => s === null) && empty.pick === null, JSON.stringify(empty).slice(0, 160));

  await call('books/register', { bookId: 'b01' }, owner.token);
  const sent = await call('activity/submit', { bookId: 'b01', type: 'sentence', text: '집주인이 고른 문장', page: 7, reason: '좋아서' }, owner.token);
  const up = await upload(owner.token, fakeJpeg(800, 600));
  const draw = await call('activity/submit', { bookId: 'b01', type: 'drawing', imgId: up.imgId, caption: '집주인의 그림' }, owner.token);
  t.check('(준비) 문장·그림 독서록 만들기', sent.ok && draw.ok && up.imgId, JSON.stringify([sent.error, draw.error, up.error]));
  await call('slot/set', { index: 0, kind: 'sentence', id: sent.item.id }, owner.token);
  await call('slot/set', { index: 2, kind: 'work', id: draw.item.id }, owner.token);
  await call('pick/set', { id: sent.item.id }, owner.token);
  const full = await call('village/house', { studentId: owner.id }, A.teacher);
  t.check('걸어 둔 문장(0번 칸)과 그림 독서록(2번 칸)이 그 칸 자리에 보인다', full.slots[0]?.text === '집주인이 고른 문장' && full.slots[2]?.type === 'drawing' && full.slots[2].caption === '집주인의 그림' && full.slots[1] === null, JSON.stringify(full.slots.map((s) => s && (s.text || s.caption))));
  t.eq('pick 문장이 바뀐 대로 보인다', full.pick?.text, '집주인이 고른 문장');
  const img = await getImg(A.teacher, full.slots[2].imgId);
  t.check('마을 화면(교사 토큰)이 그림 독서록의 사진을 열 수 있다', img.status === 200 && img.type === 'image/jpeg', JSON.stringify(img));
  t.eq('로그인 없이는 사진이 열리지 않는다(401)', (await getImg(null, full.slots[2].imgId)).status, 401);
  await call('pick/set', { id: null }, owner.token);
  t.eq('pick 을 내리면 집 보기에서도 사라진다', (await call('village/house', { studentId: owner.id }, A.teacher)).pick, null);

  // ── 입력 검사 ──
  t.eq('없는 학생은 404', (await call('village/house', { studentId: 'nope' }, A.teacher)).status, 404);
  t.eq('학생 id 를 빼도 404(오류로 죽지 않는다)', (await call('village/house', {}, A.teacher)).status, 404);
  t.eq('숫자나 객체를 보내도 404', [(await call('village/house', { studentId: 7 }, A.teacher)).status, (await call('village/house', { studentId: { a: 1 } }, A.teacher)).status], [404, 404]);
  t.eq('__proto__ 같은 이름도 404', (await call('village/house', { studentId: '__proto__' }, A.teacher)).status, 404);

  // ── 반 분리 ──
  const B = await newClass();
  const bs = await student(B.code, '다른반', '3333');
  t.eq('다른 반 토큰으로는 우리 반 학생(직접 만든 id)의 집이 보이지 않는다(404)', (await call('village/house', { studentId: owner.id }, bs.token)).status, 404);
  t.eq('다른 반 교사 토큰도 마찬가지(404)', (await call('village/house', { studentId: owner.id }, B.teacher)).status, 404);
  t.eq('다른 반의 사진도 열 수 없다(404)', (await getImg(B.teacher, full.slots[2].imgId)).status, 404);

  // ── 마을 화면 파일: 집을 누르면 열리고, 닫을 수 있고, 10초 새로고침에도 안 닫힌다 ──
  const js = await getText('/js/village.js');
  t.check('마을 화면 파일에 집 보기 호출·클릭·키보드·Esc·바깥 누르기 닫기가 있다', js.status === 200 && ['village/house', "addEventListener('click'", "ev.key !== 'Enter'", "ev.key === 'Escape'", 'ev.target === roomEl'].every((s) => js.body.includes(s)), String(js.status));
  t.check('집 보기 창은 새로고침되는 #app 바깥(body)에 붙는다', js.body.includes('document.body.append(roomEl)') && !/root\.append\(roomEl\)/.test(js.body), '');
  t.check('집 칸은 눌리는 버튼으로 표시된다(role=button, tabindex, 읽어 주는 이름)', /role: 'button', tabindex: '0', 'aria-label': `\$\{x\.nick\}의 집/.test(js.body), '');
  t.check('그림 사진은 교사·학생 로그인 정보를 붙여 불러온다', js.body.includes('setImageRenderer') && js.body.includes("authorization: 'Bearer ' + savedToken()"), '');
  const css = await getText('/css/village.css');
  t.check('스타일: 창이 소식 배너(z-index 90)보다 아래(80)이고 집 칸에 손가락 모양이 있다', css.status === 200 && /\.v-room-back \{[^}]*z-index: 80/.test(css.body) && /\.v-house \{[^}]*cursor: pointer/.test(css.body), String(css.status));
}
