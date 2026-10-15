import { createContext, useContext, useState } from 'react';
import { LayoutGroup } from 'motion/react';
import { Pop } from '@/components/motion/Pop';
import { SlidingHighlight } from '@/components/motion/SlidingHighlight';
import { Button as AriaButton } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import type { PublicUser } from '@/features/auth/types';
import logo from '@/ui/icons/ati-logo.svg';
import chev from '@/ui/icons/chevron-down.svg';
import { HeaderSwitcher, type SwitcherItem } from './HeaderSwitcher';
import { UserMenu } from './UserMenu';
import type { NavGroup, NavItem, NavModel } from './types';
import { copy } from './copy';
import { copy as floor } from '@/ui/copy';

const CollapsedCtx = createContext(false);
const SelectCtx = createContext<() => void>(() => {});

const Item = ({ item }: { item: NavItem }) => {
  const collapsed = useContext(CollapsedCtx);
  const afterSelect = useContext(SelectCtx);
  return (
    <Tooltip title={item.label} placement="right" isDisabled={!collapsed}>
      <AriaButton
        className={'sb-item' + (item.active ? ' active' : '')}
        onPress={() => {
          item.onSelect?.();
          afterSelect();
        }}
      >
        {item.active && <SlidingHighlight id="sb-pill" className="sb-pill" />}
        <span>
          {typeof item.icon === 'string' ? <img src={item.icon} alt="" /> : <item.icon className="size-4 shrink-0" />}
          <span className="t">{item.label}</span>
        </span>
        {item.badge ? (
          <Pop trigger={item.badge} className="sb-badge-pop">
            <Badge size="sm" color="brand" className="sb-badge">
              {item.badge}
            </Badge>
          </Pop>
        ) : null}
      </AriaButton>
    </Tooltip>
  );
};

function Group({ g }: { g: NavGroup }) {
  const [closed, setClosed] = useState(false);
  return (
    <div className={'sb-group' + (closed ? ' closed' : '')}>
      {g.label && (
        <button className="sb-label" aria-expanded={!closed} onClick={() => setClosed((c) => !c)}>
          {g.label}
          <img src={chev} alt="" style={{ transform: closed ? 'rotate(-90deg)' : undefined }} />
        </button>
      )}
      {!closed && g.items.map((it) => <Item key={it.id} item={it} />)}
      {!closed && g.extra}
    </div>
  );
}

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
          <aside className={'sidebar' + (open ? ' open' : '') + (collapsed ? ' collapsed' : '')}>
            <button className="sb-close" aria-label={floor.frame.closeMenu} onClick={onClose}>
              ×
            </button>
            <div className="sb-ws">
              <div className="sb-logo">
                <span className="mark">
                  <img src={logo} alt="" />
                </span>
                <span className="t">Flow</span>
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
            {groups.map((g) => (
              <Group key={g.id} g={g} />
            ))}
            <div className="sb-spacer" />
            <div className="sb-foot">
              {footerItems.map((it) => (
                <Item key={it.id} item={it} />
              ))}
              <UserMenu user={user} onLogout={onLogout} />
            </div>
          </aside>
        </LayoutGroup>
      </SelectCtx.Provider>
    </CollapsedCtx.Provider>
  );
}
