import { useMemo, useState } from 'react';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { DataTable, type Column } from '@/components/data/DataTable';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { useSearchText } from '@/hooks/use-search-text';
import { Badge } from '@/components/base/badges/badges';
import { formatNumber } from '@/i18n/format';
import { copy } from '../copy';
import { heightFor, KIND_HEIGHT } from '../core/classify';
import { layerRule } from '../core/build';
import type { DrawingKind, Rule, RowStats, Rules, Summary } from '../core/types';
import { UNITS } from '../core/units';

const LAYER_KINDS: DrawingKind[] = ['wall', 'partition', 'machine', 'pillar', 'area', 'ignore'];
const BLOCK_KINDS: DrawingKind[] = ['wall', 'partition', 'machine', 'pillar', 'door', 'area', 'explode', 'ignore'];
const HAS_HEIGHT = new Set<DrawingKind>(['wall', 'partition', 'machine', 'pillar', 'door']);

interface Row extends RowStats {
  kind: 'layer' | 'block';
  rule: Rule;
  why: string;
}

/** The review table: every layer and block of the drawing with what the importer thinks it is, and a choice to change it. */
export function ReviewStep({
  summary,
  layers,
  rules,
  unit,
  onUnit,
  onRule,
  edited,
}: {
  summary: Summary;
  /** layer rows now (they follow the blocks that are opened) */
  layers: RowStats[];
  rules: Rules;
  unit: number;
  onUnit(factor: number): void;
  onRule(kind: 'layer' | 'block', name: string, rule: Rule): void;
  /** what the person changed (shown as "Your choice") */
  edited: Set<string>;
}) {
  const t = copy.review;
  const [tab, setTab] = useState<'layers' | 'blocks'>('layers');
  const search = useSearchText();
  const ratio = unit / summary.guessedUnit; // sizes were measured at the first unit; another unit scales them
  const unitId = UNITS.find((u) => Math.abs(u.factor - unit) < 1e-9)?.id ?? 'm';
  const fromFile = summary.format === 'ai' || (summary.unitCode !== null && summary.unitCode !== 0);

  const rows = useMemo<Row[]>(() => {
    const src = tab === 'layers' ? layers : summary.blocks;
    return src
      .filter((r) => search.matches(r.name))
      .map((r) => {
        const key = `${tab === 'layers' ? 'layer' : 'block'}:${r.name}`;
        const rule =
          tab === 'layers' ? layerRule(rules, r.name) : (rules.blocks[r.name] ?? { kind: 'ignore' as const });
        return {
          ...r,
          kind: tab === 'layers' ? 'layer' : 'block',
          rule,
          why: edited.has(key) ? 'edited' : (summary.reasons[key] ?? 'unknown'),
        } as Row;
      });
  }, [tab, layers, summary, rules, search, edited]);

  const kinds = tab === 'layers' ? LAYER_KINDS : BLOCK_KINDS;
  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: t.columns.name,
      sort: (r) => r.name,
      cell: (r) => (
        <span translate="no" className="block max-w-[260px] truncate font-medium text-primary" title={r.name}>
          {r.name}
        </span>
      ),
    },
    {
      id: 'count',
      header: t.columns.count,
      sort: (r) => r.count,
      cell: (r) => formatNumber(r.count),
      className: 'whitespace-nowrap',
    },
    {
      id: 'size',
      header: t.columns.size,
      className: 'whitespace-nowrap',
      sort: (r) => (r.kind === 'layer' ? (r.length ?? 0) : (r.size?.w ?? 0) * (r.size?.d ?? 0)),
      cell: (r) =>
        r.kind === 'layer'
          ? t.layerSize(Math.round((r.length ?? 0) * ratio), r.closed ?? 0)
          : t.blockSize(((r.size?.w ?? 0) * ratio).toFixed(2), ((r.size?.d ?? 0) * ratio).toFixed(2)),
    },
    {
      id: 'becomes',
      header: t.columns.becomes,
      cell: (r) => (
        <div className="w-44">
          <Select
            size="sm"
            aria-label={`${t.columns.becomes}: ${r.name}`}
            selectedKey={r.rule.kind}
            onSelectionChange={(k) => onRule(r.kind, r.name, { ...r.rule, kind: String(k) as DrawingKind })}
            items={kinds.map((k) => ({ id: k, label: t.kinds[k] }))}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        </div>
      ),
    },
    {
      id: 'height',
      header: t.columns.height,
      cell: (r) =>
        HAS_HEIGHT.has(r.rule.kind) ? (
          <HeightBox
            value={r.rule.height}
            fallback={r.rule.kind === 'machine' ? heightFor('machine', r.name) : KIND_HEIGHT[r.rule.kind]}
            label={`${t.columns.height}: ${r.name}`}
            onCommit={(h) => onRule(r.kind, r.name, { ...r.rule, height: h })}
          />
        ) : null,
    },
    {
      id: 'why',
      header: t.columns.why,
      cell: (r) => (
        <Badge size="sm" color={r.why === 'unknown' ? 'warning' : r.why === 'edited' ? 'brand' : 'gray'}>
          {(t.why as Record<string, string>)[r.why] ?? r.why}
        </Badge>
      ),
    },
  ];

  const skipped = Object.values(summary.skipped).reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-3 pt-2">
      <p className="text-sm text-tertiary">{t.hint}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            size="sm"
            label={t.unit}
            selectedKey={unitId}
            onSelectionChange={(k) => onUnit(UNITS.find((u) => u.id === k)!.factor)}
            items={UNITS.map((u) => ({ id: u.id, label: t.units[u.id] }))}
            hint={fromFile ? t.unitFromFile(t.units[unitId]) : t.unitGuess(t.units[unitId])}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        </div>
        <SegmentedTabs<'layers' | 'blocks'>
          label={t.tabsLabel}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'layers', label: t.tabs.layers(layers.length) },
            { id: 'blocks', label: t.tabs.blocks(summary.blocks.length) },
          ]}
        />
        <div className="min-w-48 flex-1">
          <Input
            size="sm"
            aria-label={t.search}
            placeholder={`${t.search}…`}
            value={search.text}
            onChange={search.setText}
          />
        </div>
      </div>
      <div className="max-h-[42vh] min-h-48 overflow-auto rounded-lg border border-secondary">
        {rows.length ? (
          <DataTable
            label={t.columns.name}
            rows={rows}
            rowKey={(r) => `${r.kind}:${r.name}`}
            columns={columns}
            progressive={60}
            minWidth={780}
            plain
          />
        ) : (
          <p className="p-6 text-center text-sm text-tertiary">{t.none}</p>
        )}
      </div>
      {skipped > 0 && <p className="text-xs text-tertiary">{t.skipped(skipped)}</p>}
    </div>
  );
}

/** A small height box: empty = the kind's usual height (shown faintly), a number is kept for this layer or block. */
function HeightBox({
  value,
  fallback,
  label,
  onCommit,
}: {
  value: number | undefined;
  fallback: number;
  label: string;
  onCommit(h: number | undefined): void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const commit = () => {
    const n = parseFloat(text);
    onCommit(Number.isFinite(n) && n > 0 ? n : undefined);
    if (!(Number.isFinite(n) && n > 0)) setText('');
  };
  return (
    <div className="w-20">
      <Input
        size="sm"
        aria-label={label}
        inputMode="decimal"
        placeholder={String(fallback)}
        value={text}
        onChange={setText}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}
