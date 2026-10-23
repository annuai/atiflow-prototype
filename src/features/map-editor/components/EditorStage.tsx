import type { ReactNode } from 'react';
import { MapCanvas } from '../canvas/MapCanvas';
import { SimLayer } from '../canvas/SimLayer';
import { drawMode, type Tool } from '../canvas/tools';
import type { P } from '../canvas/layers';
import type { useDrawTools } from '../canvas/useDrawTools';
import { copy } from '../copy';
import { hintFor } from '../model/hints';
import { setParams, setThreePointTurn } from '../model/approach/nodes';
import { addRouteNode, moveRouteNode } from '../model/routes';
import { insertPoint, moveElements, setBox, setPoint, setPoints } from '../model/structure/ops';
import { moveStation, updateStation } from '../model/stations';
import { updateStagingArea } from '../model/staging';
import { setZoneShape } from '../model/zones';
import type { MapData, Selection } from '../model/types';
import type { useDraftEditor } from '../model/useDraftEditor';
import type { useSimulationPanel } from '../sim/useSimulationPanel';
import { ViewSwitch } from './ViewSwitch';
import { DrawHint } from './DrawHint';
import { ModuleToolbar, type Module } from './ModuleToolbar';
import type { SiteLayout } from '@/core/types';

interface Props {
  site: SiteLayout;
  data: MapData;
  tool: Tool;
  editable: boolean;
  locateAt: { x: number; y: number; span: number; n: number } | null;
  /** the Locate button of the zoom controls: set while something is selected, so it is disabled otherwise */
  onLocateSelected?: () => void;
  selection: Selection;
  mode: 'design' | 'simulation';
  sim: ReturnType<typeof useSimulationPanel>;
  pick: (sel: Selection) => void;
  drawing: P[];
  draw: ReturnType<typeof useDrawTools>;
  editor: ReturnType<typeof useDraftEditor>;
  choices: Record<Module, string>;
  /** the Structure module is open */
  structureOpen: boolean;
  /** Select multiple (a button of the tool bar): clicks toggle elements, dragging the floor draws a selection box */
  multi: boolean;
  onView(v: '2d' | '3d'): void;
  onMarquee(a: P, b: P, additive: boolean): void;
  onSelectTool: () => void;
  onArm: (m: Module, choice?: string) => void;
}

/** A dragged station or staging area lands here: one undo step per thing dragged. */
const moveThing = (m: MapData, kind: 'station' | 'staging', id: string, to: { x: number; y: number }) =>
  kind === 'station'
    ? moveStation(m, id, to)
    : updateStagingArea(m, id, { x: Math.round(to.x * 100) / 100, y: Math.round(to.y * 100) / 100 });

/** The map with its drawing hint and tool bar (the middle of the Map Editor page). */
export function EditorStage({
  site,
  data,
  tool,
  editable,
  locateAt,
  onLocateSelected,
  selection,
  mode,
  sim,
  pick,
  drawing,
  draw,
  editor,
  choices,
  structureOpen,
  multi,
  onMarquee,
  onView,
  onSelectTool,
  onArm,
}: Props): ReactNode {
  const designing = mode === 'design';
  return (
    <div className="relative min-h-[360px] min-w-0 flex-1">
      <MapCanvas
        site={site}
        data={data}
        tool={tool}
        editable={editable}
        locate={locateAt}
        onLocateSelected={onLocateSelected}
        selection={selection}
        canSelect={(s) => mode === 'design' || s.kind === 'station'}
        onSelect={mode === 'simulation' ? sim.pick : pick}
        overlay={mode === 'simulation' ? (vp) => <SimLayer vp={vp} marks={sim.marks} /> : undefined}
        drawing={drawing}
        onPoint={draw.onPoint}
        structureOpen={structureOpen && designing}
        elementsPickable={designing}
        multi={multi && structureOpen}
        onMarquee={onMarquee}
        onElementMove={(id, dx, dy) => {
          const set = selection?.kind === 'element' && selection.ids?.includes(id) ? selection.ids : [id];
          editor.edit((m) => moveElements(m, set, dx, dy), `elem:${set.join()}`);
        }}
        onElementPoint={(id, i, to) => editor.edit((m) => setPoint(m, id, i, to), `point:${id}:${i}`)}
        onElementPoints={(id, pts) => editor.edit((m) => setPoints(m, id, pts), `pts:${id}`)}
        onElementBox={(id, b) => editor.edit((m) => setBox(m, id, b), `box:${id}`)}
        onElementAddPoint={(id, at) => {
          const r = insertPoint(data, id, at);
          if (r.index < 0) return;
          editor.edit(() => r.data);
        }}
        onRouteNodeSelect={(rid, index) => pick({ kind: 'road', id: rid, node: index })}
        onRouteNodeMove={(rid, index, to) =>
          editor.edit((m) => moveRouteNode(m, rid, index, to), `node:${rid}:${index}`)
        }
        onRouteNodeAdd={(rid, at) => {
          const r = addRouteNode(data, rid, at);
          if (r.index < 0) return;
          editor.edit(() => r.data);
          pick({ kind: 'road', id: rid, node: r.index });
        }}
        onFinish={draw.finish}
        onZoneShape={(zid, shape) => editor.edit((m) => setZoneShape(m, zid, shape), `shape:${zid}`)}
        onStagingChange={(id, patch) => editor.edit((m) => updateStagingArea(m, id, patch), `stg:${id}`)}
        onThreePointBox={(sid, patch) => editor.edit((m) => setThreePointTurn(m, sid, patch), `turn:${sid}`)}
        onApproachParams={(sid, node, slot, params) =>
          editor.edit((m) => setParams(m, sid, node, slot, params), `approach:${sid}:${node}:${slot}`)
        }
        onStationAngle={(sid, angle) => editor.edit((m) => updateStation(m, sid, { angle }), `angle:${sid}`)}
        onMove={(kind, sid, to) => editor.edit((m) => moveThing(m, kind, sid, to), `move:${kind}:${sid}`)}
      />
      {designing && tool.kind !== 'select' && (
        <DrawHint
          text={hintFor(tool, drawing.length, data.p2p)}
          showFinish={drawMode(tool) === 'many' && !(data.p2p && tool.kind === 'road')}
          canFinish={drawing.length >= 2}
          onFinish={draw.finish}
          onCancel={draw.cancel}
          cancelLabel={drawing.length ? copy.hint.cancel : copy.hint.done}
        />
      )}
      {designing && <ViewSwitch view="2d" onView={onView} />}
      {designing && <ModuleToolbar tool={tool} choices={choices} onSelect={onSelectTool} onTool={onArm} />}
    </div>
  );
}
