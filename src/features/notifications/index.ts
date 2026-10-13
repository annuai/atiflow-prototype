import { localApi } from './api';
import type { NotificationApi } from './types';

/**
 * THE place the notification data is chosen. Today it comes from this app's own sources (live robot alerts for supervisors, a mock MES feed for configurators).
 * To use a server, return `restApi({ baseUrl: '/api' })` instead (or any object that implements `NotificationApi`).
 */
export const notificationApi: NotificationApi = localApi();
