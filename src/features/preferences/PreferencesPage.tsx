import { useMemo, useState } from 'react';
import { TabbedPanel } from '@/components/data/TabbedPanel';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bell01, Globe01, Home02 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { LanguageSelect } from '@/components/data/LanguageSelect';
import { Select } from '@/components/base/select/select';
import { Toggle } from '@/components/base/toggle/toggle';
import { SettingsRow } from '@/components/data/SettingsRow';
import { WORKSPACES, can } from '@/features/access';
import { useVisibleFleets } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { SUPERVISOR_SETTINGS_PATH } from '@/features/live-floor';
import { OPERATOR_SETTINGS_PATH } from '@/features/action-center';
import { notify } from '@/ui/toast';
import { copy } from './copy';
import { preferencesStore, useMyPreferences } from './data/store';
import {
  BATTERY_OPTIONS,
  DEFAULT_PREFERENCES,
  SECONDS_OPTIONS,
  secondsLabel,
  validatePreferences,
} from './model/defaults';
import type { Preferences } from './model/types';
import { Page, PageCard, PageHeader } from '@/components/page';

const ALL_TABS = [
  { id: 'alerts', icon: Bell01 },
  { id: 'start', icon: Home02 },
  { id: 'language', icon: Globe01 },
] as const;
type TabId = (typeof ALL_TABS)[number]['id'];
/** Supervisors set alerts, start page and language; operators have only the language. */
const TABS_OF: Record<'supervisor' | 'operator', TabId[]> = {
  supervisor: ['alerts', 'start', 'language'],
  operator: ['language'],
};
const opts = (values: number[], label: (n: number) => string) =>
  values.map((v) => ({ id: String(v), label: label(v) }));

/**
 * A supervisor's Settings: their own preferences (alerts and thresholds, the page the app opens on), saved per person. One draft across the three tabs and one
 * Save at the bottom. The alert settings drive the real notifications and the Dashboard's "needs attention" list; the start page and default fleet drive where the app opens.
 */
