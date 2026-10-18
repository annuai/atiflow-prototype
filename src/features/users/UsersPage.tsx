import { NoResults } from '@/components/data/EmptyState';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { SearchToggle } from '@/components/data/SearchToggle';
import { Input } from '@/components/base/input/input';
import { DataTable, type Column } from '@/components/data/DataTable';
import { roleById, USERS_PATH } from '@/features/access';
import { toPublic, useUsers, type PublicUser } from '@/features/auth';
import '@/ui/detailPages.css';
import { AddUserModal } from './components/AddUserModal';
import { RoleBadge } from './components/RoleBadge';
import { UserAvatar } from './components/UserAvatar';
import { copy } from './copy';
import { localized } from '@/i18n';
import { Page, PageCard, PageHeader } from '@/components/page';

const misc = localized('misc');

/** The users of the app. Only configurators (and the superuser) can open it (see features/access). Same layout as Robots / Hardware: title block with search and Add, one card with the table. */
export function UsersPage() {
  const navigate = useNavigate();
  const users = useUsers((s) => s.users).map(toPublic);
  const [adding, setAdding] = useState(false),
    [searching, setSearching] = useState(false),
    [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = ql
    ? users.filter((u) =>
        [u.name, u.username, u.email, roleById(u.role).label].some((x) => x.toLowerCase().includes(ql)),
      )
    : users;
  const columns: Column<PublicUser>[] = [
    {
      id: 'name',
      sort: (u) => u.name,
      header: copy.columns.name,
      cell: (u) => (
        <div className="flex items-center gap-3 whitespace-nowrap">
          <UserAvatar user={u} />
          <span className="font-semibold text-primary">{u.name}</span>
        </div>
      ),
    },
    { id: 'username', sort: (u) => u.username, header: copy.columns.username, cell: (u) => u.username },
    { id: 'email', sort: (u) => u.email, header: copy.columns.email, cell: (u) => u.email },
    {
      id: 'role',
      sort: (u) => roleById(u.role).label,
      header: copy.columns.role,
      cell: (u) => <RoleBadge role={u.role} />,
    },
    {
      id: 'go',
      header: '',
      className: 'w-10',
      cell: () => <ChevronRight className="size-5 text-fg-brand-primary" aria-hidden />,
    },
  ];
  return (
    <>
      <Page>
        <PageHeader
          title={copy.title}
          subtitle={copy.subtitle}
          actions={
            <>
              {searching && (
                <Input
                  size="sm"
                  aria-label={misc.userForm.searchUsers}
                  placeholder={copy.search}
                  value={q}
                  onChange={setQ}
                  autoFocus
                  wrapperClassName="dv-search"
                />
              )}
              <SearchToggle
                label={misc.userForm.search}
                active={searching}
                onToggle={() => {
                  setSearching((s) => !s);
                  setQ('');
                }}
              />
              <Button size="sm" color="primary" iconLeading={Plus} onPress={() => setAdding(true)}>
                {copy.add}
              </Button>
            </>
          }
        />
        <PageCard>
          {rows.length === 0 ? (
            <NoResults subtext={copy.none(q)} className="m-auto" />
          ) : (
            <div className="dv-scroll">
              <DataTable
                label={copy.title}
                rows={rows}
                rowKey={(u) => u.username}
                columns={columns}
                onRowAction={(u) => navigate(`${USERS_PATH}/${encodeURIComponent(u.username)}`)}
              />
            </div>
          )}
        </PageCard>
      </Page>
      <AddUserModal isOpen={adding} onOpenChange={setAdding} />
    </>
  );
}
