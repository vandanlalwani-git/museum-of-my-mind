/**
 * Old rooms → one mind with galaxies.
 *
 * Pure: takes the old museums and records (the same shape as a v1–v3
 * backup), returns new records and a plain-language report. It never reads
 * or writes storage, so it can be tested exhaustively and run on a backup
 * before it ever touches the keeper's real data.
 *
 * Rules:
 * - Every own museum becomes a galaxy in a single mind. The demo museum is
 *   left out; the guided tour replaces it.
 * - Ids are kept, so every reference stays intact.
 * - Every old record lands somewhere: the report counts them, and the tests
 *   prove the counts add up.
 */
import { newId as defaultNewId } from '@/lib/ids';
import type {
  Action, Goal as OldGoal, Link, Memory, Museum, MuseumRecords, Note, Project as OldProject, Thread,
} from '@/types';
import { dayKey } from './calendar';
import {
  GALAXY_HUES, emptySnapshot,
  type Connection, type Galaxy, type Goal, type GoalHorizon, type GoalState, type JournalEntry, type LegacyRecord,
  type Mind, type MindRecord, type MindSnapshot, type Project, type ProjectState, type Step, type Thought,
} from './types';

export interface LegacyData {
  museums: Museum[];
  records: MuseumRecords;
}

export interface MigrationReport {
  galaxies: number;
  goals: number;
  projects: number;
  steps: number;
  thoughts: number;
  /** Thoughts that were already linked to a goal or project, so they skip Unsorted. */
  thoughtsPlaced: number;
  connections: number;
  journal: number;
  reflections: number;
  legacy: number;
  /** Projects that Today had created quietly to hold a step; now visible as "First steps". */
  holdersRenamed: number;
  /** Records left out because they belong to the demo museum. */
  demoRecordsSkipped: number;
  /** Records that point at something missing. They are kept as they are. */
  danglingReferences: string[];
}

export interface MigrationResult {
  snapshot: MindSnapshot | null;
  report: MigrationReport;
}

export interface MigrationOptions {
  now?: number;
  newId?: () => string;
}

const HORIZON: Record<OldGoal['horizon'], GoalHorizon> = { season: 'season', year: 'year', decade: 'years', lifetime: 'lifetime' };
const GOAL_STATE: Record<OldGoal['state'], GoalState> = { active: 'active', dormant: 'resting', fulfilled: 'reached', released: 'released' };
const PROJECT_STATE: Record<OldProject['status'], ProjectState> = { idea: 'idea', active: 'active', paused: 'paused', done: 'finished', abandoned: 'dropped' };

export const HOLDER_TITLE = 'First steps';

function base(r: { id: string; createdAt: number; updatedAt: number; lastVisitedAt: number; tags: string[]; restUntil?: number }, museumId: string): MindRecord {
  return {
    id: r.id, museumId, createdAt: r.createdAt, updatedAt: r.updatedAt, lastVisitedAt: r.lastVisitedAt,
    tags: [...(r.tags ?? [])],
    ...(r.restUntil !== undefined ? { restUntil: r.restUntil } : {}),
  };
}

/** Today (Phase 9) made a project named after its goal, with no summary, to hold a first step. */
export function isHolderProject(p: OldProject, goals: Map<string, OldGoal>): boolean {
  if (p.goalIds.length !== 1 || p.summary.trim() !== '') return false;
  const g = goals.get(p.goalIds[0] ?? '');
  return !!g && g.title.trim().toLowerCase() === p.title.trim().toLowerCase();
}

