import { EmptyState } from '@/components/data/EmptyState';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { authStore, useAuth } from '@/features/auth/authStore';

/** Shown to a signed-in user whose access has no page to open yet (for example a line supervisor or an operator). */
export function NoAccessPage() {
  const user = useAuth((s) => s.user); const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="grid min-h-dvh place-items-center bg-secondary p-6">
      <div className="w-full max-w-md rounded-2xl bg-primary shadow-lg ring-1 ring-secondary">
        <EmptyState icon={Lock01} size="lg" title="Nothing to open yet" subtext={`${user.name}, your access has no pages in this app yet. Ask a configurator to update your permissions.`}
          action={<Button size="sm" color="secondary" onPress={() => { authStore.getState().logout(); navigate('/login', { replace: true }); }}>Log out</Button>} />
      </div>
    </div>
  );
}
