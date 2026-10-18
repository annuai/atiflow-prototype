import { useState } from 'react';
import { Grid01 } from '@untitledui/icons';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { ModalFrame, DialogLayout } from '@/components/modal/ModalShell';
import { useNow } from '@/hooks/use-now';
import { lastUpdated } from '@/utils/timeAgo';
import { copy } from '../copy';
import { parseKey } from '../model/cells';
import { cellState } from '../model/cellStates';
import { masterDataStore } from '../model/store';
import type { CellEdit, CellError } from '../model/cells';
import type { CellSnapshot, Material, StagingArea, StagingCell } from '../model/types';

type Choice = 'available' | 'filled' | 'blocked';
const word = (s: CellSnapshot) =>
  s.materialCode
    ? `${cellState(s.state).label} · ${s.materialCode}${s.quantity ? ` × ${s.quantity}` : ''}`
    : cellState(s.state).label;

/** What a cell holds, in words (for someone who may only look). */
function holdsText(c: StagingCell | undefined, names: ReadonlyMap<string, string>): string {
  const t = copy.staging.cell;
  if (c?.state === 'blocked') return c.reason ?? '—';
  if (c?.materialCode) {
    const name = names.get(c.materialCode);
    return `${name ? `${c.materialCode} ${name}` : c.materialCode}${c.quantity ? `, ${t.pieces(c.quantity)}` : ''}`;
  }
  return c?.state === 'filled' ? t.notSet : '—';
}

