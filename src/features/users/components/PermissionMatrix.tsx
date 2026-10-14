import { Checkbox } from '@/components/base/checkbox/checkbox';
import { cx } from '@/utils/cx';
import { WORKSPACES, effective, setPermission, setWorkspace, type AccessProfile } from '@/features/access';
import { copy } from '../copy';

/**
 * One table, one column per workspace (Configurator, Supervisor, Operator), one tick per feature, straight from the access catalog:
 * a new feature or workspace appears here by itself. Read-only until `editable`; a role's preset is only the starting point (see policy.ts).
 */
export function PermissionMatrix({ profile, editable, onChange }: { profile: AccessProfile; editable: boolean; onChange(next: AccessProfile): void }) {
  const held = effective(profile);
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 2xl:grid-cols-4" role="group" aria-label={copy.perms.title}>
      {WORKSPACES.map((w) => {
        const n = w.features.filter((f) => held.has(f.id)).length;
        return (
          <section key={w.id} className="min-w-0">
            <header className="mb-2 flex items-center justify-between gap-2 border-b border-secondary pb-2">
              <h3 className="min-w-0 text-md font-semibold text-primary">{w.name}{!w.built && <span className="ml-2 text-xs font-normal text-quaternary">{copy.perms.notBuilt}</span>}</h3>
              {w.features.length > 0 && <Checkbox size="sm" aria-label={copy.perms.all(w.name)} isDisabled={!editable} isSelected={n === w.features.length} isIndeterminate={n > 0 && n < w.features.length} onChange={(on) => onChange(setWorkspace(profile, w.id, on))} />}
            </header>
            {w.features.length === 0 ? <p className="py-2 text-sm text-quaternary">{copy.perms.none}</p> : (
              <ul className="flex flex-col">
                {w.features.map((f) => (
                  <li key={f.id} className={cx('flex items-center justify-between gap-3 py-1.5 text-sm', held.has(f.id) ? 'text-primary' : 'text-tertiary')}>
                    <span>{f.label}</span>
                    <Checkbox size="sm" aria-label={`${w.name}: ${f.label}`} isDisabled={!editable} isSelected={held.has(f.id)} onChange={(on) => onChange(setPermission(profile, f.id, on))} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
