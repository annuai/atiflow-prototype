import { Target02 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';

/** "Locate on Map": a secondary button at the bottom of a thing's settings. It centres and zooms the map on the thing and pulses it. */
export function LocateButton({ onPress }: { onPress(): void }) {
  return <Button size="md" color="secondary" iconLeading={Target02} onPress={onPress}>{copy.locate}</Button>;
}
