/**
 * Everything the keeper can do to their mind, as small named actions.
 * Removal never erases: it sets a deletion marker, so it can travel to a
 * paired device later and a backup still tells the whole story.
 */
import { newId } from '@/lib/ids';
import { dayKey } from './calendar';
import { useMind } from './store';
import type { RecordOf } from './repo';
import {
  GALAXY_HUES, type Galaxy, type Goal, type JournalEntry, type MindCollection, type MindRecord, type Project,
  type ProjectShape, type Review, type Step, type StepKind, type Thought,
} from './types';

const S = () => useMind.getState();

function stamp(now = Date.now()): MindRecord {
  const mind = S().mind;
  if (!mind) throw new Error('No museum is open.');
  return { id: newId(), museumId: mind.id, createdAt: now, updatedAt: now, lastVisitedAt: now, tags: [] };
}

function find<C extends MindCollection>(c: C, id: string): RecordOf<C> {
  const rec = (S().snap?.[c] as { id: string }[] | undefined)?.find((r) => r.id === id);
  if (!rec) throw new Error(`Could not find that ${c.replace(/s$/, '')}.`);
  return rec as RecordOf<C>;
}

async function patch<C extends MindCollection>(c: C, id: string, changes: Partial<RecordOf<C>>): Promise<RecordOf<C>> {
  const now = Date.now();
  const next = { ...find(c, id), ...changes, updatedAt: now, lastVisitedAt: now } as RecordOf<C>;
  await S().put(c, next);
  return next;
}

/** #words become the keeper's own tags. */
export function tagsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,40})/gu)) out.add(m[2]!.toLowerCase());
  return [...out];
}

export interface ThoughtInput {
  text: string;
  body?: string;
  url?: string;
  galaxyId: string | null;
  goalId?: string;
  projectId?: string;
  isQuestion?: boolean;
  intent?: 'step';
}

