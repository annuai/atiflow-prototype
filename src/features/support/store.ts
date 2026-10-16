import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { services } from '@/services';
import { notify } from '@/ui/toast';
import { MockSupportService } from './service/mockSupportService';
import type { Category, Severity, SupportContext, Ticket, TicketInput } from './types';

export type View = 'home' | 'chat' | 'call' | 'tickets' | 'ticket' | 'new';
export interface Draft {
  id: string;
  input: TicketInput;
  createdAt: number;
}
export interface Prefill {
  category?: Category;
  severity?: Severity;
  description?: string;
  /** a conversation with Ati AI, shown to the person as a preview before anything is sent */ aiSummary?: string;
}
interface Dev {
  /** true / false forces support online / offline; null follows the clock */ hours: boolean | null;
  /** false = pretend there is no internet */ internet: boolean | null;
  menu: boolean;
}
export interface SupportState {
  open: boolean;
  view: View;
  ticketId: string | null;
  prefill: Prefill | null;
  tickets: Ticket[];
  drafts: Draft[];
  /** the browser says it is online */ online: boolean;
  dev: Dev;
  setOpen(open: boolean): void;
  go(view: View, opts?: { ticketId?: string; prefill?: Prefill | null }): void;
  refresh(): Promise<void>;
  setDev(patch: Partial<Dev>): void;
  saveDraft(input: TicketInput): void;
  flushDrafts(): Promise<void>;
}
const OPEN = 'support-open';
const DRAFTS = 'support:drafts';
const readDrafts = (): Draft[] => {
  try {
    return JSON.parse(services().device.get(DRAFTS) ?? '[]') as Draft[];
  } catch {
    return [];
  }
};

export const supportStore = createStore<SupportState>((set, get) => ({
  open: services().device.get(OPEN) === '1',
  view: 'home',
  ticketId: null,
  prefill: null,
  tickets: [],
  drafts: readDrafts(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  dev: {
    hours: null,
    internet: null,
    menu: typeof location !== 'undefined' && /[?&]devSupport=1/.test(location.search),
  },
  setOpen(open) {
    services().device.set(OPEN, open ? '1' : '0');
    set({ open });
  },
  go(view, opts = {}) {
    set({
      view,
      ticketId: opts.ticketId ?? (view === 'ticket' ? get().ticketId : null),
      prefill: opts.prefill === undefined ? get().prefill : opts.prefill,
    });
  },
  async refresh() {
    set({ tickets: await supportService.listTickets() });
  },
  setDev(patch) {
    set((s) => ({ dev: { ...s.dev, ...patch } }));
    if (patch.internet !== undefined) void get().flushDrafts();
  },
  saveDraft(input) {
    const drafts = [...get().drafts, { id: `d${Date.now().toString(36)}`, input, createdAt: Date.now() }];
    services().device.set(DRAFTS, JSON.stringify(drafts));
    set({ drafts });
  },
  /** Sends the drafts made while there was no internet, as soon as there is some. */
  async flushDrafts() {
    if (!internetUp() || !get().drafts.length) return;
    const drafts = get().drafts;
    set({ drafts: [] });
    services().device.set(DRAFTS, '[]');
    const sent: Ticket[] = [];
    for (const d of drafts) sent.push(await supportService.createTicket(d.input));
    await get().refresh();
    notify.success(
      sent.length === 1 ? `Ticket ${sent[0].id} sent` : `${sent.length} tickets sent`,
      'They were saved while there was no internet.',
      'support-drafts-sent',
    );
  },
}));
export const useSupport = <T>(sel: (s: SupportState) => T): T => useStore(supportStore, sel);
/** The internet counts as up unless the browser says it is down or the demo toggle pretends so. */
export const internetUp = (s = supportStore.getState()): boolean => s.online && s.dev.internet !== false;
/** The service every screen uses. PROD: the same interface over the backend that talks to Zendesk. */
export const supportService = new MockSupportService({ override: () => supportStore.getState().dev.hours });

if (typeof window !== 'undefined') {
  const set = () => {
    supportStore.setState({ online: navigator.onLine });
    void supportStore.getState().flushDrafts();
  };
  window.addEventListener('online', set);
  window.addEventListener('offline', set);
}
export type { SupportContext };
