import MiniSearch from 'minisearch';
import { canonicalId, sameId } from './match/ids';
import { normalize, processTerm, queryTerms, tokenize } from './match/normalize';
import { searchRegistry } from './registry';
import type {
  EntityType,
  SearchContext,
  SearchEntity,
  SearchGroup,
  SearchQuery,
  SearchResult,
  SearchResultPage,
} from './types';

const DAY = 86_400_000;
const GROUP_LIMIT = 5;
interface Index {
  rows: unknown[];
  ms: MiniSearch;
}
const indexes = new Map<string, Index>();
/** One search index per entity; rebuilt only when the rows are a different list (live lists are small, stores keep theirs stable). */
function indexOf(e: SearchEntity<unknown>, rows: unknown[], scope: string): MiniSearch {
  const key = `${e.type}|${scope}`;
  const have = indexes.get(key);
  if (have && have.rows === rows) return have.ms;
  const ms = new MiniSearch({
    idField: 'i',
    fields: e.fields.map((_, n) => `f${n}`),
    tokenize,
    processTerm,
  });
  ms.addAll(rows.map((r, i) => ({ i, ...Object.fromEntries(e.fields.map((f, n) => [`f${n}`, f.get(r)])) })));
  indexes.set(key, { rows, ms });
  return ms;
}

