import { useSearchParams } from 'react-router-dom';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { RequestMaterialPane, useRequestableItems } from '@/features/request-material';
import { TripsPane } from './components/TripsPane';
import { copy } from './copy';

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
    <div className="content">
      <div className="title-block">
        <div>
          <h1>{copy.book.title}</h1>
          <p>{canRequest ? copy.book.subtitleBoth : copy.book.subtitle}</p>
        </div>
      </div>
      <div className="builder md-card">
        {canRequest && (
          <div className="md-bar">
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
          </div>
        )}
        {tab === 'request' ? <RequestMaterialPane /> : <TripsPane />}
      </div>
    </div>
  );
}
