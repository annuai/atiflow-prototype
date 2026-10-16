import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchLg } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { workspaceOfPath } from '@/features/access';
import { useAuth } from '@/features/auth';
import { PageTitleName } from '@/shell/PageTitle';
import { track } from '../analytics';
import { buildSearchContext } from '../context';
import { copy } from '../copy';
import { rememberSearch } from '../recent';
import { searchRegistry } from '../registry';
import type { EntityType, SearchAction, SearchGroup, SearchResult, SearchSort } from '../types';
import { FIELD, FilterBar } from './FilterBar';
import { ResultCard } from './ResultCard';
import { TypeTabs } from './TypeTabs';
import { useCommands } from './useCommands';
import { useQueryState } from './useQueryState';
import { useSearch } from './useSearch';

const PAGE = 20;
const btn = 'min-h-11 rounded-lg border border-primary px-4 text-sm font-semibold';

/** The text box of the page; its own state starts from the URL (the page remounts it when the address changes). */
function QueryBox({ q, simple, onSubmit }: { q: string; simple: boolean; onSubmit(text: string): void }) {
  const [text, setText] = useState(q);
  return (
    <form
      role="search"
      className="flex shrink-0 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text.trim());
      }}
    >
      <label className="relative flex-1">
        <SearchLg
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-quaternary"
        />
        <input
          className={`${FIELD} w-full pl-10 ${simple ? 'min-h-14 text-md' : ''}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={copy.ui.label}
        />
      </label>
    </form>
  );
}

/** Type tabs, filters and the screen-reader count: only when there is a query (operators get no filters). */
function Controls(p: {
  q: string;
  simple: boolean;
  groups: SearchGroup[];
  all: number;
  cur: SearchGroup[];
  total: number;
  type: EntityType | null;
  sort: SearchSort;
  params: URLSearchParams;
  allowed: EntityType[];
  counted: boolean;
  onPick(t: EntityType | null): void;
  onSet(patch: Record<string, string | null>): void;
}) {
  if (!p.q) return null;
  return (
    <>
      <TypeTabs groups={p.groups} total={p.all} type={p.type} allowed={p.allowed} onPick={p.onPick} />
      {!p.simple && <FilterBar groups={p.cur} params={p.params} sort={p.sort} onSet={p.onSet} />}
      <p className="sr-only" role="status" aria-live="polite">
        {p.counted ? copy.ui.count(p.total) : ''}
      </p>
    </>
  );
}
/** Loading skeletons, an error with Try again, or "No results" with a did-you-mean. */
function Status({
  busy,
  error,
  empty,
  q,
  didYouMean,
  onRetry,
  onPick,
}: {
  busy: boolean;
  error: boolean;
  empty: boolean;
  q: string;
  didYouMean?: string;
  onRetry(): void;
  onPick(w: string): void;
}) {
  if (busy)
    return (
      <div className="flex flex-col gap-2" aria-label={copy.ui.loading}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  if (error)
    return (
      <EmptyState
        icon={SearchLg}
        title={copy.ui.error}
        subtext=""
        size="lg"
        action={
          <button type="button" className={btn} onClick={onRetry}>
            {copy.ui.retry}
          </button>
        }
      />
    );
  if (!empty) return null;
  return (
    <EmptyState
      icon={SearchLg}
      title={copy.ui.noResults(q)}
      subtext={`${didYouMean ? copy.ui.didYouMean(didYouMean) + ' ' : ''}${copy.ui.hint}`}
      size="lg"
      action={
        didYouMean ? (
          <button type="button" className={btn} onClick={() => onPick(didYouMean)}>
            {didYouMean}
          </button>
        ) : undefined
      }
    />
  );
}

interface ListProps {
  groups: SearchGroup[];
  type: EntityType | null;
  simple: boolean;
  list: SearchResult[];
  total: number;
  onType(t: EntityType): void;
  onMore(): void;
  onOpen(r: SearchResult, i: number): void;
  onAction(a: SearchAction, r: SearchResult): void;
}
/** The results: grouped by type on All, one long list on a type tab. */
function Results({ groups, type, simple, list, total, onType, onMore, onOpen, onAction }: ListProps) {
  const card = (r: SearchResult, i: number) => (
    <ResultCard
      key={`${r.type}:${r.id}`}
      r={r}
      simple={simple}
      onOpen={() => onOpen(r, i)}
      onAction={(a) => onAction(a, r)}
    />
  );
  if (type)
    return (
      <ul className="flex flex-col gap-2">
        {list.map(card)}
        {total > list.length && (
          <li>
            <button type="button" className={`${btn} w-full`} onClick={onMore}>
              {copy.ui.showMore}
            </button>
          </li>
        )}
      </ul>
    );
  return (
    <>
      {groups.map((g) => (
        <section key={g.type} aria-label={g.label} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-md font-semibold text-primary">
              {g.label} <span className="font-normal text-tertiary">({g.total})</span>
            </h2>
            {g.total > g.results.length && (
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-brand-secondary underline"
                onClick={() => onType(g.type)}
              >
                {copy.ui.showMore}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2">{g.results.map(card)}</ul>
        </section>
      ))}
    </>
  );
}

/**
 * The full results page (`/<workspace>/search?q=&type=&status=&fleet=&zone=&sort=`; everything is in the URL, so Back and sharing work). Type tabs with counts, filters, sort, rich cards with their
 * actions, "Show more". Operators get the simple version: no filters, big cards, one button.
 */
export function SearchPage() {
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const here = useLocation();
  const { params, q, type, sort, set, filters } = useQueryState();
  const [shown, setShown] = useState(PAGE);
  const simple = workspaceOfPath(here.pathname) === 'operator';
  const all = useSearch({ text: q, sort, filters, limit: type ? 1 : 5 }, 0, true, true);
  const typed = useSearch({ text: q, types: type ? [type] : undefined, sort, filters, limit: shown }, 0, !!type);
  const go = (url: string) => navigate(url.startsWith('?') ? here.pathname + url : url);
  const { run, dialogs } = useCommands(go);
  const allowed = useMemo(() => {
    const ctx = buildSearchContext();
    return ctx ? searchRegistry.allowed(ctx).map((e) => e.type) : [];
  }, []);
  const cur = type ? typed : all;
  const groups = all.page?.groups ?? [];
  const typedGroup = typed.page?.groups[0];
  const total = type ? (typedGroup?.total ?? 0) : (all.page?.total ?? 0);
  const busy = cur.loading && !cur.page;
  const empty = !!q && !busy && !cur.error && total === 0;
  const open = (r: SearchResult, i: number) => {
    track({ name: 'result_click', q, type: r.type, id: r.id, position: i });
    rememberSearch(user.username, q);
    const a = r.actions.find((x) => x.primary && x.kind === 'navigate') ?? r.actions.find((x) => x.kind === 'navigate');
    go(a?.url ?? r.url);
  };
  return (
    <div className="content">
      <PageTitleName name={copy.ui.pageTitle} />
      <div className="title-block">
        <div>
          <h1>{copy.ui.pageTitle}</h1>
          <p>{q ? copy.ui.pageFor(q) : copy.ui.pageSubtitle}</p>
        </div>
      </div>
      <div className="builder md-card">
        <div className="md-body !gap-4">
          <QueryBox key={q} q={q} simple={simple} onSubmit={(text) => set({ q: text || null, type: null })} />
          <Controls
            q={q}
            simple={simple}
            groups={groups}
            all={all.page?.total ?? 0}
            cur={cur.page?.groups ?? groups}
            total={total}
            type={type}
            sort={sort}
            params={params}
            allowed={allowed}
            counted={!!cur.page}
            onPick={(t) => {
              setShown(PAGE);
              set({ type: t });
            }}
            onSet={set}
          />
          {!q && <EmptyState icon={SearchLg} title={copy.ui.pageEmpty} subtext={copy.ui.hint} size="lg" />}
          <Status
            busy={busy}
            error={cur.error}
            empty={empty}
            q={q}
            didYouMean={all.page?.didYouMean}
            onRetry={cur.retry}
            onPick={(w) => set({ q: w, type: null })}
          />
          {!busy && !empty && q && (
            <Results
              groups={groups}
              type={type}
              simple={simple}
              list={typedGroup?.results ?? []}
              total={total}
              onType={(t) => {
                setShown(PAGE);
                set({ type: t });
              }}
              onMore={() => setShown((n) => n + PAGE)}
              onOpen={open}
              onAction={run}
            />
          )}
        </div>
      </div>
      {dialogs}
    </div>
  );
}
