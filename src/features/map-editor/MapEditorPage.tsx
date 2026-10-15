import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Button } from '@/components/base/buttons/button';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { Cursor01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useAuth } from '@/features/auth/authStore';
import { useMap } from '@/features/maps/model/maps';
import { useMapData } from '@/features/workflow-builder/model/stations';
import { useWorkflow } from '@/features/workflow-builder/model/store';
import { notify } from '@/ui/toast';
import { MapCanvas } from './canvas/MapCanvas';
import { DEFAULT_CHOICE, drawMode, minPoints, SELECT, toolFor, type Tool } from './canvas/tools';
import { DrawHint } from './components/DrawHint';
import { EditorHeader } from './components/EditorHeader';
import { ModuleToolbar, type Module } from './components/ModuleToolbar';
import { PublishDialog } from './components/PublishDialog';
import { RoadForm, RoutesPanel } from './components/RoutesPanel';
import { StagingForm } from './components/StagingForm';
import { StationForm } from './components/StationForm';
import { StationsPanel, type StationsSub } from './components/StationsPanel';
import { SimulationPanel, type SimChoice } from './components/SimulationPanel';
import { VersionHistory } from './components/VersionHistory';
import { SimLayer } from './canvas/SimLayer';
import { locateTarget } from './model/locate';
import { planTrip } from './model/simulate';
import { useTripSimulation } from './sim/tripSim';
import { ROBOT_TYPES } from '@/data/robotTypes';
import { ZoneForm, ZonesPanel } from './components/ZonesPanel';
import { copy } from './copy';
import { cellStatesFromMasterData } from './model/cellStates';
import { emptyHistory, record, redo as redoStep, undo as undoStep, type History } from './model/history';
import { addRoad, deleteRoad, renameRoad, updateRoad } from './model/roads';
import { seedMapData } from './model/seed';
import { addStagingArea, deleteStagingArea, updateStagingArea } from './model/staging';
import { addStation, deleteStation, moveStation, nodeOf, updateStation } from './model/stations';
import { draftOf, latestOf, mapVersionsStore, useMapVersions } from './model/store';
import type { MapData, Selection } from './model/types';
import { workflowsUsing } from './model/usage';
import { publishProblems } from './model/validate';
import { addZone, boxPolygon, deleteZone, gatePolygon, updateZone } from './model/zones';
import { zoneType } from './model/zoneTypes';

type P = [number, number];
/**
 * The Map Editor (`/configurator/maps/:id`). A published version can only be looked at; "Edit as draft" makes the one draft, saved as you edit and turned into the next version by Publish.
 * The four modules float at the bottom of the map (Stations with staging areas, Routes, Traffic Gates, Zones): opening one puts its tool on the map and its panel on the right at once.
 */
