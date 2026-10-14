import { useState } from 'react';
import { Link03 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { settingsStore, useSettings } from '../data/store';
import { connectionErrors } from '../model/validate';
import type { ConnectionDef, ConnectionField } from '../model/types';

function Form({ def, onOpenChange }: { def: ConnectionDef; onOpenChange(o: boolean): void }) {
  const saved = useSettings((s) => s.connections[def.id].values); const [values, setValues] = useState<Record<string, string>>({ ...saved }); const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string | string[]) => { setValues((o) => ({ ...o, [k]: String(v) })); setErrors((e) => ({ ...e, [k]: '' })); };
  const submit = () => {
    const clean = Object.fromEntries(def.fields.map((f) => [f.key, (values[f.key] ?? '').trim()])); const p = connectionErrors(def, clean);
    // required fields may be left empty here (saved as not set); only what is typed has to be valid
    const typed = Object.fromEntries(Object.entries(p).filter(([k]) => clean[k] !== '')); setErrors(typed); if (Object.keys(typed).length) return;
    settingsStore.getState().saveConnection(def.id, clean); onOpenChange(false); notify.success(copy.edit.saved(def.name), undefined, `save-${def.id}`);
  };
  const groups = def.fields.reduce<[string, ConnectionField[]][]>((acc, f) => { const g = f.group ?? ''; const hit = acc.find(([t]) => t === g); if (hit) hit[1].push(f); else acc.push([g, [f]]); return acc; }, []);                // the main block first, then each group under its heading
  return (
    <ModalShell isOpen onOpenChange={onOpenChange} icon={Link03} title={copy.edit.title(def.name)} subtitle={copy.edit.subtitle} divided secondary={{ label: 'Cancel', onPress: () => onOpenChange(false) }} primary={{ label: copy.edit.save }} onSubmit={submit}>
      <div className="flex flex-col gap-5 px-2 pt-4">
        {groups.map(([title, fields]) => (
          <section key={title || 'main'} className="flex flex-col gap-4" aria-label={title || def.name}>
            {title && <h3 className="text-md font-semibold text-primary">{title}</h3>}
            {fields.map((f) => (
              <div key={f.key}><FormField def={{ key: f.key, label: f.label, control: f.kind === 'secret' ? 'secret' : 'text', placeholder: f.placeholder, required: f.required }} value={values[f.key] ?? ''} onChange={set(f.key)} error={errors[f.key]} fleets={[]} />{f.hint && <p className="mt-1 text-xs text-tertiary">{f.hint}</p>}</div>
            ))}
          </section>
        ))}
      </div>
    </ModalShell>
  );
}
/** Mounted only while open so every opening starts from the saved values. */
export const EditConnectionModal = ({ def, onOpenChange }: { def: ConnectionDef | null; onOpenChange(o: boolean): void }) => (def ? <Form key={def.id} def={def} onOpenChange={onOpenChange} /> : null);
