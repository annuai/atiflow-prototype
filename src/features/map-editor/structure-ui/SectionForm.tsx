import { useSyncedState } from '@/hooks/use-synced-state';
import { ArrowLeft, Trash01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { copy } from '../copy';
import { deleteSection, modelOf, updateSection } from '../model/structure/ops';
import type { Section } from '../model/structure/types';
import type { MapData } from '../model/types';
import { ColorPicker } from './ColorPicker';

/** One section: its name, its colour (every element without a colour of its own takes it) and whether its name is shown over it in 3D. */
export function SectionForm({
  section,
  data,
  editable,
  edit,
  onBack,
}: {
  section: Section;
  data: MapData;
  editable: boolean;
  edit(fn: (d: MapData) => MapData, key?: string): void;
  onBack(): void;
}) {
  const f = copy.structure.sectionForm;
  const [name, setName] = useSyncedState(section.name, section.id);
  const n = modelOf(data).elements.filter((e) => e.section === section.id).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
        {f.back}
      </button>
      <Input
        label={f.name}
        size="sm"
        value={name}
        isDisabled={!editable}
        onChange={setName}
        onBlur={() =>
          name.trim() && name.trim() !== section.name
            ? edit((m) => updateSection(m, section.id, { name: name.trim() }))
            : setName(section.name)
        }
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
        }}
      />
      <ColorPicker
        label={copy.structure.form.color}
        value={section.color}
        custom={copy.structure.form.customColor}
        disabled={!editable}
        onChange={(color) => color && edit((m) => updateSection(m, section.id, { color }))}
      />
      <Checkbox
        size="sm"
        label={f.label}
        isDisabled={!editable}
        isSelected={section.label}
        onChange={(label) => edit((m) => updateSection(m, section.id, { label }))}
      />
      <p className="text-xs text-tertiary">{f.count(n)}</p>
      {editable && (
        <Button
          className="mt-auto"
          size="md"
          color="secondary-destructive"
          iconLeading={Trash01}
          onPress={() => {
            edit((m) => deleteSection(m, section.id));
            onBack();
          }}
        >
          {f.delete}
        </Button>
      )}
    </div>
  );
}
