import type { SupportContext } from '../types';
import { copy } from '../copy';

/** Exactly what is sent along with a ticket, in a collapsed row the person can open. */
export function IncludedInfo({ context }: { context: SupportContext }) {
  const i = copy.info;
  const rows: [string, string][] = [
    [i.user, `${context.user.name} (${context.user.role})`],
    [i.site, context.site],
    [i.account, context.account],
    [i.page, context.route || '-'],
    [i.robot, context.robotId ?? i.none],
    [i.trip, context.tripId ?? i.none],
    [i.alerts, context.alerts.length ? context.alerts.join('; ') : i.none],
    [i.versions, `Ati Flow ${context.atiFlowVersion} · firmware ${context.firmwareVersion}`],
    [i.device, context.device],
    ...(context.aiSummary ? ([[i.ai, context.aiSummary]] as [string, string][]) : []),
  ];
  return (
    <details className="rounded-xl border border-secondary bg-primary">
      <summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-sm font-semibold text-secondary outline-focus-ring focus-visible:outline-2">
        {i.title}
      </summary>
      <dl className="flex flex-col gap-1.5 border-t border-secondary px-3 py-3 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-28 shrink-0 text-tertiary">{k}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap text-primary [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
