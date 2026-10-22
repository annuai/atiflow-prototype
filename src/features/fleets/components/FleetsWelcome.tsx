import { useNavigate } from 'react-router-dom';
import { Cube01, HelpCircle, Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';

/** The Fleets page of a site with nothing on it yet (Figma 70:12701): a welcome, the first thing to do and a walkthrough link, centred in the card. */
export function FleetsWelcome() {
  const navigate = useNavigate();
  const t = copy.welcome;
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
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
    </div>
  );
}
