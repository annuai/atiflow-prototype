import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { gestureBusy, useTouchGestures } from '@/components/map/useTouchGestures';
import { nearestNode } from '../model/roads';
import type { MapData, Selection } from '../model/types';
import type { P } from './layers';
import { drawMode, type Tool } from './tools';
import type { useViewport } from './useViewport';

type Vp = ReturnType<typeof useViewport>;
export interface PointerToolsInput {
  vp: Vp;
  tool: Tool;
  editable: boolean;
  nodes: MapData['nodes'];
  /** what is selected now: when several things lie under a click (routes that share a corridor), the selected one stays selected, so its nodes can be added and dragged */
  selection?: Selection;
  canSelect(sel: NonNullable<Selection>): boolean;
  onSelect(sel: Selection, opts?: { keepTool?: boolean; additive?: boolean }): void;
  /** Dragging on the empty floor draws a selection box instead of panning (Select multiple is on, or Shift is held) */
  boxSelect?: boolean;
  multi?: boolean;
  /** the box is released: its corners in site coordinates */
  onMarquee?(a: P, b: P, additive: boolean): void;
  /** a point-to-point (v2) map: with the Routes tool armed a station is the end of a route, not a thing to select or move (Shift / Alt-click still selects it) */
  p2p?: boolean;
  /** the points of the shape being drawn so far (Shift straightens the next segment from the last one) */
  drawing?: P[];
  onPoint(p: P): void;
  onMove(kind: 'station' | 'staging', id: string, to: { x: number; y: number }): void;
}

/**
 * What a pointer does on the map: drag the floor to pan (or two fingers to pan and zoom), click to select or to place a point of the open tool (snapping road ends to existing nodes),
 * drag a station or staging area of a draft. All the pointer state (the press, the drag, the cursor) lives here; the map only draws.
 */