export const mindOps = {
  /* ---------- thoughts ---------- */
  async addThought(input: ThoughtInput): Promise<Thought> {
    const text = input.text.trim();
    const placed = input.goalId !== undefined || input.projectId !== undefined;
    const t: Thought = {
      ...stamp(), tags: tagsIn(`${text} ${input.body ?? ''}`), galaxyId: input.galaxyId, text,
      origin: input.url ? 'link' : 'thought', isQuestion: input.isQuestion ?? /\?\s*$/.test(text),
      state: placed ? 'kept' : 'unsorted',
      ...(input.body?.trim() ? { body: input.body.trim() } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.intent ? { intent: input.intent } : {}),
    };
    await S().put('thoughts', t);
    return t;
  },

  /** Clear my mind: many thoughts at once, one per line, all into Unsorted. */
  async addThoughts(lines: string[], galaxyId: string | null): Promise<number> {
    const now = Date.now();
    const rows: Thought[] = lines.map((l) => l.trim()).filter(Boolean).map((text, i) => ({
      ...stamp(now + i), tags: tagsIn(text), galaxyId, text, origin: 'thought' as const,
      isQuestion: /\?\s*$/.test(text), state: 'unsorted' as const,
    }));
    await S().put('thoughts', rows);
    return rows.length;
  },

  async placeThought(id: string, home: { goalId?: string; projectId?: string; galaxyId?: string | null }): Promise<void> {
    const snap = S().snap!;
    let galaxyId = home.galaxyId ?? find('thoughts', id).galaxyId;
    if (home.goalId) galaxyId = snap.goals.find((g) => g.id === home.goalId)?.galaxyId ?? galaxyId;
    if (home.projectId) galaxyId = snap.projects.find((p) => p.id === home.projectId)?.galaxyId ?? galaxyId;
    const t = find('thoughts', id);
    const { goalId: _g, projectId: _p, intent: _i, ...rest } = t;
    void _g; void _p; void _i;
    const next: Thought = {
      ...rest, galaxyId, state: 'kept', updatedAt: Date.now(), lastVisitedAt: Date.now(),
      ...(home.goalId ? { goalId: home.goalId } : {}),
      ...(home.projectId ? { projectId: home.projectId } : {}),
    };
    await S().put('thoughts', next);
  },
  keepThought: (id: string) => patch('thoughts', id, { state: 'kept' }),
  letGo: (id: string) => patch('thoughts', id, { state: 'let-go', letGoAt: Date.now() }),
  bringBack: (id: string) => patch('thoughts', id, { state: 'unsorted' }),
  answer: (id: string, answer: string) => patch('thoughts', id, { answer: answer.trim(), answeredAt: Date.now() }),
  setQuestion: (id: string, isQuestion: boolean) => patch('thoughts', id, { isQuestion }),
  updateThought: (id: string, changes: Partial<Thought>) => patch('thoughts', id, changes),
  removeThought: (id: string) => patch('thoughts', id, { deletedAt: Date.now() }),

  async thoughtToStep(id: string, projectId: string): Promise<Step> {
    const t = find('thoughts', id);
    const step = await mindOps.addStep({ projectId, text: t.text, kind: 'once' });
    await patch('thoughts', id, { deletedAt: Date.now() });
    return step;
  },
  async thoughtToGoal(id: string, galaxyId: string): Promise<Goal> {
    const t = find('thoughts', id);
    const goal = await mindOps.addGoal({ galaxyId, title: t.text, why: t.body ?? '' });
    await patch('thoughts', id, { deletedAt: Date.now() });
    return goal;
  },
  async thoughtToProject(id: string, galaxyId: string, goalId: string | null): Promise<Project> {
    const t = find('thoughts', id);
    const project = await mindOps.addProject({ galaxyId, goalId, title: t.text, summary: t.body ?? '', shape: { kind: 'list' } });
    await patch('thoughts', id, { deletedAt: Date.now() });
    return project;
  },

  /* ---------- galaxies ---------- */
  async addGalaxy(name: string): Promise<Galaxy> {
    const existing = S().snap!.galaxies.filter((g) => g.deletedAt === undefined);
    const g: Galaxy = { ...stamp(), name: name.trim() || 'New galaxy', hue: GALAXY_HUES[existing.length % GALAXY_HUES.length]!, order: existing.length };
    await S().put('galaxies', g);
    return g;
  },
  updateGalaxy: (id: string, changes: Partial<Galaxy>) => patch('galaxies', id, changes),

  /* ---------- goals ---------- */
  async addGoal(input: { galaxyId: string; title: string; why?: string; horizon?: Goal['horizon'] }): Promise<Goal> {
    const g: Goal = { ...stamp(), galaxyId: input.galaxyId, title: input.title.trim(), why: (input.why ?? '').trim(), horizon: input.horizon ?? 'year', state: 'active' };
    await S().put('goals', g);
    return g;
  },
  updateGoal: (id: string, changes: Partial<Goal>) => patch('goals', id, changes),

  /* ---------- projects ---------- */
  async addProject(input: { galaxyId: string; goalId: string | null; title: string; summary?: string; shape: ProjectShape }): Promise<Project> {
    const p: Project = { ...stamp(), galaxyId: input.galaxyId, goalId: input.goalId, alsoGoalIds: [], title: input.title.trim(), summary: (input.summary ?? '').trim(), state: 'active', shape: input.shape };
    await S().put('projects', p);
    return p;
  },
  updateProject: (id: string, changes: Partial<Project>) => patch('projects', id, changes),

  /* ---------- steps ---------- */
  async addStep(input: { projectId: string; text: string; kind: StepKind } & Partial<Pick<Step, 'repeat' | 'amount' | 'waitingOn' | 'feeds'>>): Promise<Step> {
    const siblings = S().snap!.steps.filter((s) => s.projectId === input.projectId);
    const { projectId, text, kind, ...extra } = input;
    const step: Step = { ...stamp(), projectId, text: text.trim(), kind, order: siblings.length, log: [], ...extra };
    await S().put('steps', step);
    return step;
  },
  updateStep: (id: string, changes: Partial<Step>) => patch('steps', id, changes),
  removeStep: (id: string) => patch('steps', id, { deletedAt: Date.now() }),

  async completeStep(id: string, opts: { note?: string; amount?: number; at?: number } = {}): Promise<Step> {
    const s = find('steps', id);
    const at = opts.at ?? Date.now();
    if (s.kind === 'repeat' || s.kind === 'session') {
      const entry = { at, ...(opts.amount !== undefined ? { amount: opts.amount } : {}), ...(opts.note?.trim() ? { note: opts.note.trim() } : {}) };
      return patch('steps', id, { log: [...s.log, entry] });
    }
    return patch('steps', id, { doneAt: at });
  },

  /** Takes back the most recent tick: a one-off becomes open again; a repeat loses today's entry. */
  async undoStep(id: string): Promise<Step> {
    const s = find('steps', id);
    if (s.kind === 'repeat' || s.kind === 'session') {
      const today = dayKey(Date.now());
      const idx = s.log.map((c) => dayKey(c.at)).lastIndexOf(today);
      if (idx === -1) return s;
      return patch('steps', id, { log: s.log.filter((_, i) => i !== idx) });
    }
    const { doneAt: _d, ...rest } = s;
    void _d;
    const next = { ...rest, updatedAt: Date.now(), lastVisitedAt: Date.now() } as Step;
    await S().put('steps', next);
    return next;
  },

  /* ---------- journal ---------- */
  async addJournal(input: { title: string; body?: string; at?: number; galaxyId?: string | null; goalId?: string; projectId?: string }): Promise<JournalEntry> {
    const at = input.at ?? Date.now();
    const text = input.title.trim();
    const e: JournalEntry = {
      ...stamp(), tags: tagsIn(`${text} ${input.body ?? ''}`), galaxyId: input.galaxyId ?? null, date: dayKey(at), at,
      title: text, body: (input.body ?? '').trim(),
      ...(input.goalId ? { goalId: input.goalId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
    };
    await S().put('journal', e);
    return e;
  },
  updateJournal: (id: string, changes: Partial<JournalEntry>) => patch('journal', id, changes),
  removeJournal: (id: string) => patch('journal', id, { deletedAt: Date.now() }),

  /* ---------- reviews ---------- */
  async saveReview(input: { weekStart: string; focusGoalIds: string[]; line?: string; close?: boolean }): Promise<Review> {
    const existing = S().snap!.reviews.find((r) => r.weekStart === input.weekStart && r.deletedAt === undefined);
    const now = Date.now();
    const base = existing ?? { ...stamp(now), weekStart: input.weekStart, focusGoalIds: [] };
    const r: Review = {
      ...base, focusGoalIds: input.focusGoalIds, updatedAt: now, lastVisitedAt: now,
      ...(input.line?.trim() ? { line: input.line.trim() } : {}),
      ...(input.close ? { closedAt: now } : existing?.closedAt ? { closedAt: existing.closedAt } : {}),
    };
    await S().put('reviews', r);
    return r;
  },

  /** Notes that the keeper looked at something, which keeps it out of "you may have forgotten". */
  async visit(c: 'goals' | 'projects' | 'thoughts', id: string): Promise<void> {
    const rec = (S().snap?.[c] as { id: string; lastVisitedAt: number }[] | undefined)?.find((r) => r.id === id);
    if (!rec || Date.now() - rec.lastVisitedAt < 60_000) return;
    await S().put(c, { ...rec, lastVisitedAt: Date.now() } as never);
  },
};
