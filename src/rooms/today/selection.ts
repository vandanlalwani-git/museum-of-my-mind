import { curiosities, type Curiosity } from '@/rooms/cabinet/rules';
import type { Action, Goal, MuseumRecords, Project } from '@/types';

/**
 * What the Today screen shows. Four questions, four answers, each one chosen
 * by a rule the screen can state in a sentence. Nothing here is new data: it
 * reads the same goals, projects, actions, and items every other room uses.
 */

export interface Focus {
  goal: Goal | null;
  /** Active goals the visitor can switch to, freshest first. */
  choices: Goal[];
  /** True when the stored choice no longer exists or left the sky. */
  fellBack: boolean;
}

export interface NextStep {
  action: Action;
  project: Project;
  /** Other open steps for the same goal, in order, for "choose another". */
  alternatives: { action: Action; project: Project }[];
}

const isLive = (g: Goal) => g.state === 'active' || g.state === 'dormant';
const worksOn = (p: Project) => p.status === 'active' || p.status === 'paused' || p.status === 'idea';

/** Goals that can hold the focus, freshest first, active before resting. */
export function focusChoices(records: MuseumRecords): Goal[] {
  return records.goals
    .filter(isLive)
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'active' ? -1 : 1) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/**
 * The one goal that matters right now: the visitor's pinned choice when it is
 * still in the sky, otherwise the freshest active goal that has a next step,
 * otherwise simply the freshest.
 */
export function resolveFocus(records: MuseumRecords, pinnedId: string | null): Focus {
  const choices = focusChoices(records);
  if (choices.length === 0) return { goal: null, choices, fellBack: pinnedId !== null };
  const pinned = pinnedId ? choices.find((g) => g.id === pinnedId) ?? null : null;
  if (pinned) return { goal: pinned, choices, fellBack: false };
  const withStep = choices.find((g) => nextStepFor(records, g.id) !== null);
  return { goal: withStep ?? choices[0]!, choices, fellBack: pinnedId !== null };
}

/** Open steps for a goal: oldest first within a project, active projects first. */
export function openStepsFor(records: MuseumRecords, goalId: string, now = Date.now()): { action: Action; project: Project }[] {
  const order = { active: 0, paused: 1, idea: 2 } as Record<string, number>;
  const projects = records.projects
    .filter((p) => p.goalIds.includes(goalId) && worksOn(p))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  const out: { action: Action; project: Project }[] = [];
  for (const project of projects) {
    const steps = records.actions
      .filter((a) => a.projectId === project.id && !a.doneAt && !(a.restUntil && a.restUntil > now))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    for (const action of steps) out.push({ action, project });
  }
  return out;
}

/** The single next small thing, plus the alternatives behind it. */
export function nextStepFor(records: MuseumRecords, goalId: string, now = Date.now()): NextStep | null {
  const steps = openStepsFor(records, goalId, now);
  const first = steps[0];
  if (!first) return null;
  return { action: first.action, project: first.project, alternatives: steps.slice(1) };
}

/** Projects under a goal that have no open step, so Today can offer to name one. */
export function projectsNeedingAStep(records: MuseumRecords, goalId: string, now = Date.now()): Project[] {
  return records.projects
    .filter((p) => p.goalIds.includes(goalId) && worksOn(p))
    .filter((p) => !records.actions.some((a) => a.projectId === p.id && !a.doneAt && !(a.restUntil && a.restUntil > now)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * One forgotten thing worth a second look, with its reason. Reuses the
 * Cabinet's rules so the two rooms never disagree.
 */
export function forgottenOne(records: MuseumRecords, now: number, seed: string, skip: Set<string> = new Set()): Curiosity | null {
  return curiosities(records, now, { limit: 1, exclude: skip, seed })[0] ?? null;
}

/** How far along the focus goal is, for a quiet progress line. */
export function focusProgress(records: MuseumRecords, goalId: string): { done: number; total: number; projects: number } {
  const projects = records.projects.filter((p) => p.goalIds.includes(goalId));
  const ids = new Set(projects.map((p) => p.id));
  const actions = records.actions.filter((a) => ids.has(a.projectId));
  return { done: actions.filter((a) => a.doneAt).length, total: actions.length, projects: projects.filter(worksOn).length };
}
