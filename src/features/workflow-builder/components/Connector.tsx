import { ArrowIcon } from '../assets/nodeIcons';

/** The arrow between two nodes. It is also the drop target for add/reorder (nearest gap lights up via data-drop). */
export function Connector({
  listKey,
  gap,
  variant = '',
}: {
  listKey: string;
  gap: number;
  variant?: '' | 'ghost' | 'bare';
}) {
  return (
    <div className={`wf-conn ${variant}`} data-gap-list={listKey} data-gap-index={gap}>
      {variant ? null : <ArrowIcon />}
    </div>
  );
}
