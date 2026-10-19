import type { ReactNode } from 'react';
import { Cursor01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import type { Tool } from '../canvas/tools';
import { copy } from '../copy';
import { renameRoad, updateRoad } from '../model/roads';
import { updateStagingArea } from '../model/staging';
import { moveStation, nodeOf, updateStation } from '../model/stations';
import type { MapData, Selection } from '../model/types';
import { setZoneShape, updateZone } from '../model/zones';
import { zoneType } from '../model/zoneTypes';
import type { useSimulationPanel } from '../sim/useSimulationPanel';
import type { Module } from './ModuleToolbar';
import { RoadForm, RoutesPanel } from './RoutesPanel';
import { RouteForm } from './RouteForm';
import { ElementForm } from '../structure-ui/ElementForm';
import { MultiPanel } from '../structure-ui/MultiPanel';
import { StructurePanel } from '../structure-ui/StructurePanel';
import { elementOf } from '../model/structure/ops';
import { SimulationPanel } from './SimulationPanel';
import { StagingForm } from './StagingForm';
import { StationForm } from './StationForm';
import { StationsPanel, type StationsSub } from './StationsPanel';
import { ZoneForm, ZonesPanel } from './ZonesPanel';

type Thing = NonNullable<Selection>;
export interface SidePanelProps {
  /** shown under the list or form of the open module (the DWG panel in the 3D view) */
  footer?: ReactNode;
  mode: 'design' | 'simulation';
  module: Module | null;
  data: MapData;
  /** the shown version is the draft (everything is editable) */
  editable: boolean;
  tool: Tool;
  selection: Selection;
  sub: StationsSub;
  simulation: ReturnType<typeof useSimulationPanel>;
  /** workflows that use a station */
  usedBy(stationId: string): string[];
  /** change the draft */
  edit(fn: (d: MapData) => MapData, key?: string): void;
  onBack(): void;
  onSub(sub: StationsSub): void;
  /** look at / edit one thing: the select tool and the panel of that kind of thing */
  onPick(sel: Selection): void;
  /** arm a tool of a module (with a choice from its menu) */
  onArm(module: Module, choice?: string): void;
  /** arm the tool that places an imported station that has no position yet */
  onPlace(stationId: string): void;
  /** point-to-point (v2) maps: start a route at this station (the next click on a station ends it) */
  onRouteFrom(stationId: string): void;
  /** stop drawing: the select tool, nothing half drawn */
  onStopDrawing(): void;
  onDelete(what: Thing): void;
  onLocate(kind: Thing['kind'], id: string): void;
}

const title = (p: SidePanelProps) =>
  p.mode === 'simulation' ? copy.sim.title : p.module ? copy.panelTitle[p.module] : copy.noTool.heading;

/** The list or the form of the Stations module (stations, staging areas). */
function StationsSection(p: SidePanelProps) {
  const { data, editable, tool, selection } = p;
  const station = selection?.kind === 'station' ? data.stations.find((s) => s.id === selection.id) : undefined;
  const stationAt = station ? nodeOf(data, station) : undefined;
  const area = selection?.kind === 'staging' ? data.stagingAreas.find((a) => a.id === selection.id) : undefined;
  const adding = tool.kind === 'station' || tool.kind === 'staging';
  if (station && stationAt)
    return (
      <StationForm
        onLocate={() => p.onLocate('station', station.id)}
        station={station}
        data={data}
        at={{ x: stationAt.x, y: stationAt.y }}
        usedBy={p.usedBy(station.id)}
        editable={editable}
        onBack={p.onBack}
        onPatch={(patch) => p.edit((m) => updateStation(m, station.id, patch))}
        onMove={(to) => p.edit((m) => moveStation(m, station.id, to))}
        onPlace={() => p.onPlace(station.id)}
        onRouteFrom={() => p.onRouteFrom(station.id)}
        onDelete={() => p.onDelete({ kind: 'station', id: station.id })}
      />
    );
  if (area)
    return (
      <StagingForm
        onLocate={() => p.onLocate('staging', area.id)}
        area={area}
        data={data}
        editable={editable}
        onBack={p.onBack}
        onPatch={(patch) => p.edit((m) => updateStagingArea(m, area.id, patch))}
        onDelete={() => p.onDelete({ kind: 'staging', id: area.id })}
      />
    );
  return (
    <StationsPanel
      data={data}
      editable={editable}
      adding={adding}
      sub={p.sub}
      onSub={(s) => {
        p.onSub(s);
        if (adding) p.onArm('stations', s === 'staging' ? 'staging' : 'station');
      }}
      selectedId={selection?.id ?? null}
      onSelect={(sid) => p.onPick({ kind: p.sub === 'stations' ? 'station' : 'staging', id: sid })}
      onAdd={() => p.onArm('stations', p.sub === 'staging' ? 'staging' : 'station')}
      onCancelAdd={p.onStopDrawing}
    />
  );
}

/** The list or the form of the Routes module. */
function RoutesSection(p: SidePanelProps) {
  const { data, editable, tool, selection } = p;
  const road = selection?.kind === 'road' ? data.roads.find((r) => r.id === selection.id) : undefined;
  if (road && data.p2p)
    return (
      <RouteForm
        road={road}
        data={data}
        node={selection?.node}
        editable={editable}
        onBack={p.onBack}
        onLocate={() => p.onLocate('road', road.id)}
        onDelete={() => p.onDelete({ kind: 'road', id: road.id })}
        edit={p.edit}
        onPick={p.onPick}
      />
    );
  if (road)
    return (
      <RoadForm
        onLocate={() => p.onLocate('road', road.id)}
        road={road}
        data={data}
        editable={editable}
        onBack={p.onBack}
        onRename={(name) => p.edit((m) => renameRoad(m, road.id, name))}
        onPatch={(patch) => p.edit((m) => updateRoad(m, road.id, patch))}
        onDelete={() => p.onDelete({ kind: 'road', id: road.id })}
      />
    );
  return (
    <RoutesPanel
      data={data}
      editable={editable}
      drawing={tool.kind === 'road'}
      onDraw={() => p.onArm('routes')}
      onStop={p.onStopDrawing}
      selectedId={selection?.id ?? null}
      onSelect={(rid) => p.onPick({ kind: 'road', id: rid })}
    />
  );
}

/** The list or the form of the Traffic Gates and Zones modules. */
function ZonesSection(p: SidePanelProps & { module: 'exclusive' | 'zones' }) {
  const { data, editable, selection, module } = p;
  const zone = selection?.kind === 'zone' ? data.zones.find((z) => z.id === selection.id) : undefined;
  if (zone && zoneType(zone.type).module === module)
    return (
      <ZoneForm
        onLocate={() => p.onLocate('zone', zone.id)}
        zone={zone}
        data={data}
        module={module}
        editable={editable}
        onBack={p.onBack}
        onPatch={(patch) => p.edit((m) => updateZone(m, zone.id, patch))}
        onShape={(shape) => p.edit((m) => setZoneShape(m, zone.id, shape))}
        onDelete={() => p.onDelete({ kind: 'zone', id: zone.id })}
      />
    );
  return (
    <ZonesPanel
      module={module}
      data={data}
      editable={editable}
      onAdd={(choice) => p.onArm(module, choice)}
      selectedId={selection?.id ?? null}
      onSelect={(zid) => p.onPick({ kind: 'zone', id: zid })}
    />
  );
}

/** The list or the form of the Structure module (elements, sections). */
function StructureSection(p: SidePanelProps) {
  const { data, editable, selection } = p;
  const element = selection?.kind === 'element' ? elementOf(data, selection.id) : undefined;
  if (selection?.kind === 'element' && selection.ids && selection.ids.length > 1)
    return (
      <MultiPanel
        data={data}
        ids={selection.ids}
        editable={editable}
        edit={p.edit}
        onClear={p.onBack}
        onDelete={() => p.onDelete({ kind: 'element', id: selection.id, ids: selection.ids })}
      />
    );
  if (element)
    return (
      <ElementForm
        element={element}
        data={data}
        editable={editable}
        edit={p.edit}
        onBack={p.onBack}
        onLocate={() => p.onLocate('element', element.id)}
        onPick={(id) => p.onPick({ kind: 'element', id })}
        onDelete={() => p.onDelete({ kind: 'element', id: element.id })}
      />
    );
  return (
    <StructurePanel
      data={data}
      editable={editable}
      selectedId={null}
      onSelect={(id) => p.onPick({ kind: 'element', id })}
      edit={p.edit}
    />
  );
}

/** The right-hand panel of the Map Editor: the Simulation panel, or the list / form of the open module (stations and staging areas, routes, traffic gates, zones). */
export function SidePanel(p: SidePanelProps) {
  const { mode, module, data, simulation: sim } = p;
  return (
    <aside
      className="flex max-h-[45%] min-h-[260px] w-full shrink-0 flex-col border-t border-secondary bg-primary lg:max-h-none lg:min-h-0 lg:w-[300px] lg:pointer-coarse:w-[340px] lg:border-t-0 lg:border-l"
      aria-label={mode === 'simulation' ? copy.sim.title : module ? copy.panelTitle[module] : copy.noTool.title}
    >
      <h2 className="border-b border-secondary px-4 py-4 text-md font-semibold text-primary">{title(p)}</h2>
      {mode === 'simulation' && (
        <SimulationPanel
          data={data}
          choice={sim.choice}
          onChoice={sim.setChoice}
          state={sim.trip.state}
          error={sim.error}
          onRun={sim.run}
          onStop={sim.trip.stop}
        />
      )}
      {mode === 'design' && !module && (
        <EmptyState
          icon={Cursor01}
          title={copy.noTool.title}
          subtext={copy.noTool.subtext}
          size="sm"
          className="mt-8"
        />
      )}
      {mode === 'design' && module === 'stations' && <StationsSection {...p} />}
      {mode === 'design' && module === 'routes' && <RoutesSection {...p} />}
      {mode === 'design' && (module === 'exclusive' || module === 'zones') && <ZonesSection {...p} module={module} />}
      {mode === 'design' && module === 'structure' && <StructureSection {...p} />}
      {p.footer && (
        <details className="max-h-[55%] shrink-0 overflow-y-auto border-t border-secondary">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">
            {copy.view3d.dwgSection.title}
          </summary>
          {p.footer}
        </details>
      )}
    </aside>
  );
}
