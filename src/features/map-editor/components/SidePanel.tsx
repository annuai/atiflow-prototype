import { Cursor01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import type { Tool } from '../canvas/tools';
import { copy } from '../copy';
import { renameRoad, updateRoad } from '../model/roads';
import { updateStagingArea } from '../model/staging';
import { moveStation, nodeOf, updateStation } from '../model/stations';
import type { MapData, Selection } from '../model/types';
import { updateZone } from '../model/zones';
import { zoneType } from '../model/zoneTypes';
import type { useSimulationPanel } from '../sim/useSimulationPanel';
import type { Module } from './ModuleToolbar';
import { RoadForm, RoutesPanel } from './RoutesPanel';
import { SimulationPanel } from './SimulationPanel';
import { StagingForm } from './StagingForm';
import { StationForm } from './StationForm';
import { StationsPanel, type StationsSub } from './StationsPanel';
import { ZoneForm, ZonesPanel } from './ZonesPanel';

type Thing = NonNullable<Selection>;
export interface SidePanelProps {
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

/** The right-hand panel of the Map Editor: the Simulation panel, or the list / form of the open module (stations and staging areas, routes, traffic gates, zones). */
export function SidePanel(p: SidePanelProps) {
  const { mode, module, data, simulation: sim } = p;
  return (
    <aside
      className="flex max-h-[45%] min-h-[260px] w-full shrink-0 flex-col border-t border-secondary bg-primary lg:max-h-none lg:min-h-0 lg:w-[300px] lg:border-t-0 lg:border-l"
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
    </aside>
  );
}
