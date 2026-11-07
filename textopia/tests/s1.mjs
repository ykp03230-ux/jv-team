import { call, newClass, seed, TEACHER_PW } from './lib.mjs';

export const num = 1;
export const title = '반 만들기 · 예시 데이터';
export const method = '실제 API로 반 생성 → 예시 채우기 2번 → 학생 수·집 단계·작품·문장·마을 EXP·시연 학생 값 비교';

export async function run(t) {
  const cls = await newClass();
  t.check('반 코드가 6자리(헷갈리는 글자 제외)로 나온다', /^[A-HJKMNP-Z2-9]{6}$/.test(cls.code), cls.code);

  const noAuth = await call('teacher/overview', {}, null);
  t.eq('토큰 없이 교사 화면 요청은 401', noAuth.status, 401);

  const badLogin = await call('teacher/login', { code: cls.code, password: 'wrong-pass' });
  t.eq('틀린 교사 비밀번호는 401', badLogin.status, 401);
  const goodLogin = await call('teacher/login', { code: cls.code, password: TEACHER_PW });
  t.check('맞는 교사 비밀번호로 로그인된다', goodLogin.ok && goodLogin.token, JSON.stringify(goodLogin));

  const s1 = await seed(cls);
  t.eq('1번째: 학생 20명', s1.students, 20);
  t.eq('1번째: 오늘의 문장 7일치', s1.scheduleDays, 7);
  t.eq('1번째: 마을 EXP 290', s1.villageExp, 290);
  t.eq('1번째: 학생이 추가한 책 2권', s1.addedBooks, 2);

  const o1 = await call('teacher/overview', {}, cls.teacher);
  t.eq('개요: 마을 EXP 290', o1.village.exp, 290);
  t.eq('개요: 학생 20명', o1.students.length, 20);
  const stages = new Set(o1.students.map((s) => s.stage));
  t.eq('집 단계가 4가지 모두 있다', [...stages].sort(), ['기와집', '부지', '움집', '초가집'].sort());
  const demo = o1.students.find((s) => s.nick === '시연');
  t.check('시연 학생: EXP 295, 코인 40, 초가집', demo && demo.exp === 295 && demo.coins === 40 && demo.stage === '초가집', JSON.stringify(demo));
  t.check('개요 응답에 PIN·해시·비밀번호가 없다', !/hash|salt|pin|password/i.test(JSON.stringify(o1)), '');

  // 두 번째 채우기: 중복 없이 같은 결과
  const idsBefore = o1.students.map((s) => s.id).sort();
  const s2 = await seed(cls);
  t.eq('2번째: 요약이 1번째와 같다', s2, s1);
  const o2 = await call('teacher/overview', {}, cls.teacher);
  t.eq('2번째: 학생 20명 그대로', o2.students.length, 20);
  t.eq('2번째: 닉네임 중복 없음', new Set(o2.students.map((s) => s.nick)).size, 20);
  t.eq('2번째: 학생 id 가 같다(새로 쌓이지 않음)', o2.students.map((s) => s.id).sort(), idsBefore);
  t.eq('2번째: 마을 EXP 290', o2.village.exp, 290);
  const again = await call('teacher/login', { code: cls.code, password: TEACHER_PW });
  t.check('채우기 뒤에도 교사 비밀번호가 유지된다', again.ok, JSON.stringify(again));
}
