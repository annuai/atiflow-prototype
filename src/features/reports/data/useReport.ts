import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRange } from '../model/range';
import type { RangeSelection, Report, ReportSource } from '../model/types';

/** Loads the report for a range; `refresh` loads it again. Keeps the previous report on screen while a new one loads. */
export function useReport(source: ReportSource, selection: RangeSelection) {
  const [report, setReport] = useState<Report | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(false), [tick, setTick] = useState(0);
  const key = `${selection.preset}|${selection.from?.getTime()}|${selection.to?.getTime()}`; const latest = useRef(0);
  useEffect(() => {
    const id = ++latest.current; setLoading(true); setError(false);
    source.fetch(resolveRange(selection)).then((r) => { if (id === latest.current) { setReport(r); setLoading(false); } }, () => { if (id === latest.current) { setError(true); setLoading(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { report, loading, error, refresh };
}
