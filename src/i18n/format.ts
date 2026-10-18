import { LANGUAGES } from './languages';
import { getLocale } from './store';

/**
 * THE place dates, times and numbers are turned into text. They follow the language in use (`LANGUAGES[..].intl`, Western digits in every language) and, for dates and times, the SITE's
 * time zone (Settings > General): nobody sees a different time because of their device. A screen never calls `toLocaleString` itself, or one page would show "6 Oct" and the next "Oct 6".
 */
export type DateStyle = 'day' | 'date' | 'dateTime' | 'full' | 'time' | 'weekdayDate';
const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  /** 6 Oct */
  day: { day: 'numeric', month: 'short' },
  /** 6 Oct 2026 */
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  /** 6 Oct, 14:05 */
  dateTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  /** 6 Oct 2026, 14:05 (for a tooltip: the whole moment) */
  full: { dateStyle: 'medium', timeStyle: 'short' },
  /** 14:05 */
  time: { hour: '2-digit', minute: '2-digit' },
  /** Tuesday 6 October */
  weekdayDate: { weekday: 'long', day: 'numeric', month: 'long' },
};

let siteTimeZone: string | undefined;
/** The site's time zone (an IANA name such as "Asia/Kolkata"); anything else (empty, unknown) means the device's own. Set from Settings by `LocaleSync`. */
export function setSiteTimeZone(zone: string | null | undefined) {
  siteTimeZone = zone && isZone(zone) ? zone : undefined;
}
const isZone = (z: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

const tag = () => `${LANGUAGES.find((l) => l.id === getLocale())?.intl ?? 'en-GB'}-u-nu-latn`;
const cache = new Map<string, Intl.DateTimeFormat>();
/**
 * "6 Oct 2026" / "14:05" / ... in the language and time zone in use. `deviceZone` is for a calendar day built from the device's own midnight (report ranges, chart days): converting
 * those to another zone would move them to the wrong day.
 */
export function formatDate(at: number | Date, style: DateStyle, opts: { deviceZone?: boolean } = {}): string {
  const zone = opts.deviceZone ? undefined : siteTimeZone;
  const key = `${tag()}|${zone ?? ''}|${style}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(tag(), { ...STYLES[style], timeZone: zone });
    cache.set(key, f);
  }
  return f.format(at);
}

/** A number with a fixed count of decimals ("1,234.5" / "1.234,5" by language). */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(tag(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
