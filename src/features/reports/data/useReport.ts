import { useCallback, useEffect, useState } from 'react';
import { resolveRange } from '../model/range';
import type { RangeSelection, Report, ReportSource } from '../model/types';

/** Loads the report for a range; `refresh` loads it again. Keeps the previous report on screen while a new one loads. */
export function useReport(source: ReportSource, selection: RangeSelection) {
  const [tick, setTick] = useState(0);
  const key = `${selection.preset}|${selection.from?.getTime()}|${selection.to?.getTime()}`;
  // the newest answer (or failure) and which request it belongs to; `report` stays while a different one is on its way
  const [settled, setSettled] = useState<{ key: string; tick: number; report: Report | null; error: boolean } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    source.fetch(resolveRange(selection)).then(
      (report) => live && setSettled({ key, tick, report, error: false }),
      () => live && setSettled((s) => ({ key, tick, report: s?.report ?? null, error: true })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const current = settled?.key === key && settled.tick === tick;
  return { report: settled?.report ?? null, loading: !current, error: current && settled.error, refresh };
}
