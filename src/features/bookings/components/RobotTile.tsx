import { cx } from '@/utils/cx';

/** One robot type to choose: its picture on a light grey rounded box, its name and how many are on the fleet. A radio, big enough for a tablet. */
export function RobotTile({ label, picture, count, selected, onSelect }: { label: string; picture: string; count: string; selected: boolean; onSelect(): void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cx('flex min-h-[44px] cursor-pointer flex-col gap-3 rounded-xl border bg-primary p-4 text-left outline-focus-ring transition focus-visible:outline-2', selected ? 'border-2 border-brand bg-brand-primary' : 'border-secondary hover:bg-primary_hover')}>
      <span className="grid h-32 place-items-center rounded-lg bg-secondary p-2"><img src={picture} alt="" className="max-h-full max-w-full object-contain" /></span>
      <span className="flex flex-col"><span className="text-lg font-semibold text-primary">{label}</span><span className="text-sm text-tertiary">{count}</span></span>
    </button>
  );
}
