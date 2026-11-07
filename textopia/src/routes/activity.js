// 독서 활동(책 단위): 문장 모으기 · 질문 만들기 · 책갈피 만들기 (그림 독서록 · 책 표지는 9단계)
// 보상은 책마다 활동별로 한 번(코인 15 · EXP 15). 같은 활동을 더 해도 작품은 쌓이지만 보상은 없다.
import { fail, text, int, newId } from '../util.js';
import { REWARDS } from '../data/rules.js';
import { grant, mergeEvents, actorStudent } from '../engine/core.js';
import { findBook } from '../engine/books.js';
import { studentView } from '../engine/views.js';
import { shelfView } from '../engine/shelf.js';
import { libraryView, sentenceView, questionView, workView } from '../engine/library.js';

export const TEMPLATE_IDS = ['t1', 't2', 't3'];
const MAX_ITEMS = 100; // 학생 한 명이 종류별로 만들 수 있는 최대 개수 (저장 공간 보호)

const KINDS = { sentence: 'sentences', question: 'questions', work: 'works' };

export const activityRoutes = {
  'activity/submit': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const book = findBook(c, c.body.bookId);
    if (!book || !st.shelf.includes(book.id)) fail(409, 'not_registered', '먼저 내 책으로 등록해 주세요.');
    const type = c.body.type;
    const at = c.nowMs;
    let item;
    let view;

    if (type === 'sentence') {
      if (st.sentences.length >= MAX_ITEMS) fail(409, 'too_many', '모은 문장이 너무 많아요. 안 쓰는 문장을 지워 주세요.');
      item = {
        id: newId('s-'), bookId: book.id, at,
        text: text(c.body.text, { name: '책 속 문장', min: 2, max: 200 }),
        page: int(c.body.page, { name: '쪽수', min: 1, max: 9999 }),
        reason: text(c.body.reason, { name: '고른 이유', min: 2, max: 100 }),
      };
      st.sentences.push(item);
      view = sentenceView(c, item);
    } else if (type === 'question') {
      if (st.questions.length >= MAX_ITEMS) fail(409, 'too_many', '만든 질문이 너무 많아요. 안 쓰는 질문을 지워 주세요.');
      item = { id: newId('q-'), bookId: book.id, at, text: text(c.body.text, { name: '질문', min: 2, max: 150 }) };
      st.questions.push(item);
      view = questionView(c, item);
    } else if (type === 'bookmark') {
      if (st.works.length >= MAX_ITEMS) fail(409, 'too_many', '만든 작품이 너무 많아요. 안 쓰는 작품을 지워 주세요.');
      const s = st.sentences.find((x) => x.id === c.body.sentenceId);
      if (!s) fail(404, 'no_item', '내가 모은 문장을 골라 주세요.');
      if (s.bookId !== book.id) fail(400, 'wrong_book', '이 책에서 모은 문장으로 만들어요.');
      if (!TEMPLATE_IDS.includes(c.body.template)) fail(400, 'bad_input', '테두리를 골라 주세요.');
      item = { id: newId('w-'), type: 'bookmark', bookId: book.id, sentenceId: s.id, text: s.text, template: c.body.template, at };
      st.works.push(item);
      view = workView(c, item);
    } else if (type === 'drawing' || type === 'cover') {
      // 사진은 먼저 img/upload 로 올리고, 여기서 작품에 붙인다 (내가 올린, 아직 안 쓴 사진만)
      if (st.works.length >= MAX_ITEMS) fail(409, 'too_many', '만든 작품이 너무 많아요. 안 쓰는 작품을 지워 주세요.');
      const img = c.state.images[c.body.imgId];
      if (!img || img.sid !== st.id) fail(404, 'no_image', '내가 올린 사진을 찾을 수 없어요.');
      if (img.used) fail(409, 'image_used', '이미 작품에 붙인 사진이에요. 새 사진을 올려 주세요.');
      item = type === 'drawing'
        ? { id: newId('w-'), type, bookId: book.id, imgId: c.body.imgId, caption: text(c.body.caption, { name: '한 줄 설명', min: 1, max: 100 }), at }
        : { id: newId('w-'), type, bookId: book.id, imgId: c.body.imgId, title: text(c.body.title, { name: '표지 제목', min: 1, max: 40 }), at };
      img.used = true;
      st.works.push(item);
      view = workView(c, item);
    } else {
      return fail(400, 'bad_type', '할 수 없는 활동이에요.');
    }

    const ev = grant(c.state, st, c, { key: `act:${book.id}:${type}`, rule: REWARDS.activity, note: `독서 활동(${type})` });
    return { item: view, reward: mergeEvents([ev]), rewarded: ev.granted, shelf: shelfView(c, st), me: studentView(c, st) };
  } },

  // 내 것 고치기 (자기 것만): 문장 · 질문 · 책갈피 테두리
  'item/edit': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const { kind, id } = c.body;
    const list = st[KINDS[kind]];
    const it = list?.find((x) => x.id === id);
    if (!it) fail(404, 'no_item', '내 것만 고칠 수 있어요.');
    if (kind === 'sentence') {
      it.text = text(c.body.text, { name: '책 속 문장', min: 2, max: 200 });
      it.page = int(c.body.page, { name: '쪽수', min: 1, max: 9999 });
      it.reason = text(c.body.reason, { name: '고른 이유', min: 2, max: 100 });
    } else if (kind === 'question') {
      it.text = text(c.body.text, { name: '질문', min: 2, max: 150 });
    } else if (it.type === 'bookmark') {
      if (!TEMPLATE_IDS.includes(c.body.template)) fail(400, 'bad_input', '테두리를 골라 주세요.');
      it.template = c.body.template;
    } else if (it.type === 'drawing') {
      it.caption = text(c.body.caption, { name: '한 줄 설명', min: 1, max: 100 });
    } else if (it.type === 'cover') {
      it.title = text(c.body.title, { name: '표지 제목', min: 1, max: 40 });
    }
    return { library: libraryView(c, st), me: studentView(c, st) };
  } },

  // 내 것 지우기 (자기 것만). 이미 받은 보상은 그대로이고, 같은 활동으로 보상을 다시 받을 수는 없다.
  'item/delete': { auth: 'student', write: true, run: async (c) => {
    const st = actorStudent(c);
    const { kind, id } = c.body;
    const key = KINDS[kind];
    const i = key ? st[key].findIndex((x) => x.id === id) : -1;
    if (i < 0) fail(404, 'no_item', '내 것만 지울 수 있어요.');
    st[key].splice(i, 1);
    st.slots = st.slots.map((s) => (s && s.kind === kind && s.id === id ? null : s));
    if (kind === 'sentence' && st.pickId === id) st.pickId = null;
    return { library: libraryView(c, st), me: studentView(c, st) };
  } },
};
