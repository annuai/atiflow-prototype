import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useAuth } from '@/features/auth';
import { useMap } from '@/features/maps';
import { useMapData, useWorkflow } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { MapCanvas } from './canvas/MapCanvas';
import { SimLayer } from './canvas/SimLayer';
import { DEFAULT_CHOICE, drawMode, SELECT, toolFor, type Tool } from './canvas/tools';
import { useDrawTools, useEditorShortcuts } from './canvas/useDrawTools';
import type { P } from './canvas/layers';
import { DeleteDialog } from './components/DeleteDialog';
import { LeaveDialog } from './components/LeaveDialog';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { DrawHint } from './components/DrawHint';
import { EditorHeader } from './components/EditorHeader';
import { ModuleToolbar, type Module } from './components/ModuleToolbar';
import { PublishDialog } from './components/PublishDialog';
import { SidePanel } from './components/SidePanel';
import type { StationsSub } from './components/StationsPanel';
import { VersionBanner } from './components/VersionBanner';
import { VersionHistory } from './components/VersionHistory';
import { copy } from './copy';
import { cellStatesFromMasterData } from './model/cellStates';
import { hintFor } from './model/hints';
import { locateTarget } from './model/locate';
import { deleteRoad } from './model/roads';
import { deleteStagingArea, updateStagingArea } from './model/staging';
import { deleteStation, moveStation } from './model/stations';
import { draftOf, latestOf, mapVersionsStore, useMapVersions } from './model/store';
import type { MapData, Selection } from './model/types';
import { useDraftEditor } from './model/useDraftEditor';
import { workflowsUsing } from './model/usage';
import { publishProblems } from './model/validate';
import { moveShape } from './model/shape';
import { deleteZone, setZoneShape } from './model/zones';
import { zoneType } from './model/zoneTypes';
import { importedSite } from './model/importedSite';
import { seedMapData } from './model/seed';
import { useSimulationPanel } from './sim/useSimulationPanel';
import { PageTitleName } from '@/shell/PageTitle';

/**
 * The Map Editor (`/configurator/maps/:id`). A published version can only be looked at; "Edit as draft" makes the one draft, saved as you edit and turned into the next version by Publish.
 * The four modules float at the bottom of the map (Stations with staging areas, Routes, Traffic Gates, Zones): opening one puts its tool on the map and its panel on the right at once.
 * This component holds the page's state and wires the pieces together: the map (`canvas/`), the side panel, the draft editor with undo (`model/useDraftEditor`), what a click draws
 * (`canvas/useDrawTools`) and the Simulation mode (`sim/useSimulationPanel`).
 */
