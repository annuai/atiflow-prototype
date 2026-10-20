import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { OPERATOR_CARD_H } from '@/components/data/operatorCard';
import { cx } from '@/utils/cx';

export interface RouteStop {
  /** station id (STA-107): what is printed under the marker */
  id: string;
  /** the station's own name: shown in the tooltip */
  name: string;
}
export interface RouteCardText {
  /** what the strip is called for screen readers */
  stations: string;
  pickup: string;
  dropoff: string;
  moreStops: (n: number) => string;
}

/** Room one marker needs (its station id) and the least room between two markers, in px: when the whole route does not fit, the middle stops collapse into "+N stops". */
const NODE = 64,
  GAP = 10;

/** A marker that shows the station's name in a tooltip: while the pointer is over it (mouse) and, for touch screens that have no hover, for a few seconds after a tap (or Enter / Space). */
function Marker({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned) return;
    const t = window.setTimeout(() => setPinned(false), 3500);
    return () => window.clearTimeout(t);
  }, [pinned]);
  return (
    <Tooltip title={title} isOpen={hover || pinned} placement="top">
      <AriaButton
        className={cx('flex flex-col gap-1 rounded-md outline-focus-ring focus-visible:outline-2', className)}
        onHoverChange={setHover}
        onPress={() => setPinned((p) => !p)}
        aria-label={title}
      >
        {children}
      </AriaButton>
    </Tooltip>
  );
}

type Node = { kind: 'stop'; stop: RouteStop; role: 'first' | 'mid' | 'last' } | { kind: 'more'; hidden: RouteStop[] };
/** the labels hang under a dot that is only 12 px wide, so the lines between the dots can fill the whole width of the card */
const ALIGN = {
  first: 'left-0 items-start text-left',
  mid: 'left-1/2 -translate-x-1/2 items-center text-center',
  last: 'right-0 items-end text-right',
};

/**
 * The route as a strip of grey markers: the first and the last station always, with the stops between them when every marker fits; on a longer route the middle collapses into one
 * "+N stops" chip, so every card in a grid of dozens of trips looks the same. Under the first and last marker: its id and "Pickup" / "Drop-off", aligned to the marker above.
 * Hover, focus or tap a marker for the station's name.
 */
function RouteStrip({ stops, text }: { stops: RouteStop[]; text: RouteCardText }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const fits = width === 0 || stops.length * NODE + (stops.length - 1) * GAP <= width;
  const nodes: Node[] =
    stops.length === 1
      ? [{ kind: 'stop', stop: stops[0], role: 'last' }]
      : fits || stops.length <= 2
        ? stops.map((s, i) => ({
            kind: 'stop',
            stop: s,
            role: i === 0 ? 'first' : i === stops.length - 1 ? 'last' : 'mid',
          }))
        : [
            { kind: 'stop', stop: stops[0], role: 'first' },
            { kind: 'more', hidden: stops.slice(1, -1) },
            { kind: 'stop', stop: stops[stops.length - 1], role: 'last' },
          ];
  const label = (s: RouteStop) => (s.name ? `${s.id} · ${s.name}` : s.id);
  return (
    <div ref={box}>
      <ol className="flex items-start" aria-label={text.stations}>
        {nodes.map((n, i) => (
          <li key={i} className={cx('flex items-start', i < nodes.length - 1 ? 'min-w-0 flex-1' : 'shrink-0')}>
            {n.kind === 'stop' ? (
              <Marker title={label(n.stop)} className="relative h-[52px] w-3 shrink-0">
                <span className="flex h-4 items-center">
                  <i
                    className={cx('size-3 rounded-full', n.role === 'mid' ? 'bg-fg-quaternary/50' : 'bg-fg-quaternary')}
                    aria-hidden
                  />
                </span>
                <span className={cx('absolute top-5 flex flex-col gap-0.5 whitespace-nowrap', ALIGN[n.role])}>
                  <span className="text-xs font-medium text-secondary">{n.stop.id}</span>
                  {stops.length > 1 && n.role !== 'mid' && (
                    <span className="text-xs text-tertiary">{n.role === 'first' ? text.pickup : text.dropoff}</span>
                  )}
                </span>
              </Marker>
            ) : (
              <Marker title={n.hidden.map(label).join('\n')} className="h-[52px] shrink-0 items-center">
                <span className="flex h-4 items-center">
                  <span className="rounded-full bg-secondary px-2 text-xs leading-4 font-medium whitespace-nowrap text-secondary ring-1 ring-secondary">
                    {text.moreStops(n.hidden.length)}
                  </span>
                </span>
              </Marker>
            )}
            {i < nodes.length - 1 && (
              <span className="mx-1.5 mt-[7px] h-0.5 min-w-2 flex-1 rounded-full bg-quaternary" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One saved trip (a workflow with no material) as a card the same size as a material card, so Request Material and Book Trips feel like one page and a grid of dozens of trips stays even:
 * the robot it uses (picture, name, how many are free), whether it needs an approval, the route as grey markers, and the button that books it.
 */
export function RouteCard({
  title,
  picture,
  robot,
  free,
  stops,
  approval,
  approvalText,
  selected,
  addLabel,
  removeLabel,
  text,
  onToggle,
}: {
  title: string;
  picture: string;
  robot: string;
  free?: { text: string; any: boolean };
  stops: RouteStop[];
  approval: boolean;
  approvalText: string;
  /** in the list of robots to call */
  selected: boolean;
  addLabel: string;
  removeLabel: string;
  text: RouteCardText;
  onToggle(): void;
}) {
  return (
    <article
      className={cx(
        'flex flex-col rounded-2xl border bg-primary p-4 shadow-xs',
        OPERATOR_CARD_H,
        selected ? 'border-brand ring-2 ring-brand/30' : 'border-secondary',
      )}
    >
      <div className="flex gap-3">
        <span className="relative h-[68px] w-[104px] shrink-0">
          <span className="flex size-full items-center justify-center overflow-hidden rounded-lg bg-secondary p-1.5">
            <img src={picture} alt="" className="size-full object-contain" loading="lazy" decoding="async" />
          </span>
        </span>
        <div className="flex h-[68px] min-w-0 flex-1 flex-col justify-between">
          <h3 className="line-clamp-2 text-md leading-[22px] font-semibold text-primary" title={title}>
            {title}
          </h3>
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-sm text-tertiary">{robot}</p>
            {free && (
              <Badge
                size="sm"
                type="pill-color"
                color={free.any ? 'success' : 'gray'}
                className="shrink-0 whitespace-nowrap"
              >
                {free.text}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {approval && (
        <div className="mt-2 flex h-6 items-center overflow-hidden">
          <Badge size="md" type="pill-color" color="warning" className="whitespace-nowrap">
            {approvalText}
          </Badge>
        </div>
      )}
      <div className="my-auto py-2">
        <RouteStrip stops={stops} text={text} />
      </div>
      <Button size="lg" color={selected ? 'secondary' : 'primary'} className="mt-auto w-full" onPress={onToggle}>
        {selected ? removeLabel : addLabel}
      </Button>
    </article>
  );
}
