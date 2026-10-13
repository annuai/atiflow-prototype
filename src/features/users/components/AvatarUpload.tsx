import { useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';
import { AVATAR_TYPES, avatarFromFile, validAvatarFile } from '../model/image';
import { UserAvatar } from './UserAvatar';

/** Choose (or remove) a profile picture: a preview that falls back to the initials, Upload / Change, Remove, and a hint. Reports a small square data URL. */
export function AvatarUpload({ value, name, onChange }: { value?: string; name: string; onChange(dataUrl: string | undefined): void }) {
  const [error, setError] = useState('');
  const pick = async (files: FileList | null) => {
    const f = files?.[0]; if (!f) return; if (!validAvatarFile(f)) { setError(copy.add_.photoBad); return; }
    try { onChange(await avatarFromFile(f)); setError(''); } catch { setError(copy.add_.photoBad); }
  };
  return (
    <div className="flex items-center gap-4" role="group" aria-label={copy.add_.photo}>
      <UserAvatar user={{ name, username: name, avatar: value }} size="xl" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <FileTrigger acceptedFileTypes={AVATAR_TYPES} onSelect={(files) => void pick(files as FileList | null)}><Button size="sm" color="secondary">{value ? copy.add_.replace : copy.add_.upload}</Button></FileTrigger>
          {value && <Button size="sm" color="tertiary" onPress={() => { onChange(undefined); setError(''); }}>{copy.add_.remove}</Button>}
        </div>
        <p className={error ? 'text-xs text-error-primary' : 'text-xs text-tertiary'}>{error || copy.add_.photoHint}</p>
      </div>
    </div>
  );
}
