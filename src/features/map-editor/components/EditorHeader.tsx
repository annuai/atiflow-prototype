import { ClockRewind, Map01, Rocket01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { InlineNameEdit } from '@/components/form/InlineNameEdit';
import { renameMap } from '@/features/maps/model/maps';
import { copy } from '../copy';

/** The editor's top bar (Figma "Header Bar"): title, map name with its state, Design | Simulation, version history and Publish. */
export function EditorHeader({ mapId, mode, onMode, name, state, isDraft, canEdit, onHistory, onPublish, onEdit }: { mode: 'design' | 'simulation'; onMode(m: 'design' | 'simulation'): void; mapId: string; name: string; state: { label: string; color: 'warning' | 'success' | 'gray' }; isDraft: boolean; canEdit: boolean; onHistory(): void; onPublish(): void; onEdit(): void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary"><Map01 className="size-4" />{copy.title}</span>
        <span className="h-4 w-px bg-border-primary" aria-hidden />
        <InlineNameEdit value={name} label={copy.renameMap.label} tooltip={copy.renameMap.tooltip} onSave={(to) => renameMap(mapId, to)} display={<span className="max-w-[40vw] truncate text-sm font-medium text-brand-secondary" title={name}>{name}</span>} />
        <Badge size="sm" type="pill-color" color={state.color}>{state.label}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-secondary bg-secondary p-0.5 text-xs font-medium" role="group" aria-label="Mode">
          {(['design', 'simulation'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)} className={`cursor-pointer rounded-md px-3 py-1 outline-focus-ring focus-visible:outline-2 ${mode === m ? 'bg-primary text-brand-secondary shadow-xs' : 'text-tertiary hover:text-secondary'}`}>{copy[m]}</button>)}
        </div>
        <ButtonUtility size="sm" color="secondary" icon={ClockRewind} tooltip={copy.history} aria-label={copy.history} onPress={onHistory} />
        {isDraft ? <Button size="sm" color="primary" iconLeading={Rocket01} onPress={onPublish}>{copy.publish}</Button> : <Button size="sm" color="primary" isDisabled={!canEdit} onPress={onEdit}>{copy.editAsDraft}</Button>}
      </div>
    </header>
  );
}
