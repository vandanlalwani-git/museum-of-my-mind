import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, serializeBackup, type Backup } from '@/data/backup';
import { demoMuseum, demoRecords } from '@/data/seed/demo';
import { emptyRecords, type Museum, type MuseumRecords } from '@/types';
import { addDays, dayKey, daysBetween, startOfWeek } from './calendar';
import { describeRepeat, isDue, nextDue, reachesToday } from './recurrence';
import { projectProgress, recentPace, recentWeeks, whatIfDate } from './shapes';
import { HOLDER_TITLE, describeReport, migrateToMind } from './migrate';
import { makeMindBackup, parseAnyBackup, serializeMindBackup } from './backup';
import type { Project, Step } from './types';

const T0 = new Date(2026, 9, 1, 9, 0).getTime(); // Thursday 1 October 2026
const stamp = (id: string, museumId: string, at = T0) => ({ id, museumId, createdAt: at, updatedAt: at, lastVisitedAt: at, tags: [] as string[] });

function step(partial: Partial<Step> & Pick<Step, 'id' | 'kind'>): Step {
  return { ...stamp(partial.id, 'm'), projectId: 'p', text: partial.id, order: 0, log: [], ...partial };
}
function project(shape: Project['shape'], extra: Partial<Project> = {}): Project {
  return { ...stamp('p', 'm'), galaxyId: 'g', goalId: null, alsoGoalIds: [], title: 'P', summary: '', state: 'active', shape, ...extra };
}

describe('calendar', () => {
  it('starts weeks on Monday and counts whole days across clock changes', () => {
    const sunday = new Date(2026, 9, 11, 22, 0);
    expect(dayKey(startOfWeek(sunday))).toBe('2026-10-05');
    expect(dayKey(startOfWeek(new Date(2026, 9, 12, 0, 1)))).toBe('2026-10-12');
    expect(daysBetween(new Date(2026, 9, 24, 23), new Date(2026, 9, 26, 1))).toBe(2); // spans a European clock change
  });
});

describe('repeating steps', () => {
  const sunday = new Date(2026, 9, 11, 8);
  const monday = addDays(sunday, 1);

  it('a weekly Sunday step is due on Sunday only, and not once done that day', () => {
    const s = step({ id: 'song', kind: 'repeat', repeat: { every: 'week', day: 0 } });
    expect(isDue(s, sunday)).toBe(true);
    expect(isDue(s, monday)).toBe(false);
    const done = { ...s, log: [{ at: sunday.getTime() + 3600_000 }] };
    expect(isDue(done, sunday)).toBe(false);
    expect(dayKey(nextDue(done, sunday)!)).toBe('2026-10-18');
  });

  it('chosen weekdays, every n days, and n times a week', () => {
    const tueSat = step({ id: 'w', kind: 'repeat', repeat: { every: 'weekdays', days: [2, 6] } });
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => isDue(tueSat, addDays(monday, i)))).toEqual([false, true, false, false, false, true, false]);
    expect(describeRepeat(tueSat)).toBe('Tuesday and Saturday');

    const everyOther = step({ id: 'e', kind: 'repeat', repeat: { every: 'n-days', n: 2 }, createdAt: monday.getTime() });
    expect([0, 1, 2, 3].map((i) => isDue(everyOther, addDays(monday, i)))).toEqual([true, false, true, false]);

    const fourAWeek = step({ id: 'run', kind: 'repeat', repeat: { every: 'times-per-week', times: 4 } });
    const ran = { ...fourAWeek, log: [0, 1, 2, 3].map((i) => ({ at: addDays(monday, i).getTime() })) };
    expect(isDue(fourAWeek, addDays(monday, 4))).toBe(true);
    expect(isDue(ran, addDays(monday, 4))).toBe(false);
    expect(describeRepeat(fourAWeek)).toBe('4 times a week');
  });

  it('waiting, someday and milestone steps never reach Today; nothing becomes overdue', () => {
    for (const kind of ['waiting', 'someday', 'milestone'] as const) expect(reachesToday(step({ id: kind, kind }), sunday)).toBe(false);
    expect(reachesToday(step({ id: 'o', kind: 'once' }), sunday)).toBe(true);
    expect(reachesToday(step({ id: 'o', kind: 'once', doneAt: T0 }), sunday)).toBe(false);
    const missed = step({ id: 'm', kind: 'repeat', repeat: { every: 'week', day: 0 } });
    expect(reachesToday(missed, addDays(sunday, 3))).toBe(false); // a missed Sunday simply waits for the next one
  });
});

