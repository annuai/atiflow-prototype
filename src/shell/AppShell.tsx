import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { workspaceById, workspaceHome, workspaceOfPath, workspacesOf, type WorkspaceId } from '@/features/access';
import { authStore, useAuth } from '@/features/auth/authStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { NavModel, SearchHit } from './types';

interface Props {
  useNavModel: () => NavModel;
  searchPlaceholder: string; getHits: (q: string) => SearchHit[];
  onAi?: () => void;
  children: ReactNode;
}
/** Common chrome for every signed-in page: sidebar (workspace title, a switcher when the user has several workspaces, account menu), topbar, mobile drawer. Pages only supply content + nav/search data. */
export function AppShell({ useNavModel, searchPlaceholder, getHits, onAi, children }: Props) {
  const user = useAuth((s) => s.user)!; const navigate = useNavigate(); const { pathname } = useLocation();
  const current = workspaceOfPath(pathname);                                    // the workspace this page belongs to: its title heads the sidebar
  const items = workspacesOf(user).map((w) => ({ id: w.id, label: w.name, hint: w.built ? undefined : 'Coming soon', disabled: !w.built }));
  const switchTo = (id: string) => { const home = workspaceHome(user, id as WorkspaceId); if (home) navigate(home); };
  const [navOpen, setNavOpen] = useState(false); const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb-collapsed') === '1');
  const logout = () => { authStore.getState().logout(); navigate('/login', { replace: true }); };
  return (
    <div className="app">
      <Sidebar title={current ? workspaceById(current).title : 'ATI FLOW'} switcher={{ items, value: current, onChange: switchTo }} useNavModel={useNavModel} user={user} onLogout={logout} open={navOpen} onClose={() => setNavOpen(false)}
        collapsed={collapsed} onToggle={() => setCollapsed((c) => { localStorage.setItem('sb-collapsed', c ? '0' : '1'); return !c; })} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setNavOpen(true)} searchPlaceholder={searchPlaceholder} getHits={getHits} onAi={onAi} />
        {children}
      </div>
    </div>
  );
}
