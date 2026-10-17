import { zlibSync } from 'fflate';

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  out.set(u32(crc32(out.subarray(4, 8 + data.length))), 8 + data.length);
  return out;
}

/**
 * A PNG of one colour with a transparency byte per cell (8-bit grey + alpha, no filtering). Written by hand so it also runs in a worker and in tests with no canvas; a floor plan that is
 * mostly transparent compresses to a few percent of its raw size.
 */
export function encodeMaskPng(alpha: Uint8Array, width: number, height: number, grey = 28): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 2));
  for (let y = 0; y < height; y++) {
    const o = y * (1 + width * 2);
    for (let x = 0; x < width; x++) {
      raw[o + 1 + x * 2] = grey;
      raw[o + 2 + x * 2] = alpha[y * width + x];
    }
  }
  const ihdr = new Uint8Array([...u32(width), ...u32(height), 8, 4, 0, 0, 0]);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
