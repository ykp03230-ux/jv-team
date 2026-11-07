// 그림은 모두 SVG/CSS 로 그린다 (이미지 파일 없음). 색은 theme.css 의 변수만 쓴다.
// 이 파일이 만드는 글자는 모두 우리가 정한 값이므로 innerHTML 로 넣어도 안전하다.

const HANBOK = {
  'hb-white': '#F5F0E6', 'hb-pink': '#E9A3B4', 'hb-blue': '#5B7FB0', 'hb-yellow': '#E3B93C', 'hb-green': '#8DB26E',
};

/** 캐릭터 (40 x 64 칸). 외형 아이템에 따라 갓·댕기·한복 색·부채가 달라진다. */
export function avatarGroup(eq = {}, x = 0, y = 0, scale = 1) {
  const outfit = HANBOK[eq.outfit] || HANBOK['hb-white'];
  const hat = eq.hat === 'gat'
    ? '<ellipse cx="20" cy="10" rx="17" ry="4" fill="#1E1B18"/><rect x="12" y="-2" width="16" height="12" rx="3" fill="#2B2724"/>'
    : eq.hat === 'bokgeon'
      ? '<path d="M9 14 Q20 -6 31 14 Z" fill="#1E1B18"/>'
      : '';
  const hair = eq.hat ? '' : '<path d="M9 14 Q20 -4 31 14 Q20 6 9 14 Z" fill="var(--art-hair)"/>';
  const daenggi = eq.hair === 'daenggi' ? '<path d="M30 16 Q38 24 34 44 L31 44 Q33 28 28 20 Z" fill="var(--color-accent)"/>' : '';
  const fan = eq.acc === 'fan' ? '<path d="M30 46 L40 38 A14 14 0 0 1 42 52 Z" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.2"/>' : '';
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    ${daenggi}
    <path d="M7 30 Q20 26 33 30 L39 62 L1 62 Z" fill="${outfit}" stroke="var(--color-ink)" stroke-width="1.4"/>
    <path d="M14 29 L20 42 L26 29" fill="none" stroke="var(--color-ink)" stroke-width="1.2"/>
    <rect x="12" y="43" width="16" height="3" fill="var(--color-accent)"/>
    <circle cx="20" cy="19" r="10" fill="var(--art-skin)" stroke="var(--color-ink)" stroke-width="1.4"/>
    ${hair}${hat}
    <circle cx="16.5" cy="20" r="1.2" fill="var(--color-ink)"/><circle cx="23.5" cy="20" r="1.2" fill="var(--color-ink)"/>
    <path d="M17.5 24 Q20 26 22.5 24" fill="none" stroke="var(--color-ink)" stroke-width="1"/>
    ${fan}
  </g>`;
}

const PROPS = {
  jangdok: `<g><ellipse cx="22" cy="146" rx="10" ry="8" fill="var(--art-wood)"/><rect x="14" y="132" width="16" height="6" rx="2" fill="var(--art-wood)"/>
    <ellipse cx="40" cy="148" rx="8" ry="6" fill="var(--art-thatch-dark)"/><rect x="34" y="138" width="12" height="5" rx="2" fill="var(--art-thatch-dark)"/></g>`,
  lantern: `<g><path d="M62 92 v10" stroke="var(--color-ink)" stroke-width="1.5"/><ellipse cx="62" cy="110" rx="7" ry="9" fill="var(--color-accent)" stroke="var(--color-ink)" stroke-width="1.2"/><path d="M58 104 h8 M58 116 h8" stroke="var(--color-ink)" stroke-width="1"/></g>`,
  screen: `<g><path d="M198 112 l10 -4 v40 l-10 4 z M208 108 l10 4 v40 l-10 -4 z M218 112 l10 -4 v40 l-10 4 z" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.3"/>
    <path d="M203 124 q3 -6 6 0 M213 128 q3 -6 6 0" fill="none" stroke="var(--color-accent)" stroke-width="1.5"/></g>`,
  bonsai: `<g><path d="M186 150 l4 -12 h14 l4 12 z" fill="var(--art-wood)"/><path d="M197 138 v-16 M197 128 l-9 -8 M197 126 l9 -8" stroke="var(--art-wood)" stroke-width="3" fill="none"/>
    <circle cx="187" cy="118" r="4" fill="#F4C6D2"/><circle cx="207" cy="116" r="4" fill="#F4C6D2"/><circle cx="197" cy="112" r="5" fill="#F4C6D2"/></g>`,
};

const GROUND = '<ellipse cx="120" cy="150" rx="108" ry="13" fill="var(--art-earth)"/><path d="M14 150 q10 -8 20 0 M200 150 q10 -8 20 0" stroke="var(--art-grass)" stroke-width="3" fill="none" stroke-linecap="round"/>';

const HOUSES = {
  // 부지: 말뚝과 새끼줄로 터를 잡고 어린 나무를 심었다
  plot: `<g>
    <path d="M52 128 Q86 140 120 128 T188 128" fill="none" stroke="var(--art-thatch-dark)" stroke-width="2.5"/>
    ${[52, 86, 154, 188].map((x) => `<rect x="${x - 3}" y="116" width="6" height="34" rx="2" fill="var(--art-wood)"/>`).join('')}
    <path d="M120 148 v-26" stroke="var(--art-wood)" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="120" cy="112" rx="16" ry="13" fill="var(--art-grass)" stroke="var(--color-ink)" stroke-width="1.4"/>
    <ellipse cx="112" cy="106" rx="6" ry="4" fill="#B7C99B"/></g>`,
  // 움집: 땅을 파고 짚으로 덮은 원뿔 지붕
  pit: `<g>
    <path d="M52 150 Q120 28 188 150 Z" fill="var(--art-thatch)" stroke="var(--color-ink)" stroke-width="1.6"/>
    <path d="M78 140 Q120 62 162 140 M96 144 Q120 92 144 144" fill="none" stroke="var(--art-thatch-dark)" stroke-width="2"/>
    <path d="M104 150 v-26 a16 16 0 0 1 32 0 v26 z" fill="var(--color-ink)"/>
    <rect x="116" y="52" width="8" height="10" fill="var(--art-thatch-dark)"/></g>`,
  // 초가집: 흙벽에 짚 지붕
  thatch: `<g>
    <rect x="56" y="96" width="128" height="54" fill="var(--art-earth-dark)" stroke="var(--color-ink)" stroke-width="1.6"/>
    <path d="M32 102 Q120 20 208 102 Q120 84 32 102 Z" fill="var(--art-thatch)" stroke="var(--color-ink)" stroke-width="1.6"/>
    <path d="M60 94 Q120 44 180 94 M80 96 Q120 62 160 96" fill="none" stroke="var(--art-thatch-dark)" stroke-width="2"/>
    <circle cx="96" cy="66" r="6" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.2"/><circle cx="146" cy="62" r="5" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.2"/>
    <rect x="104" y="110" width="32" height="40" fill="var(--art-wood)" stroke="var(--color-ink)" stroke-width="1.4"/><path d="M120 110 v40" stroke="var(--color-ink)" stroke-width="1"/>
    <rect x="68" y="110" width="24" height="20" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.3"/><path d="M80 110 v20 M68 120 h24" stroke="var(--color-ink)" stroke-width="1"/>
    <rect x="148" y="110" width="24" height="20" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.3"/><path d="M160 110 v20 M148 120 h24" stroke="var(--color-ink)" stroke-width="1"/></g>`,
  // 기와집: 돌 기단, 나무 기둥, 처마 끝이 살짝 올라간 기와지붕
  tile: `<g>
    <rect x="40" y="138" width="160" height="12" fill="var(--art-stone)" stroke="var(--color-ink)" stroke-width="1.4"/>
    <rect x="54" y="92" width="132" height="46" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.6"/>
    ${[54, 98, 142, 182].map((x) => `<rect x="${x - 3}" y="92" width="6" height="46" fill="var(--art-wood)"/>`).join('')}
    <path d="M62 100 h30 v34 h-30 z M108 100 h24 v34 h-24 z M148 100 h30 v34 h-30 z" fill="none" stroke="var(--color-ink)" stroke-width="1"/>
    <path d="M77 100 v34 M120 100 v34 M163 100 v34 M62 117 h30 M108 117 h24 M148 117 h30" stroke="var(--color-ink)" stroke-width="0.8"/>
    <path d="M14 96 Q44 96 62 74 L178 74 Q196 96 226 96 Q198 106 180 100 L60 100 Q42 106 14 96 Z" fill="var(--art-tile)" stroke="var(--color-ink)" stroke-width="1.6"/>
    <path d="M68 74 L90 52 L150 52 L172 74 Z" fill="var(--art-tile-light)" stroke="var(--color-ink)" stroke-width="1.6"/>
    <path d="M80 62 h80 M70 72 h100 M40 88 h160" stroke="var(--art-tile)" stroke-width="1.6" opacity="0.7"/></g>`,
};