/** The last changes to one cell, newest first. */
function Activity({ area, cellKey }: { area: StagingArea; cellKey: string }) {
  const t = copy.staging.cell;
  const now = useNow();
  const log = (area.log ?? []).filter((e) => e.key === cellKey).slice(0, 8);
  return (
    <section aria-label={t.activity} className="border-t border-secondary pt-3">
      <h3 className="text-sm font-semibold text-primary">{t.activity}</h3>
      {log.length ? (
        <ul className="mt-1 flex flex-col gap-1 text-xs text-tertiary">
          {log.map((e) => (
            <li key={`${e.at}-${e.key}`}>{t.logLine(e.by, lastUpdated(e.at, now), word(e.from), word(e.to))}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-tertiary">{t.noActivity}</p>
      )}
    </section>
  );
}

interface Fields {
  choice: Choice;
  code: string;
  qty: string;
  reason: string;
}
/** State (Available / Filled / Blocked), then the material and quantity of a filled cell or the reason of a blocked one. */
function EditFields({
  value,
  options,
  onChange,
}: {
  value: Fields;
  options: { id: string; label: string }[];
  onChange(patch: Partial<Fields>): void;
}) {
  const t = copy.staging.cell;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-secondary">{t.state}</span>
        <ButtonGroup
          size="md"
          aria-label={t.state}
          selectedKeys={[value.choice]}
          onSelectionChange={(k) => {
            const v = [...k][0];
            if (v) onChange({ choice: v as Choice });
          }}
        >
          {(['available', 'filled', 'blocked'] as const).map((s) => (
            <ButtonGroupItem key={s} id={s}>
              {cellState(s).label}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>
      </div>
      {value.choice === 'filled' &&
        (options.length === 0 ? (
          <p className="text-sm text-tertiary">{t.nothingAssigned}</p>
        ) : (
          <Select
            label={t.material}
            placeholder={t.materialPlaceholder}
            selectedKey={value.code || null}
            onSelectionChange={(k) => onChange({ code: String(k) })}
            items={options}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        ))}
      {value.choice === 'filled' && (
        <Input
          label={t.quantity}
          inputMode="numeric"
          value={value.qty}
          onChange={(v) => onChange({ qty: v.replace(/\D/g, '') })}
        />
      )}
      {value.choice === 'blocked' && (
        <Input
          label={t.reason}
          placeholder={t.reasonPlaceholder}
          value={value.reason}
          onChange={(reason) => onChange({ reason })}
        />
      )}
    </>
  );
}

/** What the form starts with: the cell's own contents; several cells together start as "filled". */
const initialFields = (c: StagingCell | undefined, many: boolean): Fields => ({
  choice: c?.state === 'filled' || c?.state === 'blocked' ? c.state : many ? 'filled' : 'available',
  code: c?.materialCode ?? '',
  qty: c?.quantity ? String(c.quantity) : '',
  reason: c?.reason ?? '',
});

/** The materials of the fleet; a material that is no longer one of them (but is in the cell) stays in the list, marked. */
function materialOptions(allowed: Material[], current: string) {
  const list = allowed.map((m) => ({ id: m.code, label: `${m.code} · ${m.name}` }));
  return current && !allowed.some((m) => m.code === current)
    ? [...list, { id: current, label: copy.staging.cell.unknown(current) }]
    : list;
}

const editOf = (f: Fields): CellEdit =>
  f.choice === 'filled'
    ? { state: 'filled', materialCode: f.code, quantity: f.qty.trim() === '' ? undefined : Number(f.qty) }
    : f.choice === 'blocked'
      ? { state: 'blocked', reason: f.reason }
      : { state: 'available' };

/**
 * The editor of one cell, or of several selected at once. Read-only when `manage` is off (anyone may look at what a cell holds). In Manage you choose Available (empty), Filled (a material and a
 * quantity) or Blocked (an optional reason); a reserved cell is held by a request and can only be released. Material choices are the materials of the area's fleet.
 */
export function CellEditor({
  area,
  keys,
  manage,
  by,
  allowed,
  names,
  onClose,
}: {
  area: StagingArea;
  keys: string[];
  manage: boolean;
  by: string;
  /** the materials the area's fleet may hold */
  allowed: Material[];
  names: ReadonlyMap<string, string>;
  onClose(): void;
}) {
  const t = copy.staging.cell;
  const one = keys.length === 1 ? area.cells[keys[0]] : undefined;
  const reserved = one?.state === 'reserved';
  const [fields, setFields] = useState<Fields>(() => initialFields(one, keys.length > 1));
  const [error, setError] = useState<CellError | null>(null);
  const [row, col] = parseKey(keys[0]);
  const title = keys.length === 1 ? t.title(row, col) : t.titleMany(keys.length);
  const options = materialOptions(allowed, fields.code);
  const save = () => {
    const r = masterDataStore.getState().editCells(area, keys, editOf(fields), by, new Set(allowed.map((m) => m.code)));
    if (r) return setError(r.error);
    onClose();
  };
  const release = () => {
    masterDataStore.getState().releaseCells(area, keys, by);
    onClose();
  };
  const editable = manage && !reserved;
  return (
    <ModalFrame isOpen onOpenChange={(o) => !o && onClose()} label={title}>
      <DialogLayout
        icon={Grid01}
        title={title}
        subtitle={keys.length === 1 ? `${area.name} · ${cellState(one?.state ?? 'available').label}` : t.subtitleMany}
        divided
        secondary={{ label: editable ? t.cancel : t.close, onPress: onClose }}
        primary={
          editable
            ? { label: t.save, onPress: save, isDisabled: fields.choice === 'filled' && !fields.code }
            : reserved && manage
              ? { label: t.release, destructive: true, onPress: release }
              : { label: t.close, onPress: onClose }
        }
      >
        <div className="flex flex-col gap-4 pt-4">
          {reserved && (
            <p className="rounded-lg bg-warning-secondary p-3 text-sm text-warning-primary">
              {holdsText(one, names)}. {t.reservedFor(one?.reservedFor ?? '')} {t.reservedHint}
            </p>
          )}
          {editable && (
            <EditFields
              value={fields}
              options={options}
              onChange={(p) => {
                setFields((f) => ({ ...f, ...p }));
                setError(null);
              }}
            />
          )}
          {!editable && !reserved && <p className="text-sm text-secondary">{holdsText(one, names)}</p>}
          {error && (
            <p role="alert" className="rounded-lg bg-error-secondary px-3 py-2 text-sm text-error-primary">
              {t.errors[error]}
            </p>
          )}
          {keys.length === 1 && <Activity area={area} cellKey={keys[0]} />}
        </div>
      </DialogLayout>
    </ModalFrame>
  );
}