export function migrateToMind(data: LegacyData, opts: MigrationOptions = {}): MigrationResult {
  const now = opts.now ?? Date.now();
  const makeId = opts.newId ?? defaultNewId;
  const report: MigrationReport = {
    galaxies: 0, goals: 0, projects: 0, steps: 0, thoughts: 0, thoughtsPlaced: 0, connections: 0,
    journal: 0, reflections: 0, legacy: 0, holdersRenamed: 0, demoRecordsSkipped: 0, danglingReferences: [],
  };

  const own = data.museums.filter((m) => m.kind === 'own').sort((a, b) => a.createdAt - b.createdAt);
  const ownIds = new Set(own.map((m) => m.id));
  const r = data.records;

  for (const list of Object.values(r) as { museumId: string }[][]) {
    for (const rec of list) if (!ownIds.has(rec.museumId)) report.demoRecordsSkipped++;
  }
  if (!own.length) return { snapshot: null, report };

  const first = own[0]!;
  const mind: Mind = {
    id: makeId(),
    name: own.length === 1 ? first.name : 'My Mind',
    kind: 'own',
    ...(first.visitorName ? { visitorName: first.visitorName } : {}),
    createdAt: Math.min(...own.map((m) => m.createdAt)),
    lastEnteredAt: Math.max(...own.map((m) => m.lastEnteredAt)),
  };
  const out = emptySnapshot(mind);
  const M = mind.id;

  // Museums → galaxies. The galaxy keeps the museum's id so old references resolve.
  const galaxyOf = new Map<string, string>();
  own.forEach((m, i) => {
    const g: Galaxy = {
      id: m.id, museumId: M, createdAt: m.createdAt, updatedAt: now, lastVisitedAt: m.lastEnteredAt, tags: [],
      name: m.name, hue: GALAXY_HUES[i % GALAXY_HUES.length]!, order: i,
    };
    out.galaxies.push(g);
    galaxyOf.set(m.id, g.id);
  });
  const mine = <T extends { museumId: string }>(xs: T[]): T[] => xs.filter((x) => ownIds.has(x.museumId));

  // Goals
  const oldGoals = new Map(mine(r.goals).map((g) => [g.id, g]));
  for (const g of oldGoals.values()) {
    const goal: Goal = {
      ...base(g, M), galaxyId: galaxyOf.get(g.museumId)!, title: g.title, why: g.why,
      horizon: HORIZON[g.horizon] ?? 'year', state: GOAL_STATE[g.state] ?? 'active',
    };
    out.goals.push(goal);
  }

  // Projects → planets. A project keeps its first goal as its star; the rest are remembered.
  const projectIds = new Set<string>();
  for (const p of mine(r.projects)) {
    const holder = isHolderProject(p, oldGoals);
    if (holder) report.holdersRenamed++;
    const [star, ...others] = p.goalIds;
    if (star && !oldGoals.has(star)) report.danglingReferences.push(`project ${p.id} → goal ${star}`);
    const project: Project = {
      ...base(p, M), galaxyId: galaxyOf.get(p.museumId)!, goalId: star ?? null, alsoGoalIds: others,
      title: holder ? HOLDER_TITLE : p.title, summary: p.summary, state: PROJECT_STATE[p.status] ?? 'active',
      shape: { kind: 'list' },
      ...(p.progress > 0 ? { manualProgress: p.progress } : {}),
      ...(p.sizeHours !== undefined ? { sizeHours: p.sizeHours } : {}),
    };
    out.projects.push(project);
    projectIds.add(p.id);
  }

  // Actions → one-off steps, in the order they were written.
  const orderIn = new Map<string, number>();
  for (const a of [...mine(r.actions)].sort((x, y) => x.createdAt - y.createdAt) as Action[]) {
    if (!projectIds.has(a.projectId)) report.danglingReferences.push(`step ${a.id} → project ${a.projectId}`);
    const order = orderIn.get(a.projectId) ?? 0;
    orderIn.set(a.projectId, order + 1);
    const step: Step = {
      ...base(a, M), projectId: a.projectId, text: a.text, kind: 'once', order, log: [],
      ...(a.doneAt !== undefined ? { doneAt: a.doneAt } : {}),
    };
    out.steps.push(step);
  }

  // Notes and links → thoughts.
  const thoughtIds = new Set<string>();
  const thoughts = new Map<string, Thought>();
  for (const n of mine(r.notes) as Note[]) {
    const t: Thought = {
      ...base(n, M), galaxyId: galaxyOf.get(n.museumId)!, text: n.title,
      ...(n.body ? { body: n.body } : {}),
      origin: n.kind === 'idea' ? 'idea' : 'note', isQuestion: false,
      state: n.archivedAt !== undefined ? 'let-go' : 'unsorted',
      ...(n.archivedAt !== undefined ? { letGoAt: n.archivedAt } : {}),
    };
    thoughts.set(t.id, t); thoughtIds.add(t.id);
  }
  for (const l of mine(r.links) as Link[]) {
    const t: Thought = {
      ...base(l, M), galaxyId: galaxyOf.get(l.museumId)!, text: l.title, url: l.url,
      ...(l.whySaved ? { body: l.whySaved } : {}),
      origin: 'link', isQuestion: false,
      state: l.archivedAt !== undefined ? 'let-go' : 'unsorted',
      ...(l.archivedAt !== undefined ? { letGoAt: l.archivedAt } : {}),
    };
    thoughts.set(t.id, t); thoughtIds.add(t.id);
  }

  // Threads: a thought tied to a goal or project finds its home there. Every other thread stays a connection.
  const goalIds = new Set(oldGoals.keys());
  const memoryIds = new Set(mine(r.memories).map((m) => m.id));
  const known = (id: string) => goalIds.has(id) || projectIds.has(id) || thoughtIds.has(id) || memoryIds.has(id);
  for (const th of [...mine(r.threads)].sort((a, b) => a.createdAt - b.createdAt) as Thread[]) {
    for (const end of [th.fromId, th.toId]) if (!known(end)) report.danglingReferences.push(`thread ${th.id} → ${end}`);
    const thoughtEnd = thoughtIds.has(th.fromId) ? th.fromId : thoughtIds.has(th.toId) ? th.toId : null;
    const other = thoughtEnd === th.fromId ? th.toId : th.fromId;
    const t = thoughtEnd ? thoughts.get(thoughtEnd) : undefined;
    const home = goalIds.has(other) ? 'goalId' : projectIds.has(other) ? 'projectId' : null;
    if (t && home && t.goalId === undefined && t.projectId === undefined) {
      t[home] = other;
      t.link = { kind: th.kind, ...(th.why ? { why: th.why } : {}) };
      if (t.state === 'unsorted') t.state = 'kept';
      continue;
    }
    const c: Connection = { ...base(th, M), fromId: th.fromId, toId: th.toId, kind: th.kind, ...(th.why ? { why: th.why } : {}) };
    out.connections.push(c);
  }
  out.thoughts.push(...thoughts.values());

  // Memories → journal entries.
  for (const m of mine(r.memories) as Memory[]) {
    const e: JournalEntry = {
      ...base(m, M), galaxyId: galaxyOf.get(m.museumId)!, date: dayKey(m.occurredAt), at: m.occurredAt,
      title: m.title, body: m.body,
      ...(m.goalId ? { goalId: m.goalId } : {}),
      ...(m.projectId ? { projectId: m.projectId } : {}),
      ...(m.archivedAt !== undefined ? { archivedAt: m.archivedAt } : {}),
    };
    out.journal.push(e);
  }

  // Ask my AI results stay readable; Future Gallery what-ifs are kept whole but no longer shown.
  out.reflections.push(...mine(r.reflections).map((x) => ({ ...x, museumId: M, tags: [...x.tags] })));
  out.legacy.push(...mine(r.scenarios).map((s): LegacyRecord => ({ id: s.id, museumId: M, type: 'scenario', data: { ...s, tags: [...s.tags] } })));

  report.galaxies = out.galaxies.length;
  report.goals = out.goals.length;
  report.projects = out.projects.length;
  report.steps = out.steps.length;
  report.thoughts = out.thoughts.length;
  report.thoughtsPlaced = out.thoughts.filter((t) => t.goalId !== undefined || t.projectId !== undefined).length;
  report.connections = out.connections.length;
  report.journal = out.journal.length;
  report.reflections = out.reflections.length;
  report.legacy = out.legacy.length;
  return { snapshot: out, report };
}

