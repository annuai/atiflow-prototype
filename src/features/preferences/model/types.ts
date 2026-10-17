/** A user's own preferences (a supervisor's Settings): which alerts they want and when, where the app opens. (Time zone and units are NOT personal: they are set for the whole site.) They belong to the person, not to the site. */
export interface AlertPrefs {
  /** Notifications for these problems (the bell and the Notifications page). */
  blocked: boolean;
  fault: boolean;
  stuck: boolean;
  battery: boolean;
  /** Notify me when a robot has been waiting this long (seconds). */
  notifyAfterS: number;
  /** The Dashboard's "needs attention" list shows a waiting robot after this long, and calls it urgent after the second value (seconds). */
  waitWarnS: number;
  waitUrgentS: number;
  /** A battery below this percentage is low (notification and Dashboard). */
  batteryLow: number;
}
export interface Preferences {
  alerts: AlertPrefs;
  /** 'last' = the page I used last; otherwise the path of a page. */
  startPage: string;
  /** A lane-map fleet id; '' (or a fleet I can no longer see) = the first fleet on the floor. Applied when I open the Live Floor from its sidebar item. */
  defaultFleet: string;
  /** 'site' = the site's default language; otherwise a language id (see src/i18n/languages.ts). */
  language: string;
}
