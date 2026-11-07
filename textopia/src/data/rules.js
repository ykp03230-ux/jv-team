// 규칙 숫자를 한 곳에 모은다. (보상표·집 단계·마을 건물·상점 아이템)

// ── 보상표 (key 형태는 engine/rewards.js 참고) ───────────────
// limit: 같은 key 로 받을 수 있는 최대 횟수
export const REWARDS = {
  sentence:   { coins: 10, exp: 10, limit: 1 }, // 오늘의 문장 필사 — 하루 1회
  friendPick: { coins: 5,  exp: 5,  limit: 3 }, // 친구 pick 문장 필사 — 하루 3회
  readCheck:  { coins: 5,  exp: 5,  limit: 1 }, // 책 읽기 체크 — 하루 1회
  questBonus: { coins: 20, exp: 0,  limit: 1 }, // 퀘스트 3개 완료 보너스 — 하루 1회
  cert:       { coins: 30, exp: 30, limit: 1 }, // 읽음 인증(교사 승인 후) — 책당 1회
  activity:   { coins: 15, exp: 15, limit: 1 }, // 독서 활동 5가지 — 책마다 활동별 1회
  monthlyBest:{ coins: 50, exp: 0,  limit: 1 }, // 이달의 작품 — 월 1회 (하루 코인 상한 제외)
};
export const DAILY_COIN_CAP = 100;

// ── 집 단계 (개인 EXP 누적) ──────────────────────────────────
export const STAGES = [
  { key: 'plot',   name: '부지',   at: 0 },
  { key: 'pit',    name: '움집',   at: 50 },
  { key: 'thatch', name: '초가집', at: 150 },
  { key: 'tile',   name: '기와집', at: 300 },
];

// ── 마을 건물 (마을 EXP = 반 학생들이 얻은 EXP의 합) ─────────
export const BUILDINGS = [
  { id: 'seodang',  name: '서당',   at: 0,    note: '오늘의 문장' },
  { id: 'museum',   name: '박물관', at: 0,    note: '작품 전시와 투표' },
  { id: 'market',   name: '장터',   at: 300,  note: '외형 상점이 열려요' },
  { id: 'pavilion', name: '정자',   at: 800,  note: '' },
  { id: 'pond',     name: '연못',   at: 1500, note: '' },
  { id: 'seowon',   name: '서원',   at: 3000, note: '' },
];

// ── 외형 상점 (12개) — 이미지 파일 없이 SVG/CSS/이모지로 그린다 ──
// slot: hat 갓·모자 / hair 머리 / outfit 한복 색 / acc 손에 든 것 / prop 집 소품
export const SHOP_ITEMS = [
  { id: 'gat',       name: '갓',        slot: 'hat',    price: 40, emoji: '🎩' },
  { id: 'bokgeon',   name: '복건',      slot: 'hat',    price: 35, emoji: '🧢' },
  { id: 'daenggi',   name: '댕기',      slot: 'hair',   price: 30, emoji: '🎀' },
  { id: 'hb-pink',   name: '분홍 한복', slot: 'outfit', price: 30, emoji: '🌸' },
  { id: 'hb-blue',   name: '파랑 한복', slot: 'outfit', price: 30, emoji: '🔵' },
  { id: 'hb-yellow', name: '노랑 한복', slot: 'outfit', price: 30, emoji: '🟡' },
  { id: 'hb-green',  name: '연두 한복', slot: 'outfit', price: 30, emoji: '🟢' },
  { id: 'fan',       name: '부채',      slot: 'acc',    price: 25, emoji: '🪭' },
  { id: 'jangdok',   name: '장독대',    slot: 'prop',   price: 35, emoji: '🏺' },
  { id: 'lantern',   name: '등불',      slot: 'prop',   price: 20, emoji: '🏮' },
  { id: 'screen',    name: '병풍',      slot: 'prop',   price: 50, emoji: '🎴' },
  { id: 'bonsai',    name: '매화 화분', slot: 'prop',   price: 25, emoji: '🪴' },
];
export const DEFAULT_OUTFIT = 'hb-white'; // 기본 흰 한복 (무료)

export const MARKET_UNLOCK_EXP = 300;
export const SLOT_COUNT = 6;          // 집 안 전시 칸
export const MAX_STUDENTS = 60;       // 한 반 안전 상한 (기준은 20명)
export const DAILY_BOOK_ADDS = 3;     // 학생 한 명이 하루에 추가할 수 있는 책
