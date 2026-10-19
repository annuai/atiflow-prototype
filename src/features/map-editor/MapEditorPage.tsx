import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useAuth } from '@/features/auth';
import { useMap } from '@/features/maps';
import { useMapData, useWorkflow } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { DEFAULT_CHOICE, SELECT, toolFor, type Tool } from './canvas/tools';
import { useDrawTools, useEditorShortcuts } from './canvas/useDrawTools';
import type { P } from './canvas/layers';
import { DeleteDialog } from './components/DeleteDialog';
import { LeaveDialog } from './components/LeaveDialog';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { EditorHeader } from './components/EditorHeader';
import { type Module } from './components/ModuleToolbar';
import { EditorStage } from './components/EditorStage';
import { MapEditorSkeleton } from './components/MapEditorSkeleton';
import { PublishDialog } from './components/PublishDialog';
import { SidePanel } from './components/SidePanel';
import type { StationsSub } from './components/StationsPanel';
import { VersionBanner } from './components/VersionBanner';
import { VersionHistory } from './components/VersionHistory';
import { copy } from './copy';
import { cellStatesFromMasterData } from './model/cellStates';
import { locateTarget } from './model/locate';
import { mapVersionsStore, useMapVersions } from './model/store';
import type { MapData, Selection } from './model/types';
import { useDraftEditor } from './model/useDraftEditor';
import { workflowsUsing } from './model/usage';
import { useResetOnChange } from './hooks/useResetOnChange';
import { useEditorView } from './hooks/useEditorView';
import { Stage3d } from './components/Stage3d';
import { view3dNotice } from './components/View3dNotice';
import { publishProblems } from './model/validate';
import { moveShape } from './model/shape';
import { setZoneShape } from './model/zones';
import { moveElements } from './model/structure/ops';
import { deleteSelected, moduleOfSelection, versionBadge, versionShown, type Viewing } from './model/pageParts';
import { boxElements, pickElement } from './model/structure/select';
import { versionActions } from './model/versionActions';
import { importedSite } from './model/importedSite';
import { seedMapData } from './model/seed';
import { useSimulationPanel } from './sim/useSimulationPanel';
import { PageTitleName } from '@/shell/PageTitle';
import { Page, PageCard } from '@/components/page';

type Zone = MapData['zones'][number];

/** Keyboard shortcuts of the editor: undo / redo, Esc / Enter while drawing, and arrows / Delete for the selected zone. */
function useZoneShortcuts({
  tool,
  canEdit,
  editor,
  draw,
  zone,
  element,
  askDelete,
}: {
  tool: Tool;
  canEdit: boolean;
  editor: ReturnType<typeof useDraftEditor>;
  draw: ReturnType<typeof useDrawTools>;
  zone: Zone | undefined;
  /** the selected elements of the structure: arrows move them, Delete asks to remove them */
  element?: string[];
  askDelete: (d: NonNullable<Selection>) => void;
}) {
  useEditorShortcuts({
    tool,
    canEdit,
    ...editor,
    cancel: draw.cancel,
    finish: draw.finish,
    zone: zone
      ? {
          nudge: (dx, dy) =>
            editor.edit((m) => setZoneShape(m, zone.id, moveShape(zone.shape, dx, dy)), `nudge:${zone.id}`),
          remove: () => askDelete({ kind: 'zone', id: zone.id }),
        }
      : element
        ? {
            nudge: (dx, dy) => editor.edit((m) => moveElements(m, element, dx, dy), `nudge:${element.join()}`),
            remove: () => askDelete({ kind: 'element', id: element[element.length - 1], ids: element }),
          }
        : undefined,
  });
}

