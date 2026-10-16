import { describe, expect, it } from 'vitest';
import { backAtLabel, hoursLabel, isSupportOpen, nextOpenAt } from '../src/features/support/hours';

/** An instant given as India time (UTC+5:30, no daylight saving). */
const ist = (iso: string) => new Date(new Date(`${iso}Z`).getTime() - 330 * 60_000);
// 2026-10-19 is a Monday, 2026-10-24 a Saturday, 2026-10-25 a Sunday

describe('support hours are India time, Monday to Saturday, 9:00 to 19:00', () => {
  it('the boundaries', () => {
    expect(isSupportOpen(ist('2026-10-19T08:59:00'))).toBe(false);
    expect(isSupportOpen(ist('2026-10-19T09:00:00'))).toBe(true);
    expect(isSupportOpen(ist('2026-10-19T18:59:00'))).toBe(true);
    expect(isSupportOpen(ist('2026-10-19T19:00:00'))).toBe(false);
  });
  it('Saturday is open, Sunday is the day off', () => {
    expect(isSupportOpen(ist('2026-10-24T12:00:00'))).toBe(true);
    expect(isSupportOpen(ist('2026-10-25T12:00:00'))).toBe(false);
  });
  it('does not depend on the viewer: the same instant is the same answer', () => {
    const t = ist('2026-10-19T09:00:00');
    expect(t.toISOString()).toBe('2026-10-19T03:30:00.000Z');
    expect(isSupportOpen(t)).toBe(true);
  });
  it('the next opening: tonight to tomorrow morning, Saturday night over the Sunday to Monday', () => {
    expect(nextOpenAt(ist('2026-10-19T19:00:00')).toISOString()).toBe(ist('2026-10-20T09:00:00').toISOString());
    expect(nextOpenAt(ist('2026-10-24T19:30:00')).toISOString()).toBe(ist('2026-10-26T09:00:00').toISOString());
    expect(nextOpenAt(ist('2026-10-19T08:00:00')).toISOString()).toBe(ist('2026-10-19T09:00:00').toISOString());
  });
  it('the label and the viewer-zone time', () => {
    expect(hoursLabel()).toBe('Mon–Sat, 9:00 AM–7:00 PM IST');
    const next = ist('2026-10-20T09:00:00');
    expect(backAtLabel(next, 'en-GB', 'Asia/Kolkata')).toBe('9:00 AM IST');
    expect(backAtLabel(next, 'en-GB', 'Europe/London')).toContain('(');
  });
});
