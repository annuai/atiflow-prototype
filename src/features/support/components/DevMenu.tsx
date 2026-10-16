import { supportStore, useSupport } from '../store';

/** Demo switches (long-press the header, or open the app with ?devSupport=1): force support online / offline and pretend there is no internet. English only: a tool for demos, not for customers. */
export function DevMenu() {
  const dev = useSupport((s) => s.dev);
  const set = supportStore.getState().setDev;
  const seg = <T extends boolean | null>(label: string, value: T, options: [string, T][], on: (v: T) => void) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 font-semibold text-secondary">{label}</span>
      {options.map(([name, v]) => (
        <button
          key={name}
          type="button"
          aria-pressed={value === v}
          onClick={() => on(v)}
          className={`min-h-9 rounded-md border px-2 ${value === v ? 'border-brand bg-brand-primary text-brand-secondary' : 'border-primary text-secondary'}`}
        >
          {name}
        </button>
      ))}
    </div>
  );
  return (
    <section
      aria-label="Demo switches"
      className="flex flex-col gap-2 border-b border-secondary bg-warning-primary p-3"
    >
      {seg(
        'Support hours',
        dev.hours,
        [
          ['Auto', null],
          ['Online', true],
          ['Offline', false],
        ],
        (v) => set({ hours: v }),
      )}
      {seg(
        'Internet',
        dev.internet,
        [
          ['Auto', null],
          ['No internet', false],
        ],
        (v) => set({ internet: v }),
      )}
    </section>
  );
}
