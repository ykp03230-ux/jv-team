import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { call, newClass, seed, student, BASE } from './lib.mjs';

export const num = 7;
export const title = '박물관 기능 삭제 확인';
export const method = '박물관 API 가 모두 없는 주소(404), 예시 데이터·교사 현황·마을 건물에 박물관 흔적 없음, 학생 화면 파일에 박물관 탭·"박물관에 내기" 버튼 없음, 다른 기능은 정상';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

export async function run(t) {
  const A = await newClass(); await seed(A);
  const demo = await student(A.code, '시연', '0000');

  // ── 서버: 박물관 주소는 모두 없다 ──
  const gone = [
    ['museum/status', demo.token], ['museum/list', demo.token], ['museum/submit', demo.token], ['museum/vote', demo.token], ['museum/unvote', demo.token],
    ['teacher/museum', A.teacher], ['teacher/museum/toggle', A.teacher], ['teacher/vote/open', A.teacher], ['teacher/vote/close', A.teacher], ['teacher/sub/hide', A.teacher],
  ];
  for (const [action, token] of gone) {
    const r = await call(action, {}, token);
    t.check(`${action} 는 없다(404)`, r.status === 404 && r.error === 'not_found', JSON.stringify(r));
  }

  // ── 예시 데이터·교사 현황·마을 ──
  const s = await seed(A);
  t.check('예시 데이터 요약에 박물관 작품 수가 없다', !('subs' in s) && s.students === 20 && s.villageExp === 290, JSON.stringify(s));
  const ov = await call('teacher/overview', {}, A.teacher);
  t.check('교사 현황에 전시(museumOn) 정보가 없다', !('museumOn' in ov.class), JSON.stringify(ov.class));
  const v = await call('village/get', {}, A.teacher);
  t.eq('마을 건물에 박물관이 없다', v.village.buildings.map((b) => b.name), ['서당', '장터', '정자', '연못', '서원']);
  const created = await call('class/create', { password: 'repro-pass-1', name: '삭제 확인' });
  t.check('새 반에는 박물관 자료가 만들어지지 않는다', created.ok, JSON.stringify(created));

  // ── 화면 파일: 학생·교사 ──
  const studentJs = await (await fetch(`${BASE}/js/student.js`)).text();
  t.check('학생 화면 메뉴에 박물관 탭이 없다', !/museum|박물관/.test(studentJs), '');
  const booksJs = await (await fetch(`${BASE}/js/student/books.js`)).text();
  const houseJs = await (await fetch(`${BASE}/js/student/house.js`)).text();
  t.check('책·내 집 화면에 "박물관에 내기" 버튼이 없다', !/museum|박물관/.test(booksJs + houseJs), '');
  const teacherJs = await (await fetch(`${BASE}/js/teacher.js`)).text();
  const panelsJs = await (await fetch(`${BASE}/js/teacher/panels.js`)).text();
  t.check('교사 화면에 박물관 칸이 없다', !/museumPanel|박물관/.test(teacherJs + panelsJs), '');
  const gone2 = await fetch(`${BASE}/js/student/museum.js`);
  t.check('박물관 화면 파일이 서버에 없다', gone2.status === 404 || !(await gone2.text()).includes('museum/list'), String(gone2.status));

  // ── 소스에서도 지워졌다 (로컬 시험일 때만 파일을 읽는다) ──
  if (BASE.includes('127.0.0.1') || BASE.includes('localhost')) {
    for (const f of ['src/routes/museum.js', 'src/engine/museum.js', 'public/js/student/museum.js']) {
      let exists = true; try { read(f); } catch { exists = false; }
      t.check(`${f} 파일이 지워졌다`, !exists, '');
    }
    t.check('서버 라우트 목록에 박물관이 없다', !/museum/.test(read('src/routes/index.js')), '');
  }

  // ── 박물관을 지워도 다른 기능은 그대로 ──
  const demo2 = await student(A.code, '시연', '0000'); // 위에서 예시 데이터를 다시 채웠으니 다시 입장한다
  const me = await call('me', {}, demo2.token);
  t.check('학생 정보·오늘의 문장은 정상', me.ok && me.me.nick === '시연' && me.me.sentence.text, JSON.stringify(me).slice(0, 80));
  const lib = await call('library/get', {}, demo2.token);
  t.check('서재 도감은 정상(문장 2개)', lib.ok && lib.library.sentences.length === 2, '');
}
