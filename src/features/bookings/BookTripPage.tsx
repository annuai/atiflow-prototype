import { useSearchParams } from 'react-router-dom';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { RequestMaterialPane, useRequestableItems } from '@/features/request-material';
import { TripsPane } from './components/TripsPane';
import { copy } from './copy';
import { Page, PageCard, PageCardBar, PageHeader } from '@/components/page';

type Tab = 'request' | 'trips';

/**
 * The operator's Book trip page: ONE page for everything an operator sends a robot for. Fleets that only run saved routes (no material) see Book Trips alone; fleets that move material
 * also get a switch on top, Request Material | Book Trips (material first). `?tab=trips` picks Book Trips. Requests are followed (and cancelled) in History.
 */
export function BookTripPage() {
  const canRequest = useRequestableItems().length > 0;
  const [params, setParams] = useSearchParams();
  const tab: Tab = canRequest && params.get('tab') !== 'trips' ? 'request' : 'trips';
  const setTab = (t: Tab) => setParams(t === 'trips' ? { tab: 'trips' } : {}, { replace: true });
  return (
    <Page>
      <PageHeader title={copy.book.title} subtitle={canRequest ? copy.book.subtitleBoth : copy.book.subtitle} />
      <PageCard>
        {canRequest && (
          <PageCardBar>
            <SegmentedTabs<Tab>
              size="lg"
              value={tab}
              onChange={setTab}
              label={copy.book.tabs.label}
              items={[
                { id: 'request', label: copy.book.tabs.request },
                { id: 'trips', label: copy.book.tabs.trips },
              ]}
            />
          </PageCardBar>
        )}
        {tab === 'request' ? <RequestMaterialPane /> : <TripsPane />}
      </PageCard>
    </Page>
  );
}