/** One plain sentence per line, for the "your museum has moved in" note. */
export function describeReport(r: MigrationReport): string[] {
  const lines: string[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const parts = [n(r.galaxies, 'galaxy', 'galaxies')];
  if (r.goals) parts.push(n(r.goals, 'goal', 'goals'));
  if (r.projects) parts.push(n(r.projects, 'project', 'projects'));
  if (r.steps) parts.push(n(r.steps, 'step', 'steps'));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]!;
  lines.push(`${list} moved in. Each museum you had is now a galaxy.`);
  if (r.thoughts) {
    const waiting = r.thoughts - r.thoughtsPlaced;
    lines.push(r.thoughtsPlaced === 0 ? `${n(r.thoughts, 'thought waits', 'thoughts wait')} in Unsorted for a home.`
      : waiting === 0 ? `${n(r.thoughts, 'thought', 'thoughts')} kept ${r.thoughts === 1 ? 'its' : 'their'} home.`
      : `${n(r.thoughts, 'thought', 'thoughts')}: ${r.thoughtsPlaced} already ${r.thoughtsPlaced === 1 ? 'has' : 'have'} a home, ${waiting} ${waiting === 1 ? 'waits' : 'wait'} in Unsorted.`);
  }
  if (r.journal) lines.push(`${n(r.journal, 'memory is', 'memories are')} now in your Journal.`);
  if (r.holdersRenamed) lines.push(`${n(r.holdersRenamed, 'hidden project', 'hidden projects')} that held your first steps ${r.holdersRenamed === 1 ? 'is' : 'are'} now visible as "${HOLDER_TITLE}".`);
  if (r.connections) lines.push(`${n(r.connections, 'link', 'links')} from the wall ${r.connections === 1 ? 'is' : 'are'} kept.`);
  if (r.legacy) lines.push(`${n(r.legacy, 'saved what-if is', 'saved what-ifs are')} kept in your backup.`);
  return lines;
}
