import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from '@untitledui/icons';

/**
 * THE "Danger zone" of the app: a collapsed card, so a destructive action needs one more click to even be seen (it is buried on purpose). Opening it shows a title, a line saying what happens
 * (the heading + `children`) and the action on the right, which should be a quiet `tertiary-destructive` button that opens a confirmation (type the name for anything hard to undo).
 */
export function DangerZone({
  label,
  title,
  description,
  action,
  children,
}: {
  /** the heading of the collapsed card ("Danger zone") */
  label: string;
  title: string;
  description: string;
  /** the button */
  action: ReactNode;
  /** extra lines under the description (what will be touched, why it is refused) */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <section className="rounded-xl border border-secondary bg-primary">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-tertiary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
      >
        {label}
        <Chevron className="size-4 text-fg-quaternary" aria-hidden />
      </button>
      {open && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-secondary px-4 py-4">
          <div className="min-w-0 max-w-xl">
            <p className="text-sm font-semibold text-primary">{title}</p>
            <p className="text-sm text-tertiary">{description}</p>
            {children}
          </div>
          {action}
        </div>
      )}
    </section>
  );
}
