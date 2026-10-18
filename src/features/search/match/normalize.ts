/** Matching helpers shared by the index and the query: one normalisation and ONE alias map, so "L3", "line 3" and "line three" are the same words. */
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
};
/** Words that mean the same (the first is what they all become). Add a synonym here and nowhere else. */
const ALIASES: string[][] = [
  ['robot', 'amr', 'bot', 'sherpa'],
  ['trip', 'trp', 'journey'],
  ['line', 'l', 'bay'],
  ['workflow', 'wf', 'flow'],
  ['station', 'stn', 'sta'],
  ['workstation', 'ws'],
  ['charger', 'charging', 'dock', 'charge'],
  ['material', 'mat', 'part'],
  ['zone', 'area'],
  ['setting', 'settings', 'preferences', 'config', 'configuration'],
];
const CANON = new Map<string, string>();
for (const g of ALIASES) for (const w of g) CANON.set(w, g[0]);

/** Lower case, no accents, plain spaces. */
export const normalize = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Words of a text: split on spaces and punctuation and between letters and digits ("L3" -> l, 3; "AMR-007" -> amr, 007). Indic scripts stay whole words. */
export const tokenize = (s: string): string[] =>
  normalize(s)
    .split(/[^\p{L}\p{N}]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/u)
    .filter(Boolean);
/** One word as it is indexed and searched: number words as digits, no leading zeros, synonyms as their first word. */
export function processTerm(term: string): string {
  const t = WORDS[term] ?? term;
  const n = /^\d+$/.test(t) ? String(Number(t)) : t;
  return CANON.get(n) ?? n;
}
/** The words of a query as they are matched. */
export const queryTerms = (q: string): string[] => tokenize(q).map(processTerm);
