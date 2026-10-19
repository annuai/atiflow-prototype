import { useState } from 'react';
import { Building07, ChevronDown } from '@untitledui/icons';
import { Button as AriaButton } from 'react-aria-components';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { copy } from '../copy';
import { ModuleList, type ListItem } from '../components/ModuleList';
import { elementColor } from '../model/structure/derive';
import { modelOf } from '../model/structure/ops';
import { structureDxf } from '../model/structure/dxf';
import { restoreEstimate, traceAll } from '../model/structure/trace';
import type { MapData } from '../model/types';

/** The undo shortcut as this computer writes it (the editor takes Ctrl or Cmd + Z on either). */
const undoKeys = () => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Cmd+Z' : 'Ctrl+Z');

/** Saves the drawing of the structure as a DXF file any CAD program opens. */
function downloadDxf(data: MapData) {
  const url = URL.createObjectURL(new Blob([structureDxf(data)], { type: 'application/dxf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'structure.dxf' });
  a.click();
  URL.revokeObjectURL(url);
}

/** The Drawing menu: the structure as a DXF to edit outside (and, later, a DXF coming back in). */
function DrawingMenu({ data }: { data: MapData }) {
  const d = copy.structure.drawing;
  return (
    <Dropdown.Root>
      <AriaButton className="flex w-fit cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
        {d.menu}
        <ChevronDown className="size-4" />
      </AriaButton>
      <Dropdown.Popover className="w-56">
        <Dropdown.Menu onAction={(k) => k === 'download' && downloadDxf(data)}>
          <Dropdown.Item id="download" label={copy.structure.view3d.downloadDxf} />
          <Dropdown.Item id="upload" label={`${d.upload} (${d.soon})`} isDisabled />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/**
 * The Structure module's list: the elements (search, a colour dot, kind and height), the buttons to turn the whole lidar estimate into elements
 * or bring it back, and the estimate's counts. Choosing an element opens its form (the side panel does that).
 */
export function StructurePanel({
  data,
  editable,
  selectedId,
  onSelect,
  edit,
}: {
  data: MapData;
  editable: boolean;
  selectedId: string | null;
  onSelect(id: string): void;
  edit(fn: (d: MapData) => MapData): void;
}) {
  const t = copy.structure;
  const [askTrace, setAskTrace] = useState(false);
  const m = modelOf(data);
  const walls = (data.structure?.walls.length ?? 0) - m.hiddenWalls.length,
    machines = (data.structure?.equipment.length ?? 0) - m.hiddenEquipment.length;
  const elements: ListItem[] = m.elements.map((e) => ({
    id: e.id,
    title: e.name ?? e.id,
    subtitle: `${t.tools[e.kind === 'area' && e.work ? 'work' : e.kind]} · ${e.height} m`,
    dot: elementColor(data, e),
  }));
  const estimate = (data.structure?.walls.length ?? 0) + (data.structure?.equipment.length ?? 0) > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog
        isOpen={askTrace}
        onOpenChange={setAskTrace}
        title={t.list.traceWarn.title}
        description={t.list.traceWarn.body(undoKeys())}
        confirmLabel={t.list.traceWarn.confirm}
        onConfirm={() => edit((d) => traceAll(d))}
      />
      <ModuleList
        controls={
          <>
            <DrawingMenu data={data} />
            {estimate && (
              <div className="flex flex-col gap-2 rounded-lg border border-secondary p-3">
                <p className="text-xs text-secondary">{t.list.estimate(walls, machines)}</p>
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    {(walls > 0 || machines > 0) && (
                      <Button size="sm" color="secondary" onPress={() => setAskTrace(true)}>
                        {t.list.traceAll}
                      </Button>
                    )}
                    {(m.hiddenWalls.length > 0 || m.hiddenEquipment.length > 0) && (
                      <Button size="sm" color="tertiary" onPress={() => edit((d) => restoreEstimate(d))}>
                        {t.list.restore}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        }
        items={elements}
        selectedId={selectedId}
        onSelect={onSelect}
        searchPlaceholder={t.list.search}
        empty={<EmptyState icon={Building07} title={t.list.emptyTitle} subtext={t.list.emptyBody} size="sm" />}
        noMatch={(q) => q}
        label={t.list.elements}
      />
    </div>
  );
}
