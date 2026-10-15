import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu02, SearchLg } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Input } from '@/components/base/input/input';
import { useHistoryNav } from './useHistoryNav';
import { Brain, HeadsetHelp } from '@/ui/icons/figma-icons';
import { notify } from '@/ui/toast';
import type { SearchHit } from './types';
import { copy } from './copy';

interface Props {
  onMenu: () => void;
  searchPlaceholder: string;
  getHits: (q: string) => SearchHit[];
  onAi?: () => void;
  onSupport?: () => void;
}
/** Generic top app bar (Figma node 837:5352). Pages provide search behaviour and the left-hand buttons. */
export function Topbar({ onMenu, searchPlaceholder, getHits, onAi, onSupport }: Props) {
  const navigate = useNavigate();
  const h = useHistoryNav();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = q.trim() ? getHits(q.trim()) : [];
  return (
    <header className="topbar">
      <ButtonUtility className="menu-btn" icon={Menu02} tooltip={copy.menuOpen} onPress={onMenu} />
      <ButtonUtility
        icon={ChevronLeft}
        tooltip={copy.back}
        aria-label={copy.back}
        isDisabled={!h.canBack}
        onPress={h.back}
      />
      <ButtonUtility
        icon={ChevronRight}
        tooltip={copy.forward}
        aria-label={copy.forward}
        isDisabled={!h.canForward}
        onPress={h.forward}
      />
      <div className="search">
        <Input
          size="sm"
          icon={SearchLg}
          placeholder={searchPlaceholder}
          aria-label={copy.search}
          value={q}
          onChange={(v) => {
            setQ(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && hits.length > 0 && (
          <div className="results">
            {hits.map((h, i) => (
              <button
                key={i}
                onMouseDown={() => {
                  h.go?.();
                  if (h.to) navigate(h.to, { state: h.state });
                  setQ('');
                }}
              >
                <b>{h.title}</b>
                <small>
                  {h.kind}
                  {h.sub ? ` · ${h.sub}` : ''}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="tb-spacer" />
      <Button
        aria-label={copy.support}
        size="sm"
        color="secondary"
        iconLeading={HeadsetHelp}
        onPress={onSupport ?? (() => notify.info(copy.supportTitle, copy.supportToast, 'support'))}
      >
        <span className="tb-text">{copy.support}</span>
      </Button>
      <Button
        aria-label={copy.ai}
        size="sm"
        color="primary"
        iconLeading={Brain}
        onPress={onAi ?? (() => notify.info(copy.aiToast, undefined, 'ati-ai'))}
      >
        <span className="tb-text">{copy.ai}</span>
      </Button>
    </header>
  );
}
