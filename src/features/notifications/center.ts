import type { AppNotification, NewNotification } from './types';

export const MAX_NOTIFICATIONS = 100;
/** One user's notifications: newest first, no duplicates, read state, capped. Pure (no React, no storage), so it is easy to test and to back with a server later. */
export class NotificationCenter {
  constructor(public items: AppNotification[] = []) {}
  /** Adds the ones not seen before; returns how many were new. */
  add(list: NewNotification[]): number {
    const have = new Set(this.items.map((n) => n.id));
    const fresh = list.filter((n) => !have.has(n.id)).map((n) => ({ ...n, read: false }));
    if (!fresh.length) return 0;
    this.items = [...fresh, ...this.items].sort((a, b) => b.at - a.at).slice(0, MAX_NOTIFICATIONS);
    return fresh.length;
  }
  markRead(id: string) {
    this.items = this.items.map((n) => (n.id === id ? { ...n, read: true } : n));
  }
  markAllRead() {
    this.items = this.items.map((n) => (n.read ? n : { ...n, read: true }));
  }
  clear() {
    this.items = [];
  }
  get unread() {
    return this.items.filter((n) => !n.read).length;
  }
}
