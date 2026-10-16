import { useEffect, useRef } from 'react';
import { FocusScope } from 'react-aria';
import { ArrowLeft, XClose } from '@untitledui/icons';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { CallView } from './components/CallView';
import { ChatView } from './components/ChatView';
import { DevMenu } from './components/DevMenu';
import { NewTicketForm } from './components/NewTicketForm';
import { SupportHome } from './components/SupportHome';
import { TicketDetail } from './components/TicketDetail';
import { TicketList } from './components/TicketList';
import { copy } from './copy';
import { internetUp, supportService, supportStore, useSupport, type View } from './store';
import { useSupportStatus } from './useSupportStatus';
import './support.css';

const TITLES: Record<View, () => string> = {
  home: () => copy.title,
  chat: () => copy.home.chat.title,
  call: () => copy.call.title,
  tickets: () => copy.tickets.title,
  ticket: () => copy.tickets.title,
  new: () => copy.tickets.create,
};
const BACK: Partial<Record<View, View>> = {
  chat: 'home',
  call: 'home',
  tickets: 'home',
  new: 'tickets',
  ticket: 'tickets',
};

/**
 * The helpdesk window: a floating card under the top bar's Go to Support button (which opens it and shows the unread count) with the three things people need (chat, call, tickets). Frontend only: everything comes from the
 * support service (a mock today, Zendesk behind our backend later). It sits left of the Ati AI panel while that is open. Esc closes it and focus stays inside while it is open.
 */
export function SupportWidget() {
  const open = useSupport((s) => s.open);
  const view = useSupport((s) => s.view);
  const net = useSupport((s) => internetUp(s));
  const devMenu = useSupport((s) => s.dev.menu);
  const status = useSupportStatus();
  const press = useRef<number>(0);
  useEffect(() => {
    void supportStore.getState().refresh();
    void supportStore.getState().flushDrafts();
    return supportService.subscribe((e) => {
      void supportStore.getState().refresh();
      const s = supportStore.getState();
      if (
        e.type === 'message' &&
        e.message.from === 'agent' &&
        !(s.open && s.view === 'ticket' && s.ticketId === e.ticketId)
      )
        notify.info(
          `${e.ticketId}: ${e.message.author ?? 'Support'}`,
          e.message.text.slice(0, 90),
          `support-${e.ticketId}`,
        );
    });
  }, []);
  const close = () => supportStore.getState().setOpen(false);
  const back = BACK[view];
  return (
    <>
      {open && (
        <FocusScope contain restoreFocus autoFocus>
          <section
            className="sup-pop"
            role="dialog"
            aria-label={copy.title}
            onKeyDown={(e) => e.key === 'Escape' && close()}
          >
            <header
              className="flex items-center gap-2 border-b border-secondary px-3 py-3"
              onPointerDown={() => {
                press.current = window.setTimeout(
                  () => supportStore.getState().setDev({ menu: !supportStore.getState().dev.menu }),
                  700,
                );
              }}
              onPointerUp={() => window.clearTimeout(press.current)}
              onPointerLeave={() => window.clearTimeout(press.current)}
            >
              {back && (
                <button
                  type="button"
                  aria-label={copy.back}
                  className="sup-icon"
                  onClick={() => supportStore.getState().go(back)}
                >
                  <ArrowLeft aria-hidden className="size-5" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-primary">
                  {view === 'home' ? copy.title : TITLES[view]()}
                </h2>
                <p className="flex items-center gap-1.5 text-xs text-tertiary">
                  <i
                    className={cx('size-2 rounded-full', status.online ? 'bg-success-solid' : 'bg-fg-quaternary')}
                    aria-hidden
                  />
                  {status.online ? copy.status.online : copy.status.offline(status.backAt)}
                </p>
              </div>
              <button type="button" aria-label={copy.close} className="sup-icon" onClick={close}>
                <XClose aria-hidden className="size-5" />
              </button>
            </header>
            {devMenu && <DevMenu />}
            {!net && (
              <div
                role="alert"
                className="border-b border-secondary bg-warning-primary px-4 py-3 text-sm text-warning-primary"
              >
                <p className="font-semibold">{copy.banner.noInternet}</p>
                <p>{copy.banner.noInternetHint}</p>
              </div>
            )}
            {view === 'home' && <SupportHome />}
            {view === 'chat' && <ChatView />}
            {view === 'call' && <CallView />}
            {view === 'tickets' && <TicketList />}
            {view === 'ticket' && <TicketDetail />}
            {view === 'new' && <NewTicketForm />}
          </section>
        </FocusScope>
      )}
    </>
  );
}
