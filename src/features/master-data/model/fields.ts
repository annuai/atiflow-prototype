import type { FieldDef } from '@/components/form/types';
import { copy } from '../copy';

/** Form fields of a material (manual add, edit). Which ones a dialog shows is decided by the dialog, not here. */
export const materialFields = (groupNames: string[]): Record<'name' | 'code' | 'group', FieldDef> => ({
  name: {
    key: 'name',
    label: copy.manual.nameLabel,
    control: 'text',
    placeholder: copy.manual.namePlaceholder,
    required: true,
  },
  code: {
    key: 'code',
    label: copy.manual.codeLabel,
    control: 'text',
    placeholder: copy.manual.codePlaceholder,
    required: true,
    unique: true,
  },
  group: {
    key: 'group',
    label: copy.manual.groupLabel,
    control: 'select',
    options: [copy.materials.noGroup, ...groupNames],
  },
});
