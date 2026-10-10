/**
 * Alex's Next Chapter: the fictional demo museum, in the mind-first model.
 *
 * Alex has a full-time job and is making gradual progress on health, a side
 * project, creativity, and people. Everyday language only, no specialist
 * crafts, no real people. Dates are relative to the moment of seeding so the
 * demo always feels current. Bump DEMO_SEED_VERSION whenever this changes.
 */
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { addDays, dayKey, startOfDay, startOfWeek } from './calendar';
import { clearMind, mindRepo, writeSnapshot } from './repo';
import {
  emptySnapshot, type Completion, type Galaxy, type Goal, type JournalEntry, type Mind, type MindSnapshot,
  type Project, type ProjectShape, type RepeatRule, type Review, type Step, type StepKind, type Thought,
} from './types';

export const DEMO_MIND_ID = 'demo';
export const DEMO_SEED_VERSION = 5;
/** The demo re-seeds itself when it is older than this, so its dates never drift into the past. */
const DEMO_MAX_AGE_DAYS = 14;

export function buildDemoSnapshot(now = Date.now()): MindSnapshot {
  const today = startOfDay(now);
  const at = (daysAgo: number, hour = 19): number => { const d = addDays(today, -daysAgo); d.setHours(hour, 0, 0, 0); return d.getTime(); };
  const M = DEMO_MIND_ID;
  const base = (id: string, daysAgo: number, tags: string[] = []) => ({ id, museumId: M, createdAt: at(daysAgo, 9), updatedAt: at(Math.max(0, daysAgo - 2)), lastVisitedAt: at(Math.max(0, daysAgo - 2)), tags });

  const mind: Mind = { id: M, name: "Alex's Next Chapter", kind: 'demo', visitorName: 'Alex', createdAt: at(60), lastEnteredAt: now };
  const s = emptySnapshot(mind);

  const galaxy = (id: string, name: string, hue: Galaxy['hue'], order: number): Galaxy => ({ ...base(id, 60), name, hue, order });
  s.galaxies.push(
    galaxy('d-gx-health', 'Health', 'verdigris', 0),
    galaxy('d-gx-app', 'Side project', 'gold', 1),
    galaxy('d-gx-make', 'Creativity', 'steel', 2),
    galaxy('d-gx-people', 'People', 'copper', 3),
  );

  const goal = (id: string, galaxyId: string, title: string, why: string, horizon: Goal['horizon'], daysAgo: number): Goal =>
    ({ ...base(id, daysAgo), galaxyId, title, why, horizon, state: 'active' });
  s.goals.push(
    goal('d-g-strong', 'd-gx-health', 'Feel strong and rested', 'I want energy left over after work.', 'year', 55),
    goal('d-g-app', 'd-gx-app', 'Ship my budget app', 'I want to make something people actually use.', 'year', 50),
    goal('d-g-make', 'd-gx-make', 'Make things again', 'I used to draw every day, and I miss it.', 'years', 45),
    goal('d-g-people', 'd-gx-people', 'Be closer to the people I love', 'Time with them is the part I remember.', 'lifetime', 40),
  );

  const project = (id: string, goalId: string, galaxyId: string, title: string, shape: ProjectShape, daysAgo: number, summary = ''): Project =>
    ({ ...base(id, daysAgo), galaxyId, goalId, alsoGoalIds: [], title, summary, state: 'active', shape });
  const launch = dayKey(addDays(today, 33));
  s.projects.push(
    project('d-p-5k', 'd-g-strong', 'd-gx-health', 'Run a 5K', { kind: 'levels', levels: ['Run 1K without stopping', 'Run 3K', 'Run 5K'], reached: 1 }, 50, 'Slowly, three runs a week.'),
    project('d-p-prep', 'd-g-strong', 'd-gx-health', 'Weekday lunches', { kind: 'habit', perWeek: 1 }, 40, 'Cook on Sunday so weekdays are easy.'),
    project('d-p-v1', 'd-g-app', 'd-gx-app', 'First public version', { kind: 'list' }, 48),
    project('d-p-users', 'd-g-app', 'd-gx-app', 'Ten people try it', { kind: 'number', target: 10, unit: 'people', start: 3 }, 30),
    project('d-p-launch', 'd-g-app', 'd-gx-app', 'Launch day', { kind: 'date', date: launch }, 20),
    project('d-p-photos', 'd-g-make', 'd-gx-make', 'Saturday photo walks', { kind: 'habit', perWeek: 1 }, 44),
    project('d-p-stories', 'd-g-make', 'd-gx-make', 'What would I like to write?', { kind: 'explore', question: 'What kind of stories do I want to write?' }, 25),
    project('d-p-calls', 'd-g-people', 'd-gx-people', 'Call home on Sundays', { kind: 'habit', perWeek: 1 }, 40),
    project('d-p-dinners', 'd-g-people', 'd-gx-people', 'Host twelve dinners this year', { kind: 'number', target: 12, unit: 'dinners' }, 38),
  );

  const step = (id: string, projectId: string, text: string, kind: StepKind, order: number, extra: Partial<Step> = {}): Step =>
    ({ ...base(id, 30), projectId, text, kind, order, log: [], ...extra });
  const weekly = (weeksBack: number, weekday: number, hour = 10): Completion[] => {
    const out: Completion[] = [];
    for (let w = weeksBack; w >= 0; w--) {
      const d = addDays(startOfWeek(now), -7 * w + ((weekday + 6) % 7));
      d.setHours(hour, 0, 0, 0);
      if (d.getTime() < now) out.push({ at: d.getTime() });
    }
    return out;
  };
  const rule = (r: RepeatRule) => ({ repeat: r });
  const runs: Completion[] = [12, 10, 8, 5, 3, 1].map((d) => ({ at: at(d, 7), amount: 1 }));
  s.steps.push(
    step('d-s-run', 'd-p-5k', 'Go for a run', 'repeat', 0, { ...rule({ every: 'times-per-week', times: 3 }), log: runs }),
    step('d-s-shoes', 'd-p-5k', 'Buy proper running shoes', 'once', 1, { doneAt: at(28) }),
    step('d-s-prep', 'd-p-prep', 'Cook lunches for the week', 'repeat', 0, { ...rule({ every: 'week', day: 0 }), log: weekly(3, 0, 17).slice(0, -1) }),
    step('d-s-sketch', 'd-p-v1', 'Sketch the main screen', 'once', 0, { doneAt: at(40) }),
    step('d-s-signup', 'd-p-v1', 'Write the sign-up page', 'once', 1, { doneAt: at(9) }),
    step('d-s-round', 'd-p-v1', 'Fix the rounding bug', 'once', 2),
    step('d-s-sam', 'd-p-v1', 'Hear back from Sam about the beta', 'waiting', 3, { waitingOn: 'Sam' }),
    step('d-s-dark', 'd-p-v1', 'Dark mode', 'someday', 4),
    step('d-s-invite', 'd-p-users', 'Invite one person to try it', 'session', 0, { log: [{ at: at(6), note: 'A friend from work' }] }),
    step('d-s-post', 'd-p-launch', 'Write the launch post', 'once', 0),
    step('d-s-page', 'd-p-launch', 'Make a simple landing page', 'once', 1),
    step('d-s-walk', 'd-p-photos', 'Go on a photo walk', 'repeat', 0, { ...rule({ every: 'week', day: 6 }), log: weekly(4, 6, 11).filter((_, i) => i !== 2) }),
    step('d-s-read', 'd-p-stories', 'Read three short stories I love', 'once', 0, { doneAt: at(12) }),
    step('d-s-call', 'd-p-calls', 'Call home', 'repeat', 0, { ...rule({ every: 'week', day: 0 }), log: weekly(4, 0, 18).filter((_, i) => i % 2 === 0) }),
    step('d-s-dinner', 'd-p-dinners', 'Host a dinner', 'session', 0, { log: [35, 24, 13].map((d) => ({ at: at(d, 20) })) }),
  );

  const thought = (id: string, text: string, galaxyId: string | null, daysAgo: number, extra: Partial<Thought> = {}): Thought =>
    ({ ...base(id, daysAgo), galaxyId, text, origin: 'thought', isQuestion: false, state: 'kept', ...extra });
  s.thoughts.push(
    thought('d-t-gym', 'Is the gym worth it, or is running enough?', 'd-gx-health', 9, { isQuestion: true, goalId: 'd-g-strong' }),
    thought('d-t-sleep', 'Sleeping before midnight makes the next day so much easier', 'd-gx-health', 15, { goalId: 'd-g-strong' }),
    thought('d-t-free', 'Should the app be free?', 'd-gx-app', 4, { isQuestion: true, goalId: 'd-g-app' }),
    thought('d-t-email', 'A weekly email that shows where the money went', 'd-gx-app', 7, { projectId: 'd-p-v1' }),
    thought('d-t-bus', 'The night bus at 11pm would make a good opening scene', 'd-gx-make', 11, { projectId: 'd-p-stories' }),
    thought('d-t-funny', 'I like stories that are funny and a bit sad', 'd-gx-make', 8, { projectId: 'd-p-stories' }),
    thought('d-t-short', 'Maybe very short pieces first, one page each', 'd-gx-make', 3, { projectId: 'd-p-stories' }),
    thought('d-t-sister', 'Plan a weekend away with my sister', 'd-gx-people', 5, { state: 'unsorted' }),
    thought('d-t-phone', 'Look into a cheaper phone plan', null, 2, { state: 'unsorted' }),
    thought('d-t-habits', 'An article on simple budgets', 'd-gx-app', 6, { state: 'unsorted', origin: 'link', url: 'https://example.com/simple-budgets', body: 'Could shape the first screen' }),
    thought('d-t-tired', 'Am I doing too much at once?', null, 1, { state: 'unsorted', isQuestion: true }),
    thought('d-t-class', 'Try a pottery evening class', 'd-gx-make', 20, { state: 'let-go', letGoAt: at(14) }),
  );

  const entry = (id: string, daysAgo: number, title: string, body: string, links: Partial<JournalEntry> = {}): JournalEntry =>
    ({ ...base(id, daysAgo), galaxyId: null, date: dayKey(at(daysAgo)), at: at(daysAgo, 21), title, body, ...links });
  s.journal.push(
    entry('d-j-1k', 33, 'Ran 1K without stopping', 'First time ever. Slow, but I did not stop.', { goalId: 'd-g-strong', galaxyId: 'd-gx-health' }),
    entry('d-j-bug', 9, 'Showed the app to a friend', 'They found a bug in two minutes. Annoying, and useful.', { projectId: 'd-p-v1', galaxyId: 'd-gx-app' }),
    entry('d-j-canal', 6, 'Photo walk by the canal', 'Low light, lovely colours. Two photos I actually like.', { projectId: 'd-p-photos', galaxyId: 'd-gx-make' }),
    entry('d-j-dinner', 13, 'Dinner with old friends', 'Stayed too late. Worth it.', { goalId: 'd-g-people', galaxyId: 'd-gx-people' }),
    entry('d-j-tired', 2, 'A tired week', 'Did nothing extra, and that was fine.'),
  );

  const lastWeek = dayKey(addDays(startOfWeek(now), -7));
  const review: Review = { ...base('d-r-last', 8), weekStart: lastWeek, focusGoalIds: ['d-g-app', 'd-g-strong'], line: 'Slow week, but the app moved.', closedAt: at(8, 20) };
  s.reviews.push(review);
  return s;
}

/** Seeds or refreshes the demo. Own museums are never touched. Returns true if anything was written. */
export async function ensureDemoMind(now = Date.now()): Promise<boolean> {
  const seeded = await metaRepo.get<{ version: number; at: number }>(META_KEYS.demoMindVersion);
  const existing = await mindRepo.get(DEMO_MIND_ID);
  const fresh = seeded && seeded.version >= DEMO_SEED_VERSION && now - seeded.at < DEMO_MAX_AGE_DAYS * 86_400_000;
  if (existing && fresh) return false;
  await resetDemoMind(now);
  return true;
}

export async function resetDemoMind(now = Date.now()): Promise<void> {
  await clearMind(DEMO_MIND_ID);
  await writeSnapshot(buildDemoSnapshot(now));
  await metaRepo.set(META_KEYS.demoMindVersion, { version: DEMO_SEED_VERSION, at: now });
}
