/** A traffic light (the Traffic Gates tool). Not in the Untitled UI icon set, so it is drawn here in the same style: 24 px grid, 2 px round strokes, colour from the text. */
export function TrafficLight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={7} y={2} width={10} height={20} rx={3} />
      <circle cx={12} cy={7} r={1} />
      <circle cx={12} cy={12} r={1} />
      <circle cx={12} cy={17} r={1} />
    </svg>
  );
}
