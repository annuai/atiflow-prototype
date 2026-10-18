import { LayoutGroup } from 'motion/react';
import type { PublicUser } from '@/features/auth/types';
import logo from '@/ui/icons/ati-flow-logo.svg';
import mark from '@/ui/icons/ati-logo.svg';
import { HeaderSwitcher, type SwitcherItem } from './HeaderSwitcher';
import { UserMenu } from './UserMenu';
import type { NavModel } from '../types';
import { SidebarGroup } from './SidebarGroup';
import { CollapsedCtx, SelectCtx, SidebarItem } from './SidebarItem';
import './sidebar.css';
import { copy } from '../copy';
import { copy as floor } from '@/ui/copy';

interface Props {
  title: string;
  switcher: { items: SwitcherItem[]; value: string | null; onChange(id: string): void };
  useNavModel: () => NavModel;
  user: PublicUser;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggle: () => void;
}
/** Data-driven sidebar: the page supplies groups/items (`useNavModel`), the shell supplies chrome, collapse and the account menu. */
export function Sidebar({ title, switcher, useNavModel, user, onLogout, open, onClose, collapsed, onToggle }: Props) {
  const { groups, footerItems } = useNavModel();
  return (
    <CollapsedCtx.Provider value={collapsed}>
      <SelectCtx.Provider value={onClose}>
        <LayoutGroup id="sidebar">
          <aside className="sidebar" data-open={open ? '' : undefined} data-collapsed={collapsed ? '' : undefined}>
            <button className="sb-close" aria-label={floor.frame.closeMenu} onClick={onClose}>
              ×
            </button>
            <div className="sb-ws">
              <div className="sb-logo">
                <img className="sb-logo-full" src={logo} alt="Ati Flow" />
                <img className="sb-logo-mark" src={mark} alt="Ati Flow" />
              </div>
              <span className="sb-ver">v4.0</span>
              <button
                className="sb-collapse"
                aria-label={collapsed ? copy.sidebarExpand : copy.sidebarCollapse}
                aria-expanded={!collapsed}
                title={collapsed ? copy.sidebarExpand : copy.sidebarCollapse}
                onClick={onToggle}
              >
                {collapsed ? '›' : '‹'}
              </button>
            </div>
            <HeaderSwitcher title={title} {...switcher} />
            <div className="sb-scroll">
              {groups.map((g) => (
                <SidebarGroup key={g.id} group={g} />
              ))}
            </div>
            <div className="sb-foot">
              {footerItems.map((it) => (
                <SidebarItem key={it.id} item={it} />
              ))}
              <UserMenu user={user} onLogout={onLogout} />
            </div>
          </aside>
        </LayoutGroup>
      </SelectCtx.Provider>
    </CollapsedCtx.Provider>
  );
}
