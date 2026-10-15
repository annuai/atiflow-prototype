import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';
import type { MapVersion } from '../model/types';

/** The strip under the header: a published version is read-only (offer the draft), or the draft is older than the latest published version (offer to update it). */
export function VersionBanner({
  current,
  draft,
  latest,
  onOpenDraft,
  onStartDraft,
  onUpdate,
}: {
  current: MapVersion;
  draft: MapVersion | undefined;
  latest: MapVersion | undefined;
  onOpenDraft(): void;
  onStartDraft(): void;
  onUpdate(): void;
}) {
  const isDraft = current.status === 'draft';
  if (!isDraft)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary bg-warning-primary px-4 py-2.5 text-sm text-secondary">
        <span>{copy.banner.published(current.number!)}</span>
        {draft ? (
          <Button size="sm" color="secondary" onPress={onOpenDraft}>
            {copy.historyPanel.open}
          </Button>
        ) : (
          <Button size="sm" color="primary" onPress={onStartDraft}>
            {copy.banner.edit}
          </Button>
        )}
      </div>
    );
  if (latest && current.basedOn !== null && current.basedOn < (latest.number ?? 0))
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary bg-brand-primary px-4 py-2.5 text-sm text-secondary">
        <span>{copy.banner.draftOld(current.basedOn, latest.number!)}</span>
        <Button size="sm" color="secondary" onPress={onUpdate}>
          {copy.banner.update(latest.number!)}
        </Button>
      </div>
    );
  return null;
}
