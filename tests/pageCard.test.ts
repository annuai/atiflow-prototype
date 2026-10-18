import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|css)$/.test(p) ? [p] : [];
  });

/** The page card is the PageCard component. A page that draws its own (the old `builder` / `md-card` / `dv-card` classes) would drift in radius or height again. */
describe('page cards', () => {
  const files = walk('src');
  it('no page draws its own card with the old class names', () => {
    const offenders = files.filter((f) =>
      /className="[^"]*\b(builder|md-card|dv-card)\b/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
  it('the old card CSS is gone', () => {
    const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8'));
    expect(css.filter((c) => /^\.(builder|md-card|dv-card)\b/m.test(c))).toEqual([]);
  });
});
