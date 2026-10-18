import type { FC, ReactNode } from 'react';

/** `icon` is either an image url (the Figma icons) or an Untitled UI icon component. */
export interface NavItem {
  id: string;
  label: string;
  icon: string | FC<{ className?: string }>;
  active?: boolean;
  badge?: number;
  onSelect?: () => void;
}
export interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
  extra?: ReactNode;
}
export interface NavModel {
  groups: NavGroup[];
  footerItems: NavItem[];
}
