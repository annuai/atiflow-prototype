import { toPublic, useUsers } from '@/features/auth';

/** A person's name for a username (the username itself when the person is not in the list any more). */
export function useUserNames(): (username: string) => string {
  const users = useUsers((s) => s.users);
  return (u) => {
    const f = users.find((x) => x.username === u);
    return f ? toPublic(f).name : u;
  };
}
