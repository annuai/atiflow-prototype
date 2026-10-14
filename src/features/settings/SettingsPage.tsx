import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Globe01, Link03 } from '@untitledui/icons';
import { Tabs } from '@/components/application/tabs/tabs';
import { configuratorHits, useConfiguratorNav, SETTINGS_PATH } from '@/features/configurator/configuratorNav';
import { ConnectionsPanel } from './components/ConnectionsPanel';
import { GeneralPanel } from './components/GeneralPanel';
import { copy } from './copy';

/** Tabs of the page; add a tab here (+ its panel) and the route, subtitle and tab bar follow. */
const TABS = [{ id: 'connections', icon: Link03, Panel: ConnectionsPanel }, { id: 'general', icon: Globe01, Panel: GeneralPanel }] as const;
type TabId = (typeof TABS)[number]['id'];

/** Settings: same frame as the other configurator pages (title block + one card holding the tab bar and the active panel). */
export function SettingsPage() {
  const { tab = '' } = useParams(); const navigate = useNavigate(); const active = TABS.find((t) => t.id === tab);
  if (!active) return <Navigate to={`${SETTINGS_PATH}/${TABS[0].id}`} replace />;
  return (
    <>
      <div className="content">
        <div className="title-block"><div><h1>{copy.title}</h1><p>{copy.tabs[active.id].subtitle}</p></div></div>
        <div className="builder md-card">
          <Tabs selectedKey={active.id} onSelectionChange={(k) => navigate(`${SETTINGS_PATH}/${k as TabId}`)} className="min-w-0 flex-none px-5 pt-6">
            <Tabs.List type="underline" size="md" fullWidth aria-label={copy.title} items={TABS.map((t) => ({ id: t.id, label: copy.tabs[t.id].label, icon: t.icon }))} />
          </Tabs>
          <div className="md-body"><active.Panel /></div>
        </div>
      </div>
    </>
  );
}
