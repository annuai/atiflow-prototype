import type { FleetId } from '@/data/fleets';
import { TabbedPanel } from '@/components/data/TabbedPanel';
import { useDataset } from '@/data/dataset';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Dataflow03, LayoutGrid01, Package, Settings02 } from '@untitledui/icons';
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
import { FLEETS_PATH, fleetPath } from './paths';
import { profileOf, useFleets } from './model/store';
import { t } from './text';
import { PageTitleName } from '@/shell/PageTitle';
import { Page, PageCard, PageHeader, PageSubtitle, PageTitle } from '@/components/page';

/** Tabs of a fleet page. Add a tab (+ panel) here and the route, tab bar and count badge follow. */
const TABS = [
  { id: 'overview', icon: LayoutGrid01, Panel: OverviewPanel },
  { id: 'materials', icon: Package, Panel: MaterialsPanel },
  { id: 'workflows', icon: Dataflow03, Panel: WorkflowsPanel },
  { id: 'settings', icon: Settings02, Panel: SettingsPanel },
] as const;
type TabId = (typeof TABS)[number]['id'];

/**
 * One page for every fleet: `/configurator/fleets/:fleet/:tab`. The URL holds the fleet's ID (a name in an old link is turned into the id), so renaming a fleet never changes the address.
 * The fleet selects the data (map, robots, hardware, materials, groups, workflows).
 */
export function FleetPage() {
  const { name: param = '', tab = '' } = useParams();
  const record = useDataset(
    (s) => s.fleets.find((f) => f.id === param) ?? s.fleets.find((f) => f.name.toLowerCase() === param.toLowerCase()),
  );
  const active = TABS.find((t) => t.id === tab);
  if (!record) return <Navigate to={FLEETS_PATH} replace />;
  if (record.id !== param || !active) return <Navigate to={fleetPath(record.id, active?.id)} replace />;
  return <FleetPageBody fleet={record.id} name={record.name} active={active} />;
}

function FleetPageBody({ fleet, name, active }: { fleet: FleetId; name: string; active: (typeof TABS)[number] }) {
  const navigate = useNavigate();
  const map = useMap(useFleets((s) => profileOf(s.profiles, fleet).mapId));
  const robots = useDevices((s) => s.robot).filter((d) => d.values.fleet === fleet).length;
  const hardware = useDevices((s) => s.hardware).filter((d) => d.values.fleet === fleet).length;
  const workflows = useWorkflow((s) => workflowsOfFleet(s.workflows, fleet).filter(isKept).length);
  const materials = useMasterData((s) => s.materials).filter((m) => m.fleets.includes(fleet)).length;
  const onRename = (to: string) => {
    const e = renameFleet(fleet, to);
    if (!e && to.trim() !== name)
      notify.success(copy.rename.done.title, copy.rename.done.body(name, to.trim()), 'fleet-renamed');
    return e;
  };
  const counts: Partial<Record<TabId, number>> = { materials, workflows };
  return (
    <>
      <PageTitleName name={name} />
      <Page>
        <PageHeader
          heading={
            <div>
              <InlineNameEdit
                value={name}
                label={t.fleets.fleetName}
                tooltip={copy.rename.tooltip}
                display={<PageTitle>{name}</PageTitle>}
                onSave={onRename}
              />
              <PageSubtitle>{map ? copy.meta.map(map.name, map.version) : copy.meta.noMap}</PageSubtitle>
            </div>
          }
          actions={
            <>
              <Badge size="sm" type="pill-color" color="gray">
                {copy.meta.robots(robots)}
              </Badge>
              <Badge size="sm" type="pill-color" color="gray">
                {copy.meta.hardware(hardware)}
              </Badge>
            </>
          }
          actionsClassName="hide-sm"
        />
        <PageCard>
          <TabbedPanel
            tabs={TABS.map((t) => ({ id: t.id, label: copy.tabs[t.id], icon: t.icon, badge: counts[t.id] }))}
            selected={active.id}
            onSelect={(k) => navigate(fleetPath(fleet, k))}
            label={name}
            contentKey={`${fleet}/${active.id}`}
          >
            <active.Panel fleet={fleet} />
          </TabbedPanel>
        </PageCard>
      </Page>
    </>
  );
}
