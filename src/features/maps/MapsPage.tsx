import { useMemo, useState } from 'react';
import { FilterLines, Map01, Plus, SearchLg, Upload01 } from '@untitledui/icons';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { useFleets } from '@/features/fleets';
import { copy } from './copy';
import { t } from './text';
import { GenerateMapModal } from './components/GenerateMapModal';
import { ImportMapModal } from './components/ImportMapModal';
import { MapCard } from './components/MapCard';
import { fleetsByMap, filterSortMaps, type MapSort } from './model/logic';
import { useMaps } from './model/maps';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

/** Maps: the maps that are part of the system (none invented), with search and sort. Create New Map / Import open their dialogs; an empty system asks to create the first map. */
export function MapsPage() {
  const maps = useMaps();
  const profiles = useFleets((s) => s.profiles);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<MapSort>('name');
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const byMap = useMemo(() => fleetsByMap(profiles), [profiles]);
  const rows = useMemo(() => filterSortMaps(maps, byMap, text, sort), [maps, byMap, text, sort]);
  const actions = (primaryOnly?: boolean) => (
    <>
      {!primaryOnly && (
        <Button size="sm" color="secondary" iconLeading={Upload01} onPress={() => setImporting(true)}>
          {copy.import}
        </Button>
      )}
      <Button size="sm" color="primary" iconLeading={Plus} onPress={() => setGenerating(true)}>
        {copy.create}
      </Button>
    </>
  );
  return (
    <>
      <Page>
        <PageHeader title={copy.title} subtitle={copy.subtitle} actions={<>{actions()}</>} />
        <PageCard>
          {maps.length === 0 ? (
            <PageCardBody className="grid place-items-center">
              <EmptyState
                icon={Map01}
                size="lg"
                title={copy.empty.title}
                subtext={copy.empty.description}
                action={
                  <>
                    <Button size="md" color="secondary" iconLeading={Upload01} onPress={() => setImporting(true)}>
                      {copy.import}
                    </Button>
                    <Button size="md" color="primary" iconLeading={Plus} onPress={() => setGenerating(true)}>
                      {copy.create}
                    </Button>
                  </>
                }
              />
            </PageCardBody>
          ) : (
            <PageCardBody>
              <div className="flex flex-wrap gap-3">
                <Input
                  className="min-w-60 flex-1"
                  size="sm"
                  icon={SearchLg}
                  aria-label={copy.search}
                  placeholder={copy.search}
                  value={text}
                  onChange={setText}
                />
                <Select
                  size="sm"
                  aria-label={t.maps.sort}
                  className="w-[200px]"
                  icon={FilterLines}
                  selectedKey={sort}
                  onSelectionChange={(k) => setSort(k as MapSort)}
                  items={(Object.keys(copy.sorts) as MapSort[]).map((id) => ({
                    id,
                    label: copy.sortBy(copy.sorts[id]),
                  }))}
                >
                  {(item) => <Select.Item {...item} />}
                </Select>
              </div>
              {rows.length === 0 ? (
                <NoResults subtext={copy.noMatch(text)} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((m) => (
                    <MapCard key={m.id} map={m} fleets={byMap[m.id] ?? []} />
                  ))}
                </div>
              )}
            </PageCardBody>
          )}
        </PageCard>
      </Page>
      <GenerateMapModal isOpen={generating} onOpenChange={setGenerating} />
      <ImportMapModal isOpen={importing} onOpenChange={setImporting} />
    </>
  );
}
