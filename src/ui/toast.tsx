import { toast, Toaster } from 'sonner';
import { AlertCircle, CheckCircle, InfoCircle, XClose } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { copy } from './copy';

/**
 * App toasts. Untitled UI's own `Notifications`/`toaster` component is PRO-only (needs `npx untitledui login`), so this renders the
 * same layout (featured icon + title + supporting text + close) from FREE Untitled UI parts on top of Sonner, which is the engine the
 * PRO component also uses. To switch to the real component later: add it, then render `IconNotification` inside `show()` below.
 */
type Tone = 'warning' | 'success' | 'info' | 'error';
const ICON = { warning: AlertCircle, error: AlertCircle, success: CheckCircle, info: InfoCircle };
const COLOR = { warning: 'warning', error: 'error', success: 'success', info: 'brand' } as const;

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      expand={false}
      visibleToasts={4}
      gap={12}
      offset={{ bottom: 24, right: 24 }}
      mobileOffset={{ bottom: 16, left: 12, right: 12 }}
    />
  );
}

function Notice({
  title,
  description,
  tone,
  onClose,
}: {
  title: string;
  description?: string;
  tone: Tone;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex w-[min(400px,calc(100vw-24px))] items-start gap-3 rounded-xl bg-primary p-4 shadow-lg ring-1 ring-secondary_alt"
    >
      <FeaturedIcon theme="light" color={COLOR[tone]} size="md" icon={ICON[tone]} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-secondary">{title}</p>
        {description && <p className="mt-0.5 text-sm text-tertiary">{description}</p>}
      </div>
      <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip={copy.toast.dismiss} onPress={onClose} />
    </div>
  );
}

function show(tone: Tone, title: string, description?: string, id?: string) {
  return toast.custom(
    (t) => <Notice tone={tone} title={title} description={description} onClose={() => toast.dismiss(t)} />,
    { id, duration: 4000 },
  );
}

/** `id` makes repeated calls reuse one toast instead of stacking. */
export const notify = {
  warning: (title: string, description?: string, id?: string) => show('warning', title, description, id),
  success: (title: string, description?: string, id?: string) => show('success', title, description, id),
  info: (title: string, description?: string, id?: string) => show('info', title, description, id),
  error: (title: string, description?: string, id?: string) => show('error', title, description, id),
};