export function MapEditorPage() {
  const { id = '' } = useParams();
  useEffect(() => {
    document.documentElement.classList.add('map-editor-open'); // lets the touch sizes reach the editor's dialogs, which are drawn outside the page
    return () => document.documentElement.classList.remove('map-editor-open');
  }, []);
  const map = useMap(id);
  const imported = map?.source === 'imported',
    mapName = map?.name ?? '';
  const user = useAuth((s) => s.user)!;
  const base = useMapData();
  const history = useMapVersions((s) => s.byMap[id]);
  const allMaps = useMapVersions((s) => s.byMap);
  const workflows = useWorkflow((s) => s.workflows);
  const [viewing, setViewing] = useState<'draft' | number | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [sub, setSub] = useState<StationsSub>('stations');
  const [wantTool, setTool] = useState<Tool>(SELECT);
  const [selection, setSelection] = useState<Selection>(null);
  const [drawing, setDrawing] = useState<P[]>([]);
  const [choices, setChoices] = useState<Record<Module, string>>(DEFAULT_CHOICE);
  const [mode, setMode] = useState<'design' | 'simulation'>('design');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleting, setDeleting] = useState<NonNullable<Selection> | null>(null);
  const [updating, setUpdating] = useState(false);
  const [locateAt, setLocateAt] = useState<{ x: number; y: number; span: number; n: number } | null>(null);

  // the first published version of a map is made from the real site and lane map, once
  useEffect(() => {
    if (map && base && !imported)
      mapVersionsStore.getState().ensure(map.id, map.version, seedMapData(map, base.site, base.nav));
  }, [map, base, imported]);
  const draft = draftOf(history),
    latest = latestOf(history);
  const current =
    viewing === 'draft'
      ? draft
      : typeof viewing === 'number'
        ? history?.versions.find((v) => v.number === viewing && v.status === 'published')
        : (draft ?? latest);
  const data: MapData | undefined = current?.data;
  const site = imported ? importedSite(mapName, data) : base?.site;
  const isDraft = current?.status === 'draft';
  const fleetName = map ? fleetDirectory.byLiveId(map.fleetLive)?.name : undefined;
  const tool: Tool = isDraft && mode === 'design' ? wantTool : SELECT; // a published version only allows looking
  const takenStations = useMemo(() => base?.nav.stations.map((s) => s.id) ?? [], [base]);
  const takenAreas = useMemo(
    () => Object.values(allMaps).flatMap((h) => h.versions.flatMap((v) => v.data.stagingAreas.map((a) => a.id))),
    [allMaps],
  ); // an area id means one area in every map
  const usedBy = (sid: string) => workflowsUsing(Object.values(workflows), fleetName, sid);

  const sim = useSimulationPanel(data, map?.fleetLive);
  const editor = useDraftEditor(id, current?.id, () => setDrawing([]));
  const guard = useLeaveGuard(editor.dirty);
  const draw = useDrawTools({
    data,
    fleetLive: map?.fleetLive,
    tool,
    drawing,
    setDrawing,
    setSelection,
    setTool,
    edit: editor.edit,
    takenStations,
    takenAreas,
  });
  const selectedZone = selection?.kind === 'zone' ? data?.zones.find((z) => z.id === selection.id) : undefined;
  useEditorShortcuts({
    tool,
    canEdit: !!isDraft && mode === 'design',
    ...editor,
    cancel: draw.cancel,
    finish: draw.finish,
    zone: selectedZone
      ? {
          nudge: (dx, dy) =>
            editor.edit(
              (m) => setZoneShape(m, selectedZone.id, moveShape(selectedZone.shape, dx, dy)),
              `nudge:${selectedZone.id}`,
            ),
          remove: () => setDeleting({ kind: 'zone', id: selectedZone.id }),
        }
      : undefined,
  });

  // a different version is shown: nothing is selected, drawn or simulated any more
  const [shownId, setShownId] = useState(current?.id);
  if (shownId !== current?.id) {
    setShownId(current?.id);
    setSelection(null);
    setDrawing([]);
    sim.stop();
  }

  /** Arm a drawing tool: the module's panel opens and the next click on the map draws (with this choice, which is remembered for the module). Tools stay armed until Esc or Select. */
  const arm = (m: Module, choice: string = choices[m]) => {
    setModule(m);
    setSelection(null);
    setDrawing([]);
    setChoices((c) => ({ ...c, [m]: choice }));
    if (m === 'stations') setSub(choice === 'staging' ? 'staging' : 'stations');
    if (!isDraft) {
      notify.info(copy.banner.published(current?.number ?? 0), copy.stations.readOnly, 'map-readonly');
      return;
    }
    setTool(toolFor(m, choice));
  };
  const selectTool = () => {
    setTool(SELECT);
    setDrawing([]);
  };
  /** Look at / edit one thing (from the list or the map): the select tool, and the panel of that kind of thing. */
  const pick = (sel: Selection) => {
    setTool(SELECT);
    setDrawing([]);
    setSelection(sel);
    if (!sel || !data) return;
    if (sel.kind === 'station') {
      setModule('stations');
      setSub('stations');
    } else if (sel.kind === 'staging') {
      setModule('stations');
      setSub('staging');
    } else if (sel.kind === 'road') setModule('routes');
    else
      setModule(
        zoneType(data.zones.find((z) => z.id === sel.id)?.type ?? '').module === 'exclusive' ? 'exclusive' : 'zones',
      );
  };

  if (!map) return <Navigate to="/configurator/maps" replace />;
  if (!site || !data || !current)
    return (
      <div className="content">
        <div className="builder md-card">
          <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading the map">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        </div>
      </div>
    );
  const state = isDraft
    ? { label: copy.draft, color: 'warning' as const }
    : current.number === latest?.number
      ? { label: copy.published(current.number!), color: 'success' as const }
      : { label: copy.viewing(current.number!), color: 'gray' as const };
  const startDraft = () => {
    mapVersionsStore.getState().startDraft(id, user.name);
    setViewing('draft');
    notify.info(copy.started, undefined, 'map-draft');
  };
  const restore = (n: number) => {
    mapVersionsStore.getState().restoreToDraft(id, n, user.name);
    setViewing('draft');
    notify.success(copy.historyPanel.restored(n), undefined, 'map-restore');
  };
  const problems = isDraft ? publishProblems(data, latest?.data ?? null, usedBy, cellStatesFromMasterData) : [];
  const publish = () => {
    const n = mapVersionsStore.getState().publish(id, user.name);
    if (n) {
      setViewing(n);
      notify.success(copy.publishDialog.published(n), map.name, 'map-publish');
    }
  };
  const changeMode = (m: 'design' | 'simulation') => {
    setMode(m);
    setTool(SELECT);
    setDrawing([]);
    setSelection(null);
    sim.stop();
  };
  /** Show a thing on the map: centre and zoom on it and pulse it. */
  const locate = (kind: NonNullable<Selection>['kind'], sid: string) => {
    const t = locateTarget(data, { kind, id: sid });
    if (t) setLocateAt({ ...t, n: Date.now() });
  };
  const doDelete = (d: NonNullable<Selection>) => {
    editor.edit((m) =>
      d.kind === 'station'
        ? deleteStation(m, d.id)
        : d.kind === 'staging'
          ? deleteStagingArea(m, d.id)
          : d.kind === 'road'
            ? deleteRoad(m, d.id)
            : deleteZone(m, d.id),
    );
    setSelection(null);
  };
  const editable = !!isDraft && mode === 'design';
  return (
    <div className="content map-editor">
      <PageTitleName name={map.name} />
      <div className="builder md-card">
        <EditorHeader
          canUndo={editable && editor.canUndo}
          canRedo={editable && editor.canRedo}
          showHistory={editable}
          onUndo={editor.undo}
          onRedo={editor.redo}
          mode={mode}
          onMode={changeMode}
          mapId={map.id}
          name={map.name}
          state={state}
          isDraft={!!isDraft}
          canEdit
          onHistory={() => setHistoryOpen(true)}
          onPublish={() => setPublishOpen(true)}
          onEdit={startDraft}
        />
        <VersionBanner
          current={current}
          draft={draft}
          latest={latest}
          onOpenDraft={() => setViewing('draft')}
          onStartDraft={startDraft}
          onUpdate={() => setUpdating(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
              onMove={(kind, sid, to) =>
                editor.edit(
                  (m) =>
                    kind === 'station'
                      ? moveStation(m, sid, to)
                      : updateStagingArea(m, sid, { x: Math.round(to.x * 100) / 100, y: Math.round(to.y * 100) / 100 }),
                  `move:${kind}:${sid}`,
                )
              }
            />
            {mode === 'design' && tool.kind !== 'select' && (
              <DrawHint
                text={hintFor(tool, drawing.length)}
                showFinish={drawMode(tool) === 'many'}
                canFinish={drawing.length >= 2}
                onFinish={draw.finish}
                onCancel={draw.cancel}
                cancelLabel={drawing.length ? copy.hint.cancel : copy.hint.done}
              />
            )}
            {mode === 'design' && <ModuleToolbar tool={tool} choices={choices} onSelect={selectTool} onTool={arm} />}
          </div>
          <SidePanel
            mode={mode}
            module={module}
            data={data}
            editable={!!isDraft}
            tool={tool}
            selection={selection}
            sub={sub}
            simulation={sim}
            usedBy={usedBy}
            edit={editor.edit}
            onBack={() => setSelection(null)}
            onSub={(s) => {
              setSub(s);
              setSelection(null);
            }}
            onPick={pick}
            onArm={arm}
            onPlace={(sid) => {
              setDrawing([]);
              setTool({ kind: 'place', id: sid });
            }}
            onStopDrawing={() => {
              setDrawing([]);
              setTool(SELECT);
            }}
            onDelete={setDeleting}
            onLocate={locate}
          />
        </div>
      </div>
      <VersionHistory
        isOpen={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        viewing={isDraft ? 'draft' : (current.number as number)}
        onView={setViewing}
        onRestore={restore}
        onDiscard={() => {
          mapVersionsStore.getState().discardDraft(id);
          setViewing(null);
          notify.info(copy.historyPanel.discarded, undefined, 'map-discard');
        }}
      />
      <PublishDialog
        isOpen={publishOpen}
        onOpenChange={setPublishOpen}
        problems={problems}
        nextNumber={(latest?.number ?? 0) + 1}
        onPublish={publish}
        onShow={(sid) => pick({ kind: 'station', id: sid })}
      />
      <LeaveDialog
        isOpen={guard.pending}
        onKeep={guard.stay}
        onDiscard={() => {
          editor.discardChanges();
          guard.leave();
        }}
      />
      <DeleteDialog
        deleting={deleting}
        data={data}
        usedBy={usedBy}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
      />
      <ConfirmDialog
        isOpen={updating}
        onOpenChange={setUpdating}
        title={copy.historyPanel.restoreTitle(latest?.number ?? 0)}
        description={copy.historyPanel.restoreBody}
        confirmLabel={copy.banner.update(latest?.number ?? 0)}
        onConfirm={() => latest?.number && restore(latest.number)}
      />
    </div>
  );
}
