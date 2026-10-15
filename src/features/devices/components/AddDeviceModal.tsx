import { useState } from 'react';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { useFleetNames } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { deviceStore, useDevices } from '../model/store';
import { blankValues, validateNew } from '../model/validate';
import type { DeviceKind, FieldValue } from '../model/types';

interface Props {
  kind: DeviceKind;
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  preset?: Record<string, FieldValue>;
}

function Body({
  kind,
  values,
  errors,
  set,
}: {
  kind: DeviceKind;
  values: Record<string, FieldValue>;
  errors: Record<string, string>;
  set(key: string): (v: FieldValue) => void;
}) {
  const fleets = useFleetNames();
  const fields = kind.fields.filter((f) => f.modal);
  const preview = kind.preview(values);
  // consecutive 'half' fields share a row
  const rows: (typeof fields)[] = [];
  fields.forEach((f) => {
    const last = rows[rows.length - 1];
    if (f.modal === 'half' && last?.[0].modal === 'half' && last.length < 2) last.push(f);
    else rows.push([f]);
  });
  return (
    <div className="flex gap-6 px-2 pt-4">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {rows.map((r) => (
          <div key={r[0].key} className={r.length > 1 ? 'grid grid-cols-2 gap-4' : undefined}>
            {r.map((f) => (
              <FormField
                key={f.key}
                def={f}
                value={values[f.key]}
                onChange={set(f.key)}
                error={errors[f.key]}
                fleets={fleets}
                showTag
              />
            ))}
          </div>
        ))}
      </div>
      <div className="hidden w-[200px] shrink-0 flex-col items-center gap-4 sm:flex" aria-label="Preview">
        {preview.heading && <p className="text-xs font-semibold text-secondary">{preview.heading}</p>}
        <div className="grid size-[180px] place-items-center rounded-xl border border-primary bg-secondary p-4">
          {preview.image}
        </div>
        <p className="text-xs font-semibold text-secondary">{preview.caption}</p>
      </div>
    </div>
  );
}

/** "Add Robot" / "Add Hardware" dialog: form column + live preview column. Everything comes from the DeviceKind. */
function Form({ kind, preset, isOpen, onOpenChange }: Props) {
  const existing = useDevices((s) => s[kind.id]);
  const [values, setValues] = useState(() => blankValues(kind, preset));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: string) => (v: FieldValue) => {
    setValues((o) => ({ ...o, [key]: v }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };
  const submit = () => {
    const clean = { ...values, name: String(values.name).trim(), hardwareId: String(values.hardwareId).trim() };
    const problems = validateNew(kind, clean, existing);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    deviceStore.getState().add(kind.id, clean);
    onOpenChange(false);
    notify.success(`${clean.name} added`, 'It stays Offline until it connects.', 'device-added');
  };
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      icon={kind.icon}
      title={kind.addLabel}
      subtitle={kind.addSubtitle}
      divided
      secondary={{ label: 'Cancel', onPress: () => onOpenChange(false) }}
      primary={{ label: kind.addLabel }}
      onSubmit={submit}
    >
      <Body kind={kind} values={values} errors={errors} set={set} />
    </ModalShell>
  );
}
/** Mounted only while open so every opening starts from a blank form. */
export const AddDeviceModal = (props: Props) => (props.isOpen ? <Form {...props} /> : null);
