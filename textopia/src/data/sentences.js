// 기본 '오늘의 문장' 목록.
// 규칙: ① 저작권이 끝난 작가의 원문(윤동주·김소월·한용운 등)만 그대로 쓴다.
//       ② 고전(논어·명심보감·사자소학)은 번역본을 옮기지 않고 쉬운 우리말로 새로 풀어 쓴 문장만 쓴다.
// kind: 'original' 원문 / 'paraphrase' 풀어 쓴 문장.  book: 예시 데이터에서 연결할 책 id(catalog.js 기준)
export const DEFAULT_SENTENCES = [
  { id: 'sn01', kind: 'original', source: '윤동주, 〈서시〉', book: 'b11',
    text: '죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를,' },
  { id: 'sn02', kind: 'original', source: '윤동주, 〈서시〉', book: 'b11',
    text: '잎새에 이는 바람에도 나는 괴로워했다.' },
  { id: 'sn03', kind: 'original', source: '윤동주, 〈서시〉', book: 'b11',
    text: '나한테 주어진 길을 걸어가야겠다.' },
  { id: 'sn04', kind: 'original', source: '윤동주, 〈별 헤는 밤〉', book: 'b11',
    text: '별 하나에 추억과 별 하나에 사랑과 별 하나에 쓸쓸함과' },
  { id: 'sn05', kind: 'original', source: '윤동주, 〈새로운 길〉', book: 'b11',
    text: '어제도 가고 오늘도 갈 나의 길 새로운 길' },
  { id: 'sn06', kind: 'original', source: '김소월, 〈엄마야 누나야〉', book: 'b12',
    text: '엄마야 누나야 강변 살자' },
  { id: 'sn07', kind: 'original', source: '김소월, 〈산유화〉', book: 'b12',
    text: '산에는 꽃 피네 꽃이 피네 갈 봄 여름 없이 꽃이 피네' },
  { id: 'sn08', kind: 'original', source: '한용운, 〈님의 침묵〉', book: 'b13',
    text: '님은 갔습니다. 아아, 사랑하는 나의 님은 갔습니다.' },
  { id: 'sn09', kind: 'original', source: '한용운, 〈님의 침묵〉', book: 'b13',
    text: '그러나 나는 님을 보내지 아니하였습니다.' },
  { id: 'sn10', kind: 'paraphrase', source: '《논어》를 쉬운 우리말로 풀어 씀', book: 'b21',
    text: '배운 것을 틈틈이 다시 익히면 마음이 참 기쁘다.' },
  { id: 'sn11', kind: 'paraphrase', source: '《논어》를 쉬운 우리말로 풀어 씀', book: 'b21',
    text: '여럿이 함께 걷다 보면 누구에게서든 배울 점을 찾을 수 있다.' },
  { id: 'sn12', kind: 'paraphrase', source: '《논어》를 쉬운 우리말로 풀어 씀', book: 'b21',
    text: '내가 싫은 일은 남에게도 시키지 않는다.' },
  { id: 'sn13', kind: 'paraphrase', source: '《논어》를 쉬운 우리말로 풀어 씀', book: 'b21',
    text: '아는 것은 안다고, 모르는 것은 모른다고 말하는 것이 참된 앎이다.' },
  { id: 'sn14', kind: 'paraphrase', source: '《논어》를 쉬운 우리말로 풀어 씀', book: 'b21',
    text: '지난 것을 되새기며 공부하면 새로운 것도 깨닫게 된다.' },
  { id: 'sn15', kind: 'paraphrase', source: '《명심보감》을 쉬운 우리말로 풀어 씀', book: 'b15',
    text: '착한 마음을 하루라도 놓으면 나쁜 마음이 슬그머니 고개를 든다.' },
  { id: 'sn16', kind: 'paraphrase', source: '《명심보감》을 쉬운 우리말로 풀어 씀', book: 'b15',
    text: '착한 일을 하는 사람에게는 하늘이 복으로 갚아 준다.' },
  { id: 'sn17', kind: 'paraphrase', source: '《사자소학》을 쉬운 우리말로 풀어 씀', book: 'b16',
    text: '부모님은 나를 낳아 주시고 길러 주셨으니 그 은혜를 잊지 말자.' },
];

// 예시 데이터의 '오늘의 문장 7일치' 순서
export const WEEK_ORDER = ['sn01', 'sn10', 'sn08', 'sn12', 'sn06', 'sn15', 'sn02'];
