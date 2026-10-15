import type { ReactNode } from 'react';
import { useLocale } from './store';

/** Re-mounts what is inside when the language changes, so every screen reads its text again. */
export function LocaleBoundary({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <div key={locale} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
