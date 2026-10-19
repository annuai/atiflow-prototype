import { useEffect, useRef, useState } from 'react';
import { Cube01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Skeleton } from '@/components/skeleton/Skeleton';
import type { NavGraph, SiteLayout } from '@/core/types';
import { Engine } from '@/engine/Engine';
import { originGizmo } from '@/engine/originGizmo';
import { webGlProblem } from '@/engine/support';
import { localized } from '@/i18n';
import { reportError } from '@/platform';
import { copy } from './copy';
import { elementsInScreenRect, onPick, outline, pickAt } from './picking';

interface Props {
  site: SiteLayout | null;
  nav: NavGraph | null;
  selectedIds: string[];
  /** Select multiple is on: a click adds or removes, a drag draws a box (Shift does the same without it) */
  multi: boolean;
  /** the place the plan was showing: the view opens on it */
  start?: { x: number; y: number; width: number } | null;
  onPick(id: string | null, additive: boolean): void;
  onBox(ids: string[], additive: boolean): void;
}

/**
 * The structure of the map in 3D, live: the same engine as the Live Floor with the map's lanes and stations, redrawn whenever the draft changes (the camera stays where it is). Click picks an
 * element and outlines it; Shift (or Select multiple) adds to the selection and a drag draws a box round elements. The engine lives while this is on screen and is freed when it is not.
 */
export function Viewport3d({ site, nav, selectedIds, multi, start, onPick: pick, onBox }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(() => webGlProblem() !== null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const live = useRef({ pick, onBox, multi });
  useEffect(() => {
    live.current = { pick, onBox, multi }; // (the listeners below read the latest callbacks)
  });
  const hasSite = !!site;

  useEffect(() => {
    const el = holder.current;
    if (noGl || !hasSite || !el) return;
    let eng: Engine;
    try {
      eng = new Engine(el);
    } catch (e) {
      reportError(e, { where: 'map-3d-engine' });
      queueMicrotask(() => setNoGl(true));
      return;
    }
    engine.current = eng;
    const off = onPick(eng, (id, additive) => live.current.pick(id, additive));
    // Select multiple / Shift: this press is a click that toggles or a box, never a turn of the view
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !(live.current.multi || e.shiftKey)) return;
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY };
      const rect = (ev: PointerEvent) => ({
        x0: start.x - r.left,
        y0: start.y - r.top,
        x1: ev.clientX - r.left,
        y1: ev.clientY - r.top,
      });
      const move = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) setBox(rect(ev));
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setBox(null);
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= 4)
          live.current.pick(pickAt(eng, ev.clientX, ev.clientY), true);
        else live.current.onBox(elementsInScreenRect(eng, start.x, start.y, ev.clientX, ev.clientY), true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    el.addEventListener('pointerdown', down, { capture: true });
    setReady(true); // eslint-disable-line react-hooks/set-state-in-effect -- the engine is an external system built in this effect; `ready` only hides the loading skeleton
    return () => {
      off();
      el.removeEventListener('pointerdown', down, { capture: true });
      eng.dispose();
      engine.current = null;
      setReady(false);
    };
  }, [hasSite, noGl]);

  const gizmo = useRef(false);
  useEffect(() => {
    const eng = engine.current;
    if (!eng || !ready || !site || !nav) return;
    eng.refreshScene(site, nav);
    if (!gizmo.current) {
      gizmo.current = true;
      const span = Math.max(site.bounds.maxX - site.bounds.minX, site.bounds.maxY - site.bounds.minY);
      eng.scene.add(originGizmo(Math.max(3, 0.1 * span))); // a tenth of the map, so it reads at any size
      if (start) eng.lookAtSite(start.x, start.y, start.width, 0.01);
    }
  }, [site, nav, ready, start]);
  const key = selectedIds.join('|');
  useEffect(() => {
    const eng = engine.current;
    if (!eng || !ready) return;
    const offs = key ? key.split('|').map((id) => outline(eng, id, site)) : [];
    return () => offs.forEach((off) => off());
  }, [key, site, ready]);

  if (noGl)
    return (
      <EmptyState icon={Cube01} title={localized('common').noWebgl.title} subtext={localized('common').noWebgl.body} />
    );
  if (!site) return <EmptyState icon={Cube01} title={copy.view3d.title} subtext={copy.view3d.empty} size="md" />;
  return (
    <>
      <div ref={holder} className="absolute inset-0" />
      {!ready && <Skeleton className="absolute inset-0 rounded-none" />}
      {box && (
        <div
          className="pointer-events-none absolute border border-dashed border-brand bg-brand-solid/10"
          style={{
            left: Math.min(box.x0, box.x1),
            top: Math.min(box.y0, box.y1),
            width: Math.abs(box.x1 - box.x0),
            height: Math.abs(box.y1 - box.y0),
          }}
        />
      )}
      <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-primary/90 px-2 py-1 text-xs text-secondary shadow-xs ring-1 ring-secondary">
        {copy.view3d.summary(site.walls.length, site.equipment.length)}
      </p>
    </>
  );
}
