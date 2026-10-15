import { HelpCircle } from '@untitledui/icons';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { helpText } from '../help';

/** A small (?) that shows the tooltip of a help key (`help.ts`), for headings and tiles that are not a form field. Nothing when the key has no text. */
export function Hint({ k, className }: { k: string; className?: string }) {
  const t = helpText(k);
  if (!t) return null;
  return (
    <Tooltip title={t} placement="top">
      <TooltipTrigger
        isDisabled={false}
        aria-label={t}
        className={`ml-1 inline-flex cursor-pointer align-middle text-fg-quaternary hover:text-fg-quaternary_hover ${className ?? ''}`}
      >
        <HelpCircle className="size-4" />
      </TooltipTrigger>
    </Tooltip>
  );
}
