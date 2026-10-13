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
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-primary p-8 text-center shadow-lg ring-1 ring-secondary">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-fg-quaternary"><Lock01 className="size-6" /></span>
        <h1 className="text-lg font-semibold text-primary">Nothing to open yet</h1>
        <p className="text-sm text-tertiary">{user.name}, your access has no pages in this app yet. Ask a configurator to update your permissions.</p>
        <Button size="sm" color="secondary" onPress={() => { authStore.getState().logout(); navigate('/login', { replace: true }); }}>Log out</Button>
      </div>
    </div>
  );
}
