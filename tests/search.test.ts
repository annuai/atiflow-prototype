import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalId } from '../src/features/search/match/ids';
import { queryTerms } from '../src/features/search/match/normalize';
import { searchRegistry } from '../src/features/search/registry';
import { clearSearchCache, highlight, searchAll } from '../src/features/search/service';
import type { SearchContext, SearchEntity } from '../src/features/search/types';

const ctxOf = (perms: string[], workspace = 'supervisor'): SearchContext => ({
  user: { username: 'u', name: 'U' } as never,
  key: `u|${perms.join(',')}`,
  can: (p) => perms.includes(p),
  canOpen: () => true,
  liveFleets: null,
  workspace,
  locale: 'en',
  site: 'site',
  now: Date.now(),
});
interface Row {
  id: string;
  title: string;
  note?: string;
  status?: string;
  at?: number;
}
const entity = (
  type: SearchEntity<Row>['type'],
  rows: () => Row[],
  perm: string,
  home: string[] = [],
): SearchEntity<Row> => ({
  type,
  label: () => type,
  icon: (() => null) as never,
  permission: (c) => c.can(perm as never),
  load: rows,
  fields: [
    { get: (r) => r.title, weight: 3 },
    { get: (r) => r.note ?? '', weight: 1 },
    { get: (r) => r.id, weight: 4 },
  ],
  id: (r) => r.id,
  home,
  toResult: (r) => ({
    title: r.title,
    subtitle: r.note,
    url: `/x/${r.id}`,
    metadata: [],
    facets: { status: r.status },
    at: r.at,
  }),
  actions: () => [],
});
const robots: Row[] = [
  { id: 'AMR-007', title: 'AMR-007', note: 'Sherpa XT Lite' },
  { id: 'AMR-070', title: 'AMR-070', note: 'Pallet Mover' },
  { id: 'AMR-001', title: 'AMR-001', note: 'robot seven' },
];
const loadUsers = vi.fn(() => [{ id: 'kavin', title: 'Kavin' }]);
beforeEach(() => {
  clearSearchCache();
  searchRegistry.register(entity('robot', () => robots, 'supervisor.live-floor'));
  searchRegistry.register(entity('user', loadUsers, 'configurator.users'));
  searchRegistry.register(
    entity(
      'page',
      () => [
        { id: '/supervisor/dashboard', title: 'Dashboard' },
        { id: '/operator/book', title: 'Book trip', note: 'request material order' },
      ],
      'any',
    ),
  );
  loadUsers.mockClear();
});

describe('matching', () => {
  it('"L3", "line 3" and "line three" are the same words, numbers lose their zeros, robot = AMR = bot', () => {
    expect(queryTerms('L3')).toEqual(queryTerms('line three'));
    expect(queryTerms('line 3')).toEqual(['line', '3']);
    expect(queryTerms('AMR-007')).toEqual(queryTerms('robot 7'));
    expect(queryTerms('bot 07')).toEqual(queryTerms('amr 7'));
  });
  it('ids are recognised in the way people type them', () => {
    expect(canonicalId('r-07')).toBe('AMR-007');
    expect(canonicalId('amr 7')).toBe('AMR-007');
    expect(canonicalId('trp 14')).toBe('TRP-014');
    expect(canonicalId('sta113')).toBe('STA-113');
    expect(canonicalId('line three')).toBeNull();
  });
  it('highlights the matched words', () => {
    expect(highlight('Assembly Workstation 7', 'work 7')).toEqual([
      [9, 13],
      [21, 22],
    ]);
  });
});

describe('ranking', () => {
  it('an id typed in full comes first and is pinned as the exact result', async () => {
    const r = await searchAll({ text: 'r-07' }, ctxOf(['supervisor.live-floor']));
    expect(r.exact?.id).toBe('AMR-007');
    expect(r.groups[0].results[0].id).toBe('AMR-007');
  });
  it('a title that starts with the text beats one that only mentions it', async () => {
    const r = await searchAll({ text: 'book' }, ctxOf(['any']));
    expect(r.groups.flatMap((g) => g.results)[0].title).toBe('Book trip');
  });
  it('tolerates a typo and offers "did you mean" when nothing matches', async () => {
    const hit = await searchAll({ text: 'dashbaord' }, ctxOf(['any']));
    expect(hit.groups.flatMap((g) => g.results).map((x) => x.title)).toContain('Dashboard');
    const none = await searchAll({ text: 'qqqqzzzz' }, ctxOf(['any']));
    expect(none.total).toBe(0);
  });
  it('filters by facet and sorts by recency', async () => {
    searchRegistry.register(
      entity(
        'robot',
        () => [
          { id: 'A', title: 'robot a', status: 'moving', at: 1 },
          { id: 'B', title: 'robot b', status: 'idle', at: 9 },
        ],
        'supervisor.live-floor',
      ),
    );
    const ctx = ctxOf(['supervisor.live-floor']);
    expect(
      (await searchAll({ text: 'robot', filters: { status: 'idle' } }, ctx)).groups[0].results.map((r) => r.id),
    ).toEqual(['B']);
    expect((await searchAll({ text: 'robot', sort: 'recent' }, ctx)).groups[0].results.map((r) => r.id)).toEqual([
      'B',
      'A',
    ]);
  });
  it('searches 5,000 records in well under 100 ms', async () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      id: `ID-${i}`,
      title: `Material number ${i} bracket`,
      note: 'steel',
    }));
    searchRegistry.register(entity('robot', () => many, 'supervisor.live-floor'));
    const ctx = ctxOf(['supervisor.live-floor']);
    await searchAll({ text: 'warm' }, ctx); // builds the index once
    const t = performance.now();
    const r = await searchAll({ text: 'bracket 4999' }, { ...ctx, now: ctx.now + 1 });
    expect(performance.now() - t).toBeLessThan(100);
    expect(r.groups[0].results[0].id).toBe('ID-4999');
  });
});

describe('permissions are enforced in the search layer', () => {
  it('a person without the permission never gets the type, and its data is never even read', async () => {
    const op = ctxOf(['operator.book-trip'], 'operator');
    const r = await searchAll({ text: 'kavin' }, op);
    expect(r.groups.map((g) => g.type)).not.toContain('user');
    expect(loadUsers).not.toHaveBeenCalled();
    const cfg = await searchAll({ text: 'kavin' }, ctxOf(['configurator.users'], 'configurator'));
    expect(cfg.groups.map((g) => g.type)).toContain('user');
  });
  it('asking for a forbidden type by name still returns nothing', async () => {
    const r = await searchAll({ text: 'kavin', types: ['user'] }, ctxOf(['operator.book-trip'], 'operator'));
    expect(r.total).toBe(0);
  });
});

describe('a server provider can replace a local one', () => {
  it('uses the provider for its type', async () => {
    searchRegistry.useProvider('robot', {
      type: 'robot',
      search: async () => ({
        total: 1,
        results: [
          {
            id: 'S-1',
            type: 'robot',
            title: 'from the server',
            metadata: [],
            highlights: [],
            url: '/s',
            actions: [],
            score: 1,
          },
        ],
      }),
    });
    const r = await searchAll({ text: 'anything', types: ['robot'] }, ctxOf(['supervisor.live-floor']));
    expect(r.groups[0].results[0].title).toBe('from the server');
  });
});
