import { useEffect, useState } from 'react';
import { buildContext, robotChoices } from '../context';
import { CATEGORY_EN, CATEGORY_ORDER, KB, SEVERITY_EN } from '../data/mockSupportData';
import { copy } from '../copy';
import { internetUp, supportService, supportStore, useSupport } from '../store';
import type { Category, Severity, TicketMessage } from '../types';
import { Csat } from './Csat';
import { Bubble, Chip, PRIMARY, SECONDARY, TypingDots } from './parts';
import { Thread } from './Thread';

type Step = 'category' | 'severity' | 'robot' | 'duplicate' | 'fix' | 'fixed' | 'creating' | 'ticket';
let seq = 0;
const bot = (text: string): TicketMessage => ({
  id: `t${seq++}`,
  from: 'bot',
  author: 'Ati Support',
  text,
  at: Date.now(),
});
const you = (text: string): TicketMessage => ({ id: `t${seq++}`, from: 'user', text, at: Date.now() });

/**
 * Chat with support: a bot first (two or three taps: what, how serious, which robot), then a suggested fix from the knowledge base. "Still need help" makes the ticket: within hours an agent
 * joins; outside hours nothing pretends to be an agent and the ticket says when the team is back. Needs the internet (without it the screen says so and offers a saved draft).
 */
export function ChatView() {
  const prefill = useSupport((s) => s.prefill);
  const tickets = useSupport((s) => s.tickets);
  const net = useSupport((s) => internetUp(s));
  const [step, setStep] = useState<Step>(prefill?.category ? 'severity' : 'category');
  const [category, setCategory] = useState<Category | null>(prefill?.category ?? null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [robot, setRobot] = useState<string | null>(null);
  const [log, setLog] = useState<TicketMessage[]>(() => [
    bot(prefill?.category ? copy.chat.askSeverity : copy.chat.askCategory),
  ]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [csat, setCsat] = useState(false);
  const say = (...m: TicketMessage[]) => setLog((l) => [...l, ...m]);
  useEffect(() => {
    if (prefill) supportStore.setState({ prefill: null });
  }, [prefill]);
  if (!net)
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p role="status" className="rounded-xl bg-secondary p-3 text-sm text-secondary">
          {copy.chat.disabled}
        </p>
        <button type="button" className={PRIMARY} onClick={() => supportStore.getState().go('new')}>
          {copy.tickets.create}
        </button>
      </div>
    );
  if (ticketId)
    return (
      <Thread
        ticketId={ticketId}
        onEnd={() => setCsat(true)}
        footer={csat ? <Csat onSubmit={(s, c) => void supportService.submitCsat(ticketId, s, c)} /> : null}
      />
    );
  const pickCategory = (c: Category) => {
    setCategory(c);
    say(you(copy.categories[c]), bot(copy.chat.askSeverity));
    setStep('severity');
  };
  const pickSeverity = (s: Severity) => {
    setSeverity(s);
    say(you(copy.severities[s]));
    if (category === 'robot' || category === 'trip') {
      say(bot(copy.chat.askRobot));
      setStep('robot');
    } else showFix();
  };
  const showFix = () => {
    say(bot(copy.chat.fixIntro));
    setStep('fix');
  };
  const pickRobot = (r: string | null) => {
    setRobot(r);
    say(you(r ?? copy.chat.noRobot));
    const dup = r ? tickets.find((t) => t.robotId === r && t.status !== 'solved') : undefined;
    if (dup) {
      say(bot(copy.tickets.duplicate(r!, dup.id)));
      setStep('duplicate');
    } else showFix();
  };
  const dup = robot ? tickets.find((t) => t.robotId === robot && t.status !== 'solved') : undefined;
  const createTicket = async () => {
    if (!category || !severity) return;
    setStep('creating');
    say(you(copy.chat.still), bot(copy.chat.creating));
    const description = `${CATEGORY_EN[category]} - ${SEVERITY_EN[severity]}${robot ? ` - ${robot}` : ''}. I tried the suggested fix "${KB[category].title}" and still need help.`;
    const t = await supportService.createTicket({
      category,
      severity,
      description,
      robotId: robot ?? undefined,
      context: buildContext(),
      transcript: [
        {
          id: 'tr0',
          from: 'bot',
          author: 'Ati Support bot',
          text: `Suggested fix: ${KB[category].title} - ${KB[category].steps.join(' ')}`,
          at: Date.now(),
        },
      ],
    });
    await supportStore.getState().refresh();
    setTicketId(t.id);
  };
  const kb = category ? KB[category] : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-live="polite">
        <div className="flex flex-col gap-2">
          {log.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {step === 'fix' && kb && (
            <section className="rounded-xl border border-secondary p-3" aria-label={kb.title}>
              <h3 className="text-sm font-semibold text-primary">{kb.title}</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-secondary">
                {kb.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY}
                  onClick={() => {
                    say(you(copy.chat.fixed), bot(copy.chat.thanks));
                    setStep('fixed');
                  }}
                >
                  {copy.chat.fixed}
                </button>
                <button type="button" className={SECONDARY} onClick={() => void createTicket()}>
                  {copy.chat.still}
                </button>
              </div>
            </section>
          )}
          {step === 'creating' && <TypingDots label={copy.chat.creating} />}
          {step === 'fixed' && <Csat onSubmit={() => undefined} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-secondary p-3" role="group">
        {step === 'category' &&
          CATEGORY_ORDER.map((c) => (
            <Chip key={c} onClick={() => pickCategory(c)}>
              {copy.categories[c]}
            </Chip>
          ))}
        {step === 'severity' &&
          (['blocking', 'degraded', 'question'] as const).map((s) => (
            <Chip key={s} onClick={() => pickSeverity(s)}>
              {copy.severities[s]}
            </Chip>
          ))}
        {step === 'robot' && (
          <>
            {robotChoices().map((r) => (
              <Chip key={r} onClick={() => pickRobot(r)}>
                {r}
              </Chip>
            ))}
            <Chip tone="plain" onClick={() => pickRobot(null)}>
              {copy.chat.noRobot}
            </Chip>
          </>
        )}
        {step === 'duplicate' && dup && (
          <>
            <Chip onClick={() => supportStore.getState().go('ticket', { ticketId: dup.id })}>{copy.tickets.view}</Chip>
            <Chip tone="plain" onClick={showFix}>
              {copy.tickets.continue}
            </Chip>
          </>
        )}
        {step === 'fixed' && (
          <Chip tone="plain" onClick={() => supportStore.getState().go('home')}>
            {copy.back}
          </Chip>
        )}
      </div>
    </div>
  );
}
