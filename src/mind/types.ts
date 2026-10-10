/**
 * The mind-first model (Phase 11).
 *
 * One museum holds any number of galaxies. Inside a galaxy, goals are stars,
 * projects are planets, and thoughts drift until they are given a home.
 * Steps live one level down, on project pages, and never appear in the sky.
 *
 * Nothing in this file touches IndexedDB. The switch-over from the old room
 * model happens in Phase 12, through `migrateToMind`.
 */
import type { Reflection, Scenario, ThreadKind } from '@/types';

export interface MindRecord {
  id: string;
  /** The museum (one per mind; the demo is its own museum). */
  museumId: string;
  createdAt: number;
  updatedAt: number;
  lastVisitedAt: number;
  /** The keeper's own words, never a preset list. */
  tags: string[];
  /** "Put it away until…": stays out of reminders until then. */
  restUntil?: number;
  /** A deletion marker, so a removal can travel between paired devices (Phase 17). */
  deletedAt?: number;
}

export type MindKind = 'demo' | 'own';

export interface Mind {
  id: string;
  name: string;
  kind: MindKind;
  visitorName?: string;
  createdAt: number;
  lastEnteredAt: number;
}

/** Galaxy colours come from the design system, never free hex values. */
export type GalaxyHue = 'gold' | 'verdigris' | 'copper' | 'steel' | 'parchment';
export const GALAXY_HUES: GalaxyHue[] = ['gold', 'verdigris', 'copper', 'steel', 'parchment'];

export interface Galaxy extends MindRecord {
  name: string;
  hue: GalaxyHue;
  order: number;
}

export type GoalHorizon = 'season' | 'year' | 'years' | 'lifetime';
export type GoalState = 'active' | 'resting' | 'reached' | 'released';

/** A direction. Years, not today. */
export interface Goal extends MindRecord {
  galaxyId: string;
  title: string;
  /** One line on why it matters. The page leads with it. */
  why: string;
  horizon: GoalHorizon;
  state: GoalState;
}

/**
 * How a project is finished, kept up, or explored. The first three came from
 * the owner's first examples; the rest were added at their request.
 */
export type ProjectShape =
  | { kind: 'list' }
  | { kind: 'number'; target: number; unit: string; start?: number }
  | { kind: 'habit'; perWeek: number }
  | { kind: 'date'; date: string }
  | { kind: 'levels'; levels: string[]; reached: number }
  | { kind: 'explore'; question: string; conclusion?: string };

export type ProjectShapeKind = ProjectShape['kind'];
export const PROJECT_SHAPES: ProjectShapeKind[] = ['list', 'number', 'habit', 'date', 'levels', 'explore'];

export type ProjectState = 'idea' | 'active' | 'paused' | 'finished' | 'dropped';

/** A planet: something you can finish or keep up, over weeks or months. */
export interface Project extends MindRecord {
  galaxyId: string;
  /** Its star. Null for a planet that has no goal yet. */
  goalId: string | null;
  /** Other goals it also serves (kept from the old model so nothing is lost). */
  alsoGoalIds: string[];
  title: string;
  summary: string;
  state: ProjectState;
  shape: ProjectShape;
  /** A hand-set 0..1, used only when the shape cannot work progress out by itself. */
  manualProgress?: number;
  sizeHours?: number;
}

/** Step kinds. Only `once`, and `repeat` or `session` when due, ever reach Today. */
export type StepKind = 'once' | 'repeat' | 'session' | 'waiting' | 'someday' | 'milestone';
export const STEP_KINDS: StepKind[] = ['once', 'repeat', 'session', 'waiting', 'someday', 'milestone'];

/** Weekdays use JavaScript numbering: 0 is Sunday. */
export type RepeatRule =
  | { every: 'day' }
  | { every: 'weekdays'; days: number[] }
  | { every: 'week'; day: number }
  | { every: 'n-days'; n: number }
  | { every: 'times-per-week'; times: number };

export interface Completion {
  at: number;
  /** For sessions: how much was done, in the step's unit. Defaults to 1. */
  amount?: number;
  /** A few words, such as which song was learned. */
  note?: string;
}

/** Something you can do in one sitting. */
export interface Step extends MindRecord {
  projectId: string;
  text: string;
  kind: StepKind;
  order: number;
  repeat?: RepeatRule;
  /** For sessions, such as "practise 20 minutes". */
  amount?: { per: number; unit: string };
  /** Who or what it is waiting on, in the keeper's words. */
  waitingOn?: string;
  /** Whether completions count towards a number or habit project. Defaults to true for repeat and session steps. */
  feeds?: boolean;
  /** For once and milestone steps. */
  doneAt?: number;
  /** For repeat and session steps. */
  log: Completion[];
}

export type ThoughtState = 'unsorted' | 'kept' | 'let-go';
/** Where a thought came from in the old model, kept so a round trip is lossless. */
export type ThoughtOrigin = 'thought' | 'note' | 'idea' | 'link';

/** The heart of the museum: ideas, questions, worries, links. */
export interface Thought extends MindRecord {
  /** Null while it drifts at the level of the whole mind. */
  galaxyId: string | null;
  text: string;
  body?: string;
  url?: string;
  origin: ThoughtOrigin;
  isQuestion: boolean;
  answer?: string;
  answeredAt?: number;
  state: ThoughtState;
  letGoAt?: number;
  goalId?: string;
  projectId?: string;
  /** Why it was linked, carried over from an old wall thread. */
  link?: { kind: ThreadKind; why?: string };
  /** Captured as a step with no project yet; it waits in Unsorted until it gets one. */
  intent?: 'step';
}

/** A line drawn between any two things that is not a thought finding its home. */
export interface Connection extends MindRecord {
  fromId: string;
  toId: string;
  kind: ThreadKind;
  why?: string;
}

/** What happened, and how it felt. Kept apart from goals. */
export interface JournalEntry extends MindRecord {
  galaxyId: string | null;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  at: number;
  title: string;
  body: string;
  goalId?: string;
  projectId?: string;
  archivedAt?: number;
}

/** A Sunday check-in, made on the device from the keeper's own records. */
export interface Review extends MindRecord {
  /** Monday of the reviewed week, YYYY-MM-DD. */
  weekStart: string;
  focusGoalIds: string[];
  line?: string;
  closedAt?: number;
}

/** Records from retired rooms, kept whole so a backup never loses anything. */
export interface LegacyRecord {
  id: string;
  museumId: string;
  type: 'scenario';
  data: Scenario;
}

export interface MindSnapshot {
  mind: Mind;
  galaxies: Galaxy[];
  goals: Goal[];
  projects: Project[];
  steps: Step[];
  thoughts: Thought[];
  connections: Connection[];
  journal: JournalEntry[];
  reviews: Review[];
  reflections: Reflection[];
  legacy: LegacyRecord[];
}

export type MindCollection = Exclude<keyof MindSnapshot, 'mind'>;
export const MIND_COLLECTIONS: MindCollection[] = ['galaxies', 'goals', 'projects', 'steps', 'thoughts', 'connections', 'journal', 'reviews', 'reflections', 'legacy'];

export const emptySnapshot = (mind: Mind): MindSnapshot => ({
  mind, galaxies: [], goals: [], projects: [], steps: [], thoughts: [], connections: [], journal: [], reviews: [], reflections: [], legacy: [],
});
