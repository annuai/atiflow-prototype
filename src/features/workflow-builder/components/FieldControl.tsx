import { useEffect, useState } from 'react';
import { Plus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { useFleetMaterialCodes } from '@/features/master-data/model/selectors';
import { selectFleet, useWorkflow, wfStore } from '../model/store';
import { stationLabel, useFleetStations } from '../model/stations';
import type { FieldSpec, WfNode } from '../model/types';

function FieldSelect({ value, opts, onChange, label, className, placeholder, names }: { value: string; opts: string[]; onChange: (v: string) => void; label: string; className?: string; placeholder?: string; names?: Record<string, string> }) {
  // a value that is no longer offered (e.g. a material removed from the fleet) stays visible so the workflow is not silently changed
  const options = !value || opts.includes(value) ? opts : [value, ...opts];
  return (
    <Select size="sm" aria-label={label} className={className} placeholder={placeholder} selectedKey={value || null} onSelectionChange={(k) => onChange(String(k))} items={options.map((o) => ({ id: o, label: names?.[o] ?? o }))}>
      {(item) => <Select.Item {...item} />}
    </Select>
  );
}

/** Quantity box: edits locally, commits digits-only on blur/Enter (one undo step per edit). Disabled when the quantity comes from the tablet. */
function QtyInput({ node, field }: { node: WfNode; field: string }) {
  const value = String(node.f[field] ?? ''); const [v, setV] = useState(value); useEffect(() => setV(value), [value]);
  const commit = () => { const d = v.replace(/[^\d]/g, '') || '0'; setV(d); wfStore.getState().setField(node.id, field, d); };
  return <Input size="sm" className="w-[72px]" aria-label="Quantity" value={v} isDisabled={!!node.f.fromTablet} onChange={setV} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} inputMode="numeric" />;
}

/** One field of a node card, rendered from the registry spec (so new node types need no new UI). */
export function FieldControl({ node, spec, inBranch }: { node: WfNode; spec: FieldSpec; inBranch: boolean }) {
  const fd = inBranch && spec.branch ? { ...spec, ...spec.branch } : spec;
  const label = typeof fd.label === 'function' ? fd.label(node) : fd.label; const value = node.f[fd.key]; const set = wfStore.getState().setField;
  const materialCodes = useFleetMaterialCodes(useWorkflow(selectFleet));
  const stations = useFleetStations(useWorkflow(selectFleet)); const names = Object.fromEntries(stations.map((s) => [s.id, stationLabel(s)]));
  const opts = fd.optsFrom === 'fleetMaterials' ? materialCodes : fd.optsFrom === 'fleetStations' ? stations.map((s) => s.id) : (fd.opts ?? []);
  const emptyHint = fd.optsFrom === 'fleetMaterials' && opts.length === 0 ? 'No materials assigned' : fd.optsFrom === 'fleetStations' && opts.length === 0 ? 'No stations on the map' : undefined;

  if (fd.kind === 'check') return (
    <div className="wf-field row"><span className="wf-label">{label}</span>
      <Checkbox size="sm" aria-label={label} isSelected={!!value} onChange={(v) => set(node.id, fd.key, v)} /></div>
  );
  if (fd.kind === 'input') return <div className="wf-field row"><span className="wf-label">{label}</span><QtyInput node={node} field={fd.key} /></div>;
  if (fd.kind === 'multi') {
    const vals = Array.isArray(value) ? value : [value as string];
    return (
      <div className="wf-field"><span className="wf-label">{label}</span>
        <div className="wf-multi">
          {vals.map((x, i) => <FieldSelect key={i} label={`${label} ${i + 1}`} names={names} value={x} opts={opts} onChange={(v) => set(node.id, fd.key, v, i)} className="min-w-[78px]" />)}
          <ButtonUtility size="sm" icon={Plus} tooltip={`Add another ${label}`} onPress={() => wfStore.getState().addMulti(node.id, fd.key, opts)} />
        </div>
      </div>
    );
  }
  const cur = Array.isArray(value) ? value[0] : (value as string);
  const control = <FieldSelect label={label} names={names} value={cur} opts={opts} placeholder={emptyHint ?? 'Select'} onChange={(v) => set(node.id, fd.key, v)} className={fd.row ? 'min-w-[84px]' : 'w-full'} />;
  return fd.row
    ? <div className="wf-field row"><span className="wf-label">{label}</span>{control}</div>
    : <div className="wf-field">{fd.kind === 'cond' ? <span className="wf-clabel">{label}</span> : <span className="wf-label">{label}</span>}{control}</div>;
}
