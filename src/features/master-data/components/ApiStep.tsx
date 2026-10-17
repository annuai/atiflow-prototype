import { NoResults } from '@/components/data/EmptyState';
import { Button } from '@/components/base/buttons/button';
import { useEffect, useMemo, useState } from 'react';
import { SearchPrefixFilter } from '@/components/data/SearchPrefixFilter';
import { copy } from '../copy';
import { useMasterData } from '../model/store';
import { codeSet, inCodeSet } from '../model/logic';
import type { ErpRow, MaterialSource } from '../sources/types';
import { MaterialPicker, type PickerRow } from './MaterialPicker';

const PAGE = 50,
  DEBOUNCE_MS = 200;
interface Props {
  source: MaterialSource;
  showStatus: boolean;
  selected: Set<string>;
  onSelect(next: Set<string>, rows: Map<string, ErpRow>): void;
  picked: Map<string, ErpRow>;
}
interface View {
  q: string;
  rows: ErpRow[];
  total: number;
}

/**
 * Search + code-prefix filter over the ERP and a selectable list of what comes back. The source answers one page at a time (more is fetched as the list is scrolled),
 * so a catalogue of any size stays quick; "Select all" asks the source for every match. Selection survives changing the search.
 */
export function ApiStep({ source, showStatus, selected, onSelect, picked }: Props) {
  const existing = useMasterData((s) => s.materials);
  const have = useMemo(() => codeSet(existing), [existing]);
  const [text, setText] = useState('');
  const [prefix, setPrefix] = useState('');
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const q = `${text}\u0000${prefix}`;

  useEffect(() => {
    let current = true;
    const t = setTimeout(() => {
      setFailed(false);
      source
        .search({ text, prefix, limit: PAGE, offset: 0 })
        .then((r) => current && setView({ q, rows: r.rows, total: r.total }))
        .catch(() => current && setFailed(true));
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [source, text, prefix, q, attempt]);
  const fresh = view?.q === q ? view : null;
  const loading = !fresh && !failed;

  const loadMore = () => {
    if (!fresh || more || fresh.rows.length >= fresh.total) return;
    setMore(true);
    source
      .search({ text, prefix, limit: PAGE, offset: fresh.rows.length })
      .then((r) => setView((v) => (v && v.q === q ? { ...v, rows: [...v.rows, ...r.rows] } : v)))
      .catch(() => setFailed(true))
      .finally(() => setMore(false));
  };

  const shown = view?.rows; // (the previous answer stays on screen while a new one is loading)
  const rows: PickerRow[] = useMemo(
    () => (shown ?? []).map((r) => ({ ...r, status: inCodeSet(have, r.code) ? 'added' : 'available' })),
    [shown, have],
  );
  const change = (next: Set<string>) => {
    const keep = new Map(picked);
    const onScreen = new Set(rows.map((r) => r.code));
    rows.forEach((r) => (next.has(r.code) ? keep.set(r.code, r) : keep.delete(r.code)));
    // rows outside the current result keep their selection
    const all = new Set([...selected].filter((c) => !onScreen.has(c)));
    next.forEach((c) => all.add(c));
    onSelect(all, keep);
  };
  const selectAll = () => {
    setSelectingAll(true);
    source
      .all({ text, prefix })
      .then((everything) => {
        const next = new Set(selected);
        const keep = new Map(picked);
        for (const r of everything) {
          if (inCodeSet(have, r.code)) continue; // already in the list: locked
          next.add(r.code);
          keep.set(r.code, r);
        }
        onSelect(next, keep);
      })
      .catch(() => setFailed(true))
      .finally(() => setSelectingAll(false));
  };
  const visibleSelected = useMemo(
    () => new Set(rows.filter((r) => selected.has(r.code)).map((r) => r.code)),
    [rows, selected],
  );
  const total = fresh?.total ?? view?.total ?? 0;
  const canMore = !!fresh && fresh.rows.length < fresh.total;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <SearchPrefixFilter labels={copy.api} text={text} onText={setText} prefix={prefix} onPrefix={setPrefix} />
      <div className="flex items-center justify-between gap-3 text-sm text-tertiary">
        <span>
          {loading
            ? copy.api.loading
            : prefix.trim()
              ? copy.api.withPrefix(total, prefix.trim())
              : copy.api.showing(total)}
        </span>
        <span className="flex items-center gap-3">
          {selected.size > 0 && (
            <Button size="sm" color="link-gray" onPress={() => onSelect(new Set(), new Map())}>
              {copy.api.clearSelection}
            </Button>
          )}
          {!loading && total > 0 && (
            <Button size="sm" color="link-color" isLoading={selectingAll} onPress={selectAll}>
              {selectingAll ? copy.api.selectingAll : copy.api.selectAll(total)}
            </Button>
          )}
          <span className="font-semibold text-secondary">{copy.api.selected(selected.size)}</span>
        </span>
      </div>
      {failed ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-secondary py-8 text-sm text-tertiary">
          {copy.api.failed}
          <Button size="sm" color="secondary" onPress={() => setAttempt((n) => n + 1)}>
            {copy.api.retry}
          </Button>
        </div>
      ) : !loading && rows.length === 0 ? (
        <NoResults size="sm" subtext={copy.api.none} />
      ) : (
        <MaterialPicker
          rows={rows}
          selected={visibleSelected}
          onChange={change}
          showStatus={showStatus}
          onEnd={canMore ? loadMore : undefined}
          footer={more ? <p className="px-3 py-2 text-xs text-tertiary">{copy.api.loadingMore}</p> : undefined}
        />
      )}
    </div>
  );
}
