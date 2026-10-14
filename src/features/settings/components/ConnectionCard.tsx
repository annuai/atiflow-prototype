import { useState } from 'react';
import { Edit05, RefreshCcw01, Zap } from '@untitledui/icons';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Card } from '@/components/data/Card';
import { timeAgo } from '@/utils/timeAgo';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { settingsStore, useSettings } from '../data/store';
import { statusOf } from '../model/status';
import type { ConnectionDef } from '../model/types';

/** One connection: who it is, whether it works and why (not), its values, and the actions. Neutral card: only the status badge carries the colour. */
export function ConnectionCard({ def, onEdit }: { def: ConnectionDef; onEdit(): void }) {
  const state = useSettings((s) => s.connections[def.id]); const [busy, setBusy] = useState<'test' | 'sync' | null>(null);
  const status = statusOf(def, state); const ok = status.status === 'connected'; const now = Date.now();
  const test = async () => { setBusy('test'); const r = await settingsStore.getState().test(def.id); setBusy(null); (r.ok ? notify.success : notify.warning)(r.ok ? copy.edit.testOk(def.name) : copy.edit.testFail(def.name), r.message, `test-${def.id}`); };
  const sync = async () => { setBusy('sync'); await settingsStore.getState().sync(def.id); setBusy(null); notify.success(`${def.name} synced`, undefined, `sync-${def.id}`); };
  return (
    <Card className="flex flex-col gap-4" aria-label={def.name}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: def.color }} aria-hidden>{def.initials}</span>
        <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-primary">{def.name}</h2>
          <BadgeWithDot size="sm" type="pill-color" color={ok ? 'success' : 'warning'} className="mt-1">{status.headline}</BadgeWithDot>
          {status.detail && <p className="mt-1.5 text-sm text-tertiary">{status.detail}</p>}</div>
        <Button size="sm" color="secondary" iconLeading={Edit05} onPress={onEdit}>{copy.card.edit}</Button>
      </div>
      <dl className="divide-y divide-secondary border-t border-secondary">
        {def.fields.map((f) => { const v = (state.values[f.key] ?? '').trim();
          return (<div key={f.key} className="flex items-center justify-between gap-3 py-2.5 text-sm"><dt className="text-tertiary">{f.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-primary">{v ? (f.kind === 'secret' ? '••••••••' : v) : <button className="font-medium text-fg-brand-primary hover:underline" onClick={onEdit}>{copy.card.notSet} · {copy.card.add}</button>}</dd></div>); })}
        {def.syncs && <div className="flex items-center justify-between gap-3 py-2.5 text-sm"><dt className="text-tertiary">{copy.card.lastSynced}</dt><dd className="font-medium text-primary" title={state.lastSynced ? new Date(state.lastSynced).toLocaleString() : undefined}>{state.lastSynced ? timeAgo(state.lastSynced, now) : copy.card.never}</dd></div>}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-tertiary" title={state.lastTest ? new Date(state.lastTest.at).toLocaleString() : undefined}>{state.lastTest ? copy.card.lastTest(state.lastTest.ok, timeAgo(state.lastTest.at, now)) : copy.card.notTested}</p>
        <div className="flex gap-2">
          {def.syncs && <Button size="sm" color="secondary" iconLeading={RefreshCcw01} isLoading={busy === 'sync'} isDisabled={!ok || busy !== null} onPress={sync}>{busy === 'sync' ? copy.card.syncing : copy.card.sync}</Button>}
          <Button size="sm" color="secondary" iconLeading={Zap} isLoading={busy === 'test'} isDisabled={busy !== null} onPress={test}>{busy === 'test' ? copy.card.testing : copy.card.test}</Button>
        </div>
      </div>
    </Card>
  );
}