export function PreferencesPage() {
  const { tab = '' } = useParams();
  const workspace = useLocation().pathname.startsWith('/operator') ? 'operator' : 'supervisor';
  const base = workspace === 'operator' ? OPERATOR_SETTINGS_PATH : SUPERVISOR_SETTINGS_PATH;
  const TABS = ALL_TABS.filter((t) => TABS_OF[workspace].includes(t.id));
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const saved = useMyPreferences();
  const fleets = useVisibleFleets();
  const [d, setD] = useState<Preferences>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const active = TABS.find((t) => t.id === tab);
  const pages = useMemo(
    () => WORKSPACES.find((w) => w.id === 'supervisor')!.features.filter((f) => f.landing && can(user, f.id)),
    [user],
  );
  if (!active) return <Navigate to={`${base}/${TABS[0].id}`} replace />;
  const setAlerts = (patch: Partial<Preferences['alerts']>) => {
    setD({ ...d, alerts: { ...d.alerts, ...patch } });
    setErrors({});
  };
  const save = () => {
    const e = validatePreferences(d);
    setErrors(e);
    if (Object.keys(e).length) {
      navigate(`${base}/alerts`);
      return;
    }
    preferencesStore.getState().save(user.username, d);
    notify.success(copy.saved, undefined, 'prefs-saved');
  };
  const secs = (label: string, key: 'notifyAfterS' | 'waitWarnS' | 'waitUrgentS', hint?: string) => (
    <SettingsRow label={label} hint={hint}>
      <Select
        aria-label={label}
        selectedKey={String(d.alerts[key])}
        isInvalid={!!errors[key]}
        onSelectionChange={(k) => setAlerts({ [key]: +String(k) })}
        items={opts(SECONDS_OPTIONS, secondsLabel)}
      >
        {(i) => <Select.Item {...i} />}
      </Select>
      {errors[key] && <p className="mt-1 text-sm text-error-primary">{errors[key]}</p>}
    </SettingsRow>
  );
  const toggle = (key: 'blocked' | 'fault' | 'stuck' | 'battery') => (
    <Toggle size="md" label={copy.alerts[key]} isSelected={d.alerts[key]} onChange={(v) => setAlerts({ [key]: v })} />
  );
  return (
    <>
      <Page>
        <PageHeader title={copy.title} subtitle={copy.tabs[active.id].subtitle} />
        <PageCard>
          <TabbedPanel
            tabs={TABS.map((t) => ({ id: t.id, label: copy.tabs[t.id].label, icon: t.icon }))}
            selected={active.id}
            onSelect={(k) => navigate(`${base}/${k as TabId}`)}
            label={copy.title}
          >
            <div className="flex max-w-4xl flex-col">
              <div className="flex flex-col">
                {active.id === 'alerts' && (
                  <>
                    <SettingsRow label={copy.alerts.notify} hint={copy.alerts.notifyHint}>
                      <div className="flex flex-col gap-3">
                        {toggle('blocked')}
                        {toggle('fault')}
                        {toggle('stuck')}
                        {toggle('battery')}
                      </div>
                    </SettingsRow>
                    {secs(copy.alerts.notifyAfter, 'notifyAfterS', copy.alerts.notifyAfterHint)}
                    {secs(copy.alerts.warn, 'waitWarnS', copy.alerts.warnHint)}
                    {secs(copy.alerts.urgent, 'waitUrgentS')}
                    <SettingsRow label={copy.alerts.batteryLow} hint={copy.alerts.batteryLowHint}>
                      <Select
                        aria-label={copy.alerts.batteryLow}
                        selectedKey={String(d.alerts.batteryLow)}
                        onSelectionChange={(k) => setAlerts({ batteryLow: +String(k) })}
                        items={opts(BATTERY_OPTIONS, (n) => `${n}%`)}
                      >
                        {(i) => <Select.Item {...i} />}
                      </Select>
                    </SettingsRow>
                  </>
                )}
                {active.id === 'start' && (
                  <>
                    <SettingsRow label={copy.start.page} hint={copy.start.pageHint}>
                      <Select
                        aria-label={copy.start.page}
                        selectedKey={d.startPage}
                        onSelectionChange={(k) => setD({ ...d, startPage: String(k) })}
                        items={[
                          { id: 'last', label: copy.start.last },
                          ...pages.map((f) => ({ id: f.landing!, label: f.label })),
                        ]}
                      >
                        {(i) => <Select.Item {...i} />}
                      </Select>
                    </SettingsRow>
                    <SettingsRow label={copy.start.fleet} hint={copy.start.fleetHint}>
                      <Select
                        aria-label={copy.start.fleet}
                        selectedKey={
                          fleets.some((f) => (f.liveId ?? f.id) === d.defaultFleet)
                            ? d.defaultFleet
                            : (fleets[0]?.liveId ?? fleets[0]?.id) || null
                        }
                        onSelectionChange={(k) => setD({ ...d, defaultFleet: String(k) })}
                        items={fleets.map((f) => ({ id: f.liveId ?? f.id, label: f.name }))}
                      >
                        {(i) => <Select.Item {...i} />}
                      </Select>
                    </SettingsRow>
                  </>
                )}
                {active.id === 'language' && (
                  <>
                    <SettingsRow label={copy.language.label} hint={copy.language.hint}>
                      <LanguageSelect
                        aria-label={copy.language.label}
                        value={d.language}
                        onChange={(language) => setD({ ...d, language })}
                        extra={{ id: 'site', label: copy.language.siteDefault }}
                      />
                    </SettingsRow>
                  </>
                )}
              </div>
              <div className="flex flex-wrap justify-between gap-3 pt-5">
                <Button
                  size="md"
                  color="tertiary"
                  isDisabled={JSON.stringify(d) === JSON.stringify(DEFAULT_PREFERENCES)}
                  onPress={() => {
                    setD(DEFAULT_PREFERENCES);
                    setErrors({});
                  }}
                >
                  {copy.reset}
                </Button>
                <div className="flex gap-3">
                  <Button
                    size="md"
                    color="secondary"
                    isDisabled={!dirty}
                    onPress={() => {
                      setD(saved);
                      setErrors({});
                    }}
                  >
                    {copy.cancel}
                  </Button>
                  <Button size="md" color="primary" isDisabled={!dirty} onPress={save}>
                    {copy.save}
                  </Button>
                </div>
              </div>
            </div>
          </TabbedPanel>
        </PageCard>
      </Page>
    </>
  );
}
