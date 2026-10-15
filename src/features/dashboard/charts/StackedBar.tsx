export interface Segment {
  key: string;
  label: string;
  color: string;
  value: number;
}

/** One horizontal bar split into parts (e.g. a fleet by robot state). Each part is a button when `onSelect` is given. */
export function StackedBar({
  segments,
  height = 14,
  onSelect,
  label,
}: {
  segments: Segment[];
  height?: number;
  onSelect?: (key: string) => void;
  label: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total)
    return (
      <div className="rounded-full bg-secondary" style={{ height }} role="img" aria-label={`${label}: no robots`} />
    );
  return (
    <div
      className="flex w-full gap-px overflow-hidden rounded-full bg-secondary"
      style={{ height }}
      role={onSelect ? 'group' : 'img'}
      aria-label={`${label}: ${segments
        .filter((s) => s.value)
        .map((s) => `${s.value} ${s.label}`)
        .join(', ')}`}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const style = { width: `${(s.value / total) * 100}%`, background: s.color };
          const title = `${s.value} ${s.label}`;
          return onSelect ? (
            <button
              key={s.key}
              type="button"
              title={title}
              aria-label={title}
              style={style}
              className="min-w-1 transition-[width] duration-500 hover:brightness-110"
              onClick={() => onSelect(s.key)}
            />
          ) : (
            <span key={s.key} title={title} style={style} className="min-w-1 transition-[width] duration-500" />
          );
        })}
    </div>
  );
}
