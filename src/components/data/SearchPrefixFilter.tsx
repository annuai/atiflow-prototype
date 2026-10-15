import { SearchLg } from '@untitledui/icons';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';

export interface SearchPrefixLabels {
  searchLabel: string;
  searchPlaceholder: string;
  prefixLabel: string;
  prefixAddon: string;
  prefixPlaceholder: string;
}
interface Props {
  labels: SearchPrefixLabels;
  text: string;
  onText(v: string): void;
  prefix: string;
  onPrefix(v: string): void;
}

/** "Search materials" box + "Starts with [prefix]" box used above every material picker. */
export function SearchPrefixFilter({ labels, text, onText, prefix, onPrefix }: Props) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>{labels.searchLabel}</Label>
        <Input
          aria-label={labels.searchLabel}
          icon={SearchLg}
          placeholder={labels.searchPlaceholder}
          value={text}
          onChange={onText}
        />
      </div>
      <div className="flex w-[177px] flex-col gap-1.5">
        <Label>{labels.prefixLabel}</Label>
        <div className="flex rounded-lg shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
          <span className="grid place-items-center border-r border-primary px-3 text-sm whitespace-nowrap text-tertiary">
            {labels.prefixAddon}
          </span>
          <div className="min-w-0 flex-1">
            <Input
              aria-label={labels.prefixLabel}
              placeholder={labels.prefixPlaceholder}
              value={prefix}
              onChange={onPrefix}
              wrapperClassName="shadow-none ring-0 focus-within:ring-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
