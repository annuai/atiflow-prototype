import { Settings01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';

/** Settings tab: shown in the design, content not defined yet. */
export function SettingsPanel(_: { fleet: string }) {
  return <EmptyState framed icon={Settings01} size="lg" title="Fleet settings are coming" subtext={copy.settings.soon} />;
}
