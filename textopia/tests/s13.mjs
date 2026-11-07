import { call, join, student, BASE, TEACHER_PW } from './lib.mjs';

export const num = 13;
export const title = '(추가) 로그인 간소화: 직접 정한 반 코드 · 교사의 학생 계정 추가 · PIN 0000 통일';
export const method = '쉬운 반 코드로 반 만들기(중복·형식 검사, 소문자 입장), 닉네임 목록으로 계정 추가(중복·길이·인원 상한), 추가한 학생은 PIN 0000 으로 입장, PIN 일괄 0000, 파일럿 설정값 확인';

const uniq = () => 'PT' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 10);

export async function run(t) {
  // ── 쉬운 반 코드를 직접 정하기 ──
  const code = uniq();
  const created = await call('class/create', { name: '파일럿 반', password: TEACHER_PW, code: code.toLowerCase() });
  t.check('소문자로 적어도 대문자 반 코드로 만들어진다', created.ok && created.code === code, JSON.stringify(created));
  const dup = await call('class/create', { name: '또', password: TEACHER_PW, code });
  t.check('이미 있는 코드는 409, 안내 문구가 나온다', dup.status === 409 && dup.error === 'code_taken' && /이미 쓰고 있는 반 코드/.test(dup.message) && /다른 코드를 정해/.test(dup.message), JSON.stringify(dup));
  t.eq('3자 코드는 400', (await call('class/create', { password: TEACHER_PW, code: 'ABC' })).status, 400);
  t.eq('특수문자가 든 코드는 400', (await call('class/create', { password: TEACHER_PW, code: 'ABC-DEF' })).status, 400);
  t.eq('11자 코드는 400', (await call('class/create', { password: TEACHER_PW, code: 'ABCDEFGHIJK' })).status, 400);
  t.eq('한글 코드는 400', (await call('class/create', { password: TEACHER_PW, code: '파일럿반' })).status, 400);
  const blank = await call('class/create', { password: TEACHER_PW, code: '  ' });
  t.check('코드를 비우면 예전처럼 자동 6자리', blank.ok && /^[A-HJKMNP-Z2-9]{6}$/.test(blank.code), JSON.stringify(blank));
  t.eq('비밀번호가 짧으면 직접 정한 코드도 만들어지지 않는다(400)', (await call('class/create', { password: '123', code: uniq() })).status, 400);
  const tl = await call('teacher/login', { code: code.toLowerCase(), password: TEACHER_PW });
  t.check('교사 로그인은 소문자 코드로도 된다', tl.ok && tl.code === code, JSON.stringify(tl));
  const teacher = created.token;

  // ── 교사가 학생 계정 추가 ──
  const s0 = await student(code, '먼저온친구', '4321'); // 학생이 직접 만든(PIN 4321) 계정
  t.eq('학생은 계정을 추가할 수 없다(403)', (await call('teacher/students/add', { nicks: '몰래' }, s0.token)).status, 403);
  t.eq('로그인 없이는 401', (await call('teacher/students/add', { nicks: '몰래' }, null)).status, 401);
  t.eq('빈 목록은 400', (await call('teacher/students/add', { nicks: ' \n \n' }, teacher)).status, 400);
  t.eq('문자열도 배열도 아니면 400', (await call('teacher/students/add', { nicks: 5 }, teacher)).status, 400);

  const add = await call('teacher/students/add', { nicks: '다온\n하람\n별이\n다온\n  \n 하 람 \n열한글자를넘는닉네임입니다\n먼저온친구' }, teacher);
  t.eq('추가된 닉네임은 다온·하람·별이', add.added, ['다온', '하람', '별이']);
  const reasons = Object.fromEntries(add.skipped.map((s) => [s.nick, s.reason]));
  t.check('중복(같은 목록 안, 띄어쓰기만 다름, 이미 있는 학생)과 너무 긴 닉네임은 이유와 함께 건너뛴다',
    add.skipped.length === 4 && reasons['다온'] === '이미 있는 닉네임이에요.' && reasons['하 람'] === '이미 있는 닉네임이에요.' && reasons['먼저온친구'] === '이미 있는 닉네임이에요.' && /1~10자/.test(Object.values(reasons).join('')), JSON.stringify(add.skipped));
  t.eq('전체 학생 수는 4명', add.total, 4);
  const ov = await call('teacher/overview', {}, teacher);
  t.check('교사 학생 목록에 새 계정이 보인다(부지, EXP 0, 코인 0)', ['다온', '하람', '별이'].every((n) => ov.students.find((s) => s.nick === n && s.exp === 0 && s.coins === 0 && s.stage === '부지')), JSON.stringify(ov.students.map((s) => s.nick)));
  const vil = await call('village/get', {}, teacher);
  t.check('마을 화면에도 집이 생긴다', ['다온', '하람', '별이'].every((n) => vil.houses.some((h) => h.nick === n)), JSON.stringify(vil.houses.map((h) => h.nick)));

  // ── 추가한 계정은 PIN 0000 으로 입장 ──
  const j = await join(code, '다온', '0000');
  t.check('추가한 학생 "다온"이 PIN 0000 으로 입장(새로 만들어지지 않음)', j.ok && j.created === false && j.me.nick === '다온', JSON.stringify(j).slice(0, 160));
  t.eq('다른 PIN 은 거부된다(401)', (await join(code, '다온', '1234')).status, 401);
  const j2 = await join(code.toLowerCase(), '별이', '0000');
  t.check('반 코드를 소문자로 써도 입장된다', j2.ok, JSON.stringify(j2).slice(0, 120));
  const again = await call('teacher/overview', {}, teacher);
  t.eq('입장해도 학생이 더 늘지 않는다', again.students.length, 4);

  // ── PIN 0000 으로 통일 ──
  t.eq('학생은 PIN 을 통일할 수 없다(403)', (await call('teacher/students/reset-pin', {}, s0.token)).status, 403);
  t.eq('PIN 4321 인 먼저온친구는 아직 0000 으로 못 들어간다(401)', (await join(code, '먼저온친구', '0000')).status, 401);
  const reset = await call('teacher/students/reset-pin', {}, teacher);
  t.eq('모든 학생(4명)의 PIN 을 0000 으로 맞춘다', reset.count, 4);
  t.check('통일 후 먼저온친구는 0000 으로 입장', (await join(code, '먼저온친구', '0000')).ok, '');
  t.eq('옛 PIN 4321 은 더 이상 되지 않는다(401)', (await join(code, '먼저온친구', '4321')).status, 401);
  t.check('통일해도 코인·EXP 는 그대로', (await call('me', {}, s0.token)).ok, '');

  // ── 인원 상한(60명) ──
  const names = Array.from({ length: 60 }, (_, i) => `학생${i + 1}`).join('\n');
  const big = await call('class/create', { password: TEACHER_PW, code: uniq() });
  const full = await call('teacher/students/add', { nicks: names }, big.token);
  t.eq('한 번에 60명까지 추가된다', full.added.length, 60);
  const over = await call('teacher/students/add', { nicks: '넘치는학생' }, big.token);
  t.check('60명이 넘으면 건너뛰고 "가득 찼어요"', over.added.length === 0 && /가득/.test(over.skipped[0]?.reason || ''), JSON.stringify(over));
  const tooMany = await call('teacher/students/add', { nicks: Array.from({ length: 61 }, (_, i) => `x${i}`).join('\n') }, (await call('class/create', { password: TEACHER_PW, code: uniq() })).token);
  t.eq('한 번에 61명은 400', tooMany.status, 400);

  // ── 반 분리: 직접 정한 코드의 반은 다른 반과 섞이지 않는다 ──
  const otherCode = uniq();
  const other = await call('class/create', { password: TEACHER_PW, code: otherCode });
  const jo = await join(otherCode, '다온', '0000');
  t.check('다른 반에서는 "다온"이 새 계정으로 만들어진다(이 반의 다온이 아님)', jo.ok && jo.created === true && jo.me.id !== j.me.id, JSON.stringify(jo).slice(0, 140));
  t.eq('다른 반 교사 토큰은 이 반 학생을 추가할 수 없다(추가돼도 자기 반)', (await call('teacher/overview', {}, teacher)).students.length, 4);
  void other;

  // ── 파일럿 설정값 ──
  const cfg = await (await fetch(`${BASE}/js/config.js`)).text();
  const pilotCode = (cfg.match(/classCode:\s*'([^']*)'/) || [])[1];
  t.check('파일럿 반 코드는 형식에 맞는 쉬운 코드(영어 대문자·숫자 4~10자)', /^[A-Z0-9]{4,10}$/.test(pilotCode || ''), String(pilotCode));
  t.check('파일럿 PIN 은 0000', /pin:\s*'0000'/.test(cfg), cfg);
  const studentJs = await (await fetch(`${BASE}/js/student.js`)).text();
  t.check('학생 입장 화면이 파일럿 설정을 쓴다(코드·PIN 자동 입력)', /PILOT\.classCode/.test(studentJs) && /PILOT\.pin/.test(studentJs), '');
}
