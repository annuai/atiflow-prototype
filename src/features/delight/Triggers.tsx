import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth';
import { useCalls } from '@/features/action-center';
import { mapsStore } from '@/features/maps';
import { wfStore } from '@/features/workflow-builder';
import { services } from '@/services';
import { copy } from './copy';
import { celebrate, parade, sendRobot } from './eggs';

const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];
const today = () => new Date().toDateString();
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** The secret key sequence and five quick clicks on the sidebar logo. */
function useSecrets() {
  useEffect(() => {
    let at = 0;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const k = e.key.toLowerCase();
      at = k === KONAMI[at] ? at + 1 : k === KONAMI[0] ? 1 : 0;
      if (at === KONAMI.length) {
        at = 0;
        parade();
      }
    };
    let clicks = 0,
      last = 0;
    const onClick = (e: MouseEvent) => {
      const logo = (e.target as Element | null)?.closest?.('.sb-logo');
      if (!logo) return;
      const now = Date.now();
      clicks = now - last < 1500 ? clicks + 1 : 1;
      last = now;
      if (clicks < 5) return;
      clicks = 0;
      logo.classList.add('egg-spin');
      window.setTimeout(() => logo.classList.remove('egg-spin'), 900);
      sendRobot({ text: copy.logo });
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}

/** Once a day, the first time the app is open for a person: good morning before noon, "go home" after 19:00. */
function useDaily(username: string, firstName: string) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const h = new Date().getHours();
      const kind = h < 12 ? 'morning' : h >= 19 ? 'late' : null;
      if (!kind) return;
      const key = `egg:${kind}:${username}`;
      const device = services().device;
      if (device.get(key) === today()) return;
      device.set(key, today());
      celebrate(kind === 'morning' ? copy.morning(firstName) : copy.late);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [username, firstName]);
}

/** Things done for the first time, and an empty queue: a robot goes by with a word. Each first happens once per person. */
function useMilestones(username: string) {
  useEffect(() => {
    const device = services().device;
    const once = (id: string, text: string) => {
      const key = `egg:done:${username}:${id}`;
      if (device.get(key)) return;
      device.set(key, '1');
      celebrate(text);
    };
    const published = () =>
      new Set(
        Object.values(wfStore.getState().workflows)
          .filter((w) => w.published)
          .map((w) => w.id),
      );
    let wf = published();
    const offWf = wfStore.subscribe(() => {
      const now = published();
      if ([...now].some((id) => !wf.has(id))) once('workflow', copy.firstWorkflow);
      wf = now;
    });
    const imported = () => mapsStore.getState().maps.filter((m) => m.source === 'imported').length;
    let maps = imported();
    const offMaps = mapsStore.subscribe(() => {
      const n = imported();
      if (n > maps) once('map', copy.firstMap);
      maps = n;
    });
    return () => {
      offWf();
      offMaps();
    };
  }, [username]);
}

/** The Action Center queue going from something to nothing (at most once a day). */
function AllClear({ username }: { username: string }) {
  const { active } = useCalls();
  const had = useRef(0);
  useEffect(() => {
    const n = active.length;
    if (had.current > 0 && n === 0) {
      const key = `egg:clear:${username}`;
      const device = services().device;
      if (device.get(key) !== today()) {
        device.set(key, today());
        celebrate(copy.allClear);
      }
    }
    had.current = n;
  }, [active.length, username]);
  return null;
}

/** Everything that sets an easter egg off by itself (the search words are in `runEgg`). Draws nothing. */
export function Triggers() {
  const user = useAuth((s) => s.user);
  useSecrets();
  useDaily(user?.username ?? '', user?.firstName ?? '');
  useMilestones(user?.username ?? '');
  return user ? <AllClear username={user.username} /> : null;
}