/** Where the typed words occur in a text (for highlighting): character ranges, merged. */
export function highlight(text: string, q: string): [number, number][] {
  const hay = normalize(text);
  const out: [number, number][] = [];
  for (const w of tokenize(q)) {
    let at = hay.indexOf(w);
    while (at >= 0 && w.length) {
      out.push([at, at + w.length]);
      at = hay.indexOf(w, at + w.length);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Does the title begin with these words (after synonyms and number words are applied to both)? */
const startsWithTerms = (title: string, terms: string[]) => {
  const t = tokenize(title).map(processTerm);
  return terms.every((w, i) => t[i] !== undefined && t[i].startsWith(w));
};
const fuzzy = (t: string) => (t.length > 6 ? 2 : t.length > 3 ? 1 : 0);
function toResult(e: SearchEntity<unknown>, row: unknown, ctx: SearchContext, score: number, q: string): SearchResult {
  const r = e.toResult(row, ctx);
  return {
    id: e.id(row),
    type: e.type,
    ...r,
    metadata: r.metadata,
    highlights: [
      { field: 'title', ranges: highlight(r.title, q) },
      ...(r.subtitle ? [{ field: 'subtitle' as const, ranges: highlight(r.subtitle, q) }] : []),
    ],
    actions: e.actions(row, ctx),
    score,
  };
}
function passes(r: SearchResult, f: NonNullable<SearchQuery['filters']>): boolean {
  if (f.status && r.facets?.status !== f.status) return false;
  if (f.fleet && r.facets?.fleet !== f.fleet) return false;
  if (f.zone && r.facets?.zone !== f.zone) return false;
  if (f.from && (r.at ?? 0) < f.from) return false;
  if (f.to && (r.at ?? Infinity) > f.to) return false;
  return true;
}
function searchEntity(e: SearchEntity<unknown>, ctx: SearchContext, q: SearchQuery): SearchResult[] {
  const rows = e.load(ctx);
  const text = q.text.trim();
  const id = canonicalId(text);
  const exact = id && rows.some((r) => sameId(e.id(r), id)) ? id : null;
  let scored: { row: unknown; score: number }[];
  if (!text) scored = rows.map((row) => ({ row, score: 0 }));
  else {
    const ms = indexOf(e, rows, ctx.key);
    const boost = Object.fromEntries(e.fields.map((f, n) => [`f${n}`, f.weight]));
    const opts = { boost, prefix: true, fuzzy, tokenize, processTerm };
    let hits = ms.search(text, { ...opts, combineWith: 'AND' });
    if (!hits.length && queryTerms(text).length > 1) hits = ms.search(text, { ...opts, combineWith: 'OR' });
    scored = hits.map((h) => ({ row: rows[h.id as number], score: h.score * 10 }));
    if (exact && !scored.some((s) => sameId(e.id(s.row), exact)))
      for (const r of rows) if (sameId(e.id(r), exact)) scored.push({ row: r, score: 0 });
  }
  const norm = normalize(text);
  const qTerms = queryTerms(text);
  const out = scored.map(({ row, score }) => {
    const r = e.toResult(row, ctx);
    let s = score;
    if (exact && sameId(e.id(row), exact)) s += 1000; // an id typed in full: that thing, first
    if (norm && normalize(r.title).startsWith(norm))
      s += 40; // typed exactly the way it starts
    else if (qTerms.length && startsWithTerms(r.title, qTerms)) s += 20; // the same words by another name (amr = robot)
    if (r.at && ctx.now - r.at < 7 * DAY) s += 20 * (1 - (ctx.now - r.at) / (7 * DAY));
    if (e.home?.includes(ctx.workspace ?? '')) s += 15;
    s += e.boost?.(row, ctx) ?? 0;
    return toResult(e, row, ctx, s, text);
  });
  return q.filters ? out.filter((r) => passes(r, q.filters!)) : out;
}
const order = (sort: SearchQuery['sort']) => (a: SearchResult, b: SearchResult) =>
  sort === 'recent'
    ? (b.at ?? 0) - (a.at ?? 0) || b.score - a.score
    : sort === 'az'
      ? a.title.localeCompare(b.title)
      : b.score - a.score || a.title.localeCompare(b.title);

const distance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
/** For "No results": the closest word we know to what was typed (one word queries only). */
function didYouMean(text: string, ents: SearchEntity<unknown>[], ctx: SearchContext): string | undefined {
  const w = normalize(text.trim());
  if (w.length < 4 || /\s/.test(w)) return undefined;
  let best: [string, number] | null = null;
  for (const e of ents)
    for (const r of e.load(ctx).slice(0, 400))
      for (const t of tokenize(e.toResult(r, ctx).title)) {
        if (t.length < 3) continue;
        const dist = distance(w, t);
        if (dist > 0 && dist <= 2 && (!best || dist < best[1])) best = [t, dist];
      }
  return best?.[0];
}

/** The order of the groups when nothing is an exact id: what people look for most comes first. */
const PRIORITY: EntityType[] = [
  'robot',
  'trip',
  'station',
  'zone',
  'workflow',
  'material',
  'device',
  'fleet',
  'map',
  'user',
  'page',
  'metric',
  'integration',
  'ticket',
];
const cache = new Map<string, { at: number; page: SearchResultPage }>();
const TTL = 5_000;
/**
 * Search everything this person may see. Entities they have no permission for are dropped FIRST (their data is never read); the rest are searched in parallel, ranked (field weights, exact id,
 * prefix, recency, the person's workspace), grouped by type with totals. PROD: a type served by a server provider is asked through `searchRegistry.provider(type)` instead.
 */
export async function searchAll(q: SearchQuery, ctx: SearchContext): Promise<SearchResultPage> {
  const t0 = performance.now();
  const key = `${ctx.key}|${JSON.stringify(q)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.page;
  const ents = searchRegistry.allowed(ctx).filter((e) => !q.types?.length || q.types.includes(e.type));
  const limit = q.limit ?? (q.types?.length === 1 ? 20 : GROUP_LIMIT);
  const offset = q.offset ?? 0;
  const groups: SearchGroup[] = [];
  let exact: SearchResult | undefined;
  await Promise.all(
    ents.map(async (e) => {
      const server = searchRegistry.provider(e.type);
      const all = server ? (await server.search(q, ctx)).results : searchEntity(e, ctx, q);
      if (!all.length) return;
      all.sort(order(q.sort));
      const id = canonicalId(q.text);
      const top = id && all.find((r) => sameId(r.id, id));
      if (top && (!exact || top.score > exact.score)) exact = top;
      groups.push({ type: e.type, label: e.label(), total: all.length, results: all.slice(offset, offset + limit) });
    }),
  );
  groups.sort(
    (a, b) =>
      Number((b.results[0]?.score ?? 0) >= 500) - Number((a.results[0]?.score ?? 0) >= 500) || // an id typed in full: that type first
      PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) ||
      (b.results[0]?.score ?? 0) - (a.results[0]?.score ?? 0),
  );
  const total = groups.reduce((n, g) => n + g.total, 0);
  const page: SearchResultPage = {
    groups,
    total,
    tookMs: Math.round((performance.now() - t0) * 10) / 10,
    exact,
    didYouMean: total === 0 && q.text.trim() ? didYouMean(q.text, ents, ctx) : undefined,
  };
  cache.set(key, { at: Date.now(), page });
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return page;
}
export const clearSearchCache = () => cache.clear();
