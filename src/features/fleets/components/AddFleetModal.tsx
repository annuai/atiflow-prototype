import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dataflow03, Map01 } from '@untitledui/icons';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { datasetStore } from '@/data/dataset';
import { asFleetId } from '@/data/fleets';
import { ModalShell } from '@/components/modal/ModalShell';
import { KINDS, deviceStore, nameOf, useDevices, type Device, type DeviceKind } from '@/features/devices';
import { MapThumbnail, useMaps } from '@/features/maps';
import { wfStore } from '@/features/workflow-builder';
import { copy } from '../copy';
import { availableMaps } from '../model/logic';
import { fleetsStore, useFleets } from '../model/store';
import { fleetPath } from '../paths';

/** A checklist of the devices of one kind that belong to no fleet yet. */
function DevicePick({
  kind,
  label,
  hint,
  none,
  picked,
  onChange,
}: {
  kind: DeviceKind;
  label: string;
  hint: string;
  none: string;
  picked: Set<string>;
  onChange(s: Set<string>): void;
}) {
  const free = useDevices((s) => s[kind.id]).filter((d: Device) => !d.values.fleet);
  const toggle = (n: string, on: boolean) => {
    const s = new Set(picked);
    if (on) s.add(n);
    else s.delete(n);
    onChange(s);
  };
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-secondary">{label}</legend>
      <p className="text-xs text-tertiary">{free.length ? hint : none}</p>
      {free.length > 0 && (
        <ul className="max-h-44 divide-y divide-secondary overflow-auto rounded-xl border border-secondary">
          {free.map((d) => (
            <li
              key={nameOf(d)}
              className="flex cursor-pointer items-center gap-3 px-3 py-2"
              onClick={(e) => {
                // the whole row picks the device (a click on the check box itself is handled by the check box)
                if (!(e.target as HTMLElement).closest('label')) toggle(nameOf(d), !picked.has(nameOf(d)));
              }}
            >
              <Checkbox
                size="sm"
                aria-label={nameOf(d)}
                isSelected={picked.has(nameOf(d))}
                onChange={(on) => toggle(nameOf(d), on)}
              />
              {kind.thumb(d)}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-primary" translate="no">
                  {nameOf(d)}
                </span>
                <span className="block truncate text-xs text-tertiary">{kind.typeOf(d)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function Body({ onOpenChange }: { onOpenChange(o: boolean): void }) {
  const navigate = useNavigate();
  const t = copy.addFleet;
  const maps = useMaps();
  const profiles = useFleets((s) => s.profiles);
  const hasHardware = useDevices((s) => s.hardware).some((d) => !d.values.fleet);
  const [name, setName] = useState('');
  const [mapId, setMapId] = useState<string | null>(null);
  const [robots, setRobots] = useState<Set<string>>(new Set());
  const [hardware, setHardware] = useState<Set<string>>(new Set());
  const free = availableMaps(maps, profiles, asFleetId(''));
  const map = free.find((m) => m.id === mapId) ?? null;
  const make = () => {
    if (!wfStore.getState().createFleet(name)) return; // it says why (empty, already exists)
    const fleet = datasetStore.getState().fleets.at(-1)!.id;
    if (mapId) fleetsStore.getState().assignMap(fleet, mapId);
    robots.forEach((n) => deviceStore.getState().update('robot', n, { fleet }));
    hardware.forEach((n) => deviceStore.getState().update('hardware', n, { fleet }));
    onOpenChange(false);
    navigate(fleetPath(fleet));
  };
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Dataflow03}
      title={t.title}
      subtitle={t.subtitle}
      size="lg"
      divided
      secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: t.confirm, isDisabled: !name.trim(), onPress: make }}
      onSubmit={make}
    >
      <div className="grid gap-6 pt-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-5">
          <Input autoFocus label={t.name} placeholder={t.namePlaceholder} value={name} onChange={setName} />
          <div className="flex flex-col gap-1.5">
            <Select
              label={t.map}
              placeholder={t.mapPlaceholder}
              isDisabled={free.length === 0}
              selectedKey={mapId}
              onSelectionChange={(k) => setMapId(k ? String(k) : null)}
              items={free.map((m) => ({ id: m.id, label: m.name }))}
            >
              {(item) => <Select.Item {...item} />}
            </Select>
            {free.length === 0 && <p className="text-xs text-tertiary">{t.mapTaken}</p>}
          </div>
          <DevicePick
            kind={KINDS.robot}
            label={t.robots}
            hint={t.robotsHint}
            none={t.robotsNone}
            picked={robots}
            onChange={setRobots}
          />
          {hasHardware && (
            <DevicePick
              kind={KINDS.hardware}
              label={t.hardware}
              hint={t.hardwareHint}
              none=""
              picked={hardware}
              onChange={setHardware}
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-tertiary uppercase">{t.preview}</span>
          <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-secondary p-2 ring-1 ring-secondary">
            {map ? (
              <MapThumbnail map={map} fleetLive={map.fleetLive} className="size-full" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-3 text-center text-xs text-tertiary">
                <Map01 className="size-6" />
                {t.previewEmpty}
              </span>
            )}
          </div>
          {map && <span className="text-xs text-secondary">{map.name}</span>}
        </div>
      </div>
    </ModalShell>
  );
}

/** "Add Fleet" (Figma 76:2768): name, map, robots (and hardware, when there is any) in one step, with a preview of the chosen map. Mounted only while open. */
export const AddFleetModal = ({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange(o: boolean): void }) =>
  isOpen ? <Body onOpenChange={onOpenChange} /> : null;
