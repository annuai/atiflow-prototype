import { afterEach, describe, expect, it } from 'vitest';
import { formatDate, formatNumber, setSiteTimeZone } from '@/i18n';

const AT = Date.UTC(2026, 9, 6, 8, 35); // 6 Oct 2026, 08:35 UTC

describe('dates, times and numbers', () => {
  afterEach(() => setSiteTimeZone(null));
  it('are written the same way everywhere (English, 24-hour, day before month)', () => {
    setSiteTimeZone('UTC');
    expect(formatDate(AT, 'day')).toBe('6 Oct');
    expect(formatDate(AT, 'date')).toBe('6 Oct 2026');
    expect(formatDate(AT, 'time')).toBe('08:35');
    expect(formatDate(AT, 'dateTime')).toBe('6 Oct, 08:35');
    expect(formatDate(AT, 'weekdayDate')).toBe('Tuesday 6 October');
  });
  it('follow the site time zone, not the device', () => {
    setSiteTimeZone('Asia/Kolkata');
    expect(formatDate(AT, 'time')).toBe('14:05');
    setSiteTimeZone('America/New_York');
    expect(formatDate(AT, 'time')).toBe('04:35');
  });
  it('an unknown zone means the device zone instead of an error', () => {
    setSiteTimeZone('Not/AZone');
    expect(() => formatDate(AT, 'time')).not.toThrow();
  });
  it('a calendar day built from the device midnight is not moved to another zone', () => {
    setSiteTimeZone('Pacific/Kiritimati'); // +14 h
    const local = new Date(2026, 9, 6); // midnight on this device
    expect(formatDate(local, 'day', { deviceZone: true })).toBe('6 Oct');
  });
  it('numbers have a fixed number of decimals', () => {
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(formatNumber(7, 0)).toBe('7');
  });
});
