/**
 * A tiny trend line with a soft fill that fills whatever box it is put in (it never sets its own width, so it cannot overflow a card): give the parent a size.
 * The line keeps a constant thickness however the box is stretched. Nothing to draw with fewer than two points.
 */
export function Spark({ values, color = '#14b8a6' }: { values: number[]; color?: string }) {
  const W = 100, H = 30, pad = 3;
  if (values.length < 2) return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" aria-hidden><line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#d4d4d4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /></svg>;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(2)},${(H - pad - ((v - lo) / span) * (H - pad * 2)).toFixed(2)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" aria-hidden><polygon points={`0,${H} ${pts} ${W},${H}`} fill={color} fillOpacity={0.12} /><polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>;
}
