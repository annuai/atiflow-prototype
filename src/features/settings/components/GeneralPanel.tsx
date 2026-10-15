import { useMemo, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { SettingsRow } from '@/components/data/SettingsRow';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { ZONES } from '../model/zones';
import { settingsStore, useSettings } from '../data/store';
import type { GeneralSettings, Units } from '../model/types';

const LANGUAGES = ['English'];

/** Site name, time zone, units and language: one form with Save / Cancel (Save is enabled only after a change). */
export function GeneralPanel() {
  const saved = useSettings((s) => s.general);
  const [g, setG] = useState<GeneralSettings>(saved);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(g) !== JSON.stringify(saved);
  const zones = useMemo(() => (ZONES.includes(saved.timeZone) ? ZONES : [saved.timeZone, ...ZONES]), [saved.timeZone]);
  const save = () => {
    if (!g.siteName.trim()) {
      setError('Required');
      return;
    }
    settingsStore.getState().saveGeneral({ ...g, siteName: g.siteName.trim() });
    setError('');
    notify.success(copy.general.saved, undefined, 'settings-saved');
  };
  return (
    <div className="flex max-w-4xl flex-col">
      <SettingsRow label={copy.general.siteName} hint={copy.general.siteNameHint}>
        <Input
          aria-label={copy.general.siteName}
          value={g.siteName}
          onChange={(v) => {
            setG({ ...g, siteName: v });
            setError('');
          }}
          isInvalid={!!error}
          hint={error || undefined}
        />
      </SettingsRow>
      <SettingsRow label={copy.general.timeZone} hint={copy.general.timeZoneHint}>
        <Select
          aria-label={copy.general.timeZone}
          selectedKey={g.timeZone}
          onSelectionChange={(k) => setG({ ...g, timeZone: String(k) })}
          items={zones.map((z) => ({ id: z, label: z.replace(/_/g, ' ') }))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </SettingsRow>
      <SettingsRow label={copy.general.units}>
        <Select
          aria-label={copy.general.units}
          selectedKey={g.units}
          onSelectionChange={(k) => setG({ ...g, units: String(k) as Units })}
          items={[
            { id: 'metric', label: copy.general.metric },
            { id: 'imperial', label: copy.general.imperial },
          ]}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </SettingsRow>
      <SettingsRow label={copy.general.language} hint={copy.general.languageHint}>
        <Select
          aria-label={copy.general.language}
          selectedKey={g.language}
          onSelectionChange={(k) => setG({ ...g, language: String(k) })}
          items={LANGUAGES.map((l) => ({ id: l, label: l }))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </SettingsRow>
      <p className="pt-4 text-xs text-tertiary">{copy.general.note}</p>
      <div className="flex justify-end gap-3 pt-4">
        <Button
          size="md"
          color="secondary"
          isDisabled={!dirty}
          onPress={() => {
            setG(saved);
            setError('');
          }}
        >
          {copy.general.cancel}
        </Button>
        <Button size="md" color="primary" isDisabled={!dirty} onPress={save}>
          {copy.general.save}
        </Button>
      </div>
    </div>
  );
}
