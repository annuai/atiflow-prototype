import { MessageChatCircle, PhoneCall01, Ticket01 } from '@untitledui/icons';
import { COMMON_ISSUES } from '../data/mockSupportData';
import { copy } from '../copy';
import { supportStore, useSupport, internetUp } from '../store';
import { Chip } from './parts';

/** Three big cards (chat, call, my tickets) and the common problems as chips that start a chat with the category filled in. */
export function SupportHome() {
  const open = useSupport((s) => s.tickets.filter((t) => t.status !== 'solved').length);
  const net = useSupport((s) => internetUp(s));
  const card = (icon: React.ReactNode, title: string, hint: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-2xl border border-secondary bg-primary p-4 text-left shadow-xs outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-primary text-brand-secondary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-primary">{title}</span>
        <span className="block text-sm text-tertiary">{hint}</span>
      </span>
    </button>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {card(
        <MessageChatCircle aria-hidden className="size-6" />,
        copy.home.chat.title,
        net ? copy.home.chat.hint : copy.chat.disabled,
        () => supportStore.getState().go('chat', { prefill: null }),
        !net,
      )}
      {card(<PhoneCall01 aria-hidden className="size-6" />, copy.home.call.title, copy.home.call.hint, () =>
        supportStore.getState().go('call'),
      )}
      {card(
        <Ticket01 aria-hidden className="size-6" />,
        copy.home.tickets.title,
        open ? copy.home.tickets.open(open) : copy.home.tickets.none,
        () => supportStore.getState().go('tickets'),
      )}
      <h3 className="mt-2 text-sm font-semibold text-secondary">{copy.home.common}</h3>
      <div className="flex flex-wrap gap-2">
        {COMMON_ISSUES.map((i) => (
          <Chip
            key={i.id}
            onClick={() => supportStore.getState().go(net ? 'chat' : 'new', { prefill: { category: i.category } })}
          >
            {copy.home.issues[i.id as keyof typeof copy.home.issues]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
