import { Link, useNavigate } from 'react-router-dom';
import { Cube01, Dataflow03, HelpCircle, Map01, MarkerPin02, Plus, Truck01 } from '@untitledui/icons';
import type { FC } from 'react';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';

const CARDS: { id: 'robots' | 'fleet' | 'maps' | 'stations'; icon: FC<{ className?: string }>; to: string }[] = [
  { id: 'robots', icon: Truck01, to: '/configurator/robots?add=1' },
  { id: 'fleet', icon: Dataflow03, to: '/configurator/fleets?new=1' },
  { id: 'maps', icon: Map01, to: '/configurator/maps?new=generate' },
  { id: 'stations', icon: MarkerPin02, to: '/configurator/maps' },
];

/** The Fleets page of a site with nothing on it yet (Figma 70:12701): a welcome, the first thing to do, a walkthrough link and four quick starts. */
export function FleetsWelcome() {
  const navigate = useNavigate();
  const t = copy.welcome;
  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={Cube01}
        size="lg"
        title={t.title}
        subtext={t.body}
        action={
          <div className="flex flex-col items-center gap-3">
            <Button size="md" color="primary" iconLeading={Plus} onPress={() => navigate('/configurator/robots?add=1')}>
              {t.cta}
            </Button>
            <Button
              size="sm"
              color="link-gray"
              iconLeading={HelpCircle}
              onPress={() => navigate({ search: '?tour=configurator' })}
            >
              {t.walkthrough}
            </Button>
          </div>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <li key={c.id}>
            <Link
              to={c.to}
              className="flex h-full flex-col gap-2 rounded-xl bg-secondary p-4 ring-1 ring-secondary transition hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-primary text-fg-brand-primary">
                <c.icon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-primary">{t[c.id].title}</span>
              <span className="text-xs text-tertiary">{t[c.id].hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
