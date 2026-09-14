import { newId } from '@/lib/ids';
import type { Action, BaseRecord, Goal, Horizon, Project } from '@/types';

function stamp(museumId: string, now = Date.now()): BaseRecord {
  return { id: newId(), museumId, createdAt: now, updatedAt: now, lastVisitedAt: now, tags: [] };
}

export interface GoalInput { title: string; why?: string; horizon?: Horizon }
export function makeGoal(museumId: string, input: GoalInput): Goal {
  return { ...stamp(museumId), title: input.title.trim(), why: (input.why ?? '').trim(), horizon: input.horizon ?? 'year', state: 'active' };
}

export interface ProjectInput { title: string; summary?: string; goalIds?: string[] }
export function makeProject(museumId: string, input: ProjectInput): Project {
  return { ...stamp(museumId), title: input.title.trim(), summary: (input.summary ?? '').trim(), goalIds: input.goalIds ?? [], status: 'active', progress: 0 };
}

export function makeAction(museumId: string, projectId: string, text: string): Action {
  return { ...stamp(museumId), projectId, text: text.trim() };
}

/** Return a copy with updatedAt and lastVisitedAt refreshed. */
export function touched<T extends BaseRecord>(record: T, patch: Partial<T> = {}, now = Date.now()): T {
  return { ...record, ...patch, updatedAt: now, lastVisitedAt: now };
}
