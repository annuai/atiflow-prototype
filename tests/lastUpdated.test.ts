import { describe, expect, it } from 'vitest';
import { lastUpdated } from '../src/utils/timeAgo';

describe('last updated', () => {
  const now = new Date('2026-10-15T12:00:00Z').getTime(),
    ago = (ms: number) => lastUpdated(now - ms, now),
    MIN = 60_000,
    H = 60 * MIN,
    DAY = 24 * H;
  it('says just now, minutes, hours and days, then the date', () => {
    expect(ago(20_000)).toBe('Just now');
    expect(ago(12 * MIN)).toBe('12 min ago');
    expect(ago(62 * MIN)).toBe('1 hour ago');
    expect(ago(5 * H)).toBe('5 hours ago');
    expect(ago(1 * DAY + H)).toBe('1 day ago');
    expect(ago(3 * DAY)).toBe('3 days ago');
    expect(ago(9 * DAY)).toBe('6 Oct 2026');
    expect(ago(-5000)).toBe('Just now'); // a clock a little ahead is still "just now"
  });
});
