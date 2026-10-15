import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TabbedPanel } from '@/components/data/TabbedPanel';
import { Rows01, Settings02 } from '@untitledui/icons';
import { copy } from './copy';
import { MaterialsPanel } from './components/MaterialsPanel';
import { StagingAreaPanel } from './components/StagingAreaPanel';

/** Top tabs of the page. Add a tab here (+ its panel) and the route, heading and tab bar follow. */
export const MASTER_DATA_BASE = '/configurator/master-data';
const TABS = [
  { id: 'materials', icon: Rows01, Panel: MaterialsPanel },
  { id: 'staging-area', icon: Settings02, Panel: StagingAreaPanel },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Master Data: same frame as the other configurator pages (title block + one card); the card holds the tab bar and the active panel. */
export function MasterDataPage() {
  const { tab = '' } = useParams();
  const navigate = useNavigate();
  const active = TABS.find((t) => t.id === tab);
  if (!active) return <Navigate to={`${MASTER_DATA_BASE}/${TABS[0].id}`} replace />;
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.tabs[active.id].subtitle}</p>
          </div>
        </div>
        <div className="builder md-card">
          <TabbedPanel
            tabs={TABS.map((t) => ({ id: t.id, label: copy.tabs[t.id].label, icon: t.icon }))}
            selected={active.id}
            onSelect={(k) => navigate(`${MASTER_DATA_BASE}/${k as TabId}`)}
            label={copy.title}
          >
            <active.Panel />
          </TabbedPanel>
        </div>
      </div>
    </>
  );
}
