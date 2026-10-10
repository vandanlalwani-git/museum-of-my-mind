/**
 * What Today shows. Deliberately small: one thought first, then at most two
 * focus goals with one step each, then a gentle count of what is waiting.
 * Nothing is ever overdue, and nothing here is a list to get through.
 */
import { hashString } from '@/lib/rng';
import { addDays, dayKey, startOfDay, startOfWeek } from './calendar';
import { isDue } from './recurrence';
import { lastMoved, stepsOf, unsorted } from './select';
import type { Goal, MindSnapshot, Project, Step, Thought } from './types';

export interface FocusItem { goal: Goal; project: Project | null; step: Step | null; doneToday: Step[] }

export interface TodayPlan {
  thought: { t: Thought; reason: 'question' | 'forgotten' } | null;
  focus: FocusItem[];
  focusSource: 'chosen' | 'last-week' | 'suggested' | 'none';
  unsortedCount: number;
  /** The week whose review is waiting (Monday's date), on Sunday and Monday only. */
  reviewWeek: string | null;
}

const DAY = 86_400_000;
const alive = <T extends { deletedAt?: number }>(xs: T[]) => xs.filter((x) => x.deletedAt === undefined);

export function focusGoalIds(s: MindSnapshot, now: number): { ids: string[]; source: TodayPlan['focusSource'] } {
  const thisWeek = dayKey(startOfWeek(now));
  const active = new Set(alive(s.goals).filter((g) => g.state === 'active').map((g) => g.id));
  const reviews = alive(s.reviews).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const current = reviews.find((r) => r.weekStart === thisWeek);
  if (current?.focusGoalIds.length) return { ids: current.focusGoalIds.filter((id) => active.has(id)).slice(0, 2), source: 'chosen' };
  const last = reviews.find((r) => r.weekStart < thisWeek && r.focusGoalIds.length);
  if (last) {
    const ids = last.focusGoalIds.filter((id) => active.has(id)).slice(0, 2);
    if (ids.length) return { ids, source: 'last-week' };
  }
  const suggested = [...active].sort((a, b) => lastMoved(s, b) - lastMoved(s, a)).slice(0, 2);
  return { ids: suggested, source: suggested.length ? 'suggested' : 'none' };
}

/** The one step Today offers for a goal: something due today, else the next one-off in the liveliest project. */
export function nextStepFor(s: MindSnapshot, goal: Goal, now: number): { project: Project | null; step: Step | null; doneToday: Step[] } {
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const projects = alive(s.projects).filter((p) => p.goalId === goal.id && p.state === 'active');
  const moved = (p: Project) => Math.max(p.updatedAt, ...stepsOf(s, p.id).map((x) => Math.max(x.doneAt ?? 0, ...x.log.map((c) => c.at))));
  projects.sort((a, b) => moved(b) - moved(a));
  const doneToday: Step[] = [];
  for (const p of projects) for (const st of stepsOf(s, p.id)) {
    if ((st.doneAt !== undefined && dayKey(st.doneAt) === todayKey) || st.log.some((c) => dayKey(c.at) === todayKey)) doneToday.push(st);
  }
  for (const p of projects) {
    const due = stepsOf(s, p.id).find((st) => (st.kind === 'repeat' || st.kind === 'session') && isDue(st, today));
    if (due) return { project: p, step: due, doneToday };
  }
  for (const p of projects) {
    const next = stepsOf(s, p.id).find((st) => st.kind === 'once' && st.doneAt === undefined);
    if (next) return { project: p, step: next, doneToday };
  }
  return { project: projects[0] ?? null, step: null, doneToday };
}

/** One thought to start the day with: an open question, else something not looked at in weeks. Changes daily, not on every visit. */
export function thoughtOfTheDay(s: MindSnapshot, now: number): TodayPlan['thought'] {
  const seed = hashString(dayKey(now));
  const pick = <T>(xs: T[]): T | undefined => xs[seed % Math.max(1, xs.length)];
  const restingUntil = (t: Thought) => t.restUntil !== undefined && t.restUntil > now;
  const questions = alive(s.thoughts).filter((t) => t.isQuestion && !t.answer && t.state !== 'let-go' && !restingUntil(t) && now - t.lastVisitedAt > DAY)
    .sort((a, b) => a.lastVisitedAt - b.lastVisitedAt).slice(0, 5);
  const q = pick(questions);
  if (q) return { t: q, reason: 'question' };
  const forgotten = alive(s.thoughts).filter((t) => t.state === 'kept' && !restingUntil(t) && now - t.lastVisitedAt > 21 * DAY)
    .sort((a, b) => a.lastVisitedAt - b.lastVisitedAt).slice(0, 5);
  const f = pick(forgotten);
  return f ? { t: f, reason: 'forgotten' } : null;
}

export function reviewWeekFor(s: MindSnapshot, now: number): string | null {
  const d = new Date(now).getDay();
  if (d !== 0 && d !== 1) return null;
  const week = dayKey(d === 0 ? startOfWeek(now) : addDays(startOfWeek(now), -7));
  const r = alive(s.reviews).find((x) => x.weekStart === week);
  return r?.closedAt ? null : week;
}

export function planToday(s: MindSnapshot, now = Date.now()): TodayPlan {
  const { ids, source } = focusGoalIds(s, now);
  const goals = new Map(alive(s.goals).map((g) => [g.id, g]));
  const focus = ids.map((id) => goals.get(id)).filter((g): g is Goal => !!g).map((goal) => ({ goal, ...nextStepFor(s, goal, now) }));
  return { thought: thoughtOfTheDay(s, now), focus, focusSource: source, unsortedCount: unsorted(s).length, reviewWeek: reviewWeekFor(s, now) };
}
