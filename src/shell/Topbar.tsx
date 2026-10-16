import { ChevronLeft, ChevronRight, Menu02 } from '@untitledui/icons';
import { SearchPalette } from '@/features/search';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { useHistoryNav } from './useHistoryNav';
import { Brain, HeadsetHelp } from '@/ui/icons/figma-icons';
import { notify } from '@/ui/toast';
import { copy } from './copy';

interface Props {
  onMenu: () => void;
  searchPlaceholder: string;
  onAi?: () => void;
  onSupport?: () => void;
  /** replies from support the person has not read yet */
  supportUnread?: number;
}
/** Generic top app bar (Figma node 837:5352). Pages provide search behaviour and the left-hand buttons. */
export function Topbar({ onMenu, searchPlaceholder, onAi, onSupport, supportUnread = 0 }: Props) {
  const h = useHistoryNav();
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
      <SearchPalette placeholder={searchPlaceholder} />
      <div className="tb-spacer" />
      <span className="tb-support">
        <Button aria-label={copy.support} size="sm" color="secondary" iconLeading={HeadsetHelp} onPress={onSupport}>
          <span className="tb-text">{copy.support}</span>
        </Button>
        {supportUnread > 0 && (
          <span className="tb-badge" role="status" aria-label={String(supportUnread)}>
            <span>{supportUnread}</span>
          </span>
        )}
      </span>
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
