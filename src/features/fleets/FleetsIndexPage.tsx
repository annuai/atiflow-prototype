import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cube01, Dataflow03, SearchLg } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { SearchToggle } from '@/components/data/SearchToggle';
import { Input } from '@/components/base/input/input';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { useDataset } from '@/data/dataset';
import { KINDS, nameOf, useDevices } from '@/features/devices';
import { copy } from './copy';
import { DeviceCard } from './components/DeviceCard';
import { FleetAccordion } from './components/FleetAccordion';
import { MakeFleetModal } from './components/MakeFleetModal';
import { OverviewPanel } from './components/OverviewPanel';
import { useMaps } from '@/features/maps';
import { profileOf, useFleets } from './model/store';
import { fleetPath } from './paths';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

/**
 * `/configurator/fleets`: every fleet at a glance. Robots that belong to no fleet first, then one expandable row per fleet (map, version, counts); opening a row shows the same
 * overview as the fleet's own page (map, robots, hardware), so assigning and unassigning work here too. A robot card opens that robot's page, the map card opens the Map Editor.
 */
export function FleetsIndexPage() {
  const navigate = useNavigate();
  const fleets = useDataset((s) => s.fleets);
  const robots = useDevices((s) => s.robot);
  const hardware = useDevices((s) => s.hardware);
  const profiles = useFleets((s) => s.profiles);
  const maps = useMaps();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [making, setMaking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const unassigned = robots.filter((d) => !d.values.fleet);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleets
      .map((f) => ({ f, map: maps.find((m) => m.id === profileOf(profiles, f.name).mapId) ?? null }))
      .filter(({ f, map }) => !q || f.name.toLowerCase().includes(q) || !!map?.name.toLowerCase().includes(q));
  }, [fleets, maps, profiles, query]);
  const expanded = open ?? rows[0]?.f.name ?? null; // the first fleet is open until the person opens another
  return (
    <>
      <Page>
        <PageHeader
          title={copy.index.title}
          subtitle={copy.index.subtitle}
          actions={
            <>
              <SearchToggle
                size="md"
                label={copy.index.search}
                active={searching}
                onToggle={() => {
                  setSearching((s) => !s);
                  if (searching) setQuery('');
                }}
              />
              <Button size="md" color="secondary" iconLeading={Dataflow03} onPress={() => setMaking(true)}>
                {copy.index.make}
              </Button>
            </>
          }
        />
        <PageCard>
          <PageCardBody>
            <div className="flex flex-col gap-8">
              {searching && (
                <Input
                  autoFocus
                  aria-label={copy.index.search}
                  icon={SearchLg}
                  placeholder={copy.index.searchPlaceholder}
                  value={query}
                  onChange={setQuery}
                />
              )}
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-primary">{copy.index.unassignedTitle}</h2>
                  <p className="text-sm text-tertiary">
                    {unassigned.length ? copy.index.unassignedCount(unassigned.length) : copy.index.allAssigned}
                  </p>
                </div>
                {unassigned.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {unassigned.map((d) => (
                      <DeviceCard key={nameOf(d)} kind={KINDS.robot} device={d} layout="tile" fleet="" />
                    ))}
                  </div>
                )}
              </section>
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-primary">{copy.index.activeTitle}</h2>
                  <p className="text-sm text-tertiary">{copy.index.activeSubtitle}</p>
                </div>
                {fleets.length === 0 ? (
                  <EmptyState
                    framed
                    icon={Cube01}
                    title={copy.index.noFleets}
                    subtext={copy.index.noFleetsBody}
                    action={
                      <Button size="md" color="primary" onPress={() => setMaking(true)}>
                        {copy.index.make}
                      </Button>
                    }
                  />
                ) : rows.length === 0 ? (
                  <NoResults subtext={copy.index.noMatch} />
                ) : (
                  rows.map(({ f, map }) => (
                    <FleetAccordion
                      key={f.id}
                      name={f.name}
                      map={map}
                      robots={robots.filter((d) => d.values.fleet === f.name).length}
                      hardware={hardware.filter((d) => d.values.fleet === f.name).length}
                      open={expanded === f.name}
                      onToggle={() => setOpen(expanded === f.name ? '' : f.name)}
                      menu={
                        <Dropdown.Root>
                          <Dropdown.DotsButton aria-label={copy.index.fleetMenu} />
                          <Dropdown.Popover className="w-48">
                            <Dropdown.Menu onAction={() => navigate(fleetPath(f.name))}>
                              <Dropdown.Item id="open" label={copy.index.open} />
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown.Root>
                      }
                    >
                      <OverviewPanel fleet={f.name} />
                    </FleetAccordion>
                  ))
                )}
              </section>
            </div>
          </PageCardBody>
        </PageCard>
      </Page>
      <MakeFleetModal isOpen={making} onOpenChange={setMaking} />
    </>
  );
}