describe('project shapes', () => {
  const now = new Date(2026, 9, 10, 12);

  it('a list ignores someday steps and falls back to a hand-set progress', () => {
    const steps = [
      step({ id: 'walk', kind: 'once', doneAt: T0 }),
      step({ id: 'six', kind: 'once' }),
      step({ id: 'film', kind: 'someday' }),
    ];
    expect(projectProgress(project({ kind: 'list' }), steps, now)).toMatchObject({ done: 1, total: 2, fraction: 0.5, complete: false });
    expect(projectProgress(project({ kind: 'list' }, { manualProgress: 0.3 }), [], now).fraction).toBe(0.3);
  });

  it('a number counts its start plus every logged repeat, but not one-off chores', () => {
    const song = step({ id: 'song', kind: 'repeat', repeat: { every: 'week', day: 0 }, log: [{ at: T0 }, { at: T0 + 1 }] });
    const playlist = step({ id: 'playlist', kind: 'once', doneAt: T0 });
    const p = projectProgress(project({ kind: 'number', target: 50, unit: 'songs', start: 10 }), [song, playlist], now);
    expect(p).toMatchObject({ done: 12, total: 50, complete: false });
    expect(p.fraction).toBeCloseTo(0.24);
  });

  it('a habit counts this week only; levels and explore close on their own terms', () => {
    const monday = startOfWeek(now).getTime();
    const run = step({ id: 'run', kind: 'repeat', repeat: { every: 'times-per-week', times: 4 }, log: [{ at: monday }, { at: monday + 86_400_000 }, { at: monday - 86_400_000 }] });
    expect(projectProgress(project({ kind: 'habit', perWeek: 4 }), [run], now)).toMatchObject({ done: 2, total: 4, fraction: 0.5 });
    expect(recentWeeks([run], now, 2)).toEqual([1, 2]);
    expect(projectProgress(project({ kind: 'levels', levels: ['10 min', '20 min', '30 min'], reached: 1 }), [], now).fraction).toBeCloseTo(1 / 3);
    const explore = project({ kind: 'explore', question: 'Does product suit me?' });
    expect(projectProgress(explore, [], now, 4)).toMatchObject({ fraction: 0.4, complete: false, total: null });
    expect(projectProgress(explore, [], now, 40).fraction).toBe(0.85);
    expect(projectProgress(project({ kind: 'explore', question: 'q', conclusion: 'Yes, but slowly.' }), [], now).complete).toBe(true);
  });

  it('the pace what-if matches the fifty-songs example: 38 left from 11 October', () => {
    const from = new Date(2026, 9, 11);
    expect(dayKey(whatIfDate(38, 1, from)!)).toBe('2027-07-04');
    expect(dayKey(whatIfDate(38, 2, from)!)).toBe('2027-02-21');
    expect(whatIfDate(10, 0, from)).toBeNull();
    const weekly = step({ id: 'h', kind: 'repeat', log: [0, 1, 2, 3].map((i) => ({ at: addDays(from, -7 * i).getTime() })) });
    expect(recentPace([weekly], from)).toBeCloseTo(4 / 3, 1);
    expect(recentPace([], from)).toBeNull();
  });
});

/* ---------- migration ---------- */

