import { useEffect, useState } from 'react';
import { ArrowLeft, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select } from '@/components/base/select/select';
import { ROBOT_TYPES } from '@/data/robotTypes';
import { copy } from '../copy';
import { help } from '../help';
import { stagingProblems, totalCells } from '../model/staging';
import type { MapData, StagingAreaDef } from '../model/types';
import { LocateButton } from './LocateButton';
import { Hint } from './Hint';
import { NumberInput } from './NumberInput';

/** One staging area (the old tool's "Add staging area"): name, robot type, rotation, where the A1 cell is, how many rows and columns, the size of a cell. */
export function StagingForm({ onLocate, area, data, editable, onBack, onPatch, onDelete }: { onLocate(): void; area: StagingAreaDef; data: MapData; editable: boolean; onBack(): void; onPatch(p: Partial<Omit<StagingAreaDef, 'id'>>): void; onDelete(): void }) {
  const f = copy.staging.form; const [name, setName] = useState(area.name); useEffect(() => setName(area.name), [area.id, area.name]);
  const problems = stagingProblems(data, { ...area, name });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <button type="button" className="flex w-fit items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary" onClick={onBack}><ArrowLeft className="size-4" />{f.back}</button>
      <div className="flex flex-wrap items-center gap-2"><Badge size="md" color="gray">{area.id}</Badge><Badge size="md" color="brand">{f.cells(totalCells(area))}</Badge></div>
      <Input label={f.name} size="sm" value={name} isDisabled={!editable} isInvalid={!!problems.name && editable} hint={editable ? problems.name : undefined} onChange={setName} onBlur={() => { if (editable && !problems.name && name.trim() !== area.name) onPatch({ name: name.trim() }); else setName(area.name); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <div className="flex flex-col gap-1.5"><Label {...help('staging.sherpa')}>{f.sherpa}</Label>
        <Select size="sm" aria-label={f.sherpa} isDisabled={!editable} selectedKey={area.sherpaType} onSelectionChange={(k) => onPatch({ sherpaType: String(k) })} items={ROBOT_TYPES.map((t) => ({ id: t.label, label: t.label }))}>{(item) => <Select.Item {...item} />}</Select></div>
      <NumberInput {...help('staging.rotation')} label={f.rotation} value={area.rotation} disabled={!editable} onCommit={(rotation) => onPatch({ rotation })} />
      <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-sm font-semibold text-primary">{f.position}<Hint k="staging.position" /></legend>
        <div className="grid grid-cols-2 gap-3"><NumberInput {...help('station.x')} label={f.x} value={area.x} disabled={!editable} onCommit={(x) => onPatch({ x })} /><NumberInput {...help('station.y')} label={f.y} value={area.y} disabled={!editable} onCommit={(y) => onPatch({ y })} /></div></fieldset>
      <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-sm font-semibold text-primary">{f.dimensions}</legend>
        <div className="grid grid-cols-2 gap-3"><NumberInput {...help('staging.rows')} label={f.rows} integer value={area.rows} disabled={!editable} error={problems.rows} onCommit={(rows) => onPatch({ rows })} /><NumberInput {...help('staging.cols')} label={f.cols} integer value={area.cols} disabled={!editable} error={problems.cols} onCommit={(cols) => onPatch({ cols })} /></div></fieldset>
      <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-sm font-semibold text-primary">{f.cellProps}</legend>
        <div className="grid grid-cols-2 gap-3"><NumberInput {...help('staging.cellLength')} label={f.cellLength} value={area.cellLength} disabled={!editable} error={problems.cellLength} onCommit={(cellLength) => onPatch({ cellLength })} /><NumberInput {...help('staging.cellWidth')} label={f.cellWidth} value={area.cellWidth} disabled={!editable} error={problems.cellWidth} onCommit={(cellWidth) => onPatch({ cellWidth })} /></div></fieldset>
      <p className="text-xs text-tertiary">{f.master}</p>
      <div className="mt-auto flex flex-col gap-2"><LocateButton onPress={onLocate} />{!editable ? <p className="text-xs text-tertiary">{copy.stations.readOnly}</p> : <Button size="md" color="secondary-destructive" iconLeading={Trash01} onPress={onDelete}>{f.delete}</Button>}</div>
    </div>
  );
}
