import { Select } from '@/components/base/select/select';
import { LANGUAGES, isLocale, showLocale, useLocale, type LocaleId } from '@/i18n';
import { services } from '@/services';

/** Remember the language chosen on this device (the sign-in screen, before anyone is known) and switch to it. */
function chooseLanguage(id: LocaleId) {
  services().device.set('locale', id);
  void showLocale(id);
}

/**
 * THE language picker (languages come from `i18n/languages.ts`). Alone it changes the language of this device right away (sign-in screen);
 * with `value` + `onChange` it is a plain controlled field (Preferences, site Settings), optionally offering a "use the site default" choice.
 */
export function LanguageSelect({
  value,
  onChange,
  extra,
  size = 'md',
  ...rest
}: {
  value?: string;
  onChange?: (id: string) => void;
  /** Extra first choice, e.g. "Site default". */
  extra?: { id: string; label: string };
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  const current = useLocale();
  const controlled = onChange !== undefined;
  return (
    <Select
      size={size}
      aria-label={rest['aria-label']}
      selectedKey={controlled ? (value ?? current) : current}
      onSelectionChange={(k) => {
        const id = String(k);
        if (controlled) onChange(id);
        else if (isLocale(id)) chooseLanguage(id);
      }}
      items={[...(extra ? [extra] : []), ...LANGUAGES.map((l) => ({ id: l.id as string, label: l.label }))]}
    >
      {(item) => <Select.Item {...item} />}
    </Select>
  );
}
