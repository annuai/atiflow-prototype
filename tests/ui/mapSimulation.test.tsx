// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { seedMapData } from '../../src/features/map-editor/model/seed';
import type { MapData } from '../../src/features/map-editor/model/types';
import { useSimulationPanel } from '../../src/features/map-editor/sim/useSimulationPanel';
import type { NavGraph, SiteLayout } from '../../src/core/types';
import { installDomShims } from '../helpers/dom';

installDomShims();
afterEach(cleanup);

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;

/** A map no fleet runs yet, like one imported from the Deployment Manager: its roads and stations carry the empty fleet id. */
function importedLike(): MapData {
  const d = seedMapData({ fleetLive: 'line-side' }, site, nav);
  return {
    ...d,
    lanes: d.lanes.map((l) => ({ ...l, fleets: [''] })),
    stations: d.stations.map((s) => ({ ...s, fleets: [''] })),
  };
}

describe('Simulation in the Map Editor on a map that no fleet runs (an imported map)', () => {
  it('Simulate route drives the trip (it used to do nothing at all, because the map has no fleet id)', () => {
    const data = importedLike();
    const work = data.stations.filter((s) => s.type !== 'park' && s.type !== 'charge');
    const { result } = renderHook(() => useSimulationPanel(data, ''));
    act(() =>
      result.current.setChoice({ type: result.current.choice.type, start: work[0].id, end: work[work.length - 1].id }),
    );
    act(() => result.current.run());
    expect(result.current.error).toBe('');
    expect(result.current.trip.state.status).toBe('running');
    act(() => result.current.stop());
  });
  it('and says why when the stations are not connected by roads', () => {
    const data = importedLike();
    const [a, b] = [data.stations[0], data.stations[1]];
    const bare: MapData = { ...data, lanes: [], roads: [] };
    const { result } = renderHook(() => useSimulationPanel(bare, ''));
    act(() => result.current.setChoice({ type: result.current.choice.type, start: a.id, end: b.id }));
    act(() => result.current.run());
    expect(result.current.error).not.toBe('');
    expect(result.current.trip.state.status).toBe('idle');
  });
});
