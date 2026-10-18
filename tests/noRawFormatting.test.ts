import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Dates, times and numbers are written by `formatDate` / `formatNumber` (i18n/format.ts) so every page shows them the same way and in the site's time zone. */
describe('formatting', () => {
  const ALLOWED = [
    'src/i18n/format.ts',
    'src/i18n/locales', // translated text may mention the call
    'src/features/ati-ai/data/mockData.ts', // fixed English, UTC mock data for the assistant's canned replies
    'src/features/support/hours.ts', // the support team's hours are always in India time, by design
    'src/fixtures/settings.ts', // asks the browser for its zone to start the site setting with
    'src/utils/timeAgo.ts', // relative words in English ("2 min ago")
  ];
  it('no screen formats dates or numbers by itself', () => {
    const offenders = walk('src')
      .filter((f) => !ALLOWED.some((a) => f.startsWith(a)))
      .filter((f) => /\.toLocale(Date|Time)?String\(|new Intl\.DateTimeFormat\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
