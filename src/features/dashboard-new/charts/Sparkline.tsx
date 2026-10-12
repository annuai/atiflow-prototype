/** A tiny trend line with a soft fill. Fewer than two values draw a flat dashed line (nothing to trend yet). */
export function Sparkline({ values, color = '#14b8a6', width = 96, height = 28, className }: { values: number[]; color?: string; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden><line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="#d4d4d4" strokeDasharray="3 3" /></svg>;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1; const pad = 3;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - pad - ((v - lo) / span) * (height - pad * 2)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return <svg width={width} height={height} className={className} aria-hidden><polygon points={`0,${height} ${line} ${width},${height}`} fill={color} fillOpacity={0.12} /><polyline points={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
