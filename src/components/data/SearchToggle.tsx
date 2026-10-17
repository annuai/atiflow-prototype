import { SearchLg } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';

/**
 * THE "search" button of a page's header: a secondary icon button that opens / closes the page's search box. It is a real `Button` (not the smaller `ButtonUtility`),
 * so at the same `size` it is exactly as tall as the primary button next to it (pass the size that button uses).
 */
export function SearchToggle({
  label,
  active,
  onToggle,
  size = 'sm',
}: {
  label: string;
  active?: boolean;
  onToggle(): void;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Button
      size={size}
      color="secondary"
      iconLeading={SearchLg}
      aria-label={label}
      aria-pressed={active}
      onPress={onToggle}
    />
  );
}
