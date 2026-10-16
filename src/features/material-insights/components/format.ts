import { t } from '../text';

/** Minutes (or a duration in ms) as words: "< 1 min", "4 min", "1 h 5 min"; "—" when there is nothing. */
export function minutesText(m: number | null): string {
  if (m === null) return t.duration.none;
  const r = Math.round(m);
  if (r < 1) return t.duration.lessThanMin;
  return r < 60 ? t.duration.min(r) : t.duration.hourMin(Math.floor(r / 60), r % 60);
}
export const msText = (ms: number) => minutesText(ms / 60_000);
