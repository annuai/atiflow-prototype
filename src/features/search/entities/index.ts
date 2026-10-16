import { searchRegistry } from '../registry';
import {
  deviceEntity,
  fleetEntity,
  integrationEntity,
  mapEntity,
  materialEntity,
  metricEntity,
  userEntity,
  workflowEntity,
} from './config';
import { pageEntity } from './pages';
import { stationEntity, zoneEntity } from './places';
import { robotEntity } from './robots';
import { supportEntity } from './support';
import { tripEntity } from './trips';

let done = false;
/** Everything that can be searched. A new entity = its file + one line here. */
export function registerEntities() {
  if (done) return;
  done = true;
  [
    robotEntity,
    tripEntity,
    pageEntity,
    stationEntity,
    zoneEntity,
    workflowEntity,
    materialEntity,
    fleetEntity,
    deviceEntity,
    mapEntity,
    userEntity,
    integrationEntity,
    metricEntity,
    supportEntity,
  ].forEach((e) => searchRegistry.register(e as never));
}
