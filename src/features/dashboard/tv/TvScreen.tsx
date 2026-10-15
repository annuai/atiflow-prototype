import { useEffect, useRef, useState } from 'react';
import { XClose } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { LiveStatusCard } from '../components/LiveStatusCard';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { DashboardSnapshot } from '../data/types';
import { FleetStatesCard } from '../components/FleetStatesCard';
import { KpiRow } from '../components/KpiRow';
import { NeedsAttentionCard } from '../components/NeedsAttentionCard';
import { StatusStrip } from '../components/StatusStrip';
import { TripsCard } from '../components/TripsCard';
import { getLocale } from '@/i18n';

const DESIGN_W = 1600; // the TV layout is drawn at 1600 px wide and scaled to the screen, so it looks the same on any display
const noop = () => {};

/**
 * Wall-display mode: no controls, big type, everything that matters on one screen. It is a full-screen layer over the page (and asks the browser for real full screen);
 * Esc or the corner button leaves. The mouse pointer and the button fade after a few seconds without movement.
 */
/** Dates and times in the language in use, with Western digits (English keeps the 24-hour British form). */
const dateLocale = () => {
  const l = getLocale();
  return l === 'en' ? 'en-GB' : `${l}-IN-u-nu-latn`;
};

export function TvScreen({ snap, siteName, onExit }: { snap: DashboardSnapshot; siteName: string; onExit(): void }) {
  const [scale, setScale] = useState(() => window.innerWidth / DESIGN_W);
  const [height, setHeight] = useState(() => window.innerHeight / (window.innerWidth / DESIGN_W));
  const [quiet, setQuiet] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const quietTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const fit = () => {
      const s = window.innerWidth / DESIGN_W;
      setScale(s);
      setHeight(window.innerHeight / s);
    };
    const wake = () => {
      setQuiet(false);
      window.clearTimeout(quietTimer.current);
      quietTimer.current = window.setTimeout(() => setQuiet(true), 3000);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    const fs = () => {
      if (!document.fullscreenElement) onExit();
    }; // Esc inside real full screen only leaves full screen: leave TV mode with it
    const tick = window.setInterval(() => setClock(new Date()), 1000);
    window.addEventListener('resize', fit);
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    wake();
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fs);
      window.clearInterval(tick);
      window.clearTimeout(quietTimer.current);
    };
  }, [onExit]);
  return (
    <div
      className={cx('fixed inset-0 z-[100] overflow-hidden bg-secondary', quiet && 'cursor-none')}
      role="dialog"
      aria-label="TV mode"
    >
      <div style={{ width: DESIGN_W, height, zoom: scale }} className="flex flex-col gap-4 p-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">{siteName}</h1>
            <p className="text-lg text-tertiary">
              {clock.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-lg text-secondary">
              <i className="size-3 animate-pulse rounded-full bg-success-solid" />
              {copy.live}
            </span>
            <span className="text-5xl font-semibold tabular-nums text-primary">
              {clock.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>
        <StatusStrip status={snap.status} tv />
        <KpiRow kpis={snap.kpis} tv />
        <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr_1.1fr] gap-4">
          <NeedsAttentionCard items={snap.attention} tv limit={5} />
          <div className="flex min-h-0 flex-col gap-4">
            <FleetStatesCard fleets={snap.fleets} tv />
            <div className="min-h-0 flex-1">
              <TripsCard running={snap.trips.running} recent={snap.trips.recent} tv limit={4} />
            </div>
          </div>
          <LiveStatusCard site={snap.site} robots={snap.robots} onLocate={noop} onOpen={noop} readOnly />
        </div>
      </div>
      <div
        className={cx(
          'absolute right-4 bottom-4 flex items-center gap-2 rounded-lg bg-primary/90 px-3 py-1.5 text-sm text-tertiary shadow-sm transition-opacity',
          quiet && 'opacity-0',
        )}
      >
        {copy.tvHint}
        <ButtonUtility size="sm" color="tertiary" icon={XClose} aria-label={copy.exitTv} onPress={onExit} />
      </div>
    </div>
  );
}
