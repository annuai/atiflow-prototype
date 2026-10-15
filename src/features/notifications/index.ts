/** Public entry of the notifications feature for other features: the unread count and the types a source needs. (The data source itself is chosen in `notificationApi.ts`, which the app root imports directly.) */
export { useUnreadCount } from './NotificationsProvider';
export type { NewNotification, NotificationSource } from './types';
