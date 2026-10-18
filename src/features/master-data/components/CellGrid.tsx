import { Lock01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { cellKey } from '../model/cells';
import { cellState } from '../model/cellStates';
import type { StagingArea, StagingCell } from '../model/types';

/** The few characters that tell a material apart inside a 52 px cell: the part of its code after the last dash ("DCP-1003" -> "1003"). */
const shortCode = (code: string) => (code.split('-').pop() || code).slice(0, 6);

/** What a screen reader and the tooltip say about a cell beyond its state. */
function cellDetail(c: StagingCell | undefined, names: ReadonlyMap<string, string>): string | undefined {
  if (!c) return undefined;
  if (c.state === 'blocked') return c.reason;
  if (!c.materialCode) return c.state === 'filled' ? copy.staging.cell.notSet : undefined;
  const name = names.get(c.materialCode);
  return [name ? `${c.materialCode} ${name}` : c.materialCode, c.quantity ? copy.staging.cell.pieces(c.quantity) : '']
    .filter(Boolean)
    .join(', ');
}

/**
 * Numbered grid of cells; each cell is a button. A cell shows the end of its material's code (a lock when blocked). With a material in `focus` the cells that hold it stay lit and
 * are numbered in the order the area gives them out (its FIFO / LIFO setting); the others are dimmed.
 */
export function CellGrid({
  area,
  names,
  selected,
  focus,
  onCell,
}: {
  area: StagingArea;
  names: ReadonlyMap<string, string>;
  selected: ReadonlySet<string>;
  focus: { code: string; order: string[] } | null;
  /** `additive` = Shift / Ctrl / Cmd was held: add to the selection instead of replacing it */
  onCell(key: string, additive: boolean): void;
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
              const key = cellKey(r, c);
              const cell = area.cells[key];
              const def = cellState(cell?.state ?? 'available');
              const rank = focus ? focus.order.indexOf(key) : -1;
              const dim = focus && rank < 0;
              const label = copy.staging.cellLabel(r, c, def.label, cellDetail(cell, names));
              return (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  aria-label={label}
                  aria-selected={selected.has(key)}
                  title={label}
                  onClick={(e) => onCell(key, e.shiftKey || e.ctrlKey || e.metaKey)}
                  className={cx(
                    'relative grid size-[52px] cursor-pointer place-items-center rounded-lg border-2 text-xs font-semibold text-primary transition-colors outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                    def.cell,
                    selected.has(key) && 'ring-2 ring-brand ring-offset-1',
                    dim && 'opacity-30',
                  )}
                >
                  {cell?.state === 'blocked' ? (
                    <Lock01 className="size-4 text-fg-quaternary" aria-hidden />
                  ) : cell?.materialCode ? (
                    shortCode(cell.materialCode)
                  ) : cell?.state === 'filled' ? (
                    '?'
                  ) : null}
                  {rank >= 0 && (
                    <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-brand-solid text-[10px] text-white">
                      {rank + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
