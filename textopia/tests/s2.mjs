import { call, newClass, seed, join } from './lib.mjs';

export const num = 2;
export const title = '학생 입장 · 로그인 유지 · 반 분리';
export const method = '반 코드+닉네임+PIN 입장, 같은 토큰으로 me 재요청(새로고침과 같음), 틀린 PIN, 다른 반 토큰·코드로 접근';

export async function run(t) {
  const A = await newClass('A반'); await seed(A);
  const B = await newClass('B반'); await seed(B);

  const j = await join(A.code, '시연', '0000');
  t.check('시연/0000 으로 입장된다', j.ok && j.token && j.me.nick === '시연' && j.me.exp === 295, JSON.stringify(j));
  t.eq('기존 닉네임은 새로 만들지 않는다(created=false)', j.created, false);

  const refresh = await call('me', {}, j.token);
  t.check('같은 토큰으로 다시 요청해도(새로고침) 로그인이 유지된다', refresh.ok && refresh.me.nick === '시연', JSON.stringify(refresh));

  const wrong = await join(A.code, '시연', '1111');
  t.eq('같은 닉네임에 틀린 PIN 은 401', wrong.status, 401);
  t.check('틀린 PIN 은 토큰을 주지 않는다', !wrong.token, JSON.stringify(wrong));
  const wrongFmt = await join(A.code, '시연', '12a4');
  t.eq('PIN 이 숫자 4자리가 아니면 400', wrongFmt.status, 400);
  const spaced = await join(A.code, ' 시연 ', '0000');
  t.check('닉네임 앞뒤 공백은 같은 학생으로 본다', spaced.ok && spaced.me.id === j.me.id, JSON.stringify(spaced));

  const fresh = await join(A.code, '새친구', '4321');
  t.check('처음 쓰는 닉네임은 새로 만들어진다', fresh.ok && fresh.created === true && fresh.me.exp === 0 && fresh.me.coins === 0, JSON.stringify(fresh));
  const freshAgain = await join(A.code, '새친구', '4321');
  t.check('같은 닉네임+PIN 은 다시 입장된다(같은 학생)', freshAgain.ok && freshAgain.created === false && freshAgain.me.id === fresh.me.id, JSON.stringify(freshAgain));
  const freshWrong = await join(A.code, '새친구', '4322');
  t.eq('새로 만든 닉네임도 틀린 PIN 은 401', freshWrong.status, 401);

  // 다른 반
  const bad = await join('ZZZZZZ', '시연', '0000');
  t.check('없는 반 코드는 입장되지 않는다', !bad.ok && bad.status === 404, JSON.stringify(bad));
  const lower = await join(A.code.toLowerCase(), '시연', '0000');
  t.check('반 코드는 소문자로 써도 된다', lower.ok, JSON.stringify(lower));

  const inB = await join(B.code, '새친구', '4321');
  t.check('B반에는 A반의 "새친구"가 없다(새 계정으로 만들어진다)', inB.ok && inB.created === true && inB.me.id !== fresh.me.id, JSON.stringify(inB));
  const aTeacherView = await call('teacher/overview', {}, A.teacher);
  const bTeacherView = await call('teacher/overview', {}, B.teacher);
  t.check('A반 교사 화면에 B반 학생이 섞이지 않는다', aTeacherView.students.length === 21 && bTeacherView.students.length === 21, `${aTeacherView.students.length}/${bTeacherView.students.length}`);

  const bTokenOnA = await call('me', { code: A.code }, inB.token);
  t.check('B반 토큰으로 A반 코드를 보내도 A반 정보는 나오지 않는다', bTokenOnA.ok && bTokenOnA.me.class.code === B.code, JSON.stringify(bTokenOnA.me?.class));
  const forged = await call('me', {}, `${B.code}.${j.token.split('.')[1]}`);
  t.eq('A반 비밀값에 B반 코드를 붙인 위조 토큰은 401', forged.status, 401);
  const studentAsTeacher = await call('teacher/overview', {}, j.token);
  t.eq('학생 토큰으로 교사 화면은 403', studentAsTeacher.status, 403);
  const teacherAsStudent = await call('me', {}, A.teacher);
  t.eq('교사 토큰으로 학생 화면은 403', teacherAsStudent.status, 403);
  // B반 교사가 요청에 A반 코드를 적어 보내도, 적용되는 곳은 토큰의 반(B)뿐이다
  const bTeacherOnA = await call('teacher/seed', { code: A.code }, B.teacher);
  const bAfter = await call('teacher/overview', {}, B.teacher);
  const aStill = await call('teacher/overview', {}, A.teacher);
  t.check('B반 교사 토큰은 A반 코드를 적어도 B반에만 적용된다', bTeacherOnA.ok && bAfter.students.length === 20 && aStill.students.length === 21,
    `B ${bAfter.students.length}명 / A ${aStill.students.length}명`);

  const out = await call('logout', {}, j.token);
  t.check('로그아웃된다', out.ok, JSON.stringify(out));
  const after = await call('me', {}, j.token);
  t.eq('로그아웃한 토큰은 401', after.status, 401);
}
