import { addDays, dayKey, daysBetween, startOfWeek } from './calendar';
import type { Step } from './types';

/** Completions logged on the same local day as `day`. */
function doneOn(step: Step, day: Date): boolean {
  const key = dayKey(day);
  return step.log.some((c) => dayKey(c.at) === key);
}

function completionsInWeek(step: Step, day: Date): number {
  const from = startOfWeek(day).getTime();
  const to = addDays(startOfWeek(day), 7).getTime();
  return step.log.filter((c) => c.at >= from && c.at < to).length;
}

/**
 * Whether a repeating step asks for attention on `day`. Only due steps reach
 * Today; nothing ever becomes "overdue".
 */
export function isDue(step: Step, day: Date): boolean {
  if (step.deletedAt) return false;
  if (step.kind !== 'repeat' && step.kind !== 'session') return false;
  const rule = step.repeat;
  if (!rule) return !doneOn(step, day); // a session with no rhythm is welcome any day
  switch (rule.every) {
    case 'day':
      return !doneOn(step, day);
    case 'weekdays':
      return rule.days.includes(day.getDay()) && !doneOn(step, day);
    case 'week':
      return day.getDay() === rule.day && !doneOn(step, day);
    case 'n-days': {
      const n = Math.max(1, Math.round(rule.n));
      const anchor = step.log.length ? Math.max(...step.log.map((c) => c.at)) : step.createdAt;
      const gap = daysBetween(anchor, day);
      return step.log.length ? gap >= n : gap % n === 0 && !doneOn(step, day);
    }
    case 'times-per-week':
      return completionsInWeek(step, day) < Math.max(1, rule.times) && !doneOn(step, day);
  }
}

/** The next day, from `from` onwards, on which the step is due; null when it never will be. */
export function nextDue(step: Step, from: Date, horizonDays = 400): Date | null {
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(from, i);
    if (isDue(step, day)) return day;
  }
  return null;
}

/** Whether this step may ever appear on Today. Waiting, someday, and milestone steps never do. */
export function reachesToday(step: Step, day: Date): boolean {
  if (step.deletedAt) return false;
  switch (step.kind) {
    case 'once': return step.doneAt === undefined;
    case 'repeat':
    case 'session': return isDue(step, day);
    default: return false;
  }
}

/** Plain words for a rule, as the keeper would say it. */
export function describeRepeat(step: Step): string {
  const rule = step.repeat;
  if (!rule) return step.kind === 'session' ? 'Whenever you like' : '';
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (rule.every) {
    case 'day': return 'Every day';
    case 'week': return `Every ${names[rule.day] ?? 'week'}`;
    case 'n-days': return rule.n === 2 ? 'Every other day' : `Every ${rule.n} days`;
    case 'times-per-week': return rule.times === 1 ? 'Once a week' : `${rule.times} times a week`;
    case 'weekdays': {
      const days = [...rule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d] ?? '');
      if (days.length === 5 && !rule.days.includes(0) && !rule.days.includes(6)) return 'Weekdays';
      if (days.length <= 1) return days[0] ? `Every ${days[0]}` : '';
      return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
    }
  }
}
