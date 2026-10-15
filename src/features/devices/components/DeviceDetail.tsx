import { useState, type ReactNode } from 'react';
import { TabbedPanel } from '@/components/data/TabbedPanel';
import { useLocation, useNavigate } from 'react-router-dom';
import { GamingPad01, RefreshCcw03, Rows01, Settings02, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { useFleetNames } from '@/features/workflow-builder';
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

const TAB_ICONS = [Rows01, Settings02, GamingPad01, RefreshCcw03];
const detailOf = (f: { detail?: unknown }) =>
  typeof f.detail === 'object'
    ? (f.detail as { label?: string; display?: 'text' | 'badge' | 'badges'; editable?: boolean })
    : {};

/** Detail card for one robot / hardware: breadcrumb, big name + badges, picture, optional tabs, spec grid, footer actions. */
export function DeviceDetail({ kind, device }: { kind: DeviceKind; device: Device }) {
  const navigate = useNavigate();
  const name = nameOf(device);
  const fleets = useFleetNames();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  const [tab, setTab] = useState('Details');
  const [confirm, setConfirm] = useState(false);
  const fleet = String(device.values.fleet ?? '');
  // opened from a fleet page (link state) while still in that fleet: Fleets > <fleet> > <name>; otherwise Robots / Hardware > <name>
  const from = (useLocation().state as { fleet?: string } | null)?.fleet;
  const viaFleet = !!from && from === fleet;
  const back = viaFleet ? fleetPath(fleet) : `/configurator/${kind.route}`;
  const trail: Crumb[] = viaFleet
    ? [
        { label: 'Fleets', onPress: () => navigate(FLEETS_PATH) },
        { label: fleet, onPress: () => navigate(back) },
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
    notify.success('Details saved', undefined, 'device-saved');
  };
  const unassign = () => {
    deviceStore.getState().update(kind.id, name, { fleet: '' });
    notify.success(`${name} unassigned`, `Removed from ${fleet}.`, 'device-unassigned');
  };
  const remove = () => {
    deviceStore.getState().remove(kind.id, name);
    navigate(back, { replace: true });
    notify.success(`${name} removed`, undefined, 'device-removed');
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
    <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-2">
      {!f.editing && (
        <Button
          color="tertiary-destructive"
          size="md"
          iconLeading={Trash01}
          className="mr-auto"
          onPress={() => setConfirm(true)}
        >
          Remove {kind.singular.toLowerCase()}
        </Button>
      )}
      {f.editing ? (
        <>
          <Button color="secondary" size="md" isDisabled={f.busy} onPress={f.onCancel}>
            Cancel
          </Button>
          <Button color="primary" size="md" isLoading={f.busy} onPress={f.onSave}>
            Save Changes
          </Button>
        </>
      ) : (
        <>
          {fleet && (
            <Button color="secondary" size="md" onPress={unassign}>
              Unassign from {fleet}
            </Button>
          )}
          <Button color="primary" size="md" isDisabled={f.disabled} onPress={f.onEdit}>
            {f.editLabel}
          </Button>
        </>
      )}
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
            editLabel: 'Edit Details',
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
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-1 sm:min-h-[140px] sm:flex-nowrap">
        <div className="flex h-full min-w-0 flex-1 flex-col justify-between gap-6">
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
                  {fleet}
                </Badge>
              )}
              <StatusBadge status={device.status} type="pill-color" />
            </div>
          </div>
        </div>
        <div className="hidden h-[134px] w-[290px] shrink-0 items-center justify-center lg:flex">
          {kind.illustration(device)}
        </div>
      </div>
      <div
        className="mb-3 mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[20px] border border-secondary bg-primary p-4 shadow-xs sm:p-6"
        data-testid="device-detail"
      >
        {tabs ? (
          <TabbedPanel
            tabs={tabs.map((t, i) => ({ id: t, label: t, icon: TAB_ICONS[i] }))}
            selected={tab}
            onSelect={setTab}
            label="Sections"
            barClassName="mt-6 min-w-0"
            listClassName="overflow-x-auto"
            panelClassName="flex flex-1 flex-col pt-6"
            contentClassName="flex flex-1 flex-col gap-6 sm:gap-8"
          >
            {content}
          </TabbedPanel>
        ) : (
          <>
            <div className="mt-6 h-px w-full bg-border-secondary" />
            <div className="flex flex-1 flex-col pt-6">
              <div className="flex flex-1 flex-col gap-6 sm:gap-8">{content}</div>
            </div>
          </>
        )}
        <ConfirmDialog
          isOpen={confirm}
          onOpenChange={setConfirm}
          title={`Remove ${name}?`}
          description={`This ${kind.singular.toLowerCase()} will be deleted from the configurator. You can register it again later.`}
          confirmLabel="Remove"
          onConfirm={remove}
        />
      </div>
    </>
  );
}
