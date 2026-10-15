import { Button as AriaButton } from 'react-aria-components';
import { LogOut01 } from '@untitledui/icons';
import { Avatar } from '@/components/base/avatar/avatar';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import type { PublicUser } from '@/features/auth/types';
import { copy } from './copy';
import { copy as floor } from '@/ui/copy';

/** Avatar block at the bottom of the sidebar. Click opens an account menu with Log out. */
export function UserMenu({ user, onLogout }: { user: PublicUser; onLogout: () => void }) {
  return (
    <Dropdown.Root>
      <AriaButton className="sb-user" aria-label={floor.frame.accountMenu(user.name)}>
        <Avatar size="md" status="online" src={user.avatar} alt={user.name} />
        <div className="t">
          <b>{user.name}</b>
          <small>{user.title}</small>
        </div>
      </AriaButton>
      <Dropdown.Popover placement="top start" className="w-60">
        <div className="flex items-center gap-3 border-b border-secondary px-3 py-3">
          <Avatar size="md" src={user.avatar} alt="" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-secondary">{user.name}</p>
            <p className="truncate text-xs text-tertiary">{user.title}</p>
          </div>
        </div>
        <Dropdown.Menu
          onAction={(k) => {
            if (k === 'logout') onLogout();
          }}
        >
          <Dropdown.Item id="logout" icon={LogOut01} label={copy.logout} />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
