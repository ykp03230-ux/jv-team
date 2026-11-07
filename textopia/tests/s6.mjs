import { call, newClass, seed, student, BASE } from './lib.mjs';

export const num = 6;
export const title = '마을 EXP · 장터 해금 · TV 화면';
export const method = '마을 EXP 290→300 에서 장터 해금과 집 단계 반영(서버 즉시), 개인 순위·EXP 비노출, 새로고침 주기 상수 ≤10초 확인. (TV 화면 10초 안 표시는 브라우저에서 별도 측정)';

export async function run(t) {
  const A = await newClass(); await seed(A);
  const v0 = await call('village/get', {}, A.teacher);
  t.eq('시작: 마을 EXP 290', v0.village.exp, 290);
  const open0 = v0.village.buildings.filter((b) => b.unlocked).map((b) => b.name);
  t.eq('기본 건물은 서당·박물관뿐(장터는 아직 잠김)', open0, ['서당', '박물관']);
  t.eq('잠긴 건물의 해금 EXP: 장터 300, 정자 800, 연못 1500, 서원 3000', v0.village.buildings.filter((b) => !b.unlocked).map((b) => [b.name, b.at]), [['장터', 300], ['정자', 800], ['연못', 1500], ['서원', 3000]]);
  t.eq('다음 건물은 장터(300)', v0.village.next, { name: '장터', at: 300 });
  t.eq('학생 집 20채', v0.houses.length, 20);
  t.check('집 정보에는 개인 EXP·코인·순위가 없다(id·닉네임·집 단계·외형만)', v0.houses.every((x) => JSON.stringify(Object.keys(x).sort()) === JSON.stringify(['equipped', 'id', 'nick', 'stage'])), JSON.stringify(v0.houses[0]));
  t.check('응답 전체에 exp·coins·rank 글자가 집 항목에 없다', !/"(exp|coins|rank|score)"/.test(JSON.stringify(v0.houses)), '');
  const demoHouse0 = v0.houses.find((x) => x.nick === '시연');
  t.eq('시연의 집은 초가집', demoHouse0.stage.key, 'thatch');
  t.eq('집 단계가 4가지 모두 보인다', [...new Set(v0.houses.map((x) => x.stage.key))].sort(), ['pit', 'plot', 'thatch', 'tile']);

  // 시연이 오늘의 문장을 쓰면 +10 → 마을 EXP 300, 시연 EXP 305
  const demo = await student(A.code, '시연', '0000');
  const r = await call('sentence/submit', { text: demo.me.sentence.text }, demo.token);
  t.check('필사 보상 응답에 장터 해금과 기와집 승급이 담긴다', r.reward.unlocked.includes('장터') && r.reward.stageUp?.to === '기와집', JSON.stringify(r.reward));

  const v1 = await call('village/get', {}, A.teacher);
  t.eq('마을 EXP 가 300 이 된다', v1.village.exp, 300);
  t.check('장터가 해금되어 마을 화면 자료에 바로 나온다', v1.village.buildings.find((b) => b.id === 'market').unlocked === true, '');
  t.eq('다음 건물은 정자(800)', v1.village.next, { name: '정자', at: 800 });
  t.eq('시연의 집이 기와집(tile)으로 바뀐다', v1.houses.find((x) => x.nick === '시연').stage.key, 'tile');
  t.eq('집은 여전히 20채(중복 없음)', v1.houses.length, 20);

  // 접근 권한
  const asStudent = await call('village/get', {}, demo.token);
  t.check('같은 반 학생도 마을을 볼 수 있다', asStudent.ok && asStudent.village.exp === 300, JSON.stringify(asStudent).slice(0, 120));
  t.eq('로그인 없이는 401', (await call('village/get', {}, null)).status, 401);
  const B = await newClass();
  const bs = await student(B.code, '다른반', '1111');
  const vb = await call('village/get', { code: A.code }, bs.token);
  t.check('다른 반 학생은 자기 반 마을만 본다(EXP 0, 집 1채)', vb.village.exp === 0 && vb.houses.length === 1 && vb.houses[0].nick === '다른반', JSON.stringify(vb.houses));

  // 새로고침 주기
  const res = await fetch(`${BASE}/js/village.js`);
  const src = await res.text();
  const ms = Number((src.match(/REFRESH_MS\s*=\s*(\d+)/) || [])[1]);
  t.check('마을 화면의 새로고침 주기가 10초 이하', ms > 0 && ms <= 10000, String(ms));
  t.check('마을 화면이 setInterval 로 주기적으로 다시 불러온다', /setInterval\(tick, REFRESH_MS\)/.test(src), '');
}
