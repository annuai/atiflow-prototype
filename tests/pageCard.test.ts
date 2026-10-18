import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|css)$/.test(p) ? [p] : [];
  });

/** The page frame is `Page`, its title row `PageHeader`, the card `PageCard` with `PageCardBody` / `PageCardBar` / `PageCardHeader`. A page that draws its own (the old `builder` / `md-card` / `dv-card` classes) would drift in radius or height again. */
describe('page cards', () => {
  const files = walk('src');
  it('no page draws its own frame, title row, card, card body or card header with the old class names', () => {
    const offenders = files.filter((f) =>
      /className="([^"]*\s)?(builder|md-card|dv-card|content|title-block|actions|md-body|md-bar|bh|dv-detail)(\s[^"]*)?"/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
  it('the old card CSS is gone', () => {
    const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8'));
    expect(
      css.filter((c) => /^\.(builder|md-card|dv-card|content|title-block|actions|md-body|md-bar|bh)\b/m.test(c)),
    ).toEqual([]);
  });
});

/** The sidebar's styles live in `shell/sidebar/sidebar.css` only; its state is `data-*` attributes, not extra classes. */
describe('sidebar', () => {
  const files = walk('src');
  it('only sidebar.css styles the sidebar', () => {
    const offenders = files
      .filter((f) => f.endsWith('.css') && !f.endsWith('shell/sidebar/sidebar.css'))
      .filter((f) => /(^|[\s,}])\.(sidebar|sb-[a-z-]+|scrim)\b/m.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no component sets the old state classes', () => {
    const offenders = files.filter((f) =>
      /className=[^\n]*'sidebar'|sidebar open|sidebar collapsed|sb-item active/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
