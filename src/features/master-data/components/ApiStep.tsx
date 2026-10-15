import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useEffect, useMemo, useState } from 'react';
import { SearchPrefixFilter } from '@/components/data/SearchPrefixFilter';
import { copy } from '../copy';
import { useMasterData } from '../model/store';
import { hasCode } from '../model/logic';
import type { ErpResult, ErpRow, MaterialSource } from '../sources/types';
import { MaterialPicker, type PickerRow } from './MaterialPicker';

const RESULT_LIMIT = 200, DEBOUNCE_MS = 250;
interface Props { source: MaterialSource; showStatus: boolean; selected: Set<string>; onSelect(next: Set<string>, rows: Map<string, ErpRow>): void; picked: Map<string, ErpRow> }

/** Search + code-prefix filter over the ERP, and a selectable list of what comes back. Selection survives changing the search. */
export function ApiStep({ source, showStatus, selected, onSelect, picked }: Props) {
  const existing = useMasterData((s) => s.materials);
  const [text, setText] = useState(''); const [prefix, setPrefix] = useState(''); const [result, setResult] = useState<ErpResult | null>(null); const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true; setLoading(true);
    const t = setTimeout(() => { source.search({ text, prefix, limit: RESULT_LIMIT }).then((r) => { if (live) { setResult(r); setLoading(false); } }); }, DEBOUNCE_MS);
    return () => { live = false; clearTimeout(t); };
  }, [source, text, prefix]);

  const rows: PickerRow[] = useMemo(() => (result?.rows ?? []).map((r) => ({ ...r, status: hasCode(existing, r.code) ? 'added' : 'available' })), [result, existing]);
  const change = (next: Set<string>) => {
    const keep = new Map(picked); rows.forEach((r) => { if (next.has(r.code)) keep.set(r.code, r); else keep.delete(r.code); });
    // rows outside the current result keep their selection
    const all = new Set([...selected].filter((c) => !rows.some((r) => r.code === c))); next.forEach((c) => all.add(c));
    onSelect(all, keep);
  };
  const visibleSelected = new Set(rows.filter((r) => selected.has(r.code)).map((r) => r.code));
  const total = result?.total ?? 0;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <SearchPrefixFilter labels={copy.api} text={text} onText={setText} prefix={prefix} onPrefix={setPrefix} />
      <div className="flex items-baseline justify-between text-sm text-tertiary">
        <span>{loading ? copy.api.loading : prefix.trim() ? copy.api.withPrefix(total, prefix.trim()) : copy.api.showing(total)}</span>
        <span className="font-semibold text-secondary">{copy.api.selected(selected.size)}</span>
      </div>
      {!loading && rows.length === 0 ? <NoResults size="sm" subtext={copy.api.none} />
        : <MaterialPicker rows={rows} selected={visibleSelected} onChange={change} showStatus={showStatus} />}
      {!loading && total > RESULT_LIMIT && <p className="text-xs text-tertiary">{copy.api.capped(RESULT_LIMIT)}</p>}
    </div>
  );
}
