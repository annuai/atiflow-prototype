import { useState, type ReactNode } from 'react';
import { TabbedPanel } from '@/components/data/TabbedPanel';
import { useLocation, useNavigate } from 'react-router-dom';
import { GamingPad01, RefreshCcw03, Rows01, Settings02, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { useFleetChoices, useFleetName } from '@/data/fleetDirectory';
import { asFleetId } from '@/data/fleets';
import { notify } from '@/ui/toast';
import { deviceStore } from '../model/store';
import { nameOf } from '../model/validate';
import type { Device, DeviceKind, FieldValue } from '../model/types';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { FormField } from '@/components/form/FormField';
import { fleetPath, FLEETS_PATH } from '@/features/fleets';
import {
  CalibrationTab,
  ConfigurationTab,
  SoftwareUpdateTab,
  type EditFooter,
  type RobotRef,
} from '@/features/robot-ops';
import { robotTypeByLabel } from '@/data/robotTypes';
import { DetailBreadcrumb, type Crumb } from './DetailBreadcrumb';
import { StatusBadge } from './StatusBadge';
import { t } from '../text';
import { PageCard } from '@/components/page';

const TAB_ICONS = [Rows01, Settings02, GamingPad01, RefreshCcw03];
const detailOf = (f: { detail?: unknown }) =>
  typeof f.detail === 'object'
    ? (f.detail as { label?: string; display?: 'text' | 'badge' | 'badges'; editable?: boolean })
    : {};

/** Detail card for one robot / hardware: breadcrumb, big name + badges, picture, optional tabs, spec grid, footer actions. */
export function DeviceDetail({ kind, device }: { kind: DeviceKind; device: Device }) {
  const navigate = useNavigate();
  const name = nameOf(device);
  const fleets = useFleetChoices();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  const [tab, setTab] = useState('Details');
  const [confirm, setConfirm] = useState(false);
  const fleet = asFleetId(String(device.values.fleet ?? ''));
  const fleetName = useFleetName(fleet);
  // opened from a fleet page (link state) while still in that fleet: Fleets > <fleet> > <name>; otherwise Robots / Hardware > <name>
  const from = (useLocation().state as { fleet?: string } | null)?.fleet;
  const viaFleet = !!from && from === fleet;
  const back = viaFleet ? fleetPath(fleet) : `/configurator/${kind.route}`;
  const trail: Crumb[] = viaFleet
    ? [
        { label: t.detail.fleets, onPress: () => navigate(FLEETS_PATH) },
        { label: fleetName, onPress: () => navigate(back) },
        { label: name },
      ]
    : [{ label: kind.plural, onPress: () => navigate(back) }, { label: name }];
  const value = (key: string) => (key in draft ? draft[key] : (device.values[key] ?? ''));
  const fields = kind.fields
    .map((f, i) => ({ f, o: f.detailOrder ?? 100 + i }))
    .filter((x) => x.f.detail)
    .sort((a, b) => a.o - b.o)
    .map((x) => x.f);
  const save = () => {
    deviceStore.getState().update(kind.id, name, draft);
    setEditing(false);
    setDraft({});
    notify.success(t.detail.saved, undefined, 'device-saved');
  };
  const unassign = () => {
    deviceStore.getState().update(kind.id, name, { fleet: '' });
    const done = t.detail.unassigned(name, fleetName);
    notify.success(done.title, done.body, 'device-unassigned');
  };
  const remove = () => {
    deviceStore.getState().remove(kind.id, name);
    navigate(back, { replace: true });
    notify.success(t.detail.removed(name), undefined, 'device-removed');
  };
  const tabs = kind.detail.tabs;
  const robot: RobotRef = {
    name,
    type: robotTypeByLabel(device.values.sherpaType).id,
    firmware: String(device.values.firmware ?? ''),
  };
  const online = device.status === 'online';
  /** The buttons at the bottom of the Details and Configuration tabs: Remove / Unassign on the left, then Edit (or Cancel / Save while editing). */
  const footer = (f: EditFooter): ReactNode => (
    <div className="contents sm:mt-auto sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:pt-2">
      {!f.editing && (
        <Button
          color="tertiary-destructive"
          size="md"
          iconLeading={Trash01}
          className="mt-auto self-start sm:mr-auto sm:mt-0"
          onPress={() => setConfirm(true)}
        >
          {t.detail.remove(kind.singular)}
        </Button>
      )}
      {/* On a phone the main actions stay at the bottom of the card while the fields scroll under them, side by side and as wide as the card allows */}
      <div className="flex gap-3 max-sm:sticky max-sm:-bottom-4 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-secondary max-sm:bg-primary max-sm:px-4 max-sm:py-3 max-sm:[&>button]:flex-1 sm:justify-end">
        {f.editing ? (
          <>
            <Button color="secondary" size="md" isDisabled={f.busy} onPress={f.onCancel}>
              {t.detail.cancel}
            </Button>
            <Button color="primary" size="md" isLoading={f.busy} onPress={f.onSave}>
              {t.detail.saveChanges}
            </Button>
          </>
        ) : (
          <>
            {fleet && (
              <Button color="secondary" size="md" onPress={unassign}>
                {t.detail.unassign(fleetName)}
              </Button>
            )}
            <Button color="primary" size="md" isDisabled={f.disabled} onPress={f.onEdit}>
              {f.editLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
  const content = (
    <>
      {tab === 'Details' ? (
        <>
          <div>
            <h2 className="text-lg font-semibold text-primary">{kind.detail.heading}</h2>
            <p className="text-sm text-tertiary">{kind.detail.description}</p>
          </div>
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            {fields.map((f) => {
              const d = detailOf(f);
              const editable = !!d.editable && editing;
              return (
                <FormField
                  key={f.key}
                  def={f}
                  label={d.label ?? f.label}
                  display={d.display}
                  value={value(f.key)}
                  disabled={!editable}
                  fleets={fleets}
                  onChange={(v) => setDraft((o) => ({ ...o, [f.key]: v }))}
                />
              );
            })}
          </div>
          {footer({
            editing,
            busy: false,
            disabled: false,
            editLabel: t.detail.edit,
            onEdit: () => setEditing(true),
            onSave: save,
            onCancel: () => {
              setEditing(false);
              setDraft({});
            },
          })}
        </>
      ) : tab === 'Configuration' ? (
        <ConfigurationTab robot={robot} renderFooter={footer} />
      ) : tab === 'Calibration' ? (
        <CalibrationTab robot={robot} online={online} />
      ) : (
        <SoftwareUpdateTab
          robot={robot}
          online={online}
          onInstalled={(version) => deviceStore.getState().update(kind.id, name, { firmware: version })}
        />
      )}
    </>
  );
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-1 sm:min-h-[96px] sm:flex-nowrap">
        <div className="flex h-full min-w-0 flex-1 flex-col justify-between gap-2">
          <DetailBreadcrumb trail={trail} />
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:px-3">
            <h1 className="min-w-0 truncate text-4xl font-bold tracking-tight text-primary sm:text-5xl sm:leading-[60px]">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-1 pb-2">
              {kind.headerBadges(device).map((b) => (
                <Badge key={b} size="md" type="pill-color" color="gray">
                  {b}
                </Badge>
              ))}
              {fleet && (
                <Badge size="md" type="pill-color" color="indigo">
                  {fleetName}
                </Badge>
              )}
              <StatusBadge status={device.status} type="pill-color" />
            </div>
          </div>
        </div>
        <div className="flex h-16 w-24 shrink-0 items-center justify-center sm:h-[96px] sm:w-[200px]">
          {kind.illustration(device)}
        </div>
      </div>
      <PageCard className="overflow-y-auto p-4 sm:p-6" data-testid="device-detail">
        {tabs ? (
          <TabbedPanel
            tabs={tabs.map((id, i) => ({
              id,
              label: t.tabs[id as keyof typeof t.tabs] ?? id,
              icon: TAB_ICONS[i],
            }))}
            selected={tab}
            onSelect={setTab}
            label={t.detail.sections}
            rootClassName="flex-1"
            barClassName="min-w-0"
            panelClassName="flex flex-1 flex-col pt-6"
            contentClassName="flex flex-1 flex-col gap-6 sm:gap-8"
          >
            {content}
          </TabbedPanel>
        ) : (
          <>
            <div className="h-px w-full bg-border-secondary" />
            <div className="flex flex-1 flex-col pt-6">
              <div className="flex flex-1 flex-col gap-6 sm:gap-8">{content}</div>
            </div>
          </>
        )}
        <ConfirmDialog
          isOpen={confirm}
          onOpenChange={setConfirm}
          title={t.detail.confirm.title(name)}
          description={t.detail.confirm.description(kind.singular)}
          confirmLabel={t.detail.confirm.action}
          onConfirm={remove}
        />
      </PageCard>
    </>
  );
}
