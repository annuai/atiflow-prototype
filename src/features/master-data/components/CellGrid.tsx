import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { cellKey } from '../model/areas';
import { cellState } from '../model/cellStates';
import type { StagingArea } from '../model/types';

/** Numbered grid of cells. In Manage mode cells that can be changed by hand are buttons; otherwise the grid is read-only. */
export function CellGrid({
  area,
  manage,
  onToggle,
}: {
  area: StagingArea;
  manage: boolean;
  onToggle(row: number, col: number): void;
}) {
  const cols = Array.from({ length: area.cols }, (_, i) => i + 1);
  const rows = Array.from({ length: area.rows }, (_, i) => i + 1);
  return (
    <div className="overflow-auto p-4 sm:p-6" role="grid" aria-label={copy.staging.layoutTitle(area.name)}>
      <div className="inline-grid gap-2" style={{ gridTemplateColumns: `20px repeat(${area.cols}, 52px)` }}>
        <span />
        {cols.map((c) => (
          <span key={c} className="text-center text-xs text-secondary">
            {c}
          </span>
        ))}
        {rows.map((r) => (
          <div key={r} className="contents" role="row">
            <span className="grid place-items-center text-xs text-secondary">{r}</span>
            {cols.map((c) => {
              const def = cellState(area.cells[cellKey(r, c)] ?? 'available');
              const label = copy.staging.cellLabel(r, c, def.label);
              const base = cx('size-[52px] rounded-lg border-2 transition-colors', def.cell);
              return manage && def.manual ? (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  aria-label={label}
                  title={label}
                  onClick={() => onToggle(r, c)}
                  className={cx(
                    base,
                    'cursor-pointer outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                />
              ) : (
                <div key={c} role="gridcell" aria-label={label} title={label} className={base} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
