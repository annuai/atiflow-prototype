import { t } from '../text';

export const greeting = (hour: number) => (hour < 12 ? t.page.morning : hour < 17 ? t.page.afternoon : t.page.evening);
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
