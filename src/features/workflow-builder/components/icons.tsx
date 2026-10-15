import type { IconId } from '../model/types';
import {
  AntennaIcon,
  BadgeIcon,
  BoxIcon,
  ClockIcon,
  KeyframesIcon,
  Menu12Icon,
  PinIcon,
  PlayIcon,
  SquareIcon,
} from '../assets/nodeIcons';

const MAP = {
  play: PlayIcon,
  keyframes: KeyframesIcon,
  box: BoxIcon,
  clock: ClockIcon,
  pin: PinIcon,
  badge: BadgeIcon,
  square: SquareIcon,
  antenna: AntennaIcon,
};
export const NodeIcon = ({ id, size = 24 }: { id: IconId | 'antenna'; size?: number }) => {
  const I = MAP[id];
  return <I size={size} />;
};
export const MenuIcon_ = () => <Menu12Icon />;
