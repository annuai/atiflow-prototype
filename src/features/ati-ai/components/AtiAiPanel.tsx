import { Button as AriaButton } from 'react-aria-components';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from '@untitledui/icons';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { INSIGHTS } from '../service/supervisor';
import { activeThread, atiAiStore, useAtiAi, type SendInput } from '../store';
import type { Block, Chip, Range, Role } from '../types';
import { useAiContext } from '../useAiContext';
import { AtiAiHeader } from './AtiAiHeader';
import { ChipRow } from './blocks/Simple';
import { Composer } from './Composer';
import { MessageList, Mark } from './MessageList';

const QUICK: Record<Role, string[]> = {
  operator: ['book:start', 'where', 'repeat', 'cancel', 'supervisor'],
  supervisor: ['summary', 'compare', 'failures', 'idle', 'anomalies'],
  configurator: ['wf:create', 'wf:validate', 'wf:errors', 'wf:explain', 'wf:changes'],
};
const RANGES: Range[] = ['today', '7d', '30d'];
type Card = Extract<Block, { type: 'confirmation_card' }>;

/** The assistant: header, a conversation or the empty state with suggested prompts, quick-action chips, the composer and the "can make mistakes" note. */
export function AtiAiPanel({ open, onClose }: { open: boolean; onClose(): void }) {
  const role = useAtiAi((s) => s.role);
  const thread = useAtiAi(activeThread);
  const busy = useAtiAi((s) => s.busy);
  const streaming = useAtiAi((s) => s.streaming);
  const range = useAtiAi((s) => s.range);
  const ctx = useAiContext();
  const navigate = useNavigate();
  const send = (input: SendInput) => void atiAiStore.getState().send(input, ctx);
  const onChip = (c: Chip) => {
    send({ actionId: c.id, payload: c.payload, label: c.label });
    if (c.id === 'wf:editor') navigate('/configurator');
    if (c.id === 'pin') notify.success(c.label, undefined, 'ati-ai-pin');
    if (c.id === 'export' || c.id === 'export-pdf') notify.info(c.label, undefined, 'ati-ai-export');
  };
  const handlers = {
    onChip,
    onConfirm: (b: Card) => {
      atiAiStore.getState().markCard(b.id, 'done');
      send({ actionId: 'confirm', payload: { action: JSON.stringify(b.action) }, label: copy.blocks.confirm });
    },
    onEdit: (b: Card) => {
      atiAiStore.getState().markCard(b.id, 'cancelled');
      send({ actionId: 'edit', label: copy.blocks.edit });
    },
    onCancel: (b: Card) => {
      atiAiStore.getState().markCard(b.id, 'cancelled');
      send({ actionId: 'dismiss', label: copy.blocks.cancel });
    },
  };
  if (!role) return null;
  const messages = thread?.messages ?? [];
  const recent =
    role === 'operator' && !thread?.booking
      ? [...new Map(ctx().trips.map((t) => [`${t.from}>${t.to}`, t])).values()].slice(0, 2)
      : [];
  const prompts = Object.entries(copy.prompts[role]);
  return (
    <aside
      className="ai"
      aria-label={copy.panel}
      data-role={role}
      onKeyDown={(e) => e.key === 'Escape' && !e.defaultPrevented && onClose()}
    >
      <AtiAiHeader onNew={() => atiAiStore.getState().newChat()} onClose={onClose} />
      {role === 'supervisor' && (
        <div className="ai-range">
          <span>{copy.range.label}</span>
          <Dropdown.Root>
            <AriaButton className="ai-role" aria-label={`${copy.range.label}: ${copy.range[range]}`}>
              {copy.range[range]}
              <ChevronDown aria-hidden className="size-3.5" />
            </AriaButton>
            <Dropdown.Popover placement="bottom start" className="w-44">
              <Dropdown.Menu onAction={(k) => atiAiStore.getState().setRange(k as Range)}>
                {RANGES.map((r) => (
                  <Dropdown.Item key={r} id={r} label={copy.range[r]} />
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
      )}
      <div className="ai-scroll">
        {messages.length === 0 ? (
          <div className="ai-empty">
            <Mark size={56} />
            <h3>{copy.heading}</h3>
            <div className="ai-prompts">
              {prompts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="ai-prompt"
                  disabled={busy}
                  onClick={() => send({ actionId: id, label })}
                >
                  {label}
                </button>
              ))}
            </div>
            {role === 'supervisor' && (
              <div className="ai-insights">
                <h4>{copy.insights}</h4>
                {INSIGHTS.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="ai-insight"
                    disabled={busy}
                    onClick={() => send({ actionId: i.id, label: i.text })}
                  >
                    {i.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <MessageList messages={messages} busy={busy} streaming={streaming} handlers={handlers} />
        )}
      </div>
      <div className="ai-quick">
        <ChipRow
          disabled={busy}
          onChip={onChip}
          chips={[
            ...recent.map((t) => ({
              id: 'route',
              label: `${t.fromName} → ${t.toName}`,
              payload: { from: t.from, to: t.to },
            })),
            ...QUICK[role].map((id) => ({ id, label: copy.quick[id as keyof typeof copy.quick] })),
          ]}
        />
      </div>
      <Composer role={role} busy={busy} focusKey={open} onSend={(text) => send({ text })} />
      <p className="ai-foot">{copy.footer}</p>
    </aside>
  );
}
