// PNG의 투명 여백을 제외한 크기로 배치하고, 책집은 한 구역에 세 채씩 둔다.
export const BOOKS_PER_AREA = 3;
export const HOUSE_COLORS = ['book-house-terracotta', 'book-house-sage', 'book-house-blue'];

export function bookAreas(books) {
  const areas = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_AREA) areas.push(books.slice(i, i + BOOKS_PER_AREA));
  return areas.length ? areas : [[]];
}

export function spriteGeometry(sprite, placement, map) {
  const [left, top, right, bottom] = sprite.alphaBounds;
  const scale = (placement.visibleWidth ?? sprite.suggestedVisibleWidth) / (right - left);
  const width = (right - left) * scale;
  const height = (bottom - top) * scale;
  const x = placement.x - sprite.anchorNormalized[0] * sprite.sourceSize[0] * scale + left * scale;
  const y = placement.y - sprite.anchorNormalized[1] * sprite.sourceSize[1] * scale + top * scale;
  return {
    left: Math.max(0, Math.min(map.width - width, x)) / map.width * 100,
    top: Math.max(0, Math.min(map.height - height, y)) / map.height * 100,
    width: width / map.width * 100,
    height: height / map.height * 100,
    imageWidth: sprite.sourceSize[0] / (right - left) * 100,
    imageHeight: sprite.sourceSize[1] / (bottom - top) * 100,
    imageLeft: -left / (right - left) * 100,
    imageTop: -top / (bottom - top) * 100,
    depth: Math.round(placement.y),
  };
}

export function bookMemories(book, library) {
  const sentences = library.sentences.filter((s) => s.bookId === book.id);
  const picked = sentences.find((s) => s.id === library.pick?.id);
  return {
    sentence: picked || sentences.at(-1) || null,
    sentences,
    works: library.works.filter((w) => w.bookId === book.id),
    questions: library.questions.filter((q) => q.bookId === book.id),
  };
}
