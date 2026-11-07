import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookAreas, bookMemories, spriteGeometry } from '../public/js/student/village-layout.js';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/village/v02/assets.json', import.meta.url)));

test('빈 서재에도 정원을 보여주며, 책이 늘면 세 권 단위로 빠짐없이 나눈다', () => {
  assert.deepEqual(bookAreas([]), [[]]);
  const books = Array.from({ length: 31 }, (_, i) => ({ id: `book-${i}` }));
  const areas = bookAreas(books);
  assert.equal(areas.length, 11);
  assert.deepEqual(areas.flat(), books);
  assert.ok(areas.every((area) => area.length <= 3));
});

test('실제 에셋 17개를 맵 안에 배치하고 권장 크기와 깊이를 유지한다', () => {
  for (const place of manifest.placements) {
    const sprite = manifest.sprites.find((s) => s.id === place.sprite);
    const box = spriteGeometry(sprite, place, manifest.map);
    assert.ok(Object.values(box).every(Number.isFinite));
    assert.ok(box.left >= 0 && box.top >= 0);
    assert.ok(box.left + box.width <= 100.00001);
    assert.ok(box.top + box.height <= 100.00001);
    assert.ok(Math.abs(box.width * manifest.map.width / 100 - (place.visibleWidth ?? sprite.suggestedVisibleWidth)) < .001);
    assert.equal(box.depth, Math.round(place.y));
  }
});

test('서로 다른 종횡비의 벤치와 집을 늘이지 않고 표시한다', () => {
  for (const id of ['reading-bench', 'book-house-sage']) {
    const sprite = manifest.sprites.find((s) => s.id === id);
    const g = spriteGeometry(sprite, { x: 700, y: 600, visibleWidth: 180 }, manifest.map);
    const imageWidth = g.width * manifest.map.width * g.imageWidth;
    const imageHeight = g.height * manifest.map.height * g.imageHeight;
    assert.ok(Math.abs(imageWidth / imageHeight - sprite.sourceSize[0] / sprite.sourceSize[1]) < .00001);
  }
});

test('대표 문장은 해당 책에서만 선택하며 다른 책의 기록을 섞지 않는다', () => {
  const library = {
    sentences: [{ id: 's1', bookId: 'b1' }, { id: 's2', bookId: 'b2' }, { id: 's3', bookId: 'b1' }],
    pick: { id: 's2' }, works: [{ bookId: 'b2' }], questions: [{ bookId: 'b1' }],
  };
  const memories = bookMemories({ id: 'b1' }, library);
  assert.equal(memories.sentence.id, 's3');
  assert.equal(memories.sentences.length, 2);
  assert.equal(memories.works.length, 0);
  assert.equal(memories.questions.length, 1);
  library.pick = { id: 's1' };
  assert.equal(bookMemories({ id: 'b1' }, library).sentence.id, 's1');
  assert.equal(bookMemories({ id: 'empty' }, library).sentence, null);
});