export function usePointerTools({
  vp,
  tool,
  editable,
  nodes,
  selection,
  p2p,
  drawing = [],
  boxSelect,
  multi,
  onMarquee,
  canSelect,
  onSelect,
  onPoint,
  onMove,
}: PointerToolsInput) {
  const mode = drawMode(tool);
  const [cursor, setCursor] = useState<P | null>(null);
  const touch = useTouchGestures(vp.el, { zoomAt: vp.zoomAt, panBy: vp.panBy });
  const press = useRef<{ x: number; y: number; moved: boolean; box?: P; shift?: boolean; button: number } | null>(null);
  const [box, setBox] = useState<{ a: P; b: P } | null>(null);
  const dragging = useRef<{ kind: 'station' | 'staging'; id: string; dx: number; dy: number } | null>(null);

  const snap = (p: P): P => {
    if (tool.kind !== 'road') return p;
    const n = nearestNode(nodes, p[0], p[1], 12 * vp.u);
    return n ? [n.x, n.y] : p;
  };
  /** Where the pointer aims: with Shift held while drawing a line, the segment from the last point snaps to the nearest 45 degrees (so a wall, route or gate is straight); otherwise a road end snaps to a node near it. */
  const lineTool = mode === 'many' || (tool.kind === 'gate' && tool.shape === 'line');
  const aim = (p: P, shift: boolean): P => {
    if (!(shift && lineTool && drawing.length)) return snap(p);
    const a = drawing[drawing.length - 1];
    const dx = p[0] - a[0],
      dy = p[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return p;
    const raw = Math.atan2(dy, dx);
    const ang = Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);
    const along = d * Math.cos(raw - ang); // the pointer's distance projected onto the straight direction
    return [a[0] + along * Math.cos(ang), a[1] + along * Math.sin(ang)];
  };
  const lastRaw = useRef<P | null>(null);
  useEffect(() => {
    // pressing or letting go of Shift straightens the preview at once, without moving the mouse
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && lastRaw.current && lineTool && drawing.length)
        setCursor(aim(lastRaw.current, e.type === 'keydown'));
    };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', on);
    return () => {
      window.removeEventListener('keydown', on);
      window.removeEventListener('keyup', on);
    };
  });
  const hit = (x: number, y: number): Selection => {
    const found: NonNullable<Selection>[] = [];
    for (const el of document.elementsFromPoint(x, y)) {
      const h = (el as Element).getAttribute?.('data-hit');
      if (!h) continue;
      const [kind, ...id] = h.split(':');
      const sel = { kind, id: id.join(':') } as NonNullable<Selection>;
      if (canSelect(sel)) found.push(sel);
    }
    const keep = found.find((f) => f.kind === selection?.kind && f.id === selection.id);
    return keep ? { kind: keep.kind, id: keep.id } : (found[0] ?? null);
  };

  const down = (e: ReactPointerEvent) => {
    const from = vp.toSite(e.clientX, e.clientY);
    press.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      shift: e.shiftKey,
      button: e.button,
      // (the middle button always pans, whatever Select multiple says)
      ...(boxSelect && e.button === 0 && (multi || e.shiftKey) ? { box: [from.x, from.y] as P } : {}),
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (touch.current.pinching) {
      if (press.current) Object.assign(press.current, { x: e.clientX, y: e.clientY, moved: true });
      return; // two fingers: the pinch handles it
    }
    const at = vp.toSite(e.clientX, e.clientY);
    lastRaw.current = [at.x, at.y];
    setCursor(aim([at.x, at.y], e.shiftKey));
    const d = dragging.current;
    if (d) {
      onMove(d.kind, d.id, { x: at.x + d.dx, y: at.y + d.dy });
      return;
    }
    const p = press.current;
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    p.moved = true;
    if (p.box) {
      setBox({ a: p.box, b: [at.x, at.y] });
      return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    vp.panBy(dx, dy);
  };
  const up = (e: ReactPointerEvent) => {
    if (gestureBusy(touch.current)) {
      press.current = null;
      dragging.current = null;
      return; // a finger lifting after a pinch is not a tap
    }
    const p = press.current;
    press.current = null;
    const was = dragging.current;
    dragging.current = null;
    if (p?.box && p.moved) {
      const end = vp.toSite(e.clientX, e.clientY);
      setBox(null);
      onMarquee?.(p.box, [end.x, end.y], !!(p.shift || multi));
      return;
    }
    if (was || !p || p.moved || p.button !== 0) return; // only the main button clicks
    if (mode !== 'none') {
      if (editable) {
        const at = vp.toSite(e.clientX, e.clientY);
        onPoint(aim([at.x, at.y], e.shiftKey));
      }
      return;
    }
    onSelect(hit(e.clientX, e.clientY), { additive: !!(p.shift || multi) });
  };
  /** A press on a station or staging area: select it, and (on a draft, with no drawing tool) start dragging it. */
  const startDrag = (e: ReactPointerEvent, kind: 'station' | 'staging', id: string, x: number, y: number) => {
    e.stopPropagation();
    if (kind === 'station' && p2p && tool.kind === 'road') {
      if (e.shiftKey || e.altKey) onSelect({ kind, id }, { keepTool: true });
      else onPoint([x, y]); // the station is where a route starts or ends
      return;
    }
    onSelect({ kind, id });
    if (!editable || mode !== 'none') return;
    const at = vp.toSite(e.clientX, e.clientY);
    dragging.current = { kind, id, dx: x - at.x, dy: y - at.y };
    (e.currentTarget as SVGGElement).ownerSVGElement?.setPointerCapture(e.pointerId);
  };
  /** The pointer was released on a marker: the drag ends there (and the press must not reach the map). */
  const endDrag = (e: ReactPointerEvent) => {
    e.stopPropagation();
    dragging.current = null;
  };
  return {
    mode,
    cursor,
    box,
    leave: () => setCursor(null),
    down,
    move,
    up,
    startDrag,
    endDrag,
  };
}
