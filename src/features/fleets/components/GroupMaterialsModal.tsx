import { useState } from 'react';
import { LayersThree01 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { MaterialPicker, type PickerRow } from '@/features/master-data';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { freeStations, validateGroupForm } from '../model/logic';
import { mapById } from '../model/maps';
import { fleetsStore, profileOf, useFleets } from '../model/store';

interface Props {
  fleet: string;
  rows: PickerRow[];
  preselected: string[];
  onOpenChange(o: boolean): void;
}
function Body({ fleet, rows, preselected, onOpenChange }: Props) {
  const profile = useFleets((s) => profileOf(s.profiles, fleet));
  const stations = freeStations(mapById(profile.mapId), profile.groups);
  const [name, setName] = useState('');
  const [stationId, setStation] = useState(stations[0]?.id ?? '');
  const [sel, setSel] = useState<Set<string>>(new Set(preselected));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = copy.groups.form;
  const submit = () => {
    const v = { name, stationId, codes: [...sel] };
    const e = validateGroupForm(v, profile.groups);
    setErrors(e);
    if (Object.keys(e).length) return;
    fleetsStore.getState().createGroup(fleet, v);
    onOpenChange(false);
    const c = copy.groups.created(name.trim());
    notify.success(c.title, c.body, 'group-created');
  };
  const label = (id: string) => `${id} · ${stations.find((s) => s.id === id)?.name ?? ''}`;
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={LayersThree01}
      title={t.title}
      subtitle={t.subtitle(preselected.length)}
      secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: t.submit, isDisabled: stations.length === 0 }}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5 pt-2">
        <FormField
          def={{ key: 'name', label: t.nameLabel, control: 'text', placeholder: t.namePlaceholder, required: true }}
          value={name}
          onChange={(v) => {
            setName(String(v));
            setErrors((o) => ({ ...o, name: '' }));
          }}
          error={errors.name}
          fleets={[]}
        />
        {stations.length === 0 ? (
          <p className="text-sm text-error-primary">{t.noStations}</p>
        ) : (
          <FormField
            def={{
              key: 'station',
              label: t.stationLabel,
              control: 'select',
              options: stations.map((s) => label(s.id)),
              required: true,
            }}
            value={label(stationId)}
            onChange={(v) => {
              setStation(String(v).split(' · ')[0]);
              setErrors((o) => ({ ...o, stationId: '' }));
            }}
            error={errors.stationId}
            fleets={[]}
          />
        )}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between text-sm text-tertiary">
            <span>{t.showing(rows.length)}</span>
            <span className="font-semibold text-secondary">{copy.materials.selected(sel.size)}</span>
          </div>
          <MaterialPicker
            rows={rows}
            selected={sel}
            onChange={(s) => {
              setSel(s);
              setErrors((o) => ({ ...o, codes: '' }));
            }}
          />
          {errors.codes && (
            <p className="text-sm text-error-primary" role="alert">
              {errors.codes}
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
/** "Group materials": name, station of the fleet's map and the materials. Mounted only while open (`open` carries the preselected codes). */
export const GroupMaterialsModal = ({ open, ...rest }: { open: string[] | null } & Omit<Props, 'preselected'>) =>
  open ? <Body {...rest} preselected={open} /> : null;
