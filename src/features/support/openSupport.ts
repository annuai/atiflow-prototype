import { supportStore, useSupport, type Prefill } from './store';

/** Open the support widget, optionally on a chat or ticket with something filled in. Never sends anything: a ticket is only made when the person presses its button. */
export function openSupport(
  opts: {
    category?: Prefill['category'];
    context?: { aiSummary?: string; description?: string };
    view?: 'home' | 'chat' | 'new';
  } = {},
) {
  const s = supportStore.getState();
  const prefill: Prefill | null =
    opts.category || opts.context
      ? { category: opts.category, aiSummary: opts.context?.aiSummary, description: opts.context?.description }
      : null;
  s.go(opts.view ?? (opts.context?.aiSummary ? 'new' : opts.category ? 'chat' : 'home'), { prefill });
  s.setOpen(true);
}

/** The Go to Support button: opens the window, or closes it when it is open. */
export const toggleSupport = () => supportStore.getState().setOpen(!supportStore.getState().open);
/** Replies from support the person has not read yet (the badge on the Go to Support button). */
export const useSupportUnread = () => useSupport((s) => s.tickets.reduce((n, t) => n + t.unread, 0));