/** What is on screen: the map, its history, the version shown (and its data, site and fleet), and the ids that other maps and workflows already hold. */
function useShownMap(id: string, viewing: Viewing) {
  const map = useMap(id);
  const base = useMapData();
  const history = useMapVersions((s) => s.byMap[id]);
  const allMaps = useMapVersions((s) => s.byMap);
  const workflows = useWorkflow((s) => s.workflows);
  const imported = map?.source === 'imported';
  // the first published version of a map is made from the real site and lane map, once
  useEffect(() => {
    if (map && base && !imported)
      mapVersionsStore.getState().ensure(map.id, map.version, seedMapData(map, base.site, base.nav));
    if (base) mapVersionsStore.getState().restoreAreas(base.site, base.nav.fleets);
  }, [map, base, imported]);
  const { draft, latest, current } = versionShown(history, viewing);
  const data: MapData | undefined = current?.data;
  const isDraft = current?.status === 'draft';
  const site = imported ? importedSite(map?.name ?? '', data) : base?.site;
  const fleetKey = map ? fleetDirectory.byLiveId(map.fleetLive)?.id : undefined;
  const takenStations = useMemo(() => base?.live.stations.map((s) => s.id) ?? [], [base]);
  const takenAreas = useMemo(
    () => Object.values(allMaps).flatMap((h) => h.versions.flatMap((v) => v.data.stagingAreas.map((a) => a.id))),
    [allMaps],
  ); // an area id means one area in every map
  const usedBy = (sid: string) => workflowsUsing(Object.values(workflows), fleetKey, sid);
  return { map, history, draft, latest, current, data, site, isDraft, takenStations, takenAreas, usedBy };
}

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
  const user = useAuth((s) => s.user)!;
  const [viewing, setViewing] = useState<Viewing>(null);
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

  const { map, history, draft, latest, current, data, site, isDraft, takenStations, takenAreas, usedBy } = useShownMap(
    id,
    viewing,
  );
  const latestNumber = latest?.number ?? 0;
  const editable = isDraft && mode === 'design';
  const tool: Tool = editable ? wantTool : SELECT; // a published version only allows looking

  const sim = useSimulationPanel(data, map?.fleetLive);
  const v = useEditorView(() => {
    setModule('structure');
    setTool(SELECT);
    setDrawing([]);
    setMode('design');
    sim.stop();
  });
  const { multi } = v;
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
  useZoneShortcuts({
    tool,
    canEdit: editable,
    editor,
    draw,
    zone: selection?.kind === 'zone' ? data?.zones.find((z) => z.id === selection.id) : undefined,
    element: selection?.kind === 'element' ? (selection.ids ?? [selection.id]) : undefined,
    askDelete: setDeleting,
  });

  // a different version is shown: nothing is selected, drawn or simulated any more
  useResetOnChange(current?.id, () => {
    setSelection(null);
    setDrawing([]);
    sim.stop();
  });

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
  const pick = (sel: Selection, opts?: { keepTool?: boolean; additive?: boolean }) => {
    if (!opts?.keepTool) {
      setTool(SELECT);
      setDrawing([]);
    }
    const next = sel?.kind === 'element' ? pickElement(selection, sel.id, !!(opts?.additive || multi)) : sel;
    setSelection(next);
    if (!sel || !data) return;
    setModule(moduleOfSelection(data, sel));
    if (sel.kind === 'station') setSub('stations');
    if (sel.kind === 'staging') setSub('staging');
  };

  if (!map) return <Navigate to="/configurator/maps" replace />;
  if (!site || !data || !current) return <MapEditorSkeleton />;
  const state = versionBadge(current, latest, !!isDraft);
  const { exportZip, startDraft, restore, publish } = versionActions({
    id,
    map,
    data,
    userName: user.name,
    setViewing,
  });
  const problems = isDraft ? publishProblems(data, latest?.data ?? null, usedBy, cellStatesFromMasterData) : [];
  const changeMode = (m: 'design' | 'simulation') => {
    setMode(m);
    if (m === 'simulation') v.setView('2d');
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
    editor.edit((m) => deleteSelected(m, d));
    setSelection(null);
  };
  return (
    <Page className="map-editor">
      <PageTitleName name={map.name} />
      <PageCard>
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
          onExport={data.source ? exportZip : undefined}
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
          {v.view === '3d' ? (
            <Stage3d
              name={map.name}
              data={data}
              selection={selection}
              onSelection={setSelection}
              multi={multi}
              onView={v.setView}
            />
          ) : (
            <EditorStage
              site={site}
              data={data}
              tool={tool}
              editable={editable}
              locateAt={locateAt}
              selection={selection}
              mode={mode}
              sim={sim}
              pick={pick}
              drawing={drawing}
              draw={draw}
              editor={editor}
              choices={choices}
              structureOpen={module === 'structure'}
              multi={multi}
              onView={v.setView}
              onMarquee={(a, b, additive) => setSelection(boxElements(data, selection, a, b, additive))}
              onSelectTool={selectTool}
              onArm={arm}
            />
          )}
          <SidePanel
            notice={view3dNotice(v.view, v.setView)}
            multi={multi}
            onMulti={v.toggleMulti}
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
            onRouteFrom={(sid) => {
              const n = data.nodes.find((q) => q.id === data.stations.find((s) => s.id === sid)?.nodeId);
              if (!n || !isDraft) return;
              arm('routes'); // the Routes tool, with this station as the start
              setDrawing([[n.x, n.y]]);
            }}
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
      </PageCard>
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
        nextNumber={latestNumber + 1}
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
        title={copy.historyPanel.restoreTitle(latestNumber)}
        description={copy.historyPanel.restoreBody}
        confirmLabel={copy.banner.update(latestNumber)}
        onConfirm={() => latest?.number && restore(latest.number)}
      />
    </Page>
  );
}
