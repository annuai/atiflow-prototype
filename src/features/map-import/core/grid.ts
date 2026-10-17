import type { GridImage } from './types';

/** Level of a cell -> transparency: below `minLevel` nothing, from there a clear grey that gets darker with confidence up to `maxLevel` (solid). */
export function levelsToAlpha(levels: ArrayLike<number>, minLevel: number, maxLevel: number): Uint8Array {
  const out = new Uint8Array(levels.length);
  const span = Math.max(1, maxLevel - minLevel);
  for (let i = 0; i < levels.length; i++) {
    const l = levels[i];
    if (l >= minLevel) out[i] = Math.min(255, Math.round(90 + (165 * (l - minLevel)) / span));
  }
  return out;
}

/** The smallest box (inclusive) around every cell that is not 0, or null when the picture is empty. */
export function contentBox(alpha: Uint8Array, w: number, h: number) {
  let x0 = w,
    x1 = -1,
    y0 = h,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0, o = y * w; x < w; x++)
      if (alpha[o + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

/** Cut out a box (with `margin` empty cells around it, kept inside the picture). The origin moves with it. */
export function crop(g: GridImage, box: { x0: number; x1: number; y0: number; y1: number }, margin = 0): GridImage {
  const x0 = Math.max(0, box.x0 - margin),
    y0 = Math.max(0, box.y0 - margin),
    x1 = Math.min(g.width - 1, box.x1 + margin),
    y1 = Math.min(g.height - 1, box.y1 + margin);
  const width = x1 - x0 + 1,
    height = y1 - y0 + 1;
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    alpha.set(g.alpha.subarray((y0 + y) * g.width + x0, (y0 + y) * g.width + x0 + width), y * width);
  return { ...g, width, height, originCol: g.originCol - x0, originRow: g.originRow - y0, alpha };
}

/**
 * Noise clean-up: removes every connected piece (8 neighbours) of fewer than `minCells` cells. Lidar maps are full of single-cell speckle and short smudges; walls, pillars and machines are
 * big connected pieces and stay. Returns how many cells were removed. Changes `alpha` in place.
 */
export function removeSpecks(alpha: Uint8Array, w: number, h: number, minCells: number): number {
  const seen = new Uint8Array(alpha.length);
  const stack = new Int32Array(alpha.length); // no piece can be longer than the picture
  let removed = 0;
  for (let start = 0; start < alpha.length; start++) {
    if (!alpha[start] || seen[start]) continue;
    let sp = 0,
      n = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp) {
      const i = stack[--sp];
      n++;
      const x = i % w,
        y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (alpha[j] && !seen[j]) {
            seen[j] = 1;
            stack[sp++] = j;
          }
        }
      }
    }
    if (n < minCells) {
      // a second pass over the same piece to erase it (cheap: pieces this small are tiny)
      sp = 0;
      stack[sp++] = start;
      alpha[start] = 0;
      while (sp) {
        const i = stack[--sp];
        const x = i % w,
          y = (i - x) / w;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (alpha[j]) {
              alpha[j] = 0;
              stack[sp++] = j;
            }
          }
      }
      removed += n;
    }
  }
  return removed;
}

/** Half the size: each new cell is the darkest of its 2 x 2 cells, so thin walls survive zooming out. */
export function halve(g: GridImage): GridImage {
  const width = Math.max(1, Math.ceil(g.width / 2)),
    height = Math.max(1, Math.ceil(g.height / 2));
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) {
      const v = g.alpha[y * g.width + x],
        o = (y >> 1) * width + (x >> 1);
      if (v > alpha[o]) alpha[o] = v;
    }
  return {
    res: g.res * 2,
    width,
    height,
    originCol: g.originCol / 2,
    originRow: g.originRow / 2,
    alpha,
  };
}

/** The picture and smaller copies of it for zooming out, until the longest side is `minSide` or less (at most `max` levels). */
export function pyramid(g: GridImage, minSide = 512, max = 4): GridImage[] {
  const out = [g];
  while (out.length < max && Math.max(out[out.length - 1].width, out[out.length - 1].height) > minSide)
    out.push(halve(out[out.length - 1]));
  return out;
}

/** Where the picture lies in metres: top-left corner and size. */
export function worldRect(g: GridImage) {
  return {
    minX: -g.originCol * g.res,
    maxY: g.originRow * g.res,
    maxX: (g.width - g.originCol) * g.res,
    minY: (g.originRow - g.height) * g.res,
  };
}
