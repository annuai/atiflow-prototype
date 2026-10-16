import { useState, type ReactNode } from 'react';
import { services } from '@/services';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Scrim } from '@/components/motion/Scrim';
import { workspaceById, workspaceHome, workspaceOfPath, workspacesOf, type WorkspaceId } from '@/features/access';
import { authStore, useAuth } from '@/features/auth/authStore';
import { AtiAiDock, atiAiStore } from '@/features/ati-ai';
import { SupportWidget, toggleSupport, useSupportUnread } from '@/features/support';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { NavModel } from './types';
import { copy } from './copy';

interface Props {
  useNavModel: () => NavModel;
  searchPlaceholder: string;
  children: ReactNode;
}
/** Common chrome for every signed-in page: sidebar (workspace title, a switcher when the user has several workspaces, account menu), topbar, mobile drawer. Pages only supply content + nav/search data. */
export function AppShell({ useNavModel, searchPlaceholder, children }: Props) {
  const user = useAuth((s) => s.user)!;
  const supportUnread = useSupportUnread();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = workspaceOfPath(pathname); // the workspace this page belongs to: its title heads the sidebar
  const items = workspacesOf(user).map((w) => ({
    id: w.id,
    label: w.name,
    hint: w.built ? undefined : copy.comingSoon,
    disabled: !w.built,
  }));
  const switchTo = (id: string) => {
    const home = workspaceHome(user, id as WorkspaceId);
    if (home) navigate(home);
  };
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => services().device.get('sb-collapsed') === '1');
  // the menu drawer shuts whenever the page changes, however it changed (menu, Back / Forward, search, a link): an open drawer's dim layer covers the page and swallows every touch, which looked like "the page does not scroll"
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setNavOpen(false);
  }
  const logout = () => {
    authStore.getState().logout();
    navigate('/login', { replace: true });
  };
  return (
    <div className="app">
      <Sidebar
        title={current ? workspaceById(current).title : 'ATI FLOW'}
        switcher={{ items, value: current, onChange: switchTo }}
        useNavModel={useNavModel}
        user={user}
        onLogout={logout}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggle={() =>
          setCollapsed((c) => {
            services().device.set('sb-collapsed', c ? '0' : '1');
            return !c;
          })
        }
      />
      <AnimatePresence>
        {navOpen && <Scrim key="scrim" className="scrim" onClick={() => setNavOpen(false)} />}
      </AnimatePresence>
      <div className="main">
        <Topbar
          onMenu={() => setNavOpen(true)}
          searchPlaceholder={searchPlaceholder}
          onAi={() => atiAiStore.getState().toggle()}
          onSupport={toggleSupport}
          supportUnread={supportUnread}
        />
        {children}
      </div>
      <AtiAiDock />
      <SupportWidget />
    </div>
  );
}