function legacyFixture(): { museums: Museum[]; records: MuseumRecords } {
  const museums: Museum[] = [
    { id: 'm-life', name: 'Personal', kind: 'own', visitorName: 'Sam', createdAt: T0, lastEnteredAt: T0 + 50 },
    { id: 'm-work', name: 'Career', kind: 'own', createdAt: T0 + 10, lastEnteredAt: T0 + 90 },
    { id: 'demo', name: 'Demo', kind: 'demo', createdAt: T0, lastEnteredAt: T0 },
  ];
  const r = emptyRecords();
  r.goals.push(
    { ...stamp('g-guitar', 'm-life'), title: 'Learn the guitar', why: 'I feel like myself', horizon: 'decade', state: 'active' },
    { ...stamp('g-cook', 'm-life'), title: 'Cook well', why: '', horizon: 'year', state: 'dormant' },
    { ...stamp('g-move', 'm-work'), title: 'Next career move', why: '', horizon: 'season', state: 'fulfilled', restUntil: T0 + 5 },
    { ...stamp('g-demo', 'demo'), title: 'Demo goal', why: '', horizon: 'year', state: 'active' },
  );
  r.projects.push(
    { ...stamp('p-holder', 'm-life'), title: 'Cook well', summary: '', goalIds: ['g-cook'], status: 'active', progress: 0 },
    { ...stamp('p-chords', 'm-life'), title: 'Learn the basic chords', summary: 'Two chords', goalIds: ['g-guitar', 'g-cook'], status: 'done', progress: 0.5, sizeHours: 15 },
    { ...stamp('p-loose', 'm-work'), title: 'Tidy CV', summary: '', goalIds: [], status: 'abandoned', progress: 0 },
  );
  r.actions.push(
    { ...stamp('a-walk', 'm-life', T0 + 1), projectId: 'p-chords', text: 'Learn the G chord', doneAt: T0 + 2 },
    { ...stamp('a-six', 'm-life', T0 + 2), projectId: 'p-chords', text: 'Learn the six open chords' },
    { ...stamp('a-dal', 'm-life'), projectId: 'p-holder', text: 'Make dal' },
  );
  r.notes.push(
    { ...stamp('n-class', 'm-life'), title: 'Try a beginner class', body: 'Saturdays?', kind: 'idea', tags: ['guitar'] },
    { ...stamp('n-old', 'm-life'), title: 'Old worry', body: '', archivedAt: T0 + 3 },
    { ...stamp('n-pm', 'm-work'), title: 'Is a new role right for me', body: '' },
  );
  r.links.push({ ...stamp('l-pod', 'm-work'), url: 'https://example.com/pod', title: 'Career podcast', whySaved: 'For the commute' });
  r.memories.push({ ...stamp('mem-first', 'm-life'), title: 'First full song', body: 'Without looking at my hands', occurredAt: new Date(2026, 9, 4, 19).getTime(), goalId: 'g-guitar' });
  r.threads.push(
    { ...stamp('t-class', 'm-life', T0 + 1), fromId: 'n-class', toId: 'p-chords', kind: 'supports', why: 'Practice' },
    { ...stamp('t-class2', 'm-life', T0 + 2), fromId: 'g-guitar', toId: 'n-class', kind: 'reminds-me-of' },
    { ...stamp('t-goals', 'm-life'), fromId: 'g-guitar', toId: 'g-cook', kind: 'blocks' },
    { ...stamp('t-pod', 'm-work'), fromId: 'l-pod', toId: 'g-move', kind: 'inspired-by' },
    { ...stamp('t-lost', 'm-work'), fromId: 'n-pm', toId: 'gone', kind: 'supports' },
  );
  r.scenarios.push({ ...stamp('s-1', 'm-life'), name: 'Five hours', goalId: 'g-guitar', hoursPerWeek: 5, consistency: 0.8, focus: 0.5, rest: 0.5 });
  r.reflections.push({ ...stamp('r-1', 'm-work'), mode: 'connect', model: 'm', itemIds: [], themes: ['change'], reflection: 'text', reasoning: 'why', accepted: { tags: 0, threads: 0, projects: 0, actions: 0 } });
  return { museums, records: r };
}

let idCounter = 0;
const opts = { now: T0 + 1000, newId: () => `mind-${++idCounter}` };