export function MapEditorPage() {
  const { id = '' } = useParams(); const map = useMap(id); const user = useAuth((s) => s.user)!; const base = useMapData();
  const history = useMapVersions((s) => s.byMap[id]); const allMaps = useMapVersions((s) => s.byMap); const workflows = useWorkflow((s) => s.workflows);
  const [viewing, setViewing] = useState<'draft' | number | null>(null); const [module, setModule] = useState<Module | null>(null); const [sub, setSub] = useState<StationsSub>('stations');
  const [wantTool, setTool] = useState<Tool>(SELECT); const [selection, setSelection] = useState<Selection>(null); const [drawing, setDrawing] = useState<P[]>([]); const [choices, setChoices] = useState<Record<Module, string>>(DEFAULT_CHOICE);
  const [mode, setMode] = useState<'design' | 'simulation'>('design'); const [simChoice, setSimChoice] = useState<SimChoice>({ type: ROBOT_TYPES[0].label, start: '', end: '' }); const [simError, setSimError] = useState(''); const trip = useTripSimulation();
  const [historyOpen, setHistoryOpen] = useState(false); const [publishOpen, setPublishOpen] = useState(false); const [deleting, setDeleting] = useState<NonNullable<Selection> | null>(null); const [updating, setUpdating] = useState(false);
  // the first published version of a map is made from the real site and lane map, once
  useEffect(() => { if (map && base) mapVersionsStore.getState().ensure(map.id, map.version, seedMapData(map, base.site, base.nav)); }, [map, base]);
  const draft = draftOf(history), latest = latestOf(history);
  const current = viewing === 'draft' ? draft : typeof viewing === 'number' ? history?.versions.find((v) => v.number === viewing && v.status === 'published') : (draft ?? latest);
  const data: MapData | undefined = current?.data; const isDraft = current?.status === 'draft'; const fleetName = map ? fleetDirectory.byLiveId(map.fleetLive)?.name : undefined;
  const tool: Tool = isDraft && mode === 'design' ? wantTool : SELECT;                                                              // a published version only allows looking
  const taken = useMemo(() => base?.nav.stations.map((s) => s.id) ?? [], [base]);
  const takenAreas = useMemo(() => Object.values(allMaps).flatMap((h) => h.versions.flatMap((v) => v.data.stagingAreas.map((a) => a.id))), [allMaps]);          // an area id means one area in every map
  const usedBy = (sid: string) => workflowsUsing(Object.values(workflows), fleetName, sid);
  const [locateAt, setLocateAt] = useState<{ x: number; y: number; span: number; n: number } | null>(null);
  const hist = useRef<History<MapData>>(emptyHistory()); const [, bump] = useState(0);
  const liveDraft = () => draftOf(mapVersionsStore.getState().byMap[id])?.data;
  /** Change the draft; every change is an undo step (changes with the same `key` in quick succession, such as dragging, are one step). */
  const edit = (fn: (d: MapData) => MapData, key?: string) => {
    const cur = liveDraft(); if (!cur) return; const next = fn(cur); if (next === cur) return;
    hist.current = record(hist.current, cur, key, Date.now()); mapVersionsStore.getState().updateDraft(id, () => next); bump((n) => n + 1);
  };
  const undo = () => { const cur = liveDraft(); const r = cur && undoStep(hist.current, cur); if (!r) return; hist.current = r.history; mapVersionsStore.getState().updateDraft(id, () => r.value); setDrawing([]); bump((n) => n + 1); };
  const redo = () => { const cur = liveDraft(); const r = cur && redoStep(hist.current, cur); if (!r) return; hist.current = r.history; mapVersionsStore.getState().updateDraft(id, () => r.value); setDrawing([]); bump((n) => n + 1); };
  useEffect(() => { setSelection(null); setDrawing([]); trip.stop(); setSimError(''); hist.current = emptyHistory(); }, [current?.id]);

  /** Arm a drawing tool: the module's panel opens and the next click on the map draws (with this choice, which is remembered for the module). Tools stay armed until Esc or Select. */
  const arm = (m: Module, choice: string = choices[m]) => {
    setModule(m); setSelection(null); setDrawing([]); setChoices((c) => ({ ...c, [m]: choice })); if (m === 'stations') setSub(choice === 'staging' ? 'staging' : 'stations');
    if (!isDraft) { notify.info(copy.banner.published(current?.number ?? 0), copy.stations.readOnly, 'map-readonly'); return; }
    setTool(toolFor(m, choice));
  };
  const selectTool = () => { setTool(SELECT); setDrawing([]); };
  /** Look at / edit one thing (from the list or the map): the select tool, and the panel of that kind of thing. */
  const pick = (sel: Selection) => {
    setTool(SELECT); setDrawing([]); setSelection(sel); if (!sel || !data) return;
    if (sel.kind === 'station') { setModule('stations'); setSub('stations'); } else if (sel.kind === 'staging') { setModule('stations'); setSub('staging'); } else if (sel.kind === 'road') setModule('routes');
    else setModule(zoneType(data.zones.find((z) => z.id === sel.id)?.type ?? '').module === 'exclusive' ? 'exclusive' : 'zones');
  };
  const cancel = () => { if (drawing.length) setDrawing([]); else setTool(SELECT); };
  const finish = () => {
    if (!data || !map) return;
    if (tool.kind === 'road') { const r = addRoad(data, drawing, { oneWay: tool.oneWay, fleetLive: map.fleetLive }); if (!r.id) { notify.warning(copy.routes.tooShort, undefined, 'road-short'); return; } edit(() => r.data); setDrawing([]); setSelection({ kind: 'road', id: r.id }); }
    else if (tool.kind === 'zone' && drawing.length >= 3) { const r = addZone(data, tool.type, drawing); edit(() => r.data); setDrawing([]); setSelection({ kind: 'zone', id: r.id }); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && isDraft && mode === 'design' && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) { e.preventDefault(); (e.key.toLowerCase() === 'y' || e.shiftKey) ? redo() : undo(); return; }
      if (e.key === 'Escape' && tool.kind !== 'select') cancel(); else if (e.key === 'Enter' && drawMode(tool) === 'many') finish(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });                                                                                                           // (re-registered each render: it reads the current drawing and tool)
  if (!map) return <Navigate to="/configurator/maps" replace />;
  if (!base || !data || !current) return (
    <div className="content"><div className="builder md-card"><div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading the map"><Skeleton className="h-8 w-72" /><Skeleton className="h-10 w-full" /><Skeleton className="h-[420px] w-full" /></div></div></div>
  );
  const onPoint = (p: P) => {
    if (tool.kind === 'station') { const r = addStation(data, map.fleetLive, { x: p[0], y: p[1] }, taken); edit(() => r.data); setSelection({ kind: 'station', id: r.id }); return; }
    if (tool.kind === 'staging') { const r = addStagingArea(data, { x: p[0], y: p[1] }, takenAreas); edit(() => r.data); setSelection({ kind: 'staging', id: r.id }); return; }
    if (tool.kind === 'gate') {
      if (!drawing.length) { setDrawing([p]); return; } if (Math.hypot(p[0] - drawing[0][0], p[1] - drawing[0][1]) < 0.3) return;
      const poly = tool.shape === 'box' ? boxPolygon(drawing[0], p) : gatePolygon(drawing[0], p); const r = addZone(data, 'exclusive', poly, { shape: tool.shape }, `${tool.shape === 'box' ? copy.zones.gateBox : copy.zones.gateLine} ${data.zones.filter((z) => z.type === 'exclusive').length + 1}`);
      edit(() => r.data); setDrawing([]); setSelection({ kind: 'zone', id: r.id }); return;
    }
    setDrawing((d) => (d.length && Math.hypot(p[0] - d[d.length - 1][0], p[1] - d[d.length - 1][1]) < 0.05 ? d : [...d, p]));
  };
  const station = selection?.kind === 'station' ? data.stations.find((s) => s.id === selection.id) : undefined; const stationAt = station ? nodeOf(data, station) : undefined;
  const area = selection?.kind === 'staging' ? data.stagingAreas.find((a) => a.id === selection.id) : undefined; const road = selection?.kind === 'road' ? data.roads.find((r) => r.id === selection.id) : undefined;
  const zone = selection?.kind === 'zone' ? data.zones.find((z) => z.id === selection.id) : undefined;
  const state = isDraft ? { label: copy.draft, color: 'warning' as const } : current.number === latest?.number ? { label: copy.published(current.number!), color: 'success' as const } : { label: copy.viewing(current.number!), color: 'gray' as const };
  const startDraft = () => { mapVersionsStore.getState().startDraft(id, user.name); setViewing('draft'); notify.info(copy.started, undefined, 'map-draft'); };
  const restore = (n: number) => { mapVersionsStore.getState().restoreToDraft(id, n, user.name); setViewing('draft'); notify.success(copy.historyPanel.restored(n), undefined, 'map-restore'); };
  const problems = isDraft ? publishProblems(data, latest?.data ?? null, usedBy, cellStatesFromMasterData) : [];
  const publish = () => { const n = mapVersionsStore.getState().publish(id, user.name); if (n) { setViewing(n); notify.success(copy.publishDialog.published(n), map.name, 'map-publish'); } };
  const changeMode = (m: 'design' | 'simulation') => { setMode(m); setTool(SELECT); setDrawing([]); setSelection(null); trip.stop(); setSimError(''); };
  /** In Simulation a click on a station fills the start, then the end; a click after both are set starts over with a new start. */
  const simPick = (sel: Selection) => {
    if (!sel || sel.kind !== 'station' || trip.state.status === 'running') return; setSimError('');
    if (!simChoice.start || simChoice.end) setSimChoice({ ...simChoice, start: sel.id, end: '' }); else if (sel.id !== simChoice.start) setSimChoice({ ...simChoice, end: sel.id });
  };
  const runSim = () => {
    const a = data.stations.find((x) => x.id === simChoice.start), b = data.stations.find((x) => x.id === simChoice.end); const p = planTrip(data, map.fleetLive, simChoice.start, simChoice.end);
    if (!p.ok || !a || !b) { setSimError(!p.ok && p.reason === 'same' ? copy.sim.sameStation : !p.ok && p.reason === 'no-route' && a && b ? copy.sim.noRoute(a.name, b.name) : copy.sim.missing); return; }
    setSimError(''); void trip.run(p, simChoice.type, a.name, b.name);
  };
  const simMarks = (['start', 'end'] as const).flatMap((k) => { const st = data.stations.find((x) => x.id === simChoice[k]); const n = st && nodeOf(data, st); return n ? [{ kind: k, p: { x: n.x, y: n.y } }] : []; });
  /** Show a thing on the map: centre and zoom on it and pulse it. */
  const locate = (kind: NonNullable<Selection>['kind'], sid: string) => { const t = locateTarget(data, { kind, id: sid }); if (t) setLocateAt({ ...t, n: Date.now() }); };
  const addTo = (choice: string) => { if (module) arm(module, choice); };
  const hintText = tool.kind === 'station' ? copy.hint.station : tool.kind === 'staging' ? copy.hint.staging : tool.kind === 'gate' ? (tool.shape === 'box' ? copy.hint.gateBox : copy.hint.gateLine) : tool.kind === 'road' ? (drawing.length ? copy.hint.roadMany(drawing.length) : copy.hint.road) : tool.kind === 'zone' ? (drawing.length ? copy.hint.roadMany(drawing.length) : copy.hint.zone(zoneType(tool.type).label)) : '';
  const deletingName = deleting?.kind === 'station' ? data.stations.find((s) => s.id === deleting.id)?.name : deleting?.kind === 'staging' ? data.stagingAreas.find((s) => s.id === deleting.id)?.name : deleting?.kind === 'road' ? data.roads.find((s) => s.id === deleting.id)?.name : data.zones.find((s) => s.id === deleting?.id)?.name;
  const deleteText = deleting?.kind === 'station' ? (usedBy(deleting.id).length ? copy.stations.form.deleteUsed(usedBy(deleting.id).join(', ')) : copy.stations.form.deleteBody) : deleting?.kind === 'staging' ? copy.staging.form.deleteBody : deleting?.kind === 'road' ? copy.routes.form.deleteBody : copy.zones.form.deleteBody;
  const doDelete = () => {
    if (!deleting) return; const d = deleting;
    edit((m) => (d.kind === 'station' ? deleteStation(m, d.id) : d.kind === 'staging' ? deleteStagingArea(m, d.id) : d.kind === 'road' ? deleteRoad(m, d.id) : deleteZone(m, d.id))); setSelection(null);
  };
  return (
    <div className="content">
      <div className="builder md-card">
        <EditorHeader canUndo={!!isDraft && mode === 'design' && hist.current.past.length > 0} canRedo={!!isDraft && mode === 'design' && hist.current.future.length > 0} showHistory={!!isDraft && mode === 'design'} onUndo={undo} onRedo={redo} mode={mode} onMode={changeMode} mapId={map.id} name={map.name} state={state} isDraft={!!isDraft} canEdit onHistory={() => setHistoryOpen(true)} onPublish={() => setPublishOpen(true)} onEdit={startDraft} />
        {!isDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary bg-warning-primary px-4 py-2.5 text-sm text-secondary"><span>{copy.banner.published(current.number!)}</span>
            {draft ? <Button size="sm" color="secondary" onPress={() => setViewing('draft')}>{copy.historyPanel.open}</Button> : <Button size="sm" color="primary" onPress={startDraft}>{copy.banner.edit}</Button>}</div>)}
        {isDraft && latest && current.basedOn !== null && current.basedOn < (latest.number ?? 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary bg-brand-primary px-4 py-2.5 text-sm text-secondary"><span>{copy.banner.draftOld(current.basedOn, latest.number!)}</span><Button size="sm" color="secondary" onPress={() => setUpdating(true)}>{copy.banner.update(latest.number!)}</Button></div>)}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[360px] min-w-0 flex-1">
            <MapCanvas site={base.site} data={data} tool={tool} editable={!!isDraft && mode === 'design'} locate={locateAt} selection={selection} canSelect={(s) => mode === 'design' || s.kind === 'station'} onSelect={mode === 'simulation' ? simPick : pick} overlay={mode === 'simulation' ? (vp) => <SimLayer vp={vp} marks={simMarks} /> : undefined} drawing={drawing} onPoint={onPoint} onFinish={finish}
              onMove={(kind, sid, to) => edit((m) => (kind === 'station' ? moveStation(m, sid, to) : updateStagingArea(m, sid, { x: Math.round(to.x * 100) / 100, y: Math.round(to.y * 100) / 100 })), `move:${kind}:${sid}`)} />
            {mode === 'design' && tool.kind !== 'select' && <DrawHint text={hintText} showFinish={drawMode(tool) === 'many'} canFinish={drawing.length >= minPoints(tool)} onFinish={finish} onCancel={cancel} cancelLabel={drawing.length ? copy.hint.cancel : copy.hint.done} />}
            {mode === 'design' && <ModuleToolbar tool={tool} choices={choices} onSelect={selectTool} onTool={arm} />}
          </div>
          <aside className="flex max-h-[45%] min-h-[260px] w-full shrink-0 flex-col border-t border-secondary bg-primary lg:max-h-none lg:min-h-0 lg:w-[300px] lg:border-t-0 lg:border-l" aria-label={mode === 'simulation' ? copy.sim.title : module ? copy.panelTitle[module] : copy.noTool.title}>
            <h2 className="border-b border-secondary px-4 py-4 text-md font-semibold text-primary">{mode === 'simulation' ? copy.sim.title : module ? copy.panelTitle[module] : copy.noTool.heading}</h2>
            {mode === 'simulation' && <SimulationPanel data={data} choice={simChoice} onChoice={(c) => { setSimChoice(c); setSimError(''); }} state={trip.state} error={simError} onRun={runSim} onStop={trip.stop} />}
            {mode === 'design' && !module && <EmptyState icon={Cursor01} title={copy.noTool.title} subtext={copy.noTool.subtext} size="sm" className="mt-8" />}
            {mode === 'design' && module === 'stations' && (station && stationAt
              ? <StationForm onLocate={() => locate('station', station.id)} station={station} data={data} at={{ x: stationAt.x, y: stationAt.y }} usedBy={usedBy(station.id)} editable={!!isDraft} onBack={() => setSelection(null)} onPatch={(p) => edit((m) => updateStation(m, station.id, p))} onMove={(to) => edit((m) => moveStation(m, station.id, to))} onDelete={() => setDeleting({ kind: 'station', id: station.id })} />
              : area ? <StagingForm onLocate={() => locate('staging', area.id)} area={area} data={data} editable={!!isDraft} onBack={() => setSelection(null)} onPatch={(p) => edit((m) => updateStagingArea(m, area.id, p))} onDelete={() => setDeleting({ kind: 'staging', id: area.id })} />
              : <StationsPanel data={data} editable={!!isDraft} adding={tool.kind === 'station' || tool.kind === 'staging'} sub={sub} onSub={(s) => { setSub(s); setSelection(null); if (tool.kind === 'station' || tool.kind === 'staging') arm('stations', s === 'staging' ? 'staging' : 'station'); }} selectedId={selection?.id ?? null}
                  onSelect={(sid) => pick({ kind: sub === 'stations' ? 'station' : 'staging', id: sid })} onAdd={() => arm('stations', sub === 'staging' ? 'staging' : 'station')} onCancelAdd={() => { setTool(SELECT); setDrawing([]); }} />)}
            {mode === 'design' && module === 'routes' && (road
              ? <RoadForm onLocate={() => locate('road', road.id)} road={road} data={data} editable={!!isDraft} onBack={() => setSelection(null)} onRename={(name) => edit((m) => renameRoad(m, road.id, name))} onPatch={(p) => edit((m) => updateRoad(m, road.id, p))} onDelete={() => setDeleting({ kind: 'road', id: road.id })} />
              : <RoutesPanel data={data} editable={!!isDraft} drawing={tool.kind === 'road'} onDraw={() => arm('routes')} onStop={() => { setDrawing([]); setTool(SELECT); }} selectedId={selection?.id ?? null} onSelect={(rid) => pick({ kind: 'road', id: rid })} />)}
            {mode === 'design' && (module === 'exclusive' || module === 'zones') && (zone && zoneType(zone.type).module === module
              ? <ZoneForm onLocate={() => locate('zone', zone.id)} zone={zone} data={data} module={module} editable={!!isDraft} onBack={() => setSelection(null)} onPatch={(p) => edit((m) => updateZone(m, zone.id, p))} onDelete={() => setDeleting({ kind: 'zone', id: zone.id })} />
              : <ZonesPanel module={module} data={data} editable={!!isDraft} onAdd={addTo} selectedId={selection?.id ?? null} onSelect={(zid) => pick({ kind: 'zone', id: zid })} />)}
          </aside>
        </div>
      </div>
      <VersionHistory isOpen={historyOpen} onOpenChange={setHistoryOpen} history={history} viewing={isDraft ? 'draft' : (current.number as number)} onView={setViewing} onRestore={restore} onDiscard={() => { mapVersionsStore.getState().discardDraft(id); setViewing(null); notify.info(copy.historyPanel.discarded, undefined, 'map-discard'); }} />
      <PublishDialog isOpen={publishOpen} onOpenChange={setPublishOpen} problems={problems} nextNumber={(latest?.number ?? 0) + 1} onPublish={publish} onShow={(sid) => pick({ kind: 'station', id: sid })} />
      <ConfirmDialog isOpen={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={deleting?.kind === 'station' ? copy.stations.form.deleteTitle(deletingName ?? '') : deleting?.kind === 'staging' ? copy.staging.form.deleteTitle(deletingName ?? '') : deleting?.kind === 'road' ? copy.routes.form.deleteTitle(deletingName ?? '') : copy.zones.form.deleteTitle(deletingName ?? '')}
        description={deleteText} confirmLabel={copy.stations.form.delete} onConfirm={doDelete} />
      <ConfirmDialog isOpen={updating} onOpenChange={setUpdating} title={copy.historyPanel.restoreTitle(latest?.number ?? 0)} description={copy.historyPanel.restoreBody} confirmLabel={copy.banner.update(latest?.number ?? 0)} onConfirm={() => latest?.number && restore(latest.number)} />
    </div>
  );
}
