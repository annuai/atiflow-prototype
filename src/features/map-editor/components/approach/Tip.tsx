import { HelpCircle } from '@untitledui/icons';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';

/** A small (?) with a tooltip, for headings and rows that are not a form field. */
export function Tip({ text }: { text: string }) {
  return (
    <Tooltip title={text} placement="top">
      <TooltipTrigger
        isDisabled={false}
        aria-label={text}
        className="inline-flex cursor-pointer align-middle text-fg-quaternary hover:text-fg-quaternary_hover"
      >
        <HelpCircle className="size-4" />
      </TooltipTrigger>
    </Tooltip>
  );
}
