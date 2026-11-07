// 필사 비교. 연속된 공백은 하나로 보고, 문장부호·기호는 무시한다.
// (서버와 시험에서 같이 쓰므로 Cloudflare 전용 코드를 넣지 않는다.)

export function normalize(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[\p{P}\p{S}​-‍﻿]/gu, '') // 문장부호·기호·보이지 않는 글자 제거
    .replace(/\s+/g, ' ')                               // 연속된 공백 → 하나
    .trim();
}

export const sameText = (a, b) => normalize(a) === normalize(b);

/**
 * 정답(expected)과 학생이 쓴 글(typed)을 글자 단위로 맞춰 본다. 둘 다 normalize 된 글을 넣는다.
 * 반환: [{ c: 글자, s: 'ok' | 'bad' | 'miss' }]
 *   ok   맞게 쓴 글자
 *   bad  틀리게 쓴 글자(바꿔 쓴 것, 더 쓴 것)
 *   miss 빠뜨린 글자 (정답의 글자를 보여 준다)
 */
export function diffMarks(expected, typed) {
  const a = [...expected];
  const b = [...typed];
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = 0; i <= n; i++) dp[i * w] = i;
  for (let j = 0; j <= m; j++) dp[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * w + j] = Math.min(dp[(i - 1) * w + j] + 1, dp[i * w + j - 1] + 1, dp[(i - 1) * w + j - 1] + cost);
    }
  }
  const out = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i * w + j] === dp[(i - 1) * w + j - 1]) {
      out.push({ c: b[j - 1], s: 'ok' }); i--; j--;
    } else if (i > 0 && j > 0 && dp[i * w + j] === dp[(i - 1) * w + j - 1] + 1) {
      out.push({ c: b[j - 1], s: 'bad' }); i--; j--;
    } else if (j > 0 && dp[i * w + j] === dp[i * w + j - 1] + 1) {
      out.push({ c: b[j - 1], s: 'bad' }); j--;
    } else {
      out.push({ c: a[i - 1], s: 'miss' }); i--;
    }
  }
  return out.reverse();
}
