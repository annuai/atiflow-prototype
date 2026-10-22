import { NoResults } from '@/components/data/EmptyState';
import { useUrlSearchText } from '@/hooks/use-search-text';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { SearchToggle } from '@/components/data/SearchToggle';
import { Input } from '@/components/base/input/input';
import type { DeviceKind, FieldValue } from './model/types';
import { useDevices } from './model/store';
import { nameOf } from './model/validate';
import { t } from './text';
import { AddDeviceModal } from './components/AddDeviceModal';
import { DeviceEmptyState } from './components/DeviceEmptyState';
import { DeviceTable } from './components/DeviceTable';
import '@/ui/detailPages.css';
import { Page, PageCard, PageHeader } from '@/components/page';

/** Robots list / Hardware list. Same layout as the Workflow Builder page (title block + one card); everything kind-specific comes from `kind`. */
export function DeviceListPage({ kind }: { kind: DeviceKind }) {
  const navigate = useNavigate();
  const devices = useDevices((s) => s[kind.id]);
  const [adding, setAdding] = useState(false);
  const [params, setParams] = useSearchParams();
  // `?add=1` (the setup steps and the welcome cards link here) opens the Add dialog straight away
  const addOpen = adding || params.get('add') === '1';
  const setAddOpen = (o: boolean) => {
    setAdding(o);
    if (!o && params.has('add')) {
      params.delete('add');
      setParams(params, { replace: true });
    }
  };
  const [preset, setPreset] = useState<Record<string, FieldValue>>();
  const { text: q, setText: setQ, matches } = useUrlSearchText('q');
  const [searching, setSearching] = useState(!!q);
  const rows = devices.filter((d) =>
    matches(nameOf(d) + ' ' + kind.typeOf(d) + ' ' + fleetDirectory.nameOf(String(d.values.fleet ?? ''))),
  );
  const add = (p?: Record<string, FieldValue>) => {
    setPreset(p);
    setAdding(true);
  };
  return (
    <>
      <Page>
        <PageHeader
          title={kind.plural}
          subtitle={kind.subtitle}
          actions={
            <>
              {searching && (
                <Input
                  size="sm"
                  aria-label={t.list.searchLabel(kind.plural)}
                  placeholder={t.list.searchLabel(kind.plural)}
                  value={q}
                  onChange={setQ}
                  autoFocus
                  wrapperClassName="dv-search"
                />
              )}
              <SearchToggle
                label={t.list.search}
                active={searching}
                onToggle={() => {
                  setSearching((s) => !s);
                  setQ('');
                }}
              />
              <Button size="sm" color="primary" iconLeading={Plus} data-tour="add-device" onPress={() => add()}>
                {kind.addLabel}
              </Button>
            </>
          }
        />
        <PageCard>
          {devices.length === 0 ? (
            <div className="dv-scroll flex flex-col">
              <DeviceEmptyState kind={kind} onAdd={add} />
            </div>
          ) : rows.length === 0 ? (
            <NoResults subtext={t.list.noMatch(kind.plural, q)} className="m-auto" />
          ) : (
            <div className="dv-scroll">
              <DeviceTable
                kind={kind}
                rows={rows}
                onOpen={(d) => navigate(`/configurator/${kind.route}/${encodeURIComponent(nameOf(d))}`)}
              />
            </div>
          )}
        </PageCard>
      </Page>
      <AddDeviceModal kind={kind} isOpen={addOpen} onOpenChange={setAddOpen} preset={preset} />
    </>
  );
}
