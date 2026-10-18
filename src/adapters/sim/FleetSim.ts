import type { LaneGraph } from '../../core/lanes';
import type {
  ChargeResult,
  FleetEvent,
  NavGraph,
  OrderUpdate,
  RelocalizeResult,
  RobotTelemetry,
  TransportOrder,
  Vec2,
} from '../../core/types';
import { Commands } from './commands';
import { Deadlocks } from './deadlocks';
import { Dispatch } from './dispatch';
import { Mover } from './mover';
import { Permits } from './permits';
import { snapshotOf } from './telemetry';
import { Traffic } from './traffic';
import type { Circle, RosterEntry, SimOptions } from './types';
import { World } from './world';

/**
 * Pure, deterministic fleet simulation (no timers). Obeys the same rules a real fleet does: fleet-confined lanes, directed lanes, one direction of travel (robots never reverse),
 * a permit for every traffic zone (one robot in, the others wait at the hold point until it is clear), no touching, no forbidden zones (lanes avoid them).
 * This class only assembles the parts (see `world.ts` for the shared state and the other files for each rule set) and runs the clock.
 */
export class FleetSim {
  private readonly w: World;
  private readonly mover: Mover;
  private readonly deadlocks: Deadlocks;
  private readonly commands: Commands;
  constructor(nav: NavGraph, siteId: string, count = 14, seed = 7, roster?: RosterEntry[], opts: SimOptions = {}) {
    this.w = new World(nav, siteId, count, seed, roster, opts);
    const traffic = new Traffic(this.w);
    const permits = new Permits(this.w, traffic);
    const dispatch = new Dispatch(this.w, permits);
    this.mover = new Mover(this.w, permits, traffic, dispatch);
    this.deadlocks = new Deadlocks(this.w, dispatch);
    this.commands = new Commands(this.w);
  }
  get graph(): LaneGraph {
    return this.w.graph;
  }
  get bots() {
    return this.w.bots;
  }
  get time() {
    return this.w.time;
  }
  get zones() {
    return this.w.zones;
  }
  get tripSeq() {
    return this.w.tripSeq;
  }
  /** Orders waiting for a robot (oldest first). */
  get orders(): TransportOrder[] {
    return this.w.orders;
  }
  get deadlocksFound() {
    return this.w.deadlocksFound;
  }
  /** Hand over (and forget) the events that happened since the last call. */
  drainEvents(): FleetEvent[] {
    return this.w.drainEvents();
  }
  drainOrderUpdates(): OrderUpdate[] {
    return this.commands.drainOrderUpdates();
  }
  step(dt: number) {
    const w = this.w;
    w.time += dt;
    const claims = new Map<string, Circle[]>();
    // Strict priority = oldest trip first. Each robot reserves its way top-down, so a lower-priority robot can never block a higher one for long and no cycle of waits can form.
    const order = [...w.bots].sort((p, q) => p.prio - q.prio || (p.id < q.id ? -1 : 1));
    for (const b of order) this.mover.stepBot(b, dt, claims);
    if (Math.floor(w.time) !== Math.floor(w.time - dt)) this.deadlocks.breakDeadlocks();
  }
  snapshot(): RobotTelemetry[] {
    return snapshotOf(this.w);
  }
  sendToCharger(id: string): ChargeResult {
    return this.commands.sendToCharger(id);
  }
  relocalize(id: string): RelocalizeResult {
    return this.commands.relocalize(id);
  }
  /** Test and demo aid: make a robot report a position `by` metres away from where it is. */
  displace(id: string, by: Vec2): boolean {
    return this.commands.displace(id, by);
  }
  /** Test and demo aid: someone picks the robot up and puts it `by` metres away. */
  moveByHand(id: string, by: Vec2): boolean {
    return this.commands.moveByHand(id, by);
  }
  /** Accept an order: false (and a `failed` update) when the fleet has no robot here or a station is not on the map. */
  submitOrder(o: TransportOrder): boolean {
    return this.commands.submitOrder(o);
  }
  /** Take the order back while no robot is on its way with it. */
  cancelOrder(id: string): boolean {
    return this.commands.cancelOrder(id);
  }
}
