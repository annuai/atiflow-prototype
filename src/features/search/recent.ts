import { services } from '@/services';

const MAX = 8;
const key = (user: string) => `search:recent:${user}`;
/** Recent searches of one person (this device). */
export function recentSearches(user: string): string[] {
  try {
    return JSON.parse(services().device.get(key(user)) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function rememberSearch(user: string, q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  const next = [t, ...recentSearches(user).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
  services().device.set(key(user), JSON.stringify(next));
}
export const forgetSearches = (user: string) => services().device.set(key(user), '[]');
