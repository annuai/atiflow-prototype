import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Map01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { FleetMap } from '../model/types';

/** One fleet as an expandable row: name, its map and version, how many robots and hardware; opening it shows `children` (the fleet overview). */
export function FleetAccordion({
  name,
  map,
  robots,
  hardware,
  open,
  onToggle,
  menu,
  children,
}: {
  name: string;
  map: FleetMap | null;
  robots: number;
  hardware: number;
  open: boolean;
  onToggle(): void;
  /** the ⋮ menu (kept outside the toggle button: a button cannot hold a button) */
  menu?: ReactNode;
  children: ReactNode;
}) {
  const bodyId = useId();
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <section
      className={cx(
        'overflow-hidden rounded-xl border border-secondary shadow-xs',
        open ? 'bg-secondary_subtle' : 'bg-primary',
      )}
    >
      <div className={cx('flex items-center gap-2 px-5 py-4', open && 'border-b border-secondary bg-secondary')}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={copy.index.expand(name)}
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 text-left outline-focus-ring focus-visible:outline-2"
        >
          <h2 className="text-lg font-semibold text-primary">{name}</h2>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-tertiary">
            <span className="flex items-center gap-2">
              {copy.index.mapLabel}
              {map ? (
                <>
                  <Badge size="sm" type="modern" color="gray" className="max-w-56">
                    <Map01 className="mr-1 inline size-3.5" />
                    <span className="truncate">{map.name}</span>
                  </Badge>
                  <Badge size="sm" type="pill-color" color="brand">
                    {map.tag}
                  </Badge>
                </>
              ) : (
                <span className="text-quaternary">{copy.index.noMapShort}</span>
              )}
            </span>
            {map && (
              <span>
                {copy.overview.mapVersion}: {copy.overview.version(map.version)}
              </span>
            )}
            <span>
              {copy.meta.robots(robots)} · {copy.meta.hardware(hardware)}
            </span>
          </div>
        </button>
        {menu}
        <Chevron className="size-5 shrink-0 text-fg-quaternary" aria-hidden />
      </div>
      {open && (
        <div id={bodyId} className="p-5">
          {children}
        </div>
      )}
    </section>
  );
}
