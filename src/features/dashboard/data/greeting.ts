export const greeting = (hour: number) =>
  hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
