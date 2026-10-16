/**
 * When support is reachable. ONE team in Bengaluru, so every rule runs on Asia/Kolkata time (never the device's clock zone): a customer abroad still sees the right answer.
 * India has no daylight saving, so IST is a fixed UTC+5:30.
 */
export const SUPPORT_TZ = 'Asia/Kolkata';
/** Days support works (0 = Sunday ... 6 = Saturday). ASSUMPTION: Monday to Saturday; add 0 here if Sunday needs cover. */
export const SUPPORT_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6];
export const OPEN_MINUTE = 9 * 60;
export const CLOSE_MINUTE = 19 * 60;
/** The support phone number. */
export const SUPPORT_PHONE = '+91 9645738621';
export const SUPPORT_PHONE_HREF = 'tel:+919645738621';
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clock = (minute: number) => {
  const h = Math.floor(minute / 60);
  return `${h % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
/** "9:00 AM", "7:00 PM" (IST). */
export const OPEN_LABEL = clock(OPEN_MINUTE);
export const CLOSE_LABEL = clock(CLOSE_MINUTE);
/** "Mon-Sat, 9:00 AM-7:00 PM IST", built from the constants above. */
export function hoursLabel(): string {
  const first = SUPPORT_DAYS[0];
  const last = SUPPORT_DAYS[SUPPORT_DAYS.length - 1];
  const contiguous = SUPPORT_DAYS.every((d, i) => d === first + i);
  const days = contiguous ? `${NAMES[first]}–${NAMES[last]}` : SUPPORT_DAYS.map((d) => NAMES[d]).join(', ');
  return `${days}, ${OPEN_LABEL}–${CLOSE_LABEL} IST`;
}
/** Day of week and minute of the day in India for an instant. */
export function istParts(now: Date): { dow: number; minute: number } {
  const t = new Date(now.getTime() + IST_OFFSET_MS);
  return { dow: t.getUTCDay(), minute: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
/** Open from 9:00 up to (not including) 19:00 on a working day. */
export function isSupportOpen(now: Date): boolean {
  const { dow, minute } = istParts(now);
  return SUPPORT_DAYS.includes(dow) && minute >= OPEN_MINUTE && minute < CLOSE_MINUTE;
}
/** The next moment support opens, strictly after `now` (an instant: show it in any zone). */
export function nextOpenAt(now: Date): Date {
  const t = now.getTime() + IST_OFFSET_MS;
  const dayStart = Math.floor(t / DAY_MS) * DAY_MS;
  for (let i = 0; i <= 8; i++) {
    const start = dayStart + i * DAY_MS + OPEN_MINUTE * 60_000;
    if (SUPPORT_DAYS.includes(new Date(start).getUTCDay()) && start > t) return new Date(start - IST_OFFSET_MS);
  }
  return new Date(now.getTime() + DAY_MS); // unreachable while SUPPORT_DAYS is not empty
}
/** "back Mon 9:00 AM IST" plus the same moment in the viewer's zone when that zone is not India. */
export function backAtLabel(next: Date, locale = 'en-GB', zone?: string): string {
  const here = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
  }).format(next);
  const inIndia = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SUPPORT_TZ,
  }).format(next);
  return here === inIndia ? `${OPEN_LABEL} IST` : `${OPEN_LABEL} IST (${here})`;
}
