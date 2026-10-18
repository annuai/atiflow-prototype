import { StatusDot } from '@/components/data/StatusDot';
import { cx } from '@/utils/cx';

/** One robot type to choose: its picture on a light grey rounded box, its name, how many robots of that type the fleet has and how many are free now. A radio, big enough for a tablet. */
export function RobotTile({
  label,
  picture,
  count,
  free,
  selected,
  onSelect,
}: {
  label: string;
  picture: string;
  count: string;
  /** "1 free now", or nothing until the floor has reported */ free?: { text: string; any: boolean };
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'flex min-h-[44px] cursor-pointer flex-col gap-3 rounded-xl border bg-primary p-4 text-left outline-focus-ring transition focus-visible:outline-2',
        selected ? 'border-2 border-brand bg-brand-primary' : 'border-secondary hover:bg-primary_hover',
      )}
    >
      <span className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-secondary p-2">
        <img src={picture} alt="" className="size-full object-contain" />
      </span>
      <span className="flex flex-col">
        <span className="text-lg font-semibold text-primary">{label}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-tertiary">
          <span>{count}</span>
          {free && (
            <span className="flex items-center gap-1.5">
              <StatusDot tone={free.any ? 'success' : 'neutral'} />
              {free.text}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
