/**
 * The Sunday review, worked out on the device from the keeper's own records.
 * No AI, no network: just what moved, what went quiet, and what is waiting.
 */
import { addDays, dayKey, parseDayKey, startOfWeek } from './calendar';
import { lastMoved, openQuestions, stepsOf, unsorted } from './select';
import type { Goal, JournalEntry, MindSnapshot, Project, Step } from './types';

export interface MovedProject {
  project: Project;
  goal: Goal | null;
  /** Ticks this week: one-off steps finished plus repeat or session completions. */
  ticks: number;
  /** Names of one-off steps finished this week. */
  finished: string[];
  /** For number projects: the count before and after the week. */
  count?: { from: number; to: number; target: number };
}

export interface WeekSummary {
  weekStart: string;
  start: Date;
  end: Date;
  moved: MovedProject[];
  quiet: Goal[];
  captured: number;
  journal: JournalEntry[];
  openQuestions: number;
  unsorted: number;
}

const alive = <T extends { deletedAt?: number }>(xs: T[]) => xs.filter((x) => x.deletedAt === undefined);

function amountBefore(steps: Step[], t: number, start = 0): number {
  let n = start;
  for (const s of steps) {
    const feeds = s.feeds ?? (s.kind === 'repeat' || s.kind === 'session');
    if (!feeds) continue;
    if ((s.kind === 'once' || s.kind === 'milestone') && s.doneAt !== undefined && s.doneAt < t) n += 1;
    for (const c of s.log) if (c.at < t) n += c.amount ?? 1;
  }
  return n;
}

export function weekSummary(s: MindSnapshot, weekStart: string, now = Date.now()): WeekSummary {
  const start = parseDayKey(weekStart) ?? startOfWeek(now);
  const end = addDays(start, 7);
  const a = start.getTime(), b = end.getTime();
  const goals = new Map(alive(s.goals).map((g) => [g.id, g]));
  const moved: MovedProject[] = [];
  for (const p of alive(s.projects)) {
    const steps = stepsOf(s, p.id);
    let ticks = 0;
    const finished: string[] = [];
    for (const st of steps) {
      if (st.doneAt !== undefined && st.doneAt >= a && st.doneAt < b) { ticks++; finished.push(st.text); }
      ticks += st.log.filter((c) => c.at >= a && c.at < b).length;
    }
    if (!ticks) continue;
    const goal = p.goalId ? goals.get(p.goalId) ?? null : null;
    const item: MovedProject = { project: p, goal, ticks, finished };
    if (p.shape.kind === 'number') item.count = { from: amountBefore(steps, a, p.shape.start ?? 0), to: amountBefore(steps, b, p.shape.start ?? 0), target: p.shape.target };
    moved.push(item);
  }
  moved.sort((x, y) => y.ticks - x.ticks);
  const movedGoals = new Set(moved.map((m) => m.goal?.id).filter(Boolean));
  const quiet = [...goals.values()].filter((g) => g.state === 'active' && !movedGoals.has(g.id) && b - lastMoved(s, g.id) > 10 * 86_400_000);
  return {
    weekStart: dayKey(start), start, end, moved, quiet,
    captured: alive(s.thoughts).filter((t) => t.createdAt >= a && t.createdAt < b).length,
    journal: alive(s.journal).filter((e) => e.at >= a && e.at < b).sort((x, y) => x.at - y.at),
    openQuestions: openQuestions(s).length,
    unsorted: unsorted(s).length,
  };
}

/** Entries written on this calendar day a month, three months, six months, or a year ago. */
export function onThisDay(s: MindSnapshot, now = Date.now()): { entry: JournalEntry; ago: string }[] {
  const today = new Date(now);
  const out: { entry: JournalEntry; ago: string }[] = [];
  const back = [[1, 'A month ago'], [3, 'Three months ago'], [6, 'Six months ago'], [12, 'A year ago']] as const;
  for (const [months, label] of back) {
    const d = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
    const key = dayKey(d);
    for (const e of alive(s.journal)) if (e.date === key) out.push({ entry: e, ago: label });
  }
  return out;
}
