import { useState } from 'react';
import { Building07, ChevronDown, Plus } from '@untitledui/icons';
import { Button as AriaButton } from 'react-aria-components';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { copy } from '../copy';
import { ModuleList, type ListItem } from '../components/ModuleList';
import { elementColor } from '../model/structure/derive';
import { addSection, modelOf } from '../model/structure/ops';
import { PALETTE } from '../model/structure/palette';
import { structureDxf } from '../model/structure/dxf';
import { restoreEstimate, traceAll } from '../model/structure/trace';
import type { MapData } from '../model/types';
import { SectionForm } from './SectionForm';

type Tab = 'elements' | 'sections';

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
 * The Structure module's list: the elements (search, a colour dot, kind and height) and the sections (colour, how many elements), the buttons to turn the whole lidar estimate into elements
 * or bring it back, and the estimate's counts. Choosing an element opens its form (the side panel does that); choosing a section opens its own form here.
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
  const [tab, setTab] = useState<Tab>('elements');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const m = modelOf(data);
  const section = m.sections.find((s) => s.id === sectionId);
  if (tab === 'sections' && section)
    return (
      <SectionForm section={section} data={data} editable={editable} edit={edit} onBack={() => setSectionId(null)} />
    );
  const walls = (data.structure?.walls.length ?? 0) - m.hiddenWalls.length,
    machines = (data.structure?.equipment.length ?? 0) - m.hiddenEquipment.length;
  const elements: ListItem[] = m.elements.map((e) => ({
    id: e.id,
    title: e.name ?? e.id,
    subtitle: `${t.tools[e.kind === 'area' && e.work ? 'work' : e.kind]} · ${e.height} m${e.section ? ` · ${m.sections.find((s) => s.id === e.section)?.name ?? ''}` : ''}`,
    dot: elementColor(data, e),
  }));
  const sections: ListItem[] = m.sections.map((s) => ({
    id: s.id,
    title: s.name,
    subtitle: t.sectionForm.count(m.elements.filter((e) => e.section === s.id).length),
    dot: s.color,
  }));
  const tabs = (
    <SegmentedTabs<Tab>
      value={tab}
      onChange={setTab}
      label={t.tabTitle}
      items={[
        { id: 'elements', label: t.list.elements },
        { id: 'sections', label: t.list.sections },
      ]}
    />
  );
  const estimate = (data.structure?.walls.length ?? 0) + (data.structure?.equipment.length ?? 0) > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {tab === 'elements' ? (
        <ModuleList
          controls={
            <>
              <div className="flex items-center justify-between gap-2">
                {tabs}
                <DrawingMenu data={data} />
              </div>
              {estimate && (
                <div className="flex flex-col gap-2 rounded-lg border border-secondary p-3">
                  <p className="text-xs text-secondary">{t.list.estimate(walls, machines)}</p>
                  {editable && (
                    <div className="flex flex-wrap gap-2">
                      {(walls > 0 || machines > 0) && (
                        <Button size="sm" color="secondary" onPress={() => edit((d) => traceAll(d))}>
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
      ) : (
        <ModuleList
          controls={
            <>
              {tabs}
              {editable && (
                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={Plus}
                  onPress={() => {
                    const n = modelOf(data).sections.length;
                    const r = addSection(
                      data,
                      t.sectionForm.newName(n + 1),
                      PALETTE[(3 + n * 3) % PALETTE.length].color,
                    );
                    edit(() => r.data);
                    setSectionId(r.id);
                  }}
                >
                  {t.sectionForm.add}
                </Button>
              )}
            </>
          }
          items={sections}
          selectedId={sectionId}
          onSelect={setSectionId}
          searchPlaceholder={t.list.search}
          empty={<EmptyState icon={Building07} title={t.list.sections} subtext={t.sectionForm.add} size="sm" />}
          noMatch={(q) => q}
          label={t.list.sections}
        />
      )}
    </div>
  );
}
