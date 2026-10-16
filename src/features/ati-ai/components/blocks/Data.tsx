import type { Block, WorkflowDraft, WorkflowStep } from '../../types';
import { copy } from '../../copy';
import type { OnChip } from './Simple';

/** A small bar or line chart drawn as SVG (no chart library for a few points). */
export function ChartBlock({ block }: { block: Extract<Block, { type: 'chart' }> }) {
  const pts = block.points;
  const W = 320;
  const H = 120;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const step = W / Math.max(1, pts.length);
  const y = (v: number) => H - 6 - (v / max) * (H - 24);
  const line = pts
    .map((p, i) => `${i ? 'L' : 'M'}${(i * step + step / 2).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  return (
    <figure className="ai-card" aria-label={`${copy.blocks.chart}: ${block.title}`}>
      <figcaption className="ai-card-title">{block.title}</figcaption>
      {!pts.length ? (
        <p className="ai-muted">{copy.blocks.nothing}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="ai-chart" role="img" aria-label={block.title}>
          {block.kind === 'bar' ? (
            pts.map((p, i) => (
              <g key={i}>
                <rect
                  x={i * step + step * 0.18}
                  y={y(p.value)}
                  width={step * 0.64}
                  height={H - 6 - y(p.value)}
                  rx="3"
                  className="ai-bar"
                />
                <text x={i * step + step / 2} y={y(p.value) - 3} textAnchor="middle" className="ai-chart-v">
                  {p.value}
                </text>
              </g>
            ))
          ) : (
            <>
              <path d={line} className="ai-line" fill="none" />
              {pts.map((p, i) => (
                <circle key={i} cx={i * step + step / 2} cy={y(p.value)} r="2.5" className="ai-dot" />
              ))}
            </>
          )}
          {pts.map((p, i) =>
            pts.length > 10 && i % 2 ? null : (
              <text key={i} x={i * step + step / 2} y={H + 12} textAnchor="middle" className="ai-chart-l">
                {p.label}
              </text>
            ),
          )}
        </svg>
      )}
    </figure>
  );
}

export function TableBlock({ block }: { block: Extract<Block, { type: 'table' }> }) {
  return (
    <section className="ai-card ai-table-wrap" aria-label={block.title}>
      <h3 className="ai-card-title">{block.title}</h3>
      <table className="ai-table">
        <thead>
          <tr>
            {block.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function KpiTiles({ block }: { block: Extract<Block, { type: 'kpi_tiles' }> }) {
  return (
    <div className="ai-kpis">
      {block.tiles.map((t) => (
        <div key={t.label} className="ai-kpi">
          <span className="ai-kpi-l">{t.label}</span>
          <strong className="ai-kpi-v">{t.value}</strong>
          {t.delta && (
            <span className={t.good === undefined ? 'ai-muted' : t.good ? 'ai-good' : 'ai-bad'}>{t.delta}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const KIND: Record<WorkflowStep['kind'], string> = {
  trigger: 'ai-n-trigger',
  action: 'ai-n-action',
  wait: 'ai-n-wait',
  condition: 'ai-n-cond',
  error: 'ai-n-error',
};
/** The draft as a read-only chain of steps with arrows; what a change added is marked. */
export function WorkflowPreview({
  workflow,
  highlight = [],
  title,
}: {
  workflow: WorkflowDraft;
  highlight?: string[];
  title?: string;
}) {
  return (
    <section className="ai-card" aria-label={title ?? `${copy.blocks.preview}: ${workflow.name}`}>
      <h3 className="ai-card-title">{title ?? `${copy.blocks.preview}: ${workflow.name}`}</h3>
      <ol className="ai-flow">
        {workflow.steps.map((s, i) => (
          <li key={s.id} className="ai-flow-item">
            <div className={`ai-node ${KIND[s.kind]}${highlight.includes(s.id) ? ' ai-node-new' : ''}`}>
              <span className="ai-node-n">{i + 1}</span>
              <span>{s.text}</span>
              {highlight.includes(s.id) && <em className="ai-new">{copy.blocks.added}</em>}
            </div>
            {i < workflow.steps.length - 1 && <span className="ai-arrow" aria-hidden />}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ValidationList({
  block,
  onChip,
  disabled,
}: {
  block: Extract<Block, { type: 'validation_list' }>;
  onChip: OnChip;
  disabled?: boolean;
}) {
  return (
    <ul className="ai-card ai-valid">
      {block.items.map((v) => (
        <li key={v.id}>
          <span className={v.level === 'error' ? 'ai-bad' : 'ai-warn'} aria-hidden>
            ●
          </span>
          <span className="ai-valid-t">{v.text}</span>
          {v.fix && (
            <button
              type="button"
              className="ai-btn ai-btn-ghost"
              disabled={disabled}
              onClick={() => onChip({ id: 'wf:fix', label: v.fixLabel ?? copy.blocks.fix, payload: { fix: v.fix! } })}
            >
              {v.fixLabel ?? copy.blocks.fix}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
