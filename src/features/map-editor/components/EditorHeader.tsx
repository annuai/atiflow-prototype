import { ClockRewind, Map01, ReverseLeft, ReverseRight, Rocket01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { InlineNameEdit } from '@/components/form/InlineNameEdit';
import { renameMap } from '@/features/maps';
import { copy } from '../copy';

/** The editor's top bar (Figma "Header Bar"): title, map name with its state, Design | Simulation, version history and Publish. */
export function EditorHeader({
  canUndo,
  canRedo,
  showHistory,
  onUndo,
  onRedo,
  mapId,
  mode,
  onMode,
  name,
  state,
  isDraft,
  canEdit,
  onHistory,
  onPublish,
  onEdit,
}: {
  canUndo: boolean;
  canRedo: boolean;
  showHistory: boolean;
  onUndo(): void;
  onRedo(): void;
  mode: 'design' | 'simulation';
  onMode(m: 'design' | 'simulation'): void;
  mapId: string;
  name: string;
  state: { label: string; color: 'warning' | 'success' | 'gray' };
  isDraft: boolean;
  canEdit: boolean;
  onHistory(): void;
  onPublish(): void;
  onEdit(): void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
          <Map01 className="size-4" />
          {copy.title}
        </span>
        <span className="h-4 w-px bg-border-primary" aria-hidden />
        <InlineNameEdit
          value={name}
          label={copy.renameMap.label}
          tooltip={copy.renameMap.tooltip}
          onSave={(to) => renameMap(mapId, to)}
          display={
            <span className="max-w-[40vw] truncate text-sm font-medium text-brand-secondary" title={name}>
              {name}
            </span>
          }
        />
        <Badge size="sm" type="pill-color" color={state.color}>
          {state.label}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {showHistory && (
          <>
            <ButtonUtility
              size="sm"
              color="secondary"
              icon={ReverseLeft}
              tooltip={copy.undo}
              aria-label={copy.undo}
              isDisabled={!canUndo}
              onPress={onUndo}
            />
            <ButtonUtility
              size="sm"
              color="secondary"
              icon={ReverseRight}
              tooltip={copy.redo}
              aria-label={copy.redo}
              isDisabled={!canRedo}
              onPress={onRedo}
            />
          </>
        )}
        <ButtonGroup
          size="sm"
          aria-label="Mode"
          selectedKeys={[mode]}
          onSelectionChange={(k) => {
            const v = [...k][0];
            if (v) onMode(v as 'design' | 'simulation');
          }}
        >
          <ButtonGroupItem id="design">{copy.design}</ButtonGroupItem>
          <ButtonGroupItem id="simulation">{copy.simulation}</ButtonGroupItem>
        </ButtonGroup>
        <ButtonUtility
          size="sm"
          color="secondary"
          icon={ClockRewind}
          tooltip={copy.history}
          aria-label={copy.history}
          onPress={onHistory}
        />
        {isDraft ? (
          <Button size="sm" color="primary" iconLeading={Rocket01} onPress={onPublish}>
            {copy.publish}
          </Button>
        ) : (
          <Button size="sm" color="primary" isDisabled={!canEdit} onPress={onEdit}>
            {copy.editAsDraft}
          </Button>
        )}
      </div>
    </header>
  );
}