describe('migrating the old rooms into one mind', () => {
  it('turns every own museum into a galaxy and leaves the demo out', () => {
    const { snapshot, report } = migrateToMind(legacyFixture(), opts);
    expect(snapshot).not.toBeNull();
    const s = snapshot!;
    expect(s.mind).toMatchObject({ name: 'My Mind', kind: 'own', visitorName: 'Sam', createdAt: T0, lastEnteredAt: T0 + 90 });
    expect(s.galaxies.map((g) => [g.id, g.name, g.hue, g.order])).toEqual([['m-life', 'Personal', 'gold', 0], ['m-work', 'Career', 'verdigris', 1]]);
    expect(report.demoRecordsSkipped).toBe(1);
    for (const c of ['galaxies', 'goals', 'projects', 'steps', 'thoughts', 'connections', 'journal', 'reviews', 'reflections', 'legacy'] as const) {
      for (const rec of s[c]) expect(rec.museumId).toBe(s.mind.id);
    }
  });

  it('accounts for every old record exactly once, keeping ids', () => {
    const data = legacyFixture();
    const { snapshot } = migrateToMind(data, opts);
    const s = snapshot!;
    const own = (xs: { id: string; museumId: string }[]) => xs.filter((x) => x.museumId !== 'demo').map((x) => x.id).sort();
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();
    expect(ids(s.goals)).toEqual(own(data.records.goals));
    expect(ids(s.projects)).toEqual(own(data.records.projects));
    expect(ids(s.steps)).toEqual(own(data.records.actions));
    expect(ids(s.thoughts)).toEqual([...own(data.records.notes), ...own(data.records.links)].sort());
    expect(ids(s.journal)).toEqual(own(data.records.memories));
    expect(ids(s.legacy)).toEqual(own(data.records.scenarios));
    expect(ids(s.reflections)).toEqual(own(data.records.reflections));
    // A thread either became a thought's home or stayed a connection; none vanished.
    const homed = s.thoughts.filter((t) => t.link).length;
    expect(homed + s.connections.length).toBe(own(data.records.threads).length);
  });

  it('maps states, horizons, holders, steps, thoughts and memories faithfully', () => {
    const { snapshot, report } = migrateToMind(legacyFixture(), opts);
    const s = snapshot!;
    const goal = (id: string) => s.goals.find((g) => g.id === id)!;
    expect([goal('g-guitar').horizon, goal('g-guitar').state]).toEqual(['years', 'active']);
    expect(goal('g-cook').state).toBe('resting');
    expect(goal('g-move')).toMatchObject({ state: 'reached', restUntil: T0 + 5, galaxyId: 'm-work' });

    const proj = (id: string) => s.projects.find((p) => p.id === id)!;
    expect(proj('p-holder')).toMatchObject({ title: HOLDER_TITLE, goalId: 'g-cook' });
    expect(report.holdersRenamed).toBe(1);
    expect(proj('p-chords')).toMatchObject({ goalId: 'g-guitar', alsoGoalIds: ['g-cook'], state: 'finished', manualProgress: 0.5, sizeHours: 15, shape: { kind: 'list' } });
    expect(proj('p-loose')).toMatchObject({ goalId: null, state: 'dropped' });

    const chordSteps = s.steps.filter((x) => x.projectId === 'p-chords');
    expect(chordSteps.map((x) => [x.text, x.order, x.kind, x.doneAt])).toEqual([['Learn the G chord', 0, 'once', T0 + 2], ['Learn the six open chords', 1, 'once', undefined]]);

    const th = (id: string) => s.thoughts.find((t) => t.id === id)!;
    expect(th('n-class')).toMatchObject({ text: 'Try a beginner class', body: 'Saturdays?', origin: 'idea', state: 'kept', projectId: 'p-chords', link: { kind: 'supports', why: 'Practice' }, tags: ['guitar'] });
    expect(th('n-class').goalId).toBeUndefined(); // its second thread stays a connection
    expect(th('n-old')).toMatchObject({ state: 'let-go', letGoAt: T0 + 3 });
    expect(th('n-pm')).toMatchObject({ state: 'unsorted', isQuestion: false });
    expect(th('l-pod')).toMatchObject({ url: 'https://example.com/pod', body: 'For the commute', origin: 'link', goalId: 'g-move', state: 'kept' });
    expect(report.danglingReferences).toEqual(['thread t-lost → gone']);

    expect(s.journal[0]).toMatchObject({ date: '2026-10-04', title: 'First full song', goalId: 'g-guitar', galaxyId: 'm-life' });
    expect(s.legacy[0]).toMatchObject({ type: 'scenario', data: { name: 'Five hours' } });
    expect(describeReport(report).join(' ')).toContain('now visible as "First steps"');
  });

  it('migrates the whole demo seed cleanly, as a stand-in for a real museum', () => {
    const { snapshot, report } = migrateToMind({ museums: [{ ...demoMuseum, kind: 'own' }], records: demoRecords }, opts);
    expect(report.danglingReferences).toEqual([]);
    expect(snapshot!.goals).toHaveLength(demoRecords.goals.length);
    expect(snapshot!.steps).toHaveLength(demoRecords.actions.length);
    expect(snapshot!.thoughts).toHaveLength(demoRecords.notes.length + demoRecords.links.length);
    expect(snapshot!.thoughts.filter((t) => t.link).length + snapshot!.connections.length).toBe(demoRecords.threads.length);
  });

  it('returns no mind when there is nothing of the keeper’s own', () => {
    const { snapshot, report } = migrateToMind({ museums: [demoMuseum], records: demoRecords }, opts);
    expect(snapshot).toBeNull();
    expect(report.demoRecordsSkipped).toBeGreaterThan(0);
  });
});

