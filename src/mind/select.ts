/**
 * Read-only views over a mind snapshot. Pure functions, so every screen and
 * the sky see the same answers.
 */
import { projectProgress, type Progress } from './shapes';
import type { Galaxy, Goal, JournalEntry, MindSnapshot, Project, Step, Thought } from './types';

const alive = <T extends { deletedAt?: number }>(xs: T[]): T[] => xs.filter((x) => x.deletedAt === undefined);

export const galaxiesOf = (s: MindSnapshot): Galaxy[] => alive(s.galaxies).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
export const goalsIn = (s: MindSnapshot, galaxyId: string): Goal[] =>
  alive(s.goals).filter((g) => g.galaxyId === galaxyId).sort((a, b) => stateRank(a) - stateRank(b) || a.createdAt - b.createdAt);
export const projectsOf = (s: MindSnapshot, goalId: string): Project[] =>
  alive(s.projects).filter((p) => p.goalId === goalId).sort((a, b) => projectRank(a) - projectRank(b) || a.createdAt - b.createdAt);
/** Planets with no star yet. */
export const looseProjects = (s: MindSnapshot, galaxyId: string): Project[] =>
  alive(s.projects).filter((p) => p.goalId === null && p.galaxyId === galaxyId);
export const stepsOf = (s: MindSnapshot, projectId: string): Step[] =>
  alive(s.steps).filter((x) => x.projectId === projectId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

export const unsorted = (s: MindSnapshot, galaxyId?: string | null): Thought[] =>
  alive(s.thoughts).filter((t) => t.state === 'unsorted' && (galaxyId === undefined || t.galaxyId === galaxyId)).sort((a, b) => b.createdAt - a.createdAt);
export const thoughtsForGoal = (s: MindSnapshot, goalId: string): Thought[] =>
  alive(s.thoughts).filter((t) => t.state !== 'let-go' && t.goalId === goalId).sort(questionsFirst);
export const thoughtsForProject = (s: MindSnapshot, projectId: string): Thought[] =>
  alive(s.thoughts).filter((t) => t.state !== 'let-go' && t.projectId === projectId).sort(questionsFirst);
/** Kept thoughts that live in a galaxy without a goal or project: ideas that need no plan. */
export const freeThoughts = (s: MindSnapshot, galaxyId: string): Thought[] =>
  alive(s.thoughts).filter((t) => t.state === 'kept' && t.galaxyId === galaxyId && !t.goalId && !t.projectId).sort(questionsFirst);
export const openQuestions = (s: MindSnapshot): Thought[] =>
  alive(s.thoughts).filter((t) => t.isQuestion && !t.answer && t.state !== 'let-go');
export const journalFor = (s: MindSnapshot, ref: { goalId?: string; projectId?: string }): JournalEntry[] =>
  alive(s.journal).filter((e) => (ref.goalId && e.goalId === ref.goalId) || (ref.projectId && e.projectId === ref.projectId)).sort((a, b) => b.at - a.at);

export function progressOf(s: MindSnapshot, p: Project, now: number | Date = Date.now()): Progress {
  return projectProgress(p, stepsOf(s, p.id), now, thoughtsForProject(s, p.id).length);
}

/** When anything under a goal last moved: its projects, their steps, its thoughts, its journal. */
export function lastMoved(s: MindSnapshot, goalId: string): number {
  let t = alive(s.goals).find((g) => g.id === goalId)?.updatedAt ?? 0;
  const projects = projectsOf(s, goalId);
  for (const p of projects) {
    t = Math.max(t, p.updatedAt);
    for (const st of stepsOf(s, p.id)) t = Math.max(t, st.doneAt ?? 0, ...st.log.map((c) => c.at));
  }
  for (const th of thoughtsForGoal(s, goalId)) t = Math.max(t, th.createdAt);
  for (const e of journalFor(s, { goalId })) t = Math.max(t, e.at);
  return t;
}

/** 0..1: how lit a star is, from how recently its goal moved (two weeks to fade). */
export function brightness(s: MindSnapshot, goalId: string, now = Date.now()): number {
  const days = (now - lastMoved(s, goalId)) / 86_400_000;
  return Math.max(0.35, Math.min(1, 1 - days / 21));
}

/* ---------- suggested homes (on the device, no AI) ---------- */

const STOP = new Set('a an and are as at be but by can do for from have how i if in into is it its just like make maybe me more my no not of on or our should so some that the their them then there this to too up was what when which who why will with would you your about again also could get got want need'.split(' '));

export function words(text: string): string[] {
  return text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
}
/** A rough English stem, so play, plays and playing meet. */
function stem(w: string): string { return w.length > 4 ? w.replace(/(ingly|ings|ing|ers|er|es|ed|ly|s|e)$/u, '') : w; }

export interface Suggestion { kind: 'goal' | 'project'; id: string; title: string }

/** A likely home for a thought, by shared words. Ignored when nothing clearly matches. */
export function suggestHome(s: MindSnapshot, text: string): Suggestion | null {
  const mine = new Set(words(text));
  if (!mine.size) return null;
  let best: Suggestion | null = null, bestScore = 0;
  const consider = (kind: Suggestion['kind'], id: string, title: string, extra: string) => {
    const theirs = new Set(words(`${title} ${title} ${extra}`));
    let score = 0;
    for (const w of mine) if (theirs.has(w)) score += 1;
    if (kind === 'project') score += 0.1; // the narrower home wins a tie
    if (score > bestScore) { bestScore = score; best = { kind, id, title }; }
  };
  for (const g of alive(s.goals)) if (g.state === 'active') consider('goal', g.id, g.title, g.why);
  for (const p of alive(s.projects)) if (p.state === 'active' || p.state === 'idea') consider('project', p.id, p.title, p.summary);
  return bestScore >= 1 ? best : null;
}

/* ---------- search ---------- */

export interface SearchHit {
  kind: 'galaxy' | 'goal' | 'project' | 'step' | 'thought' | 'journal';
  id: string;
  title: string;
  context: string;
  href: string;
  score: number;
}

export function search(s: MindSnapshot, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  const galaxyName = new Map(alive(s.galaxies).map((g) => [g.id, g.name]));
  const goalTitle = new Map(alive(s.goals).map((g) => [g.id, g.title]));
  const project = new Map(alive(s.projects).map((p) => [p.id, p]));
  const score = (title: string, rest: string, tags: string[]): number => {
    const t = title.toLowerCase(), r = `${rest} ${tags.map((x) => `#${x}`).join(' ')}`.toLowerCase();
    let total = 0;
    for (const term of terms) {
      if (t.includes(term)) total += t.startsWith(term) ? 3 : 2;
      else if (r.includes(term)) total += 1;
      else return 0;
    }
    return total;
  };
  const add = (h: Omit<SearchHit, 'score'>, sc: number) => { if (sc > 0) hits.push({ ...h, score: sc }); };

  for (const g of alive(s.galaxies)) add({ kind: 'galaxy', id: g.id, title: g.name, context: 'Galaxy', href: `/?galaxy=${g.id}` }, score(g.name, '', g.tags));
  for (const g of alive(s.goals)) add({ kind: 'goal', id: g.id, title: g.title, context: `Goal · ${galaxyName.get(g.galaxyId) ?? ''}`, href: `/goal/${g.id}` }, score(g.title, g.why, g.tags));
  for (const p of alive(s.projects)) add({ kind: 'project', id: p.id, title: p.title, context: `Project · ${p.goalId ? goalTitle.get(p.goalId) ?? '' : galaxyName.get(p.galaxyId) ?? ''}`, href: `/project/${p.id}` }, score(p.title, p.summary, p.tags));
  for (const st of alive(s.steps)) {
    const p = project.get(st.projectId);
    if (p) add({ kind: 'step', id: st.id, title: st.text, context: `Step · ${p.title}`, href: `/project/${p.id}` }, score(st.text, st.waitingOn ?? '', st.tags));
  }
  for (const t of alive(s.thoughts)) {
    const where = t.state === 'let-go' ? 'Let go' : t.state === 'unsorted' ? 'Unsorted' : t.goalId ? goalTitle.get(t.goalId) ?? '' : t.projectId ? project.get(t.projectId)?.title ?? '' : galaxyName.get(t.galaxyId ?? '') ?? '';
    const href = t.state === 'unsorted' ? '/unsorted' : t.goalId ? `/goal/${t.goalId}` : t.projectId ? `/project/${t.projectId}` : `/thought/${t.id}`;
    add({ kind: 'thought', id: t.id, title: t.text, context: `${t.isQuestion ? 'Question' : 'Thought'} · ${where}`, href }, score(t.text, `${t.body ?? ''} ${t.answer ?? ''} ${t.url ?? ''}`, t.tags));
  }
  for (const e of alive(s.journal)) add({ kind: 'journal', id: e.id, title: e.title, context: `Journal · ${e.date}`, href: `/journal#${e.id}` }, score(e.title, e.body, e.tags));
  const kindRank: Record<SearchHit['kind'], number> = { goal: 0, thought: 1, project: 2, galaxy: 3, journal: 4, step: 5 };
  return hits.sort((a, b) => b.score - a.score || kindRank[a.kind] - kindRank[b.kind]).slice(0, 60);
}

function stateRank(g: Goal): number { return { active: 0, resting: 1, reached: 2, released: 3 }[g.state]; }
function projectRank(p: Project): number { return { active: 0, idea: 1, paused: 2, finished: 3, dropped: 4 }[p.state]; }
function questionsFirst(a: Thought, b: Thought): number {
  const qa = a.isQuestion && !a.answer ? 0 : 1, qb = b.isQuestion && !b.answer ? 0 : 1;
  return qa - qb || b.createdAt - a.createdAt;
}
