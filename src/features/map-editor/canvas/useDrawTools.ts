import { useEffect } from 'react';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { addRoad } from '../model/roads';
import { addStagingArea } from '../model/staging';
import { addStation, moveStation } from '../model/stations';
import type { MapData, Selection } from '../model/types';
import { newGate, rectFromCorners } from '../model/shape';
import { addZone } from '../model/zones';
import type { P } from './layers';
import { drawMode, SELECT, type Tool } from './tools';

export interface DrawToolsInput {
  data: MapData | undefined;
  /** the lane-map fleet of the open map (new roads and stations belong to it) */
  fleetLive: string | undefined;
  tool: Tool;
  /** the points clicked so far for the shape being drawn */
  drawing: P[];
  setDrawing(next: P[] | ((d: P[]) => P[])): void;
  setSelection(sel: Selection): void;
  setTool(tool: Tool): void;
  edit(fn: (d: MapData) => MapData): void;
  /** station ids and staging-area ids already used by any map (a new one gets the next free id) */
  takenStations: string[];
  takenAreas: string[];
}

/** What a click on the map does for the armed tool: place a station or staging area, add a point to a road or zone, close a gate; and how a road or zone is finished or cancelled. */
export function useDrawTools(i: DrawToolsInput) {
  const { data, fleetLive, tool, drawing, setDrawing, setSelection, setTool, edit } = i;

  const onPoint = (p: P) => {
    if (!data || fleetLive === undefined) return;
    if (tool.kind === 'place') {
      edit((m) => moveStation(m, tool.id, { x: p[0], y: p[1] }));
      setSelection({ kind: 'station', id: tool.id });
      setTool(SELECT);
      return;
    }
    if (tool.kind === 'station') {
      const r = addStation(data, fleetLive, { x: p[0], y: p[1] }, i.takenStations);
      edit(() => r.data);
      setSelection({ kind: 'station', id: r.id });
      return;
    }
    if (tool.kind === 'staging') {
      const r = addStagingArea(data, { x: p[0], y: p[1] }, i.takenAreas);
      edit(() => r.data);
      setSelection({ kind: 'staging', id: r.id });
      return;
    }
    if (tool.kind === 'gate' || tool.kind === 'zone') {
      if (!drawing.length) {
        setDrawing([p]);
        return;
      }
      if (Math.hypot(p[0] - drawing[0][0], p[1] - drawing[0][1]) < 0.3) return;
      const line = tool.kind === 'gate' && tool.shape === 'line';
      const shape = line ? newGate(drawing[0], p) : rectFromCorners(drawing[0], p);
      const r =
        tool.kind === 'zone'
          ? addZone(data, tool.type, shape)
          : addZone(
              data,
              'exclusive',
              shape,
              {},
              `${line ? copy.zones.gateLine : copy.zones.gateBox} ${data.zones.filter((z) => z.type === 'exclusive').length + 1}`,
            );
      edit(() => r.data);
      setDrawing([]);
      setSelection({ kind: 'zone', id: r.id });
      return;
    }
    setDrawing((d) =>
      d.length && Math.hypot(p[0] - d[d.length - 1][0], p[1] - d[d.length - 1][1]) < 0.05 ? d : [...d, p],
    );
  };

  const finish = () => {
    if (!data || fleetLive === undefined) return;
    if (tool.kind === 'road') {
      const r = addRoad(data, drawing, { oneWay: tool.oneWay, fleetLive });
      if (!r.id) {
        notify.warning(copy.routes.tooShort, undefined, 'road-short');
        return;
      }
      edit(() => r.data);
      setDrawing([]);
      setSelection({ kind: 'road', id: r.id });
    }
  };
  /** Esc: drop the half drawn shape, or (when there is none) leave the tool. */
  const cancel = () => {
    if (drawing.length) setDrawing([]);
    else setTool({ kind: 'select' });
  };
  return { onPoint, finish, cancel };
}

/**
 * Keyboard shortcuts of the editor: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo (draft in Design mode only), Esc cancels the tool, Enter finishes a road, arrows / Delete act on the selected zone.
 * Ignored while typing in a field. Registered again each render because it reads the current drawing and tool.
 */
export function useEditorShortcuts(o: {
  tool: Tool;
  canEdit: boolean;
  undo(): void;
  redo(): void;
  cancel(): void;
  finish(): void;
  /** The selected zone of a draft: arrow keys move it (0.1 m, Shift 1 m), Delete asks to remove it. */
  zone?: { nudge(dx: number, dy: number): void; remove(): void };
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && o.canEdit && (k === 'z' || k === 'y')) {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) o.redo();
        else o.undo();
        return;
      }
      if (o.zone && o.canEdit) {
        const step = e.shiftKey ? 1 : 0.1;
        const arrow: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        };
        if (arrow[e.key]) {
          e.preventDefault();
          o.zone.nudge(...arrow[e.key]);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          o.zone.remove();
          return;
        }
      }
      if (e.key === 'Escape' && o.tool.kind !== 'select') o.cancel();
      else if (e.key === 'Enter' && drawMode(o.tool) === 'many') o.finish();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
}