describe('backup version 4', () => {
  it('round-trips a mind losslessly', () => {
    const { snapshot } = migrateToMind(legacyFixture(), opts);
    const backup = makeMindBackup([snapshot!], T0);
    const parsed = parseAnyBackup(serializeMindBackup(backup));
    expect(parsed.kind).toBe('mind');
    expect(parsed.backup).toEqual(backup);
    expect(parsed.warnings).toEqual([]);
  });

  it('imports an old version 3 backup by migrating it on the way in', () => {
    const old: Backup = { format: BACKUP_FORMAT, schemaVersion: 3, exportedAt: 'x', ...legacyFixture() };
    const parsed = parseAnyBackup(serializeBackup(old), opts);
    expect(parsed.kind).toBe('legacy');
    expect(parsed.backup.minds).toHaveLength(1);
    expect(parsed.backup.minds[0]!.galaxies).toHaveLength(2);
    if (parsed.kind === 'legacy') expect(parsed.report.goals).toBe(3);
    expect(parsed.warnings).toHaveLength(1);
  });

  it('refuses files it cannot trust', () => {
    const { snapshot } = migrateToMind(legacyFixture(), opts);
    const good = makeMindBackup([snapshot!], T0);
    expect(() => parseAnyBackup('not json')).toThrow('not valid JSON');
    expect(() => parseAnyBackup(JSON.stringify({ ...good, schemaVersion: 5 }))).toThrow('newer version');
    expect(() => parseAnyBackup(JSON.stringify({ ...good, apiKey: 'x' }))).toThrow('Unexpected field "apiKey"');
    const stray = { ...good, minds: [{ ...snapshot!, goals: [{ ...snapshot!.goals[0]!, museumId: 'elsewhere' }] }] };
    expect(() => parseAnyBackup(JSON.stringify(stray))).toThrow('belongs to a museum not in this backup');
    const loose = { ...good, minds: [{ ...snapshot!, steps: [{ ...snapshot!.steps[0]!, projectId: 'gone' }] }] };
    expect(parseAnyBackup(JSON.stringify(loose)).warnings).toEqual([`Kept a link to something missing: step ${snapshot!.steps[0]!.id} → project gone`]);
  });
});
