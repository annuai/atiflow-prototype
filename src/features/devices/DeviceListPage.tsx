import { NoResults } from '@/components/data/EmptyState';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, SearchLg } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Input } from '@/components/base/input/input';
import type { DeviceKind, FieldValue } from './model/types';
import { useDevices } from './model/store';
import { nameOf } from './model/validate';
import { t } from './text';
import { AddDeviceModal } from './components/AddDeviceModal';
import { DeviceEmptyState } from './components/DeviceEmptyState';
import { DeviceTable } from './components/DeviceTable';
import '@/ui/detailPages.css';

/** Robots list / Hardware list. Same layout as the Workflow Builder page (title block + one card); everything kind-specific comes from `kind`. */
export function DeviceListPage({ kind }: { kind: DeviceKind }) {
  const navigate = useNavigate();
  const devices = useDevices((s) => s[kind.id]);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState<Record<string, FieldValue>>();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const rows = q.trim()
    ? devices.filter((d) =>
        (nameOf(d) + ' ' + kind.typeOf(d) + ' ' + d.values.fleet).toLowerCase().includes(q.trim().toLowerCase()),
      )
    : devices;
  const add = (p?: Record<string, FieldValue>) => {
    setPreset(p);
    setAdding(true);
  };
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <h1>{kind.plural}</h1>
            <p>{kind.subtitle}</p>
          </div>
          <div className="actions">
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
            <ButtonUtility
              icon={SearchLg}
              tooltip={t.list.search}
              color="secondary"
              size="sm"
              onPress={() => {
                setSearching((s) => !s);
                setQ('');
              }}
            />
            <Button size="sm" color="primary" iconLeading={Plus} onPress={() => add()}>
              {kind.addLabel}
            </Button>
          </div>
        </div>
        <div className="builder dv-card">
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
        </div>
      </div>
      <AddDeviceModal kind={kind} isOpen={adding} onOpenChange={setAdding} preset={preset} />
    </>
  );
}
