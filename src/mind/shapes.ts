import { addDays, DAY_MS, daysBetween, parseDayKey, startOfWeek } from './calendar';
import type { Project, ProjectShapeKind, Step } from './types';

/**
 * Progress for each project shape. In the sky it is shown as light (a ring
 * that closes, a planet that brightens); numbers appear only on the project's
 * own page.
 */
export interface Progress {
  /** 0..1, how far the ring closes. */
  fraction: number;
  /** The amount done, in the shape's own terms (steps, count, sessions, levels). */
  done: number;
  /** The amount asked for; null when the shape has no end (habit, explore). */
  total: number | null;
  /** True when the shape's own finish line has been crossed. */
  complete: boolean;
}

const live = (steps: Step[]): Step[] => steps.filter((s) => !s.deletedAt);

/** Steps that make up a finishable list: not someday, not repeating. */
function listSteps(steps: Step[]): Step[] {
  return live(steps).filter((s) => s.kind === 'once' || s.kind === 'milestone' || s.kind === 'waiting');
}

function feeds(step: Step): boolean {
  if (step.feeds !== undefined) return step.feeds;
  return step.kind === 'repeat' || step.kind === 'session';
}

/** Everything counted towards a number project, before its starting amount. */
export function countedAmount(steps: Step[]): number {
  let n = 0;
  for (const s of live(steps)) {
    if (!feeds(s)) continue;
    if (s.kind === 'once' || s.kind === 'milestone') { if (s.doneAt !== undefined) n += 1; continue; }
    for (const c of s.log) n += c.amount ?? 1;
  }
  return n;
}

/** Completions of repeating steps inside one Monday-to-Sunday week. */
export function weekCompletions(steps: Step[], weekOf: number | Date): number {
  const from = startOfWeek(weekOf).getTime();
  const to = addDays(startOfWeek(weekOf), 7).getTime();
  let n = 0;
  for (const s of live(steps)) {
    if (s.kind !== 'repeat' && s.kind !== 'session') continue;
    n += s.log.filter((c) => c.at >= from && c.at < to).length;
  }
  return n;
}

/** The last `weeks` weeks (oldest first, this week last) as completions per week. */
export function recentWeeks(steps: Step[], now: number | Date, weeks = 6): number[] {
  const out: number[] = [];
  const thisWeek = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i--) out.push(weekCompletions(steps, addDays(thisWeek, -7 * i)));
  return out;
}

export function projectProgress(project: Project, steps: Step[], now: number | Date, linkedThoughts = 0): Progress {
  const shape = project.shape;
  const mine = steps.filter((s) => s.projectId === project.id);
  const manual = (): Progress => {
    const f = clamp01(project.manualProgress ?? 0);
    return { fraction: f, done: f, total: 1, complete: project.state === 'finished' };
  };
  switch (shape.kind) {
    case 'list':
    case 'date': {
      const list = listSteps(mine);
      if (!list.length) return manual();
      const done = list.filter((s) => s.doneAt !== undefined).length;
      return { fraction: done / list.length, done, total: list.length, complete: done === list.length };
    }
    case 'number': {
      const target = Math.max(1, shape.target);
      const done = (shape.start ?? 0) + countedAmount(mine);
      return { fraction: clamp01(done / target), done, total: target, complete: done >= target };
    }
    case 'habit': {
      const per = Math.max(1, shape.perWeek);
      const done = weekCompletions(mine, now);
      return { fraction: clamp01(done / per), done, total: per, complete: false };
    }
    case 'levels': {
      const total = Math.max(1, shape.levels.length);
      const done = Math.min(total, Math.max(0, shape.reached));
      return { fraction: done / total, done, total, complete: done >= total };
    }
    case 'explore': {
      if (shape.conclusion?.trim()) return { fraction: 1, done: linkedThoughts, total: null, complete: true };
      // Exploring never "fills up": gathered thoughts brighten it, but only a written conclusion closes it.
      return { fraction: Math.min(0.85, linkedThoughts * 0.1), done: linkedThoughts, total: null, complete: false };
    }
  }
}

/** Days until a "get ready for a day" project's date (negative once it has passed); null if unset. */
export function daysUntil(project: Project, now: number | Date): number | null {
  if (project.shape.kind !== 'date') return null;
  const d = parseDayKey(project.shape.date);
  return d ? daysBetween(now, d) : null;
}

/**
 * "If you keep this pace": a what-if, never a promise. Given how much is left
 * and a rate per week, when would the target be reached?
 */
export function whatIfDate(remaining: number, perWeek: number, from: number | Date): Date | null {
  if (remaining <= 0) return typeof from === 'number' ? new Date(from) : new Date(from.getTime());
  if (!(perWeek > 0)) return null;
  const days = Math.ceil((remaining / perWeek) * 7);
  return addDays(typeof from === 'number' ? new Date(from) : from, days);
}

/**
 * The keeper's recent pace for a number project: completions per week over
 * the last `windowWeeks` weeks, or since the first completion if that is more
 * recent. Null until there is something to go on.
 */
export function recentPace(steps: Step[], now: number | Date, windowWeeks = 8): number | null {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const times: number[] = [];
  for (const s of live(steps)) {
    if (!feeds(s)) continue;
    if ((s.kind === 'once' || s.kind === 'milestone') && s.doneAt !== undefined) times.push(s.doneAt);
    else for (const c of s.log) for (let i = 0; i < (c.amount ?? 1); i++) times.push(c.at);
  }
  const windowStart = nowMs - windowWeeks * 7 * DAY_MS;
  const inWindow = times.filter((t) => t >= windowStart && t <= nowMs);
  if (!inWindow.length) return null;
  const since = Math.max(windowStart, Math.min(...inWindow));
  const weeks = Math.max(1, (nowMs - since) / (7 * DAY_MS));
  return inWindow.length / weeks;
}

export const SHAPE_WORDS: Record<ProjectShapeKind, string> = {
  list: 'A list to finish',
  number: 'A number to reach',
  habit: 'A habit to keep',
  date: 'Getting ready for a day',
  levels: 'A climb in levels',
  explore: 'A question to explore',
};

function clamp01(n: number): number { return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0)); }
