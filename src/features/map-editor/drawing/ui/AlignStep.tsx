import { useEffect, useMemo, useState } from 'react';
import { FlipBackward, RefreshCw01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { applyPoint, IDENTITY, type Similarity } from '@/core/similarity';
import type { Wall } from '@/core/types';
import { copy } from '../copy';
import { NumberInput } from '@/components/form/NumberInput';
import { alignToMap } from '../core/autoAlign';
import { aboutCentre, centreOf, placeCentre, twoPoints } from '../core/align';
import type { Area } from '../core/place';
import type { Built, P } from '../core/types';
import type { MapContext } from '../mapContext';
import { AlignCanvas, type PickState } from './AlignCanvas';
import { previewPaths } from './previewPaths';

const deg = (r: number) => Math.round(((r * 180) / Math.PI) * 100) / 100;

/** The drawing's walls as segments, for the aligner. */
const wallsOf = (b: Built): Wall[] =>
  b.lines.flatMap((l) =>
    l.points.slice(1).map((p, i) => ({ a: l.points[i], b: p, t: l.thickness, h: l.height, layer: 'dwg' }) as Wall),
  );

export interface AlignProps {
  built: Built;
  context: MapContext;
  t: Similarity;
  onT(t: Similarity): void;
  /** the map's area (the box round everything on it, a little grown), or null when the map is empty */
  area: Area | null;
  clipOn: boolean;
  onClip(v: boolean): void;
  replace: boolean;
  onReplace(v: boolean): void;
  earlier: number;
  /** how many of each the import would add right now */
  counts: {
    walls: number;
    partitions: number;
    machines: number;
    pillars: number;
    doors: number;
    areas: number;
    outside: number;
  };
  /** the alignment was already tried (so coming back to this step does not move the drawing) */
  tried: boolean;
  onTried(): void;
}

/** Step 3: the drawing over the map, moved by hand, by two matching points or by the aligner; and what will be imported. */
export function AlignStep(p: AlignProps) {
  const t = copy.align;
  const paths = useMemo(() => previewPaths(p.built), [p.built]);
  const centre = useMemo<P>(() => (p.built.bounds ? centreOf(p.built.bounds) : [0, 0]), [p.built]);
  const [pick, setPick] = useState<PickState>({ on: false, pairs: [] });
  const [fitScale, setFitScale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const canAuto = p.context.walls.length > 0 && p.built.lines.length > 0;

  // the view covers the map (the place that matters), or the drawing as first placed when the map is empty
  const bounds = useMemo<Area>(() => {
    if (p.area) return p.area;
    const d = p.built.bounds;
    return d
      ? { minX: d.minX, minY: d.minY, maxX: d.maxX, maxY: d.maxY }
      : { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  }, [p.built, p.area]);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const r = alignToMap(wallsOf(p.built), p.context.walls);
      p.onT(r.t);
      setScore(r.score);
      setBusy(false);
    }, 30);
  };
  useEffect(() => {
    if (p.tried) return;
    // first time at this step: put the drawing in the middle of the map and try the aligner (after the step has drawn)
    const timer = setTimeout(() => {
      p.onTried();
      if (p.area) p.onT(placeCentre(centre, [(p.area.minX + p.area.maxX) / 2, (p.area.minY + p.area.maxY) / 2], 1, 0));
      if (canAuto) run();
    }, 0);
    return () => clearTimeout(timer);
    // once, when the step opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = applyPoint(p.t, centre);
  const step = !pick.pairs.length
    ? 0
    : pick.pairs[pick.pairs.length - 1].to === null
      ? pick.pairs.length * 2 - 1
      : pick.pairs.length * 2;
  const onPick = (pt: P, on: 'drawing' | 'map') => {
    const pairs =
      on === 'drawing'
        ? [...pick.pairs, { from: pt, to: null }]
        : pick.pairs.map((q, i) => (i === pick.pairs.length - 1 ? { ...q, to: pt } : q));
    if (pairs.length === 2 && pairs[1].to) {
      const solved = twoPoints(pairs as { from: P; to: P }[], p.t.scale, fitScale);
      if (solved) p.onT(solved);
      setScore(null);
      setPick({ on: false, pairs: [] });
    } else setPick({ on: true, pairs });
  };
  const add = (k: keyof AlignProps['counts'], n: number) => (n > 0 ? t[k as 'walls'](n) : null);
  const lines = [
    add('walls', p.counts.walls),
    add('partitions', p.counts.partitions),
    add('machines', p.counts.machines),
    add('pillars', p.counts.pillars),
    add('doors', p.counts.doors),
    add('areas', p.counts.areas),
  ].filter(Boolean);

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-tertiary">{t.hint}</p>
        <div className="h-[52vh] min-h-[320px] overflow-hidden rounded-lg border border-secondary">
          <AlignCanvas
            bounds={bounds}
            context={p.context}
            paths={paths}
            centre={centre}
            t={p.t}
            onT={(n) => {
              p.onT(n);
              setScore(null);
            }}
            clip={p.clipOn ? p.area : null}
            pick={pick}
            onPick={onPick}
            label={t.canvas}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-primary">{t.placement}</h3>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label={t.scale}
              value={Math.round(p.t.scale * 10000) / 10000}
              onCommit={(v) => v > 0 && p.onT(aboutCentre(p.t, centre, { scale: v }))}
            />
            <NumberInput
              label={t.rotation}
              value={deg(p.t.rot)}
              onCommit={(v) => p.onT(aboutCentre(p.t, centre, { rot: (v * Math.PI) / 180 }))}
            />
            <NumberInput
              label={t.x}
              value={Math.round(c[0] * 100) / 100}
              onCommit={(v) => p.onT(placeCentre(centre, [v, c[1]], p.t.scale, p.t.rot))}
            />
            <NumberInput
              label={t.y}
              value={Math.round(c[1] * 100) / 100}
              onCommit={(v) => p.onT(placeCentre(centre, [c[0], v], p.t.scale, p.t.rot))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={RefreshCw01}
              onPress={() => p.onT(aboutCentre(p.t, centre, { rot: p.t.rot + Math.PI / 2 }))}
            >
              {t.turn90}
            </Button>
            <Button
              size="sm"
              color="tertiary"
              iconLeading={FlipBackward}
              onPress={() => {
                p.onT(
                  p.area
                    ? placeCentre(centre, [(p.area.minX + p.area.maxX) / 2, (p.area.minY + p.area.maxY) / 2], 1, 0)
                    : IDENTITY,
                );
                setScore(null);
              }}
            >
              {t.reset}
            </Button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <Button size="sm" color="secondary" isDisabled={!canAuto || busy} isLoading={busy} onPress={run}>
            {busy ? t.autoBusy : t.auto}
          </Button>
          {!canAuto && <p className="text-xs text-tertiary">{t.autoNone}</p>}
          {score !== null && <p className="text-xs font-medium text-secondary">{t.score(Math.round(score * 100))}</p>}
          <Button
            size="sm"
            color={pick.on ? 'primary' : 'secondary'}
            onPress={() => setPick(pick.on ? { on: false, pairs: [] } : { on: true, pairs: [] })}
          >
            {pick.on ? t.pickStop : t.pick}
          </Button>
          {pick.on && (
            <>
              <p role="status" className="text-xs font-medium text-brand-secondary">
                {t.pickSteps[Math.min(step, 3)]}
              </p>
              <Checkbox size="sm" isSelected={fitScale} onChange={setFitScale} label={t.fitScale} />
            </>
          )}
        </section>
        <section className="flex flex-col gap-2 border-t border-secondary pt-3">
          {p.area && <Checkbox size="sm" isSelected={p.clipOn} onChange={p.onClip} label={t.onlyInside} />}
          {p.earlier > 0 && (
            <Checkbox size="sm" isSelected={p.replace} onChange={p.onReplace} label={t.replace(p.earlier)} />
          )}
        </section>
        <section className="rounded-lg bg-secondary p-3 text-sm text-secondary">
          {lines.length ? (
            <>
              <p className="mb-1 font-semibold text-primary">{t.willAdd}</p>
              <ul>
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {p.counts.outside > 0 && <p className="mt-1 text-xs text-tertiary">{t.outside(p.counts.outside)}</p>}
            </>
          ) : (
            <p>{t.nothing}</p>
          )}
        </section>
      </div>
    </div>
  );
}