/** 집 그림. stage: plot | pit | thatch | tile. eq 를 주면 캐릭터와 집 소품도 함께 그린다. */
export function houseSVG(stage, eq = null, { avatar = true } = {}) {
  const props = (eq?.props || []).map((p) => PROPS[p] || '').join('');
  const me = eq && avatar ? avatarGroup(eq, 170, 84, 1.0) : '';
  return `<svg class="art house-art" viewBox="0 0 240 170" role="img" aria-label="집 그림" xmlns="http://www.w3.org/2000/svg">${GROUND}${HOUSES[stage] || HOUSES.plot}${props}${me}</svg>`;
}

const ROOF = (x1, x2, y, top) =>
  `<path d="M${x1 - 12} ${y} Q${x1 + 6} ${y} ${x1 + 14} ${y - 18} L${x2 - 14} ${y - 18} Q${x2 - 6} ${y} ${x2 + 12} ${y} Q${x2 - 4} ${y + 7} ${x2 - 10} ${y + 3} L${x1 + 10} ${y + 3} Q${x1 + 4} ${y + 7} ${x1 - 12} ${y} Z" fill="var(--art-tile)" stroke="var(--color-ink)" stroke-width="1.4"/>${top ? `<path d="M${x1 + 20} ${y - 18} L${x1 + 32} ${y - 32} L${x2 - 32} ${y - 32} L${x2 - 20} ${y - 18} Z" fill="var(--art-tile-light)" stroke="var(--color-ink)" stroke-width="1.4"/>` : ''}`;

