import type { GoalHorizon } from '@/mind/types';

export const HORIZON_WORDS: Record<GoalHorizon, string> = {
  season: 'A season', year: 'About a year', years: 'A few years', lifetime: 'A lifetime',
};

export const monthYear = (at: number): string => new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const longDay = (d: Date | number): string => new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDay = (d: Date | number): string => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const monthOnly = (d: Date | number): string => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
