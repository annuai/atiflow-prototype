import { useRef, type ReactNode } from 'react';
import { XClose } from '@untitledui/icons';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import type { BadgeColors } from '@/components/base/badges/badge-types';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { BAR_CLASS, type BarTone } from './tones';
import { copy } from './copy';

export interface InfoStat {
  label: string;
  value: ReactNode;
  bar?: { pct: number; tone: BarTone };
}
export interface InfoAlert {
  text: string;
  severity: 'info' | 'warn' | 'critical';
}
export interface InfoPanelProps {
  title: string;
  subtitle?: ReactNode;
  pill?: { label: string; tone: BadgeColors };
  chips?: { label: string; color: string }[]; // `color` = fleet colour dot
  stats?: InfoStat[];
  alerts?: InfoAlert[];
  actions?: { label: string; onClick: () => void; disabled?: boolean }[];
  onClose: () => void;
  children?: ReactNode;
}

/** The one popup card used for robots AND stations (and anything selectable later). Built on Untitled UI Badge / Button / ProgressBar. */
/** Drag-down handle for the phone bottom-sheet layout (<=720 px): swipe down past 70 px to dismiss. */
function SheetHandle({ onClose }: { onClose: () => void }) {
  const y0 = useRef<number | null>(null);
  const panel = (e: React.PointerEvent) => e.currentTarget.parentElement as HTMLElement;
  return (
    <div
      className="sheet-handle"
      aria-hidden
      onPointerDown={(e) => {
        y0.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
        panel(e).style.transition = 'none';
      }}
      onPointerMove={(e) => {
        if (y0.current !== null) panel(e).style.transform = `translateY(${Math.max(0, e.clientY - y0.current)}px)`;
      }}
      onPointerUp={(e) => {
        const dy = y0.current === null ? 0 : e.clientY - y0.current;
        y0.current = null;
        const el = panel(e);
        el.style.transition = '';
        el.style.transform = '';
        if (dy > 70) onClose();
      }}
      onPointerCancel={(e) => {
        y0.current = null;
        const el = panel(e);
        el.style.transition = '';
        el.style.transform = '';
      }}
    >
      <i />
    </div>
  );
}

export function InfoPanel({ title, subtitle, pill, chips, stats, alerts, actions, onClose, children }: InfoPanelProps) {
  return (
    <div className="float rpanel">
      <SheetHandle onClose={onClose} />
      <h3>
        {title}
        <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip={copy.toast.close} onPress={onClose} />
      </h3>
      {subtitle && <div className="sub">{subtitle}</div>}
      <div className="pills">
        {pill && (
          <BadgeWithDot size="sm" color={pill.tone} className="capitalize">
            {pill.label}
          </BadgeWithDot>
        )}
        {chips?.map((c) => (
          <Badge key={c.label} size="sm" color="gray">
            <i className="dot" style={{ background: c.color, width: 6, height: 6, marginRight: 5 }} />
            {c.label}
          </Badge>
        ))}
      </div>
      {stats && (
        <div className="kv">
          {stats.map((s) => (
            <div key={s.label}>
              <small>{s.label}</small>
              <b>{s.value}</b>
              {s.bar && (
                <ProgressBar className="mt-1 h-1.5" progressClassName={BAR_CLASS[s.bar.tone]} value={s.bar.pct} />
              )}
            </div>
          ))}
        </div>
      )}
      {children}
      {alerts?.map((a, i) => (
        <div className={'alert ' + a.severity} key={i}>
          {a.severity === 'info' ? 'ℹ' : '⚠'} {a.text}
        </div>
      ))}
      {actions && (
        <div className="row">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              color="secondary"
              className="flex-1"
              isDisabled={a.disabled}
              onPress={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
