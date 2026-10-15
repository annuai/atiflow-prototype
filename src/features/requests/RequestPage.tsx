import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchLg, ShoppingCart01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { useMasterData } from '@/features/master-data/model/store';
import { useWorkflow } from '@/features/workflow-builder/model/store';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { CartSheet } from './components/CartSheet';
import { MaterialCard } from './components/MaterialCard';
import { RequestHistory } from './components/RequestHistory';
import { copy } from './copy';
import { useRequestsRunning } from './model/bridge';
import { requestableItems } from './model/catalog';
import { dropLine, requestsStore, setLine, useRequests } from './model/store';
import { isActive } from './model/status';
import type { CartLine } from './model/types';
import { fleetIdOf, fleetLiveOf, useOperator } from './model/useOperator';

type Tab = 'new' | 'history';
/**
 * The operator's Request page (built for a tablet: big cards, steppers, a cart bar and a bottom sheet). Materials come from the published workflows that list the operator on their
 * fleets. The cart exists only while choosing; sending makes one order of independent requests.
 */
export function RequestPage() {
  useRequestsRunning(); const me = useOperator(); const [params, setParams] = useSearchParams(); const tab: Tab = params.get('tab') === 'history' ? 'history' : 'new';
  const setTab = (t: Tab) => setParams(t === 'history' ? { tab: 'history' } : {}, { replace: true });
  const workflows = useWorkflow((s) => s.workflows); const materials = useMasterData((s) => s.materials), groups = useMasterData((s) => s.groups);
  const items = useMemo(() => requestableItems(Object.values(workflows), me, fleetIdOf, fleetLiveOf, materials, groups), [workflows, me, materials, groups]);
  const mine = useRequests((s) => s.requests).filter((r) => r.requestedBy === me.username); const activeCount = mine.filter((r) => isActive(r.status)).length;
  const [cart, setCart] = useState<CartLine[]>([]); const [sheet, setSheet] = useState(false); const [q, setQ] = useState(''); const [group, setGroup] = useState('all'); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const groupNames = [...new Set(items.map((i) => i.group).filter(Boolean))].sort();
  const shown = items.filter((i) => (group === 'all' || i.group === group) && (`${i.name} ${i.code}`.toLowerCase().includes(q.trim().toLowerCase())));
  const cartItems = cart.flatMap((l) => { const i = items.find((x) => x.key === l.key); return i ? [{ item: i, qty: l.qty }] : []; });
  const send = () => {
    if (!cartItems.length) return;
    const id = requestsStore.getState().submit(me, cartItems); setCart([]); setSheet(false); setTab('history'); notify.success(copy.request.cart.sent(id, cartItems.length), undefined, 'request-sent');
  };
  return (
    <div className="content">
      <div className="title-block"><div><h1>{copy.request.title}</h1><p>{copy.request.subtitle}</p></div></div>
      <div className="builder md-card"><div className="md-body !gap-4">
        <div className="shrink-0"><SegmentedTabs<Tab> size="lg" value={tab} onChange={setTab} label="Request" items={[{ id: 'new', label: copy.request.tabs.new }, { id: 'history', label: copy.request.tabs.history(activeCount) }]} /></div>
        {tab === 'history' ? <RequestHistory requests={mine} who={me} now={now} /> : <>
          <Input size="md" wrapperClassName="shrink-0" aria-label={copy.request.search} placeholder={copy.request.search} icon={SearchLg} value={q} onChange={setQ} />
          {groupNames.length > 1 && <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Group">{['all', ...groupNames].map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className={cx('h-11 shrink-0 rounded-full border px-4 text-sm font-medium', group === g ? 'border-brand bg-brand-secondary text-brand-secondary' : 'border-primary bg-primary text-secondary')}>{g === 'all' ? copy.request.allGroups : g}</button>)}</div>}
          {!items.length ? <EmptyState icon={ShoppingCart01} title={copy.request.empty.title} subtext={copy.request.empty.hint} size="lg" />
            : !shown.length ? <NoResults subtext={copy.request.empty.noMatch} />
            : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">{shown.map((i) => <MaterialCard key={i.key} item={i} line={cart.find((l) => l.key === i.key)} onAdd={(qty) => setCart((c) => setLine(c, i.key, qty))} onRemove={() => setCart((c) => dropLine(c, i.key))} />)}</div>}
        </>}
      </div>
        {tab === 'new' && cartItems.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <p className="text-md font-semibold text-primary"><ShoppingCart01 className="mr-2 inline size-5 align-text-bottom" />{copy.request.cart.items(cartItems.length)}<span className="ml-2 text-sm font-normal text-tertiary">{cartItems.reduce((n, c) => n + c.qty, 0)} pcs</span></p>
            <Button size="xl" color="primary" onPress={() => setSheet(true)}>{copy.request.cart.review}</Button>
          </div>)}
      </div>
      <CartSheet isOpen={sheet} onOpenChange={setSheet} lines={cart} items={items} onQty={(key, qty) => setCart((c) => setLine(c, key, qty))} onRemove={(key) => setCart((c) => dropLine(c, key))} onClear={() => { setCart([]); setSheet(false); }} onSend={send} />
    </div>
  );
}
