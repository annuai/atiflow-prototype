const WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  first: '1',
  second: '2',
  third: '3',
};
/** Lower case, number words as digits, "line"/"bay"/"station" written short ("l3", "b2"), and no spaces or punctuation: "Line three" -> "l3", "L3" -> "l3". */
export function squash(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join(' ')
    .replace(/\b(line|bay|station|stn|area)\b/g, (m) =>
      m === 'line' ? 'l' : m === 'bay' ? 'b' : m === 'area' ? 'a' : 's',
    );
  return t.replace(/ /g, '');
}
export interface Named {
  id: string;
  name: string;
}
/** How well a typed place matches a station (0 = not at all): exact id or name beats a name that contains it, which beats a partial overlap. Pure. */
function stationScore(query: string, s: Named): number {
  const q = squash(query);
  if (!q) return 0;
  const id = squash(s.id);
  const digits = id.replace(/\D/g, '');
  const name = squash(s.name);
  if (q === id || (digits && q === digits)) return 100;
  if (q === name) return 95;
  if (name.endsWith(q) && /\d$/.test(q)) return 80; // "ws1" for "assemblyworkstation1"
  if (name.includes(q) && q.length >= 3) return 70;
  if (q.includes(name) && name.length >= 3) return 60;
  return 0;
}
/** The stations a typed place may mean, best first (only the best ones when one is clearly ahead). */
export function matchStations(query: string, stations: Named[]): Named[] {
  const scored = stations
    .map((s) => ({ s, score: stationScore(query, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter((x) => x.score >= top - 10).map((x) => x.s);
}
/** Finds a station named anywhere in a sentence ("send a cart to line three"): tries the words after "to" / "from" first, then every run of up to 3 words. */
export function findInSentence(text: string, stations: Named[], after?: RegExp): Named[] {
  if (after) {
    const m = text.match(after);
    if (m) {
      const hit = matchStations(m[1].trim(), stations);
      if (hit.length) return hit;
    }
  }
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (let n = 3; n >= 1; n--)
    for (let i = 0; i + n <= words.length; i++) {
      const hit = matchStations(words.slice(i, i + n).join(' '), stations);
      if (hit.length) return hit;
    }
  return [];
}
