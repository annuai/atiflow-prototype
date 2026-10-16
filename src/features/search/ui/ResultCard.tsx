import { Fragment } from 'react';
import { useApp } from '@/core/store';
import { copy as floor } from '@/ui/copy';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { searchRegistry } from '../registry';
import type { SearchAction, SearchResult } from '../types';

const TONE = {
  success: 'bg-success-primary text-success-primary',
  warning: 'bg-warning-primary text-warning-primary',
  error: 'bg-error-primary text-error-primary',
  brand: 'bg-brand-primary text-brand-secondary',
  gray: 'bg-secondary text-secondary',
} as const;

/** A title with the matched words marked. */
export function Marked({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(<Fragment key={`t${i}`}>{text.slice(at, a)}</Fragment>);
    out.push(
      <mark key={`m${i}`} className="rounded-sm bg-brand-primary px-0.5 text-brand-secondary">
        {text.slice(a, b)}
      </mark>,
    );
    at = b;
  });
  if (at < text.length) out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}
const rangesOf = (r: SearchResult, field: 'title' | 'subtitle') =>
  r.highlights.find((h) => h.field === field)?.ranges ?? [];

/** Robot and trip cards follow the live feed while they are on screen: the state and battery come from it, not from the moment the search ran. */
function useLive(r: SearchResult): SearchResult['metadata'] {
  const robot = useApp((s) => (r.live ? s.robots[r.live.robotId] : undefined));
  if (!robot) return r.metadata;
  return r.metadata.map((m) =>
    m.label === copy.meta.status
      ? {
          ...m,
          value: floor.states[robot.state] ?? robot.state,
          tone: robot.state === 'error' || robot.state === 'blocked' ? ('error' as const) : m.tone,
        }
      : m.label === copy.meta.battery
        ? {
            ...m,
            value: `${Math.round(robot.battery)}%`,
            tone: robot.battery < 25 ? ('error' as const) : ('success' as const),
          }
        : m,
  );
}

/**
 * One result: type icon, title and subtitle with the match marked, the key facts as chips (live for robots and trips) and its actions. In `simple` mode (operators) the card is big, plain, and has ONE button.
 */
export function ResultCard({
  r,
  simple,
  active,
  onOpen,
  onAction,
}: {
  r: SearchResult;
  simple?: boolean;
  active?: boolean;
  onOpen(): void;
  onAction(a: SearchAction): void;
}) {
  const Icon = searchRegistry.get(r.type)?.icon;
  const meta = useLive(r);
  const primary = r.actions.find((a) => a.primary) ?? r.actions[0];
  const others = simple ? [] : r.actions.filter((a) => a !== primary);
  return (
    <li
      className={cx(
        'flex flex-wrap items-center gap-3 rounded-2xl border bg-primary p-3 shadow-xs',
        simple && 'min-h-20 p-4',
        active ? 'border-brand ring-2 ring-brand/30' : 'border-secondary',
      )}
      data-result={r.type}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-fg-secondary">
        {Icon && <Icon className="size-5" />}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 basis-56 cursor-pointer rounded-lg text-left outline-focus-ring focus-visible:outline-2"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-tertiary">{copy.one[r.type]}</span>
        <span className={cx('block font-semibold text-primary', simple ? 'text-lg' : 'text-md')}>
          <Marked text={r.title} ranges={rangesOf(r, 'title')} />
        </span>
        {r.subtitle && (
          <span className="block text-sm text-tertiary">
            <Marked text={r.subtitle} ranges={rangesOf(r, 'subtitle')} />
          </span>
        )}
        {!simple && meta.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <span
                key={m.label}
                className={cx('rounded-full px-2 py-0.5 text-xs font-medium', TONE[m.tone ?? 'gray'])}
              >
                {m.label}: {m.value}
              </span>
            ))}
          </span>
        )}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <button
            type="button"
            onClick={() => onAction(primary)}
            className={cx(
              'inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand-solid px-3 text-sm font-semibold text-white outline-focus-ring hover:bg-brand-solid_hover focus-visible:outline-2',
              simple ? 'min-h-12 px-5 text-md' : 'min-h-10',
            )}
          >
            {primary.label}
          </button>
        )}
        {others.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction(a)}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
          >
            {a.label}
          </button>
        ))}
      </div>
    </li>
  );
}
