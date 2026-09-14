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

export type RecordType = 'goals' | 'projects' | 'actions' | 'notes' | 'links' | 'memories' | 'threads';

export interface RecordMap {
  goals: Goal;
  projects: Project;
  actions: Action;
  notes: Note;
  links: Link;
  memories: Memory;
  threads: Thread;
}

export const RECORD_TYPES: RecordType[] = ['goals', 'projects', 'actions', 'notes', 'links', 'memories', 'threads'];

export interface MuseumRecords {
  goals: Goal[];
  projects: Project[];
  actions: Action[];
  notes: Note[];
  links: Link[];
  memories: Memory[];
  threads: Thread[];
}

export const emptyRecords = (): MuseumRecords => ({
  goals: [], projects: [], actions: [], notes: [], links: [], memories: [], threads: [],
});

export interface Settings {
  soundEnabled: boolean;
  reduceMotion: 'system' | 'on' | 'off';
}

export const defaultSettings: Settings = { soundEnabled: false, reduceMotion: 'system' };

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
