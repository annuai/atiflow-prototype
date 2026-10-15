import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';

/** One saved route (a workflow with no material) as a card: the robot it uses, the stations it visits in order, whether it needs an approval, and the button that books it. */
export function RouteCard({ title, picture, robot, free, stops, approval, approvalText, cta, onBook }: { title: string; picture: string; robot: string; free?: { text: string; any: boolean }; stops: string[]; approval: boolean; approvalText: string; cta: string; onBook(): void }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary p-2"><img src={picture} alt="" className="size-full object-contain" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug text-primary">{title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-tertiary"><span>{robot}</span>{free && <span className="flex items-center gap-1.5"><i className={cx('size-2 rounded-full', free.any ? 'bg-success-solid' : 'bg-quaternary')} aria-hidden />{free.text}</span>}</p>
          {approval && <Badge size="md" color="warning" className="mt-2">{approvalText}</Badge>}
        </div>
      </div>
      <ol className="flex flex-col gap-1.5" aria-label="Stations">
        {stops.map((s, i) => (
          <li key={`${s}-${i}`} className="flex items-center gap-3 text-sm text-secondary">
            <span className="flex w-4 shrink-0 flex-col items-center"><i className={cx('size-2.5 rounded-full', i === 0 ? 'bg-[#16a34a]' : i === stops.length - 1 ? 'bg-[#dc2626]' : 'bg-[#94a3b8]')} aria-hidden /></span><span className="min-w-0 truncate">{s}</span>
          </li>))}
      </ol>
      <Button size="lg" color="primary" className="mt-auto" onPress={onBook}>{cta}</Button>
    </article>
  );
}
