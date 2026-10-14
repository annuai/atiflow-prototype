import type { ReactNode } from 'react';
import { Label } from '@/components/base/input/label';

/** One setting of a settings form: its name and a short explanation on the left, the control on the right (stacked on phones). */
export function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-secondary py-5 last:border-b-0 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-8">
      <div><Label>{label}</Label>{hint && <p className="mt-0.5 text-sm text-tertiary">{hint}</p>}</div><div className="max-w-md">{children}</div>
    </div>
  );
}
