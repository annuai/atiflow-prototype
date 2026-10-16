import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FocusScope } from 'react-aria';
import { enterableWorkspaces, workspaceOfPath } from '@/features/access';
import { useAuth } from '@/features/auth';
import { AtiAiPanel } from './components/AtiAiPanel';
import { atiAiStore, useAtiAi } from './store';
import type { Role } from './types';
import './ati-ai.css';

const useDrawer = () => {
  const q = '(max-width: 1024px)';
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
};

/**
 * The assistant docked on the right of the app, in the sidebar's own surface: it opens by widening beside the page (the page shrinks), and below 1024 px it slides over it as a drawer
 * (focus kept inside, Esc closes). Cmd / Ctrl + J opens and closes it. The roles offered are the workspaces the person holds; each keeps its own chat.
 */
export function AtiAiDock() {
  const user = useAuth((s) => s.user)!;
  const { pathname } = useLocation();
  const open = useAtiAi((s) => s.open);
  const drawer = useDrawer();
  const roles = useMemo(() => enterableWorkspaces(user).map((w) => w.id as Role), [user]);
  const here = workspaceOfPath(pathname) as Role | null;
  const [mounted, setMounted] = useState(open); // the panel (and what it loads) exists only once it has been opened
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    // the signed-in person's chats; the role follows the workspace they are in when they hold it
    const role = (here && roles.includes(here) ? here : roles[0]) as Role | undefined;
    if (role) atiAiStore.getState().enter(user.username, role);
  }, [user.username, roles, here]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        atiAiStore.getState().toggle();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  useEffect(() => {
    // the Ati Support window moves left of the panel while it is docked beside the page
    document.documentElement.classList.toggle('ai-docked', open && !drawer);
    return () => document.documentElement.classList.remove('ai-docked');
  }, [open, drawer]);
  const close = () => atiAiStore.getState().setOpen(false);
  if (!roles.length) return null;
  const body = mounted && <AtiAiPanel open={open} onClose={close} />;
  return (
    <>
      {drawer && open && <div className="ai-scrim" onClick={close} aria-hidden />}
      <div className="ai-dock" data-open={open} data-drawer={drawer} inert={!open}>
        {drawer ? (
          <FocusScope contain={open} restoreFocus>
            {body}
          </FocusScope>
        ) : (
          body
        )}
      </div>
    </>
  );
}
