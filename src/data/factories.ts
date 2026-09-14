import { newId } from '@/lib/ids';
import type { Action, BaseRecord, Goal, Horizon, Link, Memory, Note, NoteKind, Project, Scenario, Thread, ThreadKind } from '@/types';

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

export function makeNote(museumId: string, input: { title: string; body?: string; kind?: NoteKind; tags?: string[] }): Note {
  return { ...stamp(museumId), title: input.title.trim(), body: (input.body ?? '').trim(), ...(input.kind === 'idea' ? { kind: 'idea' as const } : {}), tags: input.tags ?? [] };
}

export function makeLink(museumId: string, input: { url: string; title?: string; whySaved?: string; tags?: string[] }): Link {
  const url = input.url.trim();
  let title = (input.title ?? '').trim();
  if (!title) { try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { title = url; } }
  return { ...stamp(museumId), url, title, whySaved: (input.whySaved ?? '').trim(), tags: input.tags ?? [] };
}

export function makeMemory(museumId: string, input: { title: string; body?: string; occurredAt?: number; goalId?: string; projectId?: string; tags?: string[] }): Memory {
  const now = Date.now();
  return {
    ...stamp(museumId, now),
    title: input.title.trim(),
    body: (input.body ?? '').trim(),
    occurredAt: input.occurredAt ?? now,
    ...(input.goalId ? { goalId: input.goalId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    tags: input.tags ?? [],
  };
}

export function makeThread(museumId: string, fromId: string, toId: string, kind: ThreadKind, why?: string): Thread {
  return { ...stamp(museumId), fromId, toId, kind, ...(why?.trim() ? { why: why.trim() } : {}) };
}

export function makeScenario(museumId: string, input: { name: string; goalId: string; hoursPerWeek: number; consistency: number; focus: number; rest: number }): Scenario {
  return { ...stamp(museumId), name: input.name.trim() || 'Untitled what-if', goalId: input.goalId, hoursPerWeek: input.hoursPerWeek, consistency: input.consistency, focus: input.focus, rest: input.rest };
}
