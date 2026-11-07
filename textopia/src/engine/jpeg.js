// JPEG 머리말을 읽어 가로·세로를 알아낸다 (그림을 해석하지는 않는다). 서버가 '긴 변 1024px 이하, JPEG'를 확인하는 데 쓴다.
export const MAX_IMAGE_BYTES = 1024 * 1024; // 한 장 1MB 이하
export const MAX_LONG_SIDE = 1024;          // 긴 변 1024px 이하

const SOF = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

/** 반환: { w, h } 또는 JPEG 가 아니면 null */
export function jpegSize(b) {
  if (!(b instanceof Uint8Array) || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xFF) return null;
    let marker = b[i + 1];
    if (marker === 0xFF) { i++; continue; }                    // 채우기 바이트
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) { i += 2; continue; } // 길이가 없는 표식
    if (marker === 0xD9 || marker === 0xDA) return null;      // 크기 정보 없이 끝남
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    if (SOF.has(marker)) {
      if (i + 8 >= b.length) return null;
      const h = (b[i + 5] << 8) | b[i + 6];
      const w = (b[i + 7] << 8) | b[i + 8];
      return w > 0 && h > 0 ? { w, h } : null;
    }
    i += 2 + len;
  }
  return null;
}
