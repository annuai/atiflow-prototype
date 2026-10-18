import { createContext, useContext, type FC, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { Pop } from '@/components/motion/Pop';
import { SlidingHighlight } from '@/components/motion/SlidingHighlight';
import type { NavItem } from '../types';

/** What an item needs to know about the sidebar around it: whether it is the narrow rail (labels become tooltips) and what to do after a choice (the drawer closes). */
export const CollapsedCtx = createContext(false);
export const SelectCtx = createContext<() => void>(() => {});

const SidebarIcon = ({ icon }: { icon: NavItem['icon'] }) => {
  const Icon = icon as FC<{ className?: string }>;
  return typeof icon === 'string' ? <img src={icon} alt="" /> : <Icon className="size-4 shrink-0" />;
};

/** One entry of the sidebar: icon, label, an optional count, and the highlight that slides to it while it is the active one. */
export function SidebarItem({ item }: { item: NavItem }) {
  const collapsed = useContext(CollapsedCtx);
  const afterSelect = useContext(SelectCtx);
  return (
    <Tooltip title={item.label} placement="right" isDisabled={!collapsed}>
      <AriaButton
        className="sb-item"
        data-active={item.active ? '' : undefined}
        onPress={() => {
          item.onSelect?.();
          afterSelect();
        }}
      >
        {item.active && <SlidingHighlight id="sb-pill" className="sb-pill" />}
        <span>
          <SidebarIcon icon={item.icon} />
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
}

/** A sidebar entry that opens something instead of going somewhere (the configurator's "Create new fleet"): the same look as an item, with its own press handler. */
export function SidebarButton({ icon, label, onPress }: { icon: NavItem['icon']; label: ReactNode; onPress(): void }) {
  return (
    <button className="sb-item" onClick={onPress}>
      <span>
        <SidebarIcon icon={icon} />
        <span className="t">{label}</span>
      </span>
    </button>
  );
}
