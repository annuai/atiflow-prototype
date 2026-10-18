import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SearchLg, ShoppingCart01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { OPERATOR_CARD_GRID } from '@/components/data/operatorCard';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useMasterData } from '@/features/master-data';
import { useWorkflow } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import {
  CartSheet,
  MaterialCard,
  dropLine,
  fleetLiveOf,
  requestableItems,
  requestsStore,
  setLine,
  useOperator,
  useRequestsRunning,
  type CartLine,
} from '@/features/requests';
import { copy, t } from './text';
import { PageCardBody } from '@/components/page';

/** The materials this operator may request (published Tablet workflows with a Material step that list them). None = a fleet that only runs saved routes: no material requests at all. */
export function useRequestableItems() {
  const me = useOperator();
  const workflows = useWorkflow((s) => s.workflows);
  const materials = useMasterData((s) => s.materials),
    groups = useMasterData((s) => s.groups);
  return useMemo(
    () => requestableItems(Object.values(workflows), me, fleetLiveOf, materials, groups),
    [workflows, me, materials, groups],
  );
}

/**
 * Request Material (a tab of the operator's Book trip page, built for a tablet: big cards, steppers, a cart bar and a bottom sheet). Materials come from the published workflows that
 * list the operator on their fleets. The cart exists only while choosing; sending makes one order of independent requests, which are followed (and cancelled while they can be) in History.
 * Renders into the page card (body + cart bar), not a page of its own.
 */
export function RequestMaterialPane() {
  useRequestsRunning();
  const me = useOperator();
  const items = useRequestableItems();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('add') ?? ''); // search: "Order" opens the list on that material
  const { search: urlSearch } = useLocation();
  const [seenAdd, setSeenAdd] = useState(urlSearch);
  if (seenAdd !== urlSearch) {
    setSeenAdd(urlSearch);
    const v = new URLSearchParams(urlSearch).get('add');
    if (v) setQ(v);
  }
  const [group, setGroup] = useState('all');
  const groupNames = [...new Set(items.map((i) => i.group).filter(Boolean))].sort();
  const shown = items.filter(
    (i) =>
      (group === 'all' || i.group === group) && `${i.name} ${i.code}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const cartItems = cart.flatMap((l) => {
    const i = items.find((x) => x.key === l.key);
    return i ? [{ item: i, qty: l.qty }] : [];
  });
  const send = () => {
    if (!cartItems.length) return;
    const id = requestsStore.getState().submit(me, cartItems);
    setCart([]);
    setSheet(false);
    notify.success(copy.request.cart.sent(id, cartItems.length), undefined, 'request-sent');
  };
  return (
    <>
      <PageCardBody>
        <div className="shrink-0">
          <h2 className="text-lg font-semibold text-primary">{copy.request.heading}</h2>
          <p className="text-sm text-tertiary">{copy.request.subtitle}</p>
        </div>
        <Input
          size="md"
          wrapperClassName="shrink-0"
          aria-label={copy.request.search}
          placeholder={copy.request.search}
          icon={SearchLg}
          value={q}
          onChange={setQ}
        />
        {groupNames.length > 1 && (
          <div
            className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label={t.requests.tabsLabel.group}
          >
            {['all', ...groupNames].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={cx(
                  'h-11 shrink-0 rounded-full border px-4 text-sm font-medium',
                  group === g
                    ? 'border-brand bg-brand-secondary text-brand-secondary'
                    : 'border-primary bg-primary text-secondary',
                )}
              >
                {g === 'all' ? copy.request.allGroups : g}
              </button>
            ))}
          </div>
        )}
        {!items.length ? (
          <EmptyState
            icon={ShoppingCart01}
            title={copy.request.empty.title}
            subtext={copy.request.empty.hint}
            size="lg"
          />
        ) : !shown.length ? (
          <NoResults subtext={copy.request.empty.noMatch} />
        ) : (
          <div className={cx('grid gap-4', OPERATOR_CARD_GRID)}>
            {shown.map((i) => (
              <MaterialCard
                key={i.key}
                item={i}
                line={cart.find((l) => l.key === i.key)}
                onAdd={(qty) => setCart((c) => setLine(c, i.key, qty))}
                onRemove={() => setCart((c) => dropLine(c, i.key))}
              />
            ))}
          </div>
        )}
      </PageCardBody>
      {cartItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="text-md font-semibold text-primary">
            <ShoppingCart01 className="mr-2 inline size-5 align-text-bottom" />
            {copy.request.cart.items(cartItems.length)}
            <span className="ml-2 text-sm font-normal text-tertiary">
              {t.requests.pcs(cartItems.reduce((n, c) => n + c.qty, 0))}
            </span>
          </p>
          <Button size="xl" color="primary" onPress={() => setSheet(true)}>
            {copy.request.cart.review}
          </Button>
        </div>
      )}
      <CartSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        lines={cart}
        items={items}
        onQty={(key, qty) => setCart((c) => setLine(c, key, qty))}
        onRemove={(key) => setCart((c) => dropLine(c, key))}
        onClear={() => {
          setCart([]);
          setSheet(false);
        }}
        onSend={send}
      />
    </>
  );
}
