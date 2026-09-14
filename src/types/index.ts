export type MuseumKind = 'demo' | 'own';

export interface Museum {
  id: string;
  name: string;
  kind: MuseumKind;
  visitorName?: string;
  createdAt: number;
  lastEnteredAt: number;
}

export interface BaseRecord {
  id: string;
  museumId: string;
  createdAt: number;
  updatedAt: number;
  lastVisitedAt: number;
  tags: string[];
  /** Set by the Cabinet's "put it away": stays out of the drawers until then. */
  restUntil?: number;
}

export type Horizon = 'season' | 'year' | 'decade' | 'lifetime';
export type GoalState = 'active' | 'dormant' | 'fulfilled' | 'released';

export interface Goal extends BaseRecord {
  title: string;
  why: string;
  horizon: Horizon;
  state: GoalState;
}

export type ProjectStatus = 'idea' | 'active' | 'paused' | 'done' | 'abandoned';

export interface Project extends BaseRecord {
  title: string;
  summary: string;
  goalIds: string[];
  status: ProjectStatus;
  progress: number; // 0..1
  /** A rough size in focused hours (15 small, 40 medium, 100 large), if the keeper has set one. */
  sizeHours?: number;
}

export interface Action extends BaseRecord {
  projectId: string;
  text: string;
  doneAt?: number;
}

export type NoteKind = 'note' | 'idea';

export interface Note extends BaseRecord {
  title: string;
  body: string;
  /** Defaults to 'note' when absent. */
  kind?: NoteKind;
  /** Set when the keeper puts it away. Archived items leave the map but stay searchable. */
  archivedAt?: number;
}

export interface Link extends BaseRecord {
  url: string;
  title: string;
  whySaved: string;
  archivedAt?: number;
}

export interface Memory extends BaseRecord {
  title: string;
  body: string;
  occurredAt: number;
  goalId?: string;
  projectId?: string;
  archivedAt?: number;
}

export type ThreadKind = 'supports' | 'inspired-by' | 'blocks' | 'reminds-me-of';

export interface Thread extends BaseRecord {
  fromId: string;
  toId: string;
  kind: ThreadKind;
  /** The keeper's own words for why these two belong together. */
  why?: string;
}

export const THREAD_KINDS: ThreadKind[] = ['supports', 'inspired-by', 'blocks', 'reminds-me-of'];
export const THREAD_LABEL: Record<ThreadKind, string> = {
  'supports': 'supports',
  'inspired-by': 'was inspired by',
  'blocks': 'blocks',
  'reminds-me-of': 'reminds me of',
};

/** A saved "what if?" from the Future Gallery. A reflection, never a forecast. */
export interface Scenario extends BaseRecord {
  name: string;
  goalId: string;
  hoursPerWeek: number; // 0..20
  consistency: number;  // 0..1, share of weeks the hours actually happen
  focus: number;        // 0..1, 1 = one main project, 0 = everything at once
  rest: number;         // 0..1, how much recovery is protected
  /** Typical project size assumed by this what-if, in focused hours. Defaults to 40. */
  projectHours?: number;
}

/** A kept result from "Ask my AI": only what the keeper accepted, plus the reflection text. Free to read forever. */
export interface Reflection extends BaseRecord {
  mode: string;
  model: string;
  itemIds: string[];
  themes: string[];
  reflection: string;
  reasoning: string;
  accepted: { tags: number; threads: number; projects: number; actions: number };
}

export type RecordType = 'goals' | 'projects' | 'actions' | 'notes' | 'links' | 'memories' | 'threads' | 'scenarios' | 'reflections';

export interface RecordMap {
  goals: Goal;
  projects: Project;
  actions: Action;
  notes: Note;
  links: Link;
  memories: Memory;
  threads: Thread;
  scenarios: Scenario;
  reflections: Reflection;
}

export const RECORD_TYPES: RecordType[] = ['goals', 'projects', 'actions', 'notes', 'links', 'memories', 'threads', 'scenarios', 'reflections'];

export interface MuseumRecords {
  goals: Goal[];
  projects: Project[];
  actions: Action[];
  notes: Note[];
  links: Link[];
  memories: Memory[];
  threads: Thread[];
  scenarios: Scenario[];
  reflections: Reflection[];
}

export const emptyRecords = (): MuseumRecords => ({
  goals: [], projects: [], actions: [], notes: [], links: [], memories: [], threads: [], scenarios: [], reflections: [],
});

export interface Settings {
  soundEnabled: boolean;
  reduceMotion: 'system' | 'on' | 'off';
  /** "Ask my AI" is off unless the keeper turns it on. Off means no code path ever calls the relay. */
  aiEnabled: boolean;
}

export const defaultSettings: Settings = { soundEnabled: false, reduceMotion: 'system', aiEnabled: false };

export type RoomId = 'entrance' | 'observatory' | 'archive' | 'workshop' | 'future' | 'cabinet';

export interface RoomMeta {
  id: RoomId;
  name: string;
  path: string;
  plaque: string;
}

export const ROOMS: RoomMeta[] = [
  { id: 'observatory', name: 'Observatory', path: '/observatory', plaque: 'Goals as constellations' },
  { id: 'archive', name: 'Archive', path: '/archive', plaque: 'Notes, ideas, and links' },
  { id: 'workshop', name: 'Workshop', path: '/workshop', plaque: 'Unfinished things' },
  { id: 'future', name: 'Future Gallery', path: '/future', plaque: 'A model, not a prophecy' },
  { id: 'cabinet', name: 'Cabinet of Curiosities', path: '/cabinet', plaque: 'What you forgot' },
];
