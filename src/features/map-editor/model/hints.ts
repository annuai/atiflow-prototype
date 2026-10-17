import { copy } from '../copy';
import type { Tool } from '../canvas/tools';
import { zoneType } from './zoneTypes';

/** The one-line instruction shown over the map for the armed tool (empty for the select tool). `placed` is how many points of the shape have been clicked so far. */
export function hintFor(tool: Tool, placed: number): string {
  switch (tool.kind) {
    case 'station':
      return copy.hint.station;
    case 'staging':
      return copy.hint.staging;
    case 'place':
      return copy.hint.place;
    case 'gate':
      return tool.shape === 'box' ? copy.hint.gateBox : copy.hint.gateLine;
    case 'road':
      return placed ? copy.hint.roadMany(placed) : copy.hint.road;
    case 'zone':
      return placed ? copy.hint.roadMany(placed) : copy.hint.zone(zoneType(tool.type).label);
    default:
      return '';
  }
}
