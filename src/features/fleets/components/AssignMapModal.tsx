import { MapThumbnail } from '@/features/maps/components/MapThumbnail';
import { EmptyState } from '@/components/data/EmptyState';
import { useState } from 'react';
import { Map01 } from '@untitledui/icons';
import { Radio, RadioGroup } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { useMaps } from '@/features/maps/model/maps';
import { fleetsStore, profileOf, useFleets } from '../model/store';

function Body({ fleet, onOpenChange }: { fleet: string; onOpenChange(o: boolean): void }) {
  const MAPS = useMaps(); const profile = useFleets((s) => profileOf(s.profiles, fleet)); const changing = profile.mapId !== null;      // a fleet that already has a map: this is "Change map"
  const [mapId, setMapId] = useState(profile.mapId ?? ''); const t = copy.assignMap; const clears = changing && mapId !== profile.mapId && profile.groups.length > 0;
  const save = () => { fleetsStore.getState().assignMap(fleet, mapId); onOpenChange(false); const d = t.done(MAPS.find((m) => m.id === mapId)!.name, fleet); notify.success(d.title, d.body, 'map-assigned'); };
  return (
    <ModalShell isOpen onOpenChange={onOpenChange} icon={Map01} title={changing ? t.changeTitle(fleet) : t.title(fleet)} subtitle={t.subtitle} secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }} primary={{ label: changing ? t.changeConfirm : t.confirm, isDisabled: !mapId || mapId === profile.mapId, onPress: save }}>
      {MAPS.length === 0 ? <EmptyState icon={Map01} title={copy.emptyTitle.maps} subtext={t.none} size="sm" /> : (
        <RadioGroup aria-label={t.title(fleet)} value={mapId} onChange={setMapId} className="flex flex-col gap-3 pt-2">
          {MAPS.map((m) => (
            <Radio key={m.id} value={m.id} className={({ isSelected, isFocusVisible }) => cx('flex cursor-pointer items-center gap-3 rounded-xl border bg-primary p-3 outline-focus-ring transition', isSelected ? 'border-brand ring-1 ring-brand' : 'border-secondary hover:bg-primary_hover', isFocusVisible && 'outline-2 outline-offset-2')}>
              {({ isSelected }) => (<>
                <MapThumbnail fleetLive={m.fleetLive} className="h-14 w-20 shrink-0 overflow-hidden rounded-lg" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{m.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tertiary"><Badge size="sm" type="pill-color" color="brand">{m.tag}</Badge>{t.version(m.version)} · {t.stations(m.stations.length)}</span></span>
                <span className={cx('grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset', isSelected ? 'bg-brand-solid ring-brand-solid' : 'ring-primary')}>{isSelected && <span className="size-1.5 rounded-full bg-white" />}</span>
              </>)}
            </Radio>))}
        </RadioGroup>)}
      {clears && <p role="alert" className="mt-3 rounded-lg bg-warning-secondary p-3 text-sm text-warning-primary">{t.warning(profile.groups.length)}</p>}
    </ModalShell>
  );
}
/** Pick a map for a fleet that has none. Mounted only while open. */
export const AssignMapModal = (p: { fleet: string; isOpen: boolean; onOpenChange(o: boolean): void }) => (p.isOpen ? <Body fleet={p.fleet} onOpenChange={p.onOpenChange} /> : null);
