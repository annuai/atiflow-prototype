import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CheckCircle, Play, ReverseLeft, ReverseRight, Stop } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import { notify } from '@/ui/toast';
import { Dataflow03 } from '@untitledui/icons';
import { WorkflowName } from './components/WorkflowName';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { MapPreview } from './components/MapPreview';
import { countNodes } from './model/tree';
import { selectFleet, selectNodes, useFleetNames, useWorkflow, wfStore } from './model/store';
import { publishProblem } from './model/validate';
import { runSimulation, stopSimulation } from './sim/runner';
import './workflow.css';
import { copy } from './copy';
import { PageTitleName } from '@/shell/PageTitle';
import { Page, PageCard, PageCardHeader, PageHeader } from '@/components/page';

/** Canvas stand-in shown until the user picks a fleet for the new workflow. */
function SelectFleetPrompt() {
  const fleets = useFleetNames();
  return (
    <div className="canvas wf-canvas wf-nofleet">
      <EmptyState icon={Dataflow03} size="lg" title={copy.noFleet.title} subtext={copy.noFleet.body}>
        <Select
          size="md"
          aria-label={copy.noFleet.aria}
          className="mt-4 w-64"
          selectedKey={null}
          placeholder={fleets.length ? copy.noFleet.placeholder : copy.noFleet.none}
          isDisabled={!fleets.length}
          onSelectionChange={(k) => wfStore.getState().assignFleet(String(k))}
          items={fleets.map((n) => ({ id: n, label: n }))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </EmptyState>
    </div>
  );
}

/** Route element for `/configurator/workflows/:id`: opens that workflow, then renders the builder once the store points at it. */
export function WorkflowBuilderPage() {
  const { id = '' } = useParams();
  const exists = useWorkflow((s) => id in s.workflows);
  const current = useWorkflow((s) => s.current);
  useEffect(() => {
    if (exists) wfStore.getState().openWorkflow(id);
    return () => wfStore.getState().discardUnsaved();
  }, [exists, id]); // leaving a workflow that was neither saved nor published discards it
  if (!exists) return <Navigate to="/configurator" replace />;
  return current === id ? <Builder /> : null;
}

/** The builder for the open workflow. Chrome comes from AppShell; this file only assembles the page. */
function Builder() {
  const current = useWorkflow((s) => s.current)!;
  const fleets = useFleetNames();
  const fleet = useWorkflow(selectFleet);
  const nodes = useWorkflow(selectNodes);
  const title = useWorkflow((s) => s.workflows[s.current!].name);
  const sim = useWorkflow((s) => s.sim);
  const canUndo = useWorkflow((s) => !!s.hist[s.current!]?.undo.length),
    canRedo = useWorkflow((s) => !!s.hist[s.current!]?.redo.length);
  const [mapOpen, setMapOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const docked = sim.status !== 'idle';
  const hasFleet = !!fleet;

  useEffect(() => {
    stopSimulation();
  }, [current]); // switching fleets stops a running simulation
  useEffect(
    () => () => {
      stopSimulation();
    },
    [],
  ); // leaving the page does too

  const onSimulate = () => {
    if (sim.status === 'running') stopSimulation();
    else void runSimulation(wfStore.getState().nodes());
  };
  const onPublish = () => {
    const p = publishProblem(nodes);
    if (p) {
      notify.warning(p.title, p.body, 'publish');
      return;
    }
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      wfStore.getState().publish();
    }, 700);
  };
  return (
    <>
      <PageTitleName name={hasFleet ? title : null} />
      <Page>
        <PageHeader
          title={copy.page.title}
          subtitle={copy.page.subtitle}
          actions={
            <>
              <Button
                size="sm"
                color="secondary"
                isDisabled={!hasFleet}
                className={'sim-btn' + (sim.status === 'done' ? ' done' : '')}
                iconLeading={sim.status === 'running' ? Stop : sim.status === 'done' ? CheckCircle : Play}
                onPress={onSimulate}
              >
                {sim.status === 'running'
                  ? copy.page.stop
                  : sim.status === 'done'
                    ? copy.page.completed
                    : copy.page.simulate}
                {sim.status === 'running' && <span className="bar" style={{ width: sim.progress + '%' }} />}
              </Button>
              <Button size="sm" color="secondary" isDisabled={!hasFleet} onPress={() => wfStore.getState().saveDraft()}>
                {copy.page.saveDraft}
              </Button>
              <Button size="sm" color="primary" isDisabled={!hasFleet} isLoading={publishing} onPress={onPublish}>
                {copy.page.publish}
              </Button>
            </>
          }
          className="max-[720px]:flex-wrap max-[720px]:gap-2"
          actionsClassName="max-[720px]:w-full max-[720px]:*:flex-1"
        />
        <div className="work">
          <PageCard className="m-0 min-w-0">
            <PageCardHeader>
              <Dataflow03 className="size-4 text-[#66cbc4]" />
              {hasFleet ? (
                <>
                  <WorkflowName key={current} name={title} />
                  <Badge size="sm" color="brand">
                    {copy.page.nodes(countNodes(nodes))}
                  </Badge>
                </>
              ) : (
                <h2 className="wf-name">{copy.noFleet.draft}</h2>
              )}
              <div style={{ flex: 1 }} />
              <ButtonUtility
                className="hide-sm"
                size="sm"
                icon={ReverseLeft}
                tooltip={copy.page.undoTip}
                aria-label={copy.page.undo}
                isDisabled={!canUndo}
                onPress={() => wfStore.getState().undo()}
              />
              <ButtonUtility
                className="hide-sm"
                size="sm"
                icon={ReverseRight}
                tooltip={copy.page.redoTip}
                aria-label={copy.page.redo}
                isDisabled={!canRedo}
                onPress={() => wfStore.getState().redo()}
              />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.page.fleetLabel}</span>
              <Select
                size="sm"
                aria-label={copy.page.fleetAria}
                className="fleet-select"
                selectedKey={fleet || null}
                placeholder={copy.noFleet.placeholder}
                onSelectionChange={(k) => wfStore.getState().assignFleet(String(k))}
                items={fleets.map((n) => ({ id: n, label: n }))}
              >
                {(item) => <Select.Item {...item} />}
              </Select>
            </PageCardHeader>
            {hasFleet ? (
              <WorkflowCanvas mapOpen={mapOpen} setMapOpen={setMapOpen} docked={docked} />
            ) : (
              <SelectFleetPrompt />
            )}
          </PageCard>
          {docked && <MapPreview mode="docked" onClose={stopSimulation} />}
        </div>
      </Page>
    </>
  );
}
