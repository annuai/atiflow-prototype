import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipContent } from '@/components/application/charts/charts-base';
import { withUnit, type MetricDef } from '../model/metrics';
import type { SeriesPoint } from '../model/types';

const COLOR = '#14b8a6';
/** A fleet figure over time (one point per hour for a day, per day for longer periods), with an optional target line (e.g. 85% availability). */
export function TrendChart({ metric, points, daily, target, height = 224 }: { metric: MetricDef; points: SeriesPoint[]; daily: boolean; target?: number; height?: number }) {
  const data = points.map((p) => ({ t: p.t, value: p.value })); const id = `trend-${metric.id}`;
  const label = (t: number) => (daily ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
  return (
    <div role="img" aria-label={`${metric.chartTitle}: ${points.map((p) => `${label(p.t)} ${withUnit(metric, p.value)}`).join(', ')}`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLOR} stopOpacity={0.28} /><stop offset="100%" stopColor={COLOR} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e5e5e5" strokeDasharray="3 4" />
          <XAxis dataKey="t" tickFormatter={label} tickLine={false} axisLine={false} minTickGap={28} tick={{ fontSize: 11, fill: '#737373' }} />
          <YAxis width={metric.unit === '%' ? 40 : 36} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#737373' }} domain={metric.unit === '%' ? [0, 100] : [0, 'auto']} tickFormatter={(v: number) => (metric.unit === '%' ? `${v}%` : String(v))} />
          <Tooltip cursor={{ stroke: '#a3a3a3' }} content={<ChartTooltipContent formatter={(v) => withUnit(metric, Number(v))} labelFormatter={(l) => (typeof l === 'number' ? label(l) : String(l))} />} />
          {target !== undefined && <ReferenceLine y={target} stroke="#737373" strokeDasharray="4 3" label={{ value: `target ${target}%`, position: 'insideTopRight', fontSize: 11, fill: '#737373' }} />}
          <Area type="monotone" dataKey="value" name={metric.label} stroke={COLOR} strokeWidth={2} fill={`url(#${id})`} connectNulls isAnimationActive={false} dot={points.length < 16 ? { r: 3, fill: COLOR, strokeWidth: 0 } : false} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
