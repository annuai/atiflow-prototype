import { ClockRewind, Download01, Map01, ReverseLeft, ReverseRight, Rocket01 } from '@untitledui/icons';
import { PageCardHeader } from '@/components/page';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { InlineNameEdit } from '@/components/form/InlineNameEdit';
import { renameMap } from '@/features/maps';
import { copy } from '../copy';
import { text } from '../text';

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
  view,
  onView,
  onExport,
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
  /** 2D | 3D: the map as a plan or its structure in 3D, live (3D only when there is something to show) */
  view: '2d' | '3d';
  onView?(v: '2d' | '3d'): void;
  /** download the map for the Deployment Manager (imported maps) */
  onExport?(): void;
}) {
  return (
    <PageCardHeader className="flex-wrap justify-between gap-3">
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
          aria-label={text.aria.mode}
          selectedKeys={[mode]}
          onSelectionChange={(k) => {
            const v = [...k][0];
            if (v) onMode(v as 'design' | 'simulation');
          }}
        >
          <ButtonGroupItem id="design">{copy.design}</ButtonGroupItem>
          <ButtonGroupItem id="simulation">{copy.simulation}</ButtonGroupItem>
        </ButtonGroup>
        {onView && (
          <ButtonGroup
            size="sm"
            aria-label={copy.viewSwitch.label}
            selectedKeys={[view]}
            onSelectionChange={(k) => {
              const v = [...k][0];
              if (v) onView(v as '2d' | '3d');
            }}
          >
            <ButtonGroupItem id="2d">{copy.viewSwitch.d2}</ButtonGroupItem>
            <ButtonGroupItem id="3d">{copy.viewSwitch.d3}</ButtonGroupItem>
          </ButtonGroup>
        )}
        {onExport && (
          <ButtonUtility
            size="sm"
            color="secondary"
            icon={Download01}
            tooltip={copy.exportMap.button}
            aria-label={copy.exportMap.button}
            onPress={onExport}
          />
        )}
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
    </PageCardHeader>
  );
}
