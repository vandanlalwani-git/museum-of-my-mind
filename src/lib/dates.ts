const DAY = 86_400_000;

export const daysAgo = (from: number, now = Date.now()): number => Math.floor((now - from) / DAY);

export function relativeAge(from: number, now = Date.now()): string {
  const d = daysAgo(from, now);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`;
  const y = Math.floor(d / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

export function timeOfDayGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'The lamps are still lit';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