const BUILDINGS = {
  // 서당: 글방. 처마 아래 현판
  seodang: `<rect x="30" y="64" width="100" height="40" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.5"/>
    <rect x="30" y="64" width="6" height="40" fill="var(--art-wood)"/><rect x="124" y="64" width="6" height="40" fill="var(--art-wood)"/>
    <rect x="62" y="74" width="36" height="30" fill="var(--art-wood)"/><rect x="56" y="54" width="48" height="14" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.2"/>
    <text x="80" y="65" text-anchor="middle" font-size="11" font-family="Song Myung, serif" fill="var(--color-ink)">書堂</text>${ROOF(30, 130, 64, false)}`,
  // 박물관: 기둥이 늘어선 큰 기와집
  museum: `<rect x="20" y="100" width="120" height="8" fill="var(--art-stone)" stroke="var(--color-ink)" stroke-width="1.3"/>
    <rect x="28" y="62" width="104" height="38" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.5"/>
    ${[34, 58, 82, 106, 126].map((x) => `<rect x="${x - 3}" y="62" width="6" height="38" fill="var(--art-wood)"/>`).join('')}
    <rect x="68" y="76" width="24" height="24" fill="var(--color-ink)"/>${ROOF(28, 132, 62, true)}`,
  // 장터: 줄무늬 차양을 친 가게 셋
  market: `${[18, 62, 106].map((x, i) => `<g><rect x="${x + 4}" y="74" width="30" height="30" fill="var(--art-earth-dark)" stroke="var(--color-ink)" stroke-width="1.2"/>
      <path d="M${x} 74 L${x + 4} 58 H${x + 34} L${x + 38} 74 Z" fill="${i === 1 ? 'var(--art-paper)' : 'var(--color-accent)'}" stroke="var(--color-ink)" stroke-width="1.3"/>
      <path d="M${x + 11} 58 L${x + 9} 74 M${x + 19} 58 V74 M${x + 27} 58 L${x + 29} 74" stroke="var(--color-ink)" stroke-width="1"/>
      <circle cx="${x + 12}" cy="97" r="5" fill="var(--art-thatch)"/><circle cx="${x + 24}" cy="98" r="5" fill="var(--color-accent)" opacity="0.8"/></g>`).join('')}`,
  // 정자: 기둥 네 개 위에 얹은 지붕, 사방이 트인 쉼터
  pavilion: `<rect x="40" y="100" width="80" height="8" fill="var(--art-stone)" stroke="var(--color-ink)" stroke-width="1.3"/>
    ${[48, 72, 88, 112].map((x) => `<rect x="${x - 3}" y="62" width="6" height="38" fill="var(--art-wood)"/>`).join('')}
    <path d="M44 84 H116" stroke="var(--art-wood)" stroke-width="3"/>${ROOF(40, 120, 62, true)}`,
  // 연못: 물 위에 연잎과 작은 다리
  pond: `<ellipse cx="80" cy="84" rx="62" ry="26" fill="var(--art-water)" stroke="var(--color-ink)" stroke-width="1.5"/>
    <ellipse cx="58" cy="82" rx="11" ry="5" fill="var(--art-grass)" stroke="var(--color-ink)" stroke-width="1"/><ellipse cx="102" cy="90" rx="13" ry="6" fill="var(--art-grass)" stroke="var(--color-ink)" stroke-width="1"/>
    <circle cx="58" cy="78" r="4" fill="#F4C6D2"/><circle cx="102" cy="85" r="4.5" fill="#F4C6D2"/>
    <path d="M70 70 Q80 62 90 70" fill="none" stroke="var(--art-wood)" stroke-width="5"/>`,
  // 서원: 대문과 큰 강당
  seowon: `<rect x="16" y="100" width="128" height="8" fill="var(--art-stone)" stroke="var(--color-ink)" stroke-width="1.3"/>
    <rect x="30" y="64" width="100" height="36" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.5"/>
    ${[36, 60, 100, 124].map((x) => `<rect x="${x - 3}" y="64" width="6" height="36" fill="var(--art-wood)"/>`).join('')}
    <rect x="66" y="78" width="28" height="22" fill="var(--art-wood)"/><rect x="72" y="50" width="16" height="12" fill="var(--art-paper)" stroke="var(--color-ink)" stroke-width="1.2"/>
    ${ROOF(30, 130, 64, true)}<path d="M12 108 H148" stroke="var(--color-ink)" stroke-width="1.5"/>`,
};

/** 마을 건물 그림. 아직 열리지 않은 건물은 흐린 그림자로 보인다. */
export function buildingSVG(id, unlocked) {
  return `<svg class="art building-art${unlocked ? '' : ' locked'}" viewBox="0 0 160 120" role="img" aria-label="건물 그림" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="80" cy="108" rx="70" ry="9" fill="var(--art-earth)"/>${BUILDINGS[id] || ''}</svg>`;
}

/** 상점 미리보기용 캐릭터 */
export function avatarSVG(eq) {
  return `<svg class="art avatar-art" viewBox="-6 -6 52 76" role="img" aria-label="캐릭터" xmlns="http://www.w3.org/2000/svg">${avatarGroup(eq)}</svg>`;
}

/** 기본 책 표지: 색과 제목 글자로 앱이 그린다 (인터넷 이미지를 쓰지 않는다) */
export function coverIndex(id) {
  let n = 0;
  for (const ch of String(id)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return (n % 6) + 1;
}
