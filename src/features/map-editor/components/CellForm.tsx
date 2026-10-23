import { ArrowLeft } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Label } from '@/components/base/input/label';
import { RadioButton, RadioGroup } from '@/components/base/radio-buttons/radio-buttons';
import { NumberInput } from '@/components/form/NumberInput';
import { clampCellAngle, colLetter } from '../model/staging';
import {
  cellSummary,
  copyNodesFromFirst,
  describePick,
  editCells,
  resetCells,
  setCells,
  withCellStation,
} from '../model/stagingCells';
import type { MapData, StagingAreaDef } from '../model/types';
import { NodesSection } from './approach/NodesSection';
import { copy } from './approach/copy';

/**
 * The picked cells of a staging area (one cell, a row, a column or several): their rotation, how far their station stands from them, whether it is off the route, and their nodes. A setting the
 * picked cells do not share shows "Mixed"; changing it sets it on all of them. Cells you do not pick keep the area's settings.
 */
export function CellForm({
  area,
  data,
  refs,
  editable,
  addingNode,
  onBack,
  onEdit,
  onAddNode,
  onCancelAddNode,
}: {
  area: StagingAreaDef;
  data: MapData;
  refs: string[];
  editable: boolean;
  addingNode: boolean;
  onBack(): void;
  onEdit(fn: (m: MapData) => MapData, key?: string): void;
  onAddNode(): void;
  onCancelAddNode(): void;
}) {
  const t = copy.cells;
  const sum = cellSummary(data, area, refs);
  const pick = describePick(area, refs);
  const title =
    pick.kind === 'cell'
      ? t.title.cell(pick.ref)
      : pick.kind === 'row'
        ? t.title.row(pick.row)
        : pick.kind === 'column'
          ? t.title.column(colLetter(pick.col))
          : t.title.many(pick.n);
  const stand = refs[0] ? withCellStation(data, area, refs[0]) : null;
  const key = `cells:${area.id}:${refs.join()}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
        {t.back}
      </button>
      <h3 className="text-md font-semibold text-primary">{title}</h3>
      <p className="text-xs text-tertiary">{t.intro}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label={t.rotation}
          value={sum.angle.value}
          mixed={sum.angle.mixed ? t.mixed : undefined}
          disabled={!editable}
          onCommit={(angle) => onEdit((m) => setCells(m, area.id, refs, { angle: clampCellAngle(angle) }), key)}
        />
        <NumberInput
          label={t.offset}
          value={sum.offset.value}
          mixed={sum.offset.mixed ? t.mixed : undefined}
          disabled={!editable}
          onCommit={(offset) => onEdit((m) => setCells(m, area.id, refs, { offset: Math.max(0, offset) }), key)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.placement}</Label>
        <RadioGroup
          aria-label={t.placement}
          isDisabled={!editable}
          value={sum.onLane.mixed ? '' : sum.onLane.value ? 'on' : 'off'}
          onChange={(v) => onEdit((m) => setCells(m, area.id, refs, { onLane: v === 'on' }), key)}
          className="flex-row gap-6"
        >
          <RadioButton value="off" label={t.offRoute} />
          <RadioButton value="on" label={t.onRoute} />
        </RadioGroup>
        {sum.onLane.mixed && <p className="text-xs text-warning-primary">{t.placementMixed}</p>}
      </div>
      {!sum.onLane.mixed && !sum.onLane.value && stand && sum.nodes.mixed && (
        <div className="flex flex-col gap-2 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary">
          {t.nodesMixed}
          {editable && (
            <Button
              size="sm"
              color="secondary"
              className="w-fit"
              onPress={() => onEdit((m) => copyNodesFromFirst(m, area.id, refs))}
            >
              {t.makeSame(refs[0])}
            </Button>
          )}
        </div>
      )}
      {!sum.onLane.mixed && !sum.onLane.value && stand && !sum.nodes.mixed && (
        <NodesSection
          station={stand.station}
          data={stand.data}
          editable={editable}
          adding={addingNode}
          onEdit={(fn, k) => onEdit((m) => editCells(m, area.id, refs, (x) => fn(x)) ?? m, k ?? key)}
          onAdd={onAddNode}
          onCancelAdd={onCancelAddNode}
        />
      )}
      <p className="text-xs text-tertiary">{t.hint}</p>
      {editable && (
        <Button
          size="md"
          color="secondary"
          className="mt-auto"
          onPress={() => onEdit((m) => resetCells(m, area.id, refs))}
        >
          {t.reset}
        </Button>
      )}
    </div>
  );
}
