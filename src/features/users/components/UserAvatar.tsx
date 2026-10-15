import { Avatar } from '@/components/base/avatar/avatar';
import { type PublicUser } from '@/features/auth';

/** The user's picture, or their initials when they have none. */
export function UserAvatar({
  user,
  size = 'md',
}: {
  user: Pick<PublicUser, 'name' | 'avatar' | 'username'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const initials = (user.name || user.username)
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <Avatar size={size} src={user.avatar} alt={user.name} initials={initials} />;
}
