import { useState } from 'react';
import chev from '@/ui/icons/chevron-down.svg';
import type { NavGroup } from '../types';
import { SidebarItem } from './SidebarItem';

/** A titled group of items that folds away when its title is pressed (a group without a title is always open). */
export function SidebarGroup({ group }: { group: NavGroup }) {
  const [closed, setClosed] = useState(false);
  return (
    <div className="sb-group">
      {group.label && (
        <button className="sb-label" aria-expanded={!closed} onClick={() => setClosed((c) => !c)}>
          {group.label}
          <img src={chev} alt="" style={{ transform: closed ? 'rotate(-90deg)' : undefined }} />
        </button>
      )}
      {!closed && group.items.map((it) => <SidebarItem key={it.id} item={it} />)}
      {!closed && group.extra}
    </div>
  );
}
