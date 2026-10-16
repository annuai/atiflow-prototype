import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { services } from '@/services';
import { log } from '@/platform';
import { MockAtiAiService } from './service/mockService';
import type { AiMessage, AtiAiService, BookingDraft, Context, Patch, Range, Role, WorkflowDraft } from './types';

const OPEN_KEY = 'ati-ai-open';
const MAX = 60;
interface Thread {
  messages: AiMessage[];
  booking: BookingDraft | null;
  workflow: WorkflowDraft | null;
}
const empty = (): Thread => ({ messages: [], booking: null, workflow: null });
const threadKey = (user: string, role: Role) => `ati-ai:${user}:${role}`;
const load = (user: string, role: Role): Thread => {
  try {
    const raw = services().device.get(threadKey(user, role));
    return raw ? { ...empty(), ...(JSON.parse(raw) as Thread) } : empty();
  } catch {
    log.child('ati-ai').warn('a saved chat could not be read and was ignored');
    return empty();
  }
};
const save = (user: string, role: Role, t: Thread) =>
  services().device.set(threadKey(user, role), JSON.stringify({ ...t, messages: t.messages.slice(-MAX) }));

export interface SendInput {
  text?: string;
  actionId?: string;
  payload?: Record<string, string>;
  /** what the person sees as their message (a tapped chip's label) */
  label?: string;
}
export interface AtiAiState {
  open: boolean;
  user: string | null;
  role: Role | null;
  range: Range;
  threads: Record<string, Thread>;
  /** a reply is being made */ busy: boolean;
  /** the id of the AI message whose text is being revealed word by word */ streaming: string | null;
  setOpen(open: boolean): void;
  toggle(): void;
  /** the signed-in person and the role to show (loads that person's saved chats) */
  enter(user: string, role: Role): void;
  setRole(role: Role): void;
  setRange(range: Range): void;
  newChat(): void;
  markCard(cardId: string, state: 'done' | 'cancelled'): void;
  send(
    input: { text?: string; actionId?: string; payload?: Record<string, string>; label?: string },
    ctx: () => Context,
  ): Promise<void>;
  stopStreaming(): void;
}
let service: AtiAiService = new MockAtiAiService();
/** Swap in a real backend (or a fast mock in tests). */
export const setAtiAiService = (s: AtiAiService) => (service = s);
let n = 0;
const id = () => `m${Date.now().toString(36)}${n++}`;

export const atiAiStore = createStore<AtiAiState>((set, get) => {
  const cur = () => {
    const { user, role, threads } = get();
    return user && role ? { k: threadKey(user, role), t: threads[threadKey(user, role)] ?? empty(), user, role } : null;
  };
  const put = (t: Thread) => {
    const c = cur();
    if (!c) return;
    set((s) => ({ threads: { ...s.threads, [c.k]: t } }));
    save(c.user, c.role, t);
  };
  return {
    open: services().device.get(OPEN_KEY) === '1',
    user: null,
    role: null,
    range: '7d',
    threads: {},
    busy: false,
    streaming: null,
    setOpen(open) {
      services().device.set(OPEN_KEY, open ? '1' : '0');
      set({ open });
    },
    toggle: () => get().setOpen(!get().open),
    enter(user, role) {
      const k = threadKey(user, role);
      set((s) => ({ user, role, threads: s.threads[k] ? s.threads : { ...s.threads, [k]: load(user, role) } }));
    },
    setRole(role) {
      const u = get().user;
      if (u) get().enter(u, role);
    },
    setRange: (range) => set({ range }),
    newChat() {
      put(empty());
      set({ busy: false, streaming: null });
    },
    markCard(cardId, state) {
      const c = cur();
      if (!c) return;
      put({
        ...c.t,
        messages: c.t.messages.map((m) => ({
          ...m,
          blocks: m.blocks.map((b) => (b.type === 'confirmation_card' && b.id === cardId ? { ...b, state } : b)),
        })),
      });
    },
    stopStreaming: () => set({ streaming: null }),
    async send(input, ctx) {
      const c = cur();
      if (!c || get().busy) return;
      const label = input.label ?? input.text ?? '';
      let t: Thread = {
        ...c.t,
        messages: [
          ...c.t.messages,
          { id: id(), from: 'user', at: Date.now(), blocks: [{ type: 'text', text: label }] },
        ],
      };
      put(t);
      set({ busy: true });
      const reply: AiMessage = { id: id(), from: 'ai', at: Date.now(), blocks: [] };
      try {
        const context = { ...ctx(), range: get().range, booking: t.booking, workflow: t.workflow };
        for await (const e of service.sendMessage({
          role: c.role,
          text: input.text,
          actionId: input.actionId,
          payload: input.payload,
          context,
        })) {
          if (get().role !== c.role || get().user !== c.user) break; // the person switched: this answer belongs to another thread
          if (e.type === 'patch') t = applyPatch(t, e.patch);
          else {
            reply.blocks = [...reply.blocks, e.block];
            t = { ...t, messages: [...t.messages.filter((m) => m.id !== reply.id), { ...reply }] };
            if (reply.blocks.length === 1) set({ streaming: reply.id });
          }
          put(t);
        }
      } catch (e) {
        log.child('ati-ai').error('the assistant failed', e);
        reply.blocks = [{ type: 'text', text: 'Sorry, something went wrong on my side. Please try again.' }];
        put({ ...t, messages: [...t.messages.filter((m) => m.id !== reply.id), { ...reply }] });
      } finally {
        set({ busy: false });
      }
    },
  };
});
const applyPatch = (t: Thread, p: Patch): Thread => ({
  ...t,
  ...('booking' in p ? { booking: p.booking ?? null } : {}),
  ...('workflow' in p ? { workflow: p.workflow ?? null } : {}),
});
export const useAtiAi = <T>(sel: (s: AtiAiState) => T): T => useStore(atiAiStore, sel);
export const activeThread = (s: AtiAiState): Thread | null =>
  s.user && s.role ? (s.threads[threadKey(s.user, s.role)] ?? null) : null;
