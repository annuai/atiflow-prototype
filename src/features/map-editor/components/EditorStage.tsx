import type { ReactNode } from 'react';
import { MapCanvas } from '../canvas/MapCanvas';
import { SimLayer } from '../canvas/SimLayer';
import { drawMode, type Tool } from '../canvas/tools';
import type { P } from '../canvas/layers';
import type { useDrawTools } from '../canvas/useDrawTools';
import { copy } from '../copy';
import { hintFor } from '../model/hints';
import { moveStation, updateStation } from '../model/stations';
import { updateStagingArea } from '../model/staging';
import { setZoneShape } from '../model/zones';
import type { MapData, Selection } from '../model/types';
import type { useDraftEditor } from '../model/useDraftEditor';
import type { useSimulationPanel } from '../sim/useSimulationPanel';
import { DrawHint } from './DrawHint';
import { ModuleToolbar, type Module } from './ModuleToolbar';
import type { SiteLayout } from '@/core/types';

interface Props {
  site: SiteLayout;
  data: MapData;
  tool: Tool;
  editable: boolean;
  locateAt: { x: number; y: number; span: number; n: number } | null;
  selection: Selection;
  mode: 'design' | 'simulation';
  sim: ReturnType<typeof useSimulationPanel>;
  pick: (sel: Selection) => void;
  drawing: P[];
  draw: ReturnType<typeof useDrawTools>;
  editor: ReturnType<typeof useDraftEditor>;
  choices: Record<Module, string>;
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
  selection,
  mode,
  sim,
  pick,
  drawing,
  draw,
  editor,
  choices,
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
        selection={selection}
        canSelect={(s) => mode === 'design' || s.kind === 'station'}
        onSelect={mode === 'simulation' ? sim.pick : pick}
        overlay={mode === 'simulation' ? (vp) => <SimLayer vp={vp} marks={sim.marks} /> : undefined}
        drawing={drawing}
        onPoint={draw.onPoint}
        onFinish={draw.finish}
        onZoneShape={(zid, shape) => editor.edit((m) => setZoneShape(m, zid, shape), `shape:${zid}`)}
        onStationAngle={(sid, angle) => editor.edit((m) => updateStation(m, sid, { angle }), `angle:${sid}`)}
        onMove={(kind, sid, to) => editor.edit((m) => moveThing(m, kind, sid, to), `move:${kind}:${sid}`)}
      />
      {designing && tool.kind !== 'select' && (
        <DrawHint
          text={hintFor(tool, drawing.length)}
          showFinish={drawMode(tool) === 'many'}
          canFinish={drawing.length >= 2}
          onFinish={draw.finish}
          onCancel={draw.cancel}
          cancelLabel={drawing.length ? copy.hint.cancel : copy.hint.done}
        />
      )}
      {designing && <ModuleToolbar tool={tool} choices={choices} onSelect={onSelectTool} onTool={onArm} />}
    </div>
  );
}
