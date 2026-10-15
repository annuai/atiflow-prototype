import { useState } from 'react';

export interface Line {
  key: string;
  label: string;
  color: string;
  values: number[];
  fill?: boolean;
}
const W = 600,
  H = 170,
  L = 30,
  R = 8,
  T = 8,
  B = 22;

/** Lines over time with horizontal grid, a "minutes ago" axis and a hover read-out. `times` are epoch ms, one per value. */
export function AreaChart({
  lines,
  times,
  yMax = 100,
  unit = '',
  label,
}: {
  lines: Line[];
  times: number[];
  yMax?: number;
  unit?: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = times.length;
  if (n < 2)
    return (
      <div className="grid h-[170px] place-items-center rounded-lg bg-secondary text-sm text-tertiary">
        Collecting data…
      </div>
    );
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R),
    y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const last = times[n - 1];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));
  const span = (last - times[0]) / 60000;
  const axis = [0, 0.5, 1].map((f) => ({ f, text: f === 1 ? 'now' : `${Math.round(span * (1 - f))} min ago` }));
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e5e5e5" strokeDasharray={t ? '3 4' : undefined} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#a3a3a3">
              {t}
            </text>
          </g>
        ))}
        {axis.map((a) => (
          <text
            key={a.f}
            x={L + a.f * (W - L - R)}
            y={H - 5}
            textAnchor={a.f === 0 ? 'start' : a.f === 1 ? 'end' : 'middle'}
            fontSize={10}
            fill="#a3a3a3"
          >
            {a.text}
          </text>
        ))}
        {lines.map((l) => {
          const pts = l.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          return (
            <g key={l.key}>
              {l.fill && (
                <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill={l.color} fillOpacity={0.12} />
              )}
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#a3a3a3" />
            {lines.map((l) => (
              <circle
                key={l.key}
                cx={x(hover)}
                cy={y(l.values[hover])}
                r={3.5}
                fill={l.color}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-secondary bg-primary px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${Math.min(70, (x(hover) / W) * 100)}%` }}
        >
          <div className="mb-0.5 text-tertiary">{Math.max(0, Math.round((last - times[hover]) / 1000))} s ago</div>
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-1.5">
              <i className="size-2 rounded-full" style={{ background: l.color }} />
              <span className="text-secondary">{l.label}</span>
              <b className="ml-auto pl-3 text-primary">
                {l.values[hover]}
                {unit}
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
