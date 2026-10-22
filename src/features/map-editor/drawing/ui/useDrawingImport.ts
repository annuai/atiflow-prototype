import { useEffect, useMemo, useRef, useState } from 'react';
import { IDENTITY, type Similarity } from '@/core/similarity';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import type { MapData } from '../../model/types';
import { addBuilt, importedFrom } from '../apply';
import { placeBuilt, type Area } from '../core/place';
import { DrawingError, type Built, type RowStats, type Rule, type Rules, type Summary } from '../core/types';
import { grown, mapContext } from '../mapContext';
import { openDrawing, type DrawingSession } from '../worker/session';

export type Phase = 'pick' | 'reading' | 'review' | 'building' | 'align';

const ERROR_KEY: Record<DrawingError['code'], keyof typeof copy.errors> = {
  'binary-dxf': 'binary',
  dwg: 'dwg',
  'ai-no-pdf': 'aiNoPdf',
  'ai-empty': 'aiEmpty',
  unsupported: 'unsupported',
  'too-big': 'tooBig',
  empty: 'empty',
  broken: 'broken',
};

/** How many of each the import would add (and how many fell outside the map). */
export function countsOf(placed: Built | null) {
  const lines = placed?.lines ?? [],
    boxes = placed?.boxes ?? [];
  return {
    walls: lines.filter((l) => l.kind === 'wall').length,
    partitions: lines.filter((l) => l.kind === 'partition').length,
    machines: boxes.filter((b) => b.kind === 'machine').length,
    pillars: boxes.filter((b) => b.kind === 'pillar').length,
    doors: placed?.doors.length ?? 0,
    areas: placed?.areas.length ?? 0,
    outside: placed?.notes.outside ?? 0,
  };
}

/** The import's state: the opened drawing, what the person decided in the review table, where it sits on the map, and the steps between. */
export function useDrawingImport(data: MapData, onApply: (fn: (d: MapData) => MapData) => void, close: () => void) {
  const t = copy;
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rules, setRules] = useState<Rules>({ layers: {}, blocks: {} });
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [unit, setUnit] = useState(1);
  const [layers, setLayers] = useState<RowStats[]>([]);
  const [built, setBuilt] = useState<Built | null>(null);
  const [place, setPlace] = useState<Similarity>(IDENTITY);
  const [tried, setTried] = useState(false);
  const [clipOn, setClipOn] = useState(true);
  const [replace, setReplace] = useState(true);
  const session = useRef<DrawingSession | null>(null);
  const seq = useRef(0);
  useEffect(() => () => session.current?.close(), []);

  const context = useMemo(() => mapContext(data, replace ? name : undefined), [data, replace, name]);
  const area = useMemo<Area | null>(() => (context.extent ? grown(context.extent, 10) : null), [context]);
  const placed = useMemo(
    () => (built ? placeBuilt(built, place, clipOn ? area : null) : null),
    [built, place, clipOn, area],
  );
  const counts = countsOf(placed);
  const total = counts.walls + counts.partitions + counts.machines + counts.pillars + counts.doors + counts.areas;

  const take = async (f: File) => {
    setError('');
    setPhase('reading');
    session.current?.close();
    session.current = null;
    try {
      const s = await openDrawing(f.name, new Uint8Array(await f.arrayBuffer()));
      session.current = s;
      setName(f.name);
      setSummary(s.summary);
      setRules(structuredClone(s.summary.rules));
      setEdited(new Set());
      setUnit(s.summary.guessedUnit);
      setLayers(s.summary.layers);
      setBuilt(null);
      setTried(false);
      setPhase('review');
    } catch (e) {
      const errors = t.errors as Record<string, string>;
      setError(errors[e instanceof DrawingError ? ERROR_KEY[e.code] : 'unknown'] ?? t.errors.unknown);
      setPhase('pick');
    }
  };
  /** The layer rows follow the blocks that are opened and the unit. */
  const refreshLayers = async (blockRules: Rules['blocks'], u: number) => {
    const my = ++seq.current;
    const rows = await session.current?.rows(blockRules, u);
    if (rows && my === seq.current) setLayers(rows);
  };
  const setRule = (kind: 'layer' | 'block', n: string, rule: Rule) => {
    const group = kind === 'layer' ? 'layers' : 'blocks';
    const next: Rules = { ...rules, [group]: { ...rules[group], [n]: rule } };
    setRules(next);
    setEdited((e) => new Set(e).add(`${kind}:${n}`));
    if (kind === 'block' && (rule.kind === 'explode') !== (rules.blocks[n]?.kind === 'explode'))
      void refreshLayers(next.blocks, unit);
  };
  const changeUnit = (f: number) => {
    setUnit(f);
    void refreshLayers(rules.blocks, f);
  };
  const goAlign = async () => {
    setPhase('building');
    try {
      setBuilt(await session.current!.build(rules, unit));
      setPhase('align');
    } catch {
      setError(t.errors.unknown);
      setPhase('review');
    }
  };
  const importNow = () => {
    if (!placed) return;
    onApply((d) => addBuilt(d, placed, name, replace));
    close();
    notify.success(t.done.title, t.done.body(total), 'drawing-import');
  };

  return {
    phase,
    setPhase,
    error,
    setError,
    name,
    summary,
    rules,
    edited,
    unit,
    layers,
    built,
    place,
    setPlace,
    tried,
    setTried,
    clipOn,
    setClipOn,
    replace,
    setReplace,
    context,
    area,
    counts,
    total,
    earlier: importedFrom(data, name),
    take,
    setRule,
    changeUnit,
    goAlign,
    importNow,
  };
}
