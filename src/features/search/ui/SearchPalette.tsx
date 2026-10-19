import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchLg } from '@untitledui/icons';
import { workspaceOfPath } from '@/features/access';
import { useAuth } from '@/features/auth';
import { track } from '../analytics';
import { copy } from '../copy';
import { forgetSearches, recentSearches, rememberSearch } from '../recent';
import { searchRegistry } from '../registry';
import type { SearchResult } from '../types';
import { Marked } from './ResultCard';
import { runEgg } from '@/features/delight';
import { useSearch } from './useSearch';
import './search.css';

/** What to type to get started (identifiers and words that exist in every site: data, not text to translate). */
const EXAMPLES = ['AMR-007', 'TRP-001', 'line 3', 'settings'];
type Item =
  | { key: string; kind: 'result'; r: SearchResult }
  | { key: string; kind: 'recent'; q: string }
  | { key: string; kind: 'example'; q: string }
  | { key: string; kind: 'all'; q: string };

/**
 * The search box of the top bar and the quick palette under it: type to see the best results grouped by type (a few each), move with the arrows, Enter opens the highlighted one, and Enter
 * with nothing highlighted (or "See all results") opens the full page. Empty, it offers recent searches and suggestions. Cmd / Ctrl + K focuses it from anywhere. Combobox / listbox semantics.
 */
export function SearchPalette({ placeholder }: { placeholder: string }) {
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const here = useLocation();
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const text = q.trim();
  const { page, loading, error, retry } = useSearch({ text, limit: 4 }, 150, open && !!text);
  const [tick, redraw] = useState(0);
  const recent = useMemo(
    () => (open && !text && tick >= 0 ? recentSearches(user.username) : []),
    [open, text, user.username, tick],
  );
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  useEffect(() => {
    const out = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, []);
  const items: Item[] = useMemo(() => {
    if (!text)
      return [
        ...recent.map((r) => ({ key: `r:${r}`, kind: 'recent' as const, q: r })),
        ...EXAMPLES.map((r) => ({ key: `e:${r}`, kind: 'example' as const, q: r })),
      ];
    const list: Item[] = [];
    if (page?.exact) list.push({ key: `x:${page.exact.type}:${page.exact.id}`, kind: 'result', r: page.exact });
    for (const g of page?.groups ?? [])
      for (const r of g.results)
        if (r !== page?.exact && !(page?.exact && r.id === page.exact.id && r.type === page.exact.type))
          list.push({ key: `${g.type}:${r.id}`, kind: 'result', r });
    if (list.length || page) list.push({ key: 'all', kind: 'all', q: text });
    return list;
  }, [text, page, recent]);
  const go = (url: string) => (url.startsWith('?') ? navigate(here.pathname + url) : navigate(url));
  const openResult = (r: SearchResult, position: number) => {
    track({ name: 'result_click', q: text, type: r.type, id: r.id, position });
    rememberSearch(user.username, text);
    const a = r.actions.find((x) => x.primary && x.kind === 'navigate') ?? r.actions.find((x) => x.kind === 'navigate');
    go(a?.url ?? r.url);
    close();
  };
  const seeAll = (query: string) => {
    rememberSearch(user.username, query);
    navigate(`/${workspaceOfPath(here.pathname) ?? 'supervisor'}/search?q=${encodeURIComponent(query)}`);
    close();
  };
  const close = () => {
    setOpen(false);
    setQ('');
    setActive(-1);
    input.current?.blur();
  };
  const choose = (i: Item, position: number) => {
    if (i.kind === 'result') openResult(i.r, position);
    else if (i.kind === 'all') seeAll(i.q);
    else setQ(i.q);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (runEgg(q)) close();
      else if (active >= 0 && items[active]) choose(items[active], active);
      else if (page?.exact) openResult(page.exact, 0);
      else if (text) seeAll(text);
    }
  };
  const total = page?.total ?? 0;
  return (
    <div ref={box} className="search sr-box">
      <div className="sr-field">
        <SearchLg aria-hidden className="size-5 text-fg-quaternary" />
        <input
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={copy.ui.label}
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <kbd className="sr-kbd" aria-hidden>
          {typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}
        </kbd>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {open && text && page ? `${copy.ui.count(total)}` : ''}
      </p>
      {open && (
        <div className="sr-pop" id={listId} role="listbox" aria-label={copy.ui.results}>
          {!text && recent.length > 0 && (
            <div className="sr-head">
              <span>{copy.ui.recent}</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  forgetSearches(user.username);
                  redraw((n) => n + 1);
                }}
              >
                {copy.ui.clearRecent}
              </button>
            </div>
          )}
          {text && loading && !page && <p className="sr-note">{copy.ui.loading}</p>}
          {text && error && (
            <p className="sr-note">
              {copy.ui.error}{' '}
              <button type="button" className="underline" onMouseDown={(e) => e.preventDefault()} onClick={retry}>
                {copy.ui.retry}
              </button>
            </p>
          )}
          {text && page && total === 0 && (
            <div className="sr-note">
              <p>{copy.ui.noResults(text)}</p>
              {page.didYouMean && (
                <button
                  type="button"
                  className="underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQ(page.didYouMean!)}
                >
                  {copy.ui.didYouMean(page.didYouMean)}
                </button>
              )}
              <p className="text-tertiary">{copy.ui.hint}</p>
            </div>
          )}
          {items.map((it, i) => {
            const first =
              it.kind === 'result' &&
              (i === 0 ||
                (items[i - 1].kind === 'result' && (items[i - 1] as { r: SearchResult }).r.type !== it.r.type));
            return (
              <div key={it.key}>
                {first && it.kind === 'result' && <div className="sr-group">{copy.types[it.r.type]}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`sr-item${i === active ? ' sr-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(it, i)}
                >
                  {it.kind === 'result' ? (
                    <>
                      <span className="sr-icon">
                        {(() => {
                          const Ic = searchRegistry.get(it.r.type)?.icon;
                          return Ic ? <Ic className="size-4" /> : null;
                        })()}
                      </span>
                      <span className="sr-text">
                        <b>
                          <Marked
                            text={it.r.title}
                            ranges={it.r.highlights.find((h) => h.field === 'title')?.ranges ?? []}
                          />
                        </b>
                        {it.r.subtitle && (
                          <small>
                            <Marked
                              text={it.r.subtitle}
                              ranges={it.r.highlights.find((h) => h.field === 'subtitle')?.ranges ?? []}
                            />
                          </small>
                        )}
                      </span>
                      <span className="sr-act">{(it.r.actions.find((a) => a.primary) ?? it.r.actions[0])?.label}</span>
                    </>
                  ) : it.kind === 'all' ? (
                    <span className="sr-all">{copy.ui.seeAll(it.q)}</span>
                  ) : (
                    <span className="sr-text">
                      <b>{it.q}</b>
                      <small>{it.kind === 'recent' ? copy.ui.recent : copy.ui.hint}</small>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
