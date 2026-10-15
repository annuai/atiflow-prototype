import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
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
import { useShellAi } from '@/shell/shellExtras';
import { selectFleet, selectNodes, useFleetNames, useWorkflow, wfStore } from './model/store';
import { publishProblem } from './model/validate';
import { runSimulation, stopSimulation } from './sim/runner';
import './workflow.css';

const NO_FLEET = { title: 'Select a fleet to start building workflows', body: 'Choose the fleet this workflow is for. Its materials, stations and robots are used while you build.', draft: 'New workflow', placeholder: 'Select a fleet', none: 'No fleets yet: create one in the sidebar' };

/** Canvas stand-in shown until the user picks a fleet for the new workflow. */
function SelectFleetPrompt() {
  const fleets = useFleetNames();
  return (
    <div className="canvas wf-canvas wf-nofleet">
      <EmptyState icon={Dataflow03} size="lg" title={NO_FLEET.title} subtext={NO_FLEET.body}>
        <Select size="md" aria-label="Fleet for this workflow" className="mt-4 w-64" selectedKey={null} placeholder={fleets.length ? NO_FLEET.placeholder : NO_FLEET.none} isDisabled={!fleets.length}
          onSelectionChange={(k) => wfStore.getState().assignFleet(String(k))} items={fleets.map((n) => ({ id: n, label: n }))}>{(item) => <Select.Item {...item} />}</Select>
      </EmptyState>
    </div>
  );
}

/** Route element for `/configurator/workflows/:id`: opens that workflow, then renders the builder once the store points at it. */
const focusAiBar = () => document.querySelector<HTMLInputElement>('[data-wf-ai] input')?.focus();       // the top bar's Ati AI button

export function WorkflowBuilderPage() {
  useShellAi(focusAiBar);
  const { id = '' } = useParams(); const exists = useWorkflow((s) => id in s.workflows); const current = useWorkflow((s) => s.current);
  useEffect(() => { if (exists) wfStore.getState().openWorkflow(id); return () => wfStore.getState().discardUnsaved(); }, [exists, id]);   // leaving a workflow that was neither saved nor published discards it
  if (!exists) return <Navigate to="/configurator" replace />;
  return current === id ? <Builder /> : null;
}

/** The builder for the open workflow. Chrome comes from AppShell; this file only assembles the page. */
function Builder() {
  const current = useWorkflow((s) => s.current)!; const fleets = useFleetNames(); const fleet = useWorkflow(selectFleet);
  const nodes = useWorkflow(selectNodes); const title = useWorkflow((s) => s.workflows[s.current!].name);
  const sim = useWorkflow((s) => s.sim); const canUndo = useWorkflow((s) => !!s.hist[s.current!]?.undo.length), canRedo = useWorkflow((s) => !!s.hist[s.current!]?.redo.length);
  const [mapOpen, setMapOpen] = useState(false); const [publishing, setPublishing] = useState(false); const docked = sim.status !== 'idle'; const hasFleet = !!fleet;

  useEffect(() => { stopSimulation(); }, [current]);                       // switching fleets stops a running simulation
  useEffect(() => () => { stopSimulation(); }, []);                         // leaving the page does too

  const onSimulate = () => { if (sim.status === 'running') stopSimulation(); else void runSimulation(wfStore.getState().nodes()); };
  const onPublish = () => {
    const p = publishProblem(nodes); if (p) { notify.warning(p.title, p.body, 'publish'); return; }
    setPublishing(true); setTimeout(() => { setPublishing(false); wfStore.getState().publish(); }, 700);
  };
  return (
    <>
      <div className="content">
        <div className="title-block wf-title"><div><h1>Workflow Builder</h1><p>Set new workflows and publish them</p></div>
          <div className="actions">
            <Button size="sm" color="secondary" isDisabled={!hasFleet} className={'sim-btn' + (sim.status === 'done' ? ' done' : '')} iconLeading={sim.status === 'running' ? Stop : sim.status === 'done' ? CheckCircle : Play} onPress={onSimulate}>
              {sim.status === 'running' ? 'Stop' : sim.status === 'done' ? 'Completed' : 'Simulate'}{sim.status === 'running' && <span className="bar" style={{ width: sim.progress + '%' }} />}
            </Button>
            <Button size="sm" color="secondary" isDisabled={!hasFleet} onPress={() => wfStore.getState().saveDraft()}>Save Draft</Button>
            <Button size="sm" color="primary" isDisabled={!hasFleet} isLoading={publishing} onPress={onPublish}>Publish Workflow</Button>
          </div></div>
        <div className="work">
          <div className="builder">
            <div className="bh"><Dataflow03 className="size-4 text-[#66cbc4]" />{hasFleet ? <><WorkflowName key={current} name={title} /><Badge size="sm" color="brand">{countNodes(nodes)} nodes</Badge></> : <h2 className="wf-name">{NO_FLEET.draft}</h2>}<div style={{ flex: 1 }} />
              <ButtonUtility className="hide-sm" size="sm" icon={ReverseLeft} tooltip="Undo (Ctrl+Z)" aria-label="Undo" isDisabled={!canUndo} onPress={() => wfStore.getState().undo()} />
              <ButtonUtility className="hide-sm" size="sm" icon={ReverseRight} tooltip="Redo (Ctrl+Shift+Z)" aria-label="Redo" isDisabled={!canRedo} onPress={() => wfStore.getState().redo()} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Fleet -</span>
              <Select size="sm" aria-label="Fleet" className="fleet-select" selectedKey={fleet || null} placeholder={NO_FLEET.placeholder} onSelectionChange={(k) => wfStore.getState().assignFleet(String(k))} items={fleets.map((n) => ({ id: n, label: n }))}>{(item) => <Select.Item {...item} />}</Select></div>
            {hasFleet ? <WorkflowCanvas mapOpen={mapOpen} setMapOpen={setMapOpen} docked={docked} /> : <SelectFleetPrompt />}
          </div>
          {docked && <MapPreview mode="docked" onClose={stopSimulation} />}
        </div>
      </div>
    </>
  );
}
