import { useState } from 'react';
import { Camera01 } from '@untitledui/icons';
import { notify } from '@/ui/toast';
import { buildContext, robotChoices } from '../context';
import { CATEGORY_ORDER } from '../data/mockSupportData';
import { copy } from '../copy';
import { internetUp, supportService, supportStore, useSupport } from '../store';
import type { Attachment, Category, Severity } from '../types';
import { IncludedInfo } from './IncludedInfo';
import { Chip, PRIMARY, SECONDARY } from './parts';

/** Create a ticket: category, how serious, what happened, an optional robot and photo. The context that goes with it is shown. Without internet the ticket is saved as a draft and sent later. */
export function NewTicketForm() {
  const prefill = useSupport((s) => s.prefill);
  const tickets = useSupport((s) => s.tickets);
  const net = useSupport((s) => internetUp(s));
  const [category, setCategory] = useState<Category>(prefill?.category ?? 'question');
  const [severity, setSeverity] = useState<Severity>(prefill?.severity ?? 'degraded');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [robot, setRobot] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Attachment | null>(null);
  const [error, setError] = useState('');
  const context = buildContext({ aiSummary: prefill?.aiSummary });
  const dup = robot ? tickets.find((t) => t.robotId === robot && t.status !== 'solved') : undefined;
  const submit = async () => {
    if (!description.trim()) return setError(copy.tickets.form.required);
    const input = {
      category,
      severity,
      description: description.trim(),
      robotId: robot ?? undefined,
      attachments: photo ? [photo] : undefined,
      context,
    };
    if (!net) {
      supportStore.getState().saveDraft(input);
      notify.info(copy.tickets.draftSaved, undefined, 'support-draft');
      return supportStore.getState().go('tickets', { prefill: null });
    }
    const t = await supportService.createTicket(input);
    await supportStore.getState().refresh();
    notify.success(copy.tickets.created(t.id), undefined, 'support-created');
    supportStore.getState().go('ticket', { ticketId: t.id, prefill: null });
  };
  const group = (label: string, children: React.ReactNode) => (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-secondary">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {group(
        copy.tickets.form.category,
        CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`${category === c ? PRIMARY : SECONDARY} !min-h-11`}
          >
            {copy.categories[c]}
          </button>
        )),
      )}
      {group(
        copy.tickets.form.severity,
        (['blocking', 'degraded', 'question'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={severity === s}
            onClick={() => setSeverity(s)}
            className={`${severity === s ? PRIMARY : SECONDARY}`}
          >
            {copy.severities[s]}
          </button>
        )),
      )}
      {group(copy.tickets.form.robot, [
        <Chip key="none" tone={robot === null ? 'brand' : 'plain'} onClick={() => setRobot(null)}>
          {copy.tickets.form.none}
        </Chip>,
        ...robotChoices().map((r) => (
          <Chip key={r} tone={robot === r ? 'brand' : 'plain'} onClick={() => setRobot(r)}>
            {r}
          </Chip>
        )),
      ])}
      {dup && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-warning-primary p-3 text-sm text-warning-primary"
        >
          {copy.tickets.duplicate(robot!, dup.id)}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => supportStore.getState().go('ticket', { ticketId: dup.id })}
          >
            {copy.tickets.view}
          </button>
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold text-secondary">
        {copy.tickets.form.description}
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError('');
          }}
          rows={4}
          className="rounded-lg border border-primary bg-primary p-3 text-sm font-normal text-primary outline-focus-ring focus-visible:outline-2"
        />
        {error && (
          <span role="alert" className="text-xs font-normal text-error-primary">
            {error}
          </span>
        )}
      </label>
      {prefill?.aiSummary && (
        <section
          className="rounded-xl border border-secondary bg-secondary p-3"
          aria-label={copy.tickets.form.aiPreview}
        >
          <h3 className="text-xs font-semibold text-tertiary">{copy.tickets.form.aiPreview}</h3>
          <p className="mt-1 text-sm whitespace-pre-wrap text-secondary">{prefill.aiSummary}</p>
        </section>
      )}
      <label className={`${SECONDARY} gap-2`}>
        <Camera01 aria-hidden className="size-5" />
        {photo ? photo.name : copy.tickets.form.photo}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () =>
              setPhoto({ name: f.name, type: f.type, dataUrl: f.size <= 200_000 ? String(r.result) : undefined });
            r.readAsDataURL(f);
          }}
        />
      </label>
      {photo?.dataUrl && (
        <img src={photo.dataUrl} alt={photo.name} className="max-h-32 w-fit rounded-lg border border-secondary" />
      )}
      <IncludedInfo context={context} />
      <button type="button" className={PRIMARY} onClick={() => void submit()}>
        {net ? copy.tickets.form.submit : copy.tickets.form.saveDraft}
      </button>
    </div>
  );
}
