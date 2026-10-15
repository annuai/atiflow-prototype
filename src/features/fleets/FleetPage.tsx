import { useRef } from 'react';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { useDataset } from '@/data/dataset';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Dataflow03, LayoutGrid01, Package, Settings02 } from '@untitledui/icons';
import { Tabs } from '@/components/application/tabs/tabs';
import { Badge } from '@/components/base/badges/badges';
import { useDevices } from '@/features/devices';
import { useMasterData } from '@/features/master-data';
import { isKept, useWorkflow, workflowsOfFleet } from '@/features/workflow-builder';
import { InlineNameEdit } from '@/components/form/InlineNameEdit';
import { notify } from '@/ui/toast';
import { copy } from './copy';
import { renameFleet } from './model/rename';
import { OverviewPanel } from './components/OverviewPanel';
import { MaterialsPanel } from './components/MaterialsPanel';
import { WorkflowsPanel } from './components/WorkflowsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useMap } from './model/maps';
import { fleetPath } from './paths';
import { profileOf, useFleets } from './model/store';

/** Tabs of a fleet page. Add a tab (+ panel) here and the route, tab bar and count badge follow. */
const TABS = [
  { id: 'overview', icon: LayoutGrid01, Panel: OverviewPanel },
  { id: 'materials', icon: Package, Panel: MaterialsPanel },
  { id: 'workflows', icon: Dataflow03, Panel: WorkflowsPanel },
  { id: 'settings', icon: Settings02, Panel: SettingsPanel },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** One page for every fleet: `/configurator/fleets/:name/:tab`. The fleet name selects the data (map, robots, hardware, materials, groups, workflow). */
export function FleetPage() {
  const { name = '', tab = '' } = useParams();
  const navigate = useNavigate();
  const renamedFrom = useRef('');
  const known = useDataset((s) => s.fleets.some((f) => f.name === name));
  const active = TABS.find((t) => t.id === tab);
  const map = useMap(useFleets((s) => profileOf(s.profiles, name).mapId));
  const robots = useDevices((s) => s.robot).filter((d) => d.values.fleet === name).length;
  const hardware = useDevices((s) => s.hardware).filter((d) => d.values.fleet === name).length;
  const workflows = useWorkflow((s) => workflowsOfFleet(s.workflows, name).filter(isKept).length);
  const materials = useMasterData((s) => s.materials).filter((m) => m.fleets.includes(name)).length;
  if (known) renamedFrom.current = '';
  if (!known && renamedFrom.current !== name) return <Navigate to="/configurator" replace />; // (a fleet that was just renamed is briefly unknown under its old URL)
  if (!active) return <Navigate to={fleetPath(name)} replace />;
  const onRename = (to: string) => {
    renamedFrom.current = name;
    const e = renameFleet(name, to);
    if (e) renamedFrom.current = '';
    if (!e && to.trim() !== name) {
      navigate(fleetPath(to.trim(), active.id), { replace: true });
      notify.success(copy.rename.done.title, copy.rename.done.body(name, to.trim()), 'fleet-renamed');
    }
    return e;
  };
  const counts: Partial<Record<TabId, number>> = { materials, workflows };
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <InlineNameEdit
              value={name}
              label="Fleet name"
              tooltip={copy.rename.tooltip}
              display={<h1>{name}</h1>}
              onSave={onRename}
            />
            <p>{map ? copy.meta.map(map.name, map.version) : copy.meta.noMap}</p>
          </div>
          <div className="actions hide-sm">
            <Badge size="sm" type="pill-color" color="gray">
              {copy.meta.robots(robots)}
            </Badge>
            <Badge size="sm" type="pill-color" color="gray">
              {copy.meta.hardware(hardware)}
            </Badge>
          </div>
        </div>
        <div className="builder md-card">
          <Tabs
            selectedKey={active.id}
            onSelectionChange={(k) => navigate(fleetPath(name, String(k)))}
            className="min-w-0 flex-none px-5 pt-6"
          >
            <Tabs.List
              type="underline"
              size="md"
              fullWidth
              aria-label={name}
              items={TABS.map((t) => ({ id: t.id, label: copy.tabs[t.id], icon: t.icon, badge: counts[t.id] }))}
            />
          </Tabs>
          <div className="md-body">
            <TabPanelMotion tabKey={`${name}/${active.id}`} fill>
              <active.Panel fleet={name} />
            </TabPanelMotion>
          </div>
        </div>
      </div>
    </>
  );
}
