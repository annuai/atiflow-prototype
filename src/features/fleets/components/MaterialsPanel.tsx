import { useState } from 'react';
import { TabPanelMotion } from '@/components/motion/TabPanelMotion';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { type PickerRow, useMasterData } from '@/features/master-data';
import { copy } from '../copy';
import { AssignMaterialsModal } from './AssignMaterialsModal';
import { FleetMaterials } from './FleetMaterials';
import { FleetStationGroups } from './FleetStationGroups';
import { GroupMaterialsModal } from './GroupMaterialsModal';

type Sub = 'all' | 'groups';
/** Materials tab of a fleet: "All materials" and "Station groups" over the materials assigned to this fleet. */
export function MaterialsPanel({ fleet }: { fleet: string }) {
  const all = useMasterData((s) => s.materials);
  const masterGroups = useMasterData((s) => s.groups);
  const materials = all.filter((m) => m.fleets.includes(fleet));
  const [sub, setSub] = useState<Sub>('all');
  const [assigning, setAssigning] = useState(false);
  const [grouping, setGrouping] = useState<string[] | null>(null);
  const [epoch, setEpoch] = useState(0); // bumping the epoch clears the table selection after a group dialog
  const rows: PickerRow[] = materials.map((m) => ({
    code: m.code,
    name: m.name,
    group: masterGroups.find((g) => g.id === m.group)?.name ?? '',
    status: 'available' as const,
  }));
  const tabs = (
    <SegmentedTabs<Sub>
      value={sub}
      onChange={setSub}
      label="Materials"
      items={(Object.keys(copy.materials.sub) as Sub[]).map((id) => ({ id, label: copy.materials.sub[id] }))}
    />
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TabPanelMotion tabKey={sub} fill>
        {sub === 'all' ? (
          <FleetMaterials
            key={epoch}
            fleet={fleet}
            materials={materials}
            total={materials.length}
            toolbarLeft={tabs}
            onAssign={() => setAssigning(true)}
            onGroup={setGrouping}
          />
        ) : (
          <FleetStationGroups
            fleet={fleet}
            materials={materials}
            masterGroups={masterGroups}
            toolbarLeft={tabs}
            onAdd={() => setGrouping([])}
          />
        )}
      </TabPanelMotion>
      <AssignMaterialsModal fleet={fleet} isOpen={assigning} onOpenChange={setAssigning} />
      <GroupMaterialsModal
        fleet={fleet}
        rows={rows}
        open={grouping}
        onOpenChange={(o) => {
          if (!o) {
            setGrouping(null);
            setEpoch((e) => e + 1);
          }
        }}
      />
    </div>
  );
}
