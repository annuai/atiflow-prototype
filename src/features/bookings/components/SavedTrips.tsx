import { useState } from 'react';
import { Route, Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { OPERATOR_CARD_GRID, OPERATOR_CARD_H } from '@/components/data/operatorCard';
import type { RobotTelemetry } from '@/core/types';
import { robotTypeById, robotTypeByLabel } from '@/data/robotTypes';
import { useAuth } from '@/features/auth';
import { requestsStore, type RequestableItem } from '@/features/requests';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { isFreeRobot } from '../model/free';
import { CallSheet } from './CallSheet';
import { RouteCard } from './RouteCard';

type MapData = { nav: { stations: { id: string; name: string }[] } } | null;

/**
 * The saved trips of the person's fleet as cards: Add the ones you need, review them in the "Call robots" sheet and call them together (nothing is sent before the confirmation).
 * Each trip becomes its own request (its own approval, trip and cancel), made together as one order. Renders the card grid, the bottom bar and the sheet into the page card.
 */
export function SavedTrips({
  routes,
  map,
  live,
  onCustom,
}: {
  routes: RequestableItem[];
  map: MapData;
  live: Record<string, RobotTelemetry>;
  onCustom(): void;
}) {
  const user = useAuth((s) => s.user)!;
  const fleetRobotsFor = (fleetLiveId: string) => Object.values(live).filter((r) => r.fleetId === fleetLiveId);
  const freeOfIn = (list: RobotTelemetry[], id: string) => list.filter((r) => r.model === id && isFreeRobot(r)).length;
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const chosenRoutes = picked.flatMap((k) => routes.filter((r) => r.key === k));
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  /** Call the robots of every picked trip: each becomes its own request (its own approval, trip and cancel), made together as one order. */
  const callPicked = () => {
    if (!chosenRoutes.length) return;
    const gid = requestsStore.getState().submit(
      { username: user.username, name: user.name },
      chosenRoutes.map((item) => ({ item, qty: 1 })),
    );
    const made = requestsStore.getState().requests.filter((x) => x.groupId === gid);
    const waiting = chosenRoutes.filter((r) => r.needsApproval).length;
    if (chosenRoutes.length === 1)
      notify.success(
        waiting ? copy.routes.sent(made[0]?.tripId ?? '') : copy.routes.booked(made[0]?.tripId ?? ''),
        waiting ? copy.routes.sentHint : chosenRoutes[0].name,
        'route-booked',
      );
    else notify.success(copy.call.done.many(chosenRoutes.length), copy.call.done.manyHint(waiting), 'route-booked');
    setPicked([]);
    setSheet(false);
  };
  return (
    <>
      <div className="md-body !gap-4">
        <section aria-label={copy.routes.title} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">{copy.routes.title}</h2>
              <p className="text-sm text-tertiary">{copy.routes.subtitle}</p>
            </div>
            <Button size="lg" color="secondary" iconLeading={Plus} onPress={onCustom}>
              {copy.routes.custom.cta}
            </Button>
          </div>
          <div className={cx('grid gap-4', OPERATOR_CARD_GRID)}>
            {routes.map((it) => {
              const t = it.robotType ? robotTypeById(it.robotType) : robotTypeByLabel(undefined);
              const free =
                it.robotType && fleetRobotsFor(it.fleetLive).length
                  ? freeOfIn(fleetRobotsFor(it.fleetLive), it.robotType)
                  : null;
              return (
                <RouteCard
                  key={it.key}
                  title={it.name}
                  picture={t.illustration}
                  robot={it.robotType ? t.label : copy.routes.anyRobot}
                  free={free === null ? undefined : { text: copy.book.free(free), any: free > 0 }}
                  stops={it.legs.map((id) => ({ id, name: map?.nav.stations.find((x) => x.id === id)?.name ?? '' }))}
                  text={{
                    stations: copy.routes.stations,
                    pickup: copy.routes.pickup,
                    dropoff: copy.routes.dropoff,
                    moreStops: copy.routes.moreStops,
                  }}
                  approval={it.needsApproval}
                  approvalText={copy.routes.approval}
                  selected={picked.includes(it.key)}
                  addLabel={copy.call.add}
                  removeLabel={copy.call.remove}
                  onToggle={() => toggle(it.key)}
                />
              );
            })}
            <button
              type="button"
              onClick={onCustom}
              className={cx(
                'flex cursor-pointer flex-col',
                OPERATOR_CARD_H,
                'items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary p-6 text-center outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2',
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-primary text-brand-secondary">
                <Plus className="size-6" aria-hidden />
              </span>
              <span className="text-lg font-semibold text-primary">{copy.routes.custom.title}</span>
              <span className="text-sm text-tertiary">{copy.routes.custom.hint}</span>
            </button>
          </div>
        </section>
      </div>
      {chosenRoutes.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="text-md font-semibold text-primary">
            <Route className="mr-2 inline size-5 align-text-bottom" />
            {copy.call.bar.items(chosenRoutes.length)}
          </p>
          <Button size="xl" color="primary" onPress={() => setSheet(true)}>
            {copy.call.bar.review}
          </Button>
        </div>
      )}
      <CallSheet
        isOpen={sheet && chosenRoutes.length > 0}
        onOpenChange={setSheet}
        title={copy.call.sheet.title}
        subtitle={copy.call.sheet.subtitle}
        rows={chosenRoutes.map((it) => ({
          key: it.key,
          title: it.name,
          detail: `${it.robotType ? robotTypeById(it.robotType).label : copy.routes.anyRobot} · ${it.legs[0]}${
            it.legs.length > 1 ? ` → ${it.legs[it.legs.length - 1]}` : ''
          }`,
          approval: it.needsApproval ? copy.routes.approval : undefined,
        }))}
        note={[
          chosenRoutes.filter((r) => r.needsApproval).length
            ? copy.call.sheet.waits(chosenRoutes.filter((r) => r.needsApproval).length)
            : '',
          chosenRoutes.filter((r) => !r.needsApproval).length
            ? copy.call.sheet.direct(chosenRoutes.filter((r) => !r.needsApproval).length)
            : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        removeLabel={copy.call.sheet.removeItem}
        clearLabel={copy.call.sheet.clear}
        sendLabel={copy.call.sheet.send(chosenRoutes.length)}
        onRemove={(key) => setPicked((p) => p.filter((k) => k !== key))}
        onClear={() => {
          setPicked([]);
          setSheet(false);
        }}
        onSend={callPicked}
      />
    </>
  );
}
