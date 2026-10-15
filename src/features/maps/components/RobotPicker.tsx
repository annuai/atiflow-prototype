import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useState } from 'react';
import { SearchLg, Cube01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { useDevices, KINDS, nameOf } from '@/features/devices';
import { cx } from '@/utils/cx';
import { copy } from '../copy';

/** Search the registered robots and pick one; the chosen robot is shown as a card (picture, name, connection state). */
export function RobotPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange(name: string): void;
  error?: string;
}) {
  const robots = useDevices((s) => s.robot);
  const [q, setQ] = useState('');
  const t = copy.generate;
  const chosen = robots.find((r) => nameOf(r) === value);
  const matches = robots.filter((r) => nameOf(r).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-1.5">
      <Label isRequired>{t.robot}</Label>
      {chosen ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-secondary p-3">
          <div className="shrink-0">{KINDS.robot.thumb(chosen)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-md font-semibold text-primary">{nameOf(chosen)}</p>
            <p className="flex items-center gap-1.5 text-xs text-secondary">
              <span
                className={cx(
                  'size-2 rounded-full',
                  chosen.status === 'online' ? 'bg-success-solid' : 'bg-error-solid',
                )}
              />
              {chosen.status === 'online' ? t.connected : t.disconnected}
            </p>
          </div>
          <Button size="sm" color="secondary" onPress={() => onChange('')}>
            {t.robotChange}
          </Button>
        </div>
      ) : (
        <>
          <Input
            aria-label={t.robotSearch}
            icon={SearchLg}
            placeholder={t.robotSearch}
            value={q}
            onChange={setQ}
            isInvalid={!!error}
          />
          {robots.length === 0 ? (
            <EmptyState icon={Cube01} title="No robots yet" subtext={t.noRobots} size="sm" />
          ) : (
            <ul className="max-h-40 overflow-auto rounded-xl border border-secondary" aria-label={t.robot}>
              {matches.length === 0 && (
                <li>
                  <NoResults size="sm" subtext={t.robotNone} />
                </li>
              )}
              {matches.map((r) => (
                <li key={nameOf(r)}>
                  <button
                    type="button"
                    onClick={() => onChange(nameOf(r))}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                  >
                    <span className="text-sm font-semibold text-primary">{nameOf(r)}</span>
                    <Badge size="sm" type="pill-color" color={r.status === 'online' ? 'success' : 'gray'}>
                      {r.status === 'online' ? t.connected : t.disconnected}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p className="text-sm text-error-primary" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
