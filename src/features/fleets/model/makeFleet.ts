import { mapsStore } from '@/data/maps';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { canCreateFleet } from './logic';

/**
 * "Add fleet" starts here: with no map on the site there is nothing to give a fleet, so the dialog does not open. A warning toast says so and offers to create the first map
 * (which opens the Generate New Map dialog); `go` is how the caller navigates (this is not a component).
 */
export function requestMakeFleet(go: (path: string) => void, open: () => void): void {
  if (canCreateFleet(mapsStore.getState().maps.length)) return open();
  notify.warning(copy.noMap.title, copy.noMap.body, 'no-map', {
    label: copy.noMap.action,
    onPress: () => go('/configurator/maps?new=generate'),
  });
}
