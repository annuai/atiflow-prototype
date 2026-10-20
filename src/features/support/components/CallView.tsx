import { focusFirstError } from '@/utils/focus-first-error';
import { useState } from 'react';
import { PhoneCall01 } from '@untitledui/icons';
import { notify } from '@/ui/toast';
import { buildContext } from '../context';
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '../hours';
import { copy } from '../copy';
import { callbackTicket } from '../service/mockSupportService';
import { supportService, supportStore, internetUp } from '../store';
import { useSupportStatus } from '../useSupportStatus';
import type { CallbackInput } from '../types';
import { Chip, PRIMARY, SECONDARY } from './parts';

type When = CallbackInput['when'];
/**
 * The phone number (a real `tel:` link: a phone works without this system's internet), the hours and whether support is in, and a callback request. Nothing here places a real call: "Call now"
 * only shows a mock "Calling..." screen. Outside hours "Call now" is off and the callback is for when support reopens.
 */
export function CallView() {
  const status = useSupportStatus();
  const [calling, setCalling] = useState(false);
  const [phone, setPhone] = useState('');
  const [when, setWhen] = useState<When>(status.online ? 'asap' : 'reopen');
  const [error, setError] = useState('');
  const options: [When, string][] = status.online
    ? [
        ['asap', copy.call.whenAsap],
        ['30m', copy.call.when30],
        ['1h', copy.call.when60],
      ]
    : [['reopen', copy.call.whenReopen]];
  const request = async () => {
    if (!phone.trim()) {
      setError(copy.call.phoneRequired);
      return focusFirstError();
    }
    const input: CallbackInput = { phone: phone.trim(), when, context: buildContext() };
    if (!internetUp()) {
      supportStore.getState().saveDraft(callbackTicket(input));
      notify.info(copy.tickets.draftSaved, undefined, 'support-draft');
      return supportStore.getState().go('tickets');
    }
    const t = await supportService.requestCallback(input);
    await supportStore.getState().refresh();
    notify.success(copy.call.sent(t.id), undefined, 'support-callback');
    supportStore.getState().go('ticket', { ticketId: t.id });
  };
  if (calling)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" role="status">
        <span className="grid size-20 place-items-center rounded-full bg-brand-primary text-brand-secondary sup-ring">
          <PhoneCall01 aria-hidden className="size-9" />
        </span>
        <h3 className="text-lg font-semibold text-primary">{copy.call.calling}</h3>
        <p className="text-sm text-tertiary">{SUPPORT_PHONE}</p>
        <p className="text-xs text-tertiary">{copy.call.mockNote}</p>
        <button type="button" className={PRIMARY} onClick={() => setCalling(false)}>
          {copy.call.hangUp}
        </button>
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <section className="flex flex-col gap-1 rounded-2xl border border-secondary p-4">
        <p className="text-xs text-tertiary">{copy.call.number}</p>
        <a
          href={SUPPORT_PHONE_HREF}
          className="text-2xl font-bold text-primary underline-offset-2 outline-focus-ring hover:underline focus-visible:outline-2"
        >
          {SUPPORT_PHONE}
        </a>
        <p className="mt-2 text-xs text-tertiary">{copy.call.hours}</p>
        <p className="text-sm text-secondary">{status.hoursLabel}</p>
        <p
          className={
            status.online
              ? 'mt-1 text-sm font-semibold text-success-primary'
              : 'mt-1 text-sm font-semibold text-tertiary'
          }
        >
          {status.online ? copy.call.online : copy.call.offline}
        </p>
        {!status.online && <p className="text-sm text-tertiary">{copy.call.closed(status.backAt)}</p>}
        {status.online ? (
          <a href={SUPPORT_PHONE_HREF} onClick={() => setCalling(true)} className={`${PRIMARY} mt-3`}>
            {copy.call.callNow}
          </a>
        ) : (
          <button type="button" disabled className={`${PRIMARY} mt-3`}>
            {copy.call.callNow}
          </button>
        )}
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-secondary p-4" aria-label={copy.call.callback}>
        <h3 className="text-sm font-semibold text-primary">{copy.call.callback}</h3>
        <label className="flex flex-col gap-1 text-sm text-secondary">
          {copy.call.phone}
          <input
            type="tel"
            inputMode="tel"
            aria-invalid={!!error}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            className="min-h-11 rounded-lg border border-primary bg-primary px-3 text-primary outline-focus-ring focus-visible:outline-2"
          />
          {error && (
            <span role="alert" className="text-xs text-error-primary">
              {error}
            </span>
          )}
        </label>
        <div role="group" aria-label={copy.call.when} className="flex flex-wrap gap-2">
          {options.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={when === id}
              onClick={() => setWhen(id)}
              className={`${when === id ? PRIMARY : SECONDARY}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={PRIMARY} onClick={() => void request()}>
          {copy.call.send}
        </button>
      </section>
    </div>
  );
}
export { Chip };
