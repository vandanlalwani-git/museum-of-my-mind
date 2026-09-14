import type { Action, Goal, Link, Memory, Museum, MuseumRecords, Note, Project, Scenario, Thread } from '@/types';

/**
 * The demo museum belongs to Alex, a fictional person with a full-time job
 * who is making slow, real progress on four ordinary things: health, a side
 * project, creativity, and the people they love. Nothing here references a
 * real person.
 *
 * Timestamps are fixed relative to a base so the seed is stable across runs,
 * with enough age spread that the Workshop and the Cabinet have something
 * dusty to surface.
 */
export const DEMO_MUSEUM_ID = 'demo';

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 8, 1, 9, 0, 0); // 1 Sep 2026
const at = (daysBefore: number) => BASE - daysBefore * DAY;

const base = (id: string, created: number, updated = created, visited = updated, tags: string[] = []) => ({
  id,
  museumId: DEMO_MUSEUM_ID,
  createdAt: created,
  updatedAt: updated,
  lastVisitedAt: visited,
  tags,
});

export const demoMuseum: Museum = {
  id: DEMO_MUSEUM_ID,
  name: "Alex's Next Chapter",
  kind: 'demo',
  visitorName: 'Alex',
  createdAt: at(210),
  lastEnteredAt: at(2),
};

const goals: Goal[] = [
  {
    ...base('g-health', at(200), at(3), at(3), ['health']),
    title: 'Feel stronger and more energetic',
    why: 'I want to get through a workday without running on coffee, and keep up with my nephew at the park.',
    horizon: 'year',
    state: 'active',
  },
  {
    ...base('g-side-project', at(150), at(1), at(1), ['side-project']),
    title: 'Ship a small side project',
    why: 'One finished thing with my name on it that real people use, even if it is tiny.',
    horizon: 'year',
    state: 'active',
  },
  {
    ...base('g-creativity', at(190), at(40), at(40), ['creativity']),
    title: 'Make more time for creativity',
    why: 'I used to make things for no reason. I miss that.',
    horizon: 'decade',
    state: 'active',
  },
  {
    ...base('g-people', at(180), at(5), at(5), ['people']),
    title: 'Be more intentional with people',
    why: 'The people I love should not only hear from me when something goes wrong.',
    horizon: 'lifetime',
    state: 'active',
  },
];

const projects: Project[] = [
  // Health
  {
    ...base('p-5k', at(60), at(3), at(3), ['health', 'running']),
    title: 'Beginner 5K plan',
    summary: 'Three short runs a week for eight weeks. On week four now.',
    goalIds: ['g-health'],
    status: 'active',
    progress: 0.4,
  },
  {
    ...base('p-meal-prep', at(120), at(38), at(38), ['health', 'food']),
    title: 'Weekday meal prep',
    summary: 'Cook on Sunday so weekday lunches are already sorted.',
    goalIds: ['g-health'],
    status: 'paused',
    progress: 0.3,
  },
  {
    ...base('p-earlier-nights', at(45), at(45), at(45), ['health', 'sleep']),
    title: 'Earlier nights',
    summary: 'Screens off by ten. Just try it for two weeks.',
    goalIds: ['g-health'],
    status: 'idea',
    progress: 0,
  },
  // Side project
  {
    ...base('p-budget-app', at(140), at(1), at(1), ['side-project', 'code']),
    title: 'Budget app, first rough version',
    summary: 'A single page: add an expense, see the month total by category. No login.',
    goalIds: ['g-side-project'],
    status: 'active',
    progress: 0.55,
  },
  {
    ...base('p-user-notes', at(30), at(12), at(12), ['side-project', 'users']),
    title: 'Early user notes',
    summary: 'Ask three friends to try it and write down exactly what confuses them.',
    goalIds: ['g-side-project'],
    status: 'active',
    progress: 0.2,
  },
  {
    ...base('p-one-page-site', at(25), at(25), at(25), ['side-project']),
    title: 'A one-page website for it',
    summary: 'What it does, one screenshot, a link. Later.',
    goalIds: ['g-side-project'],
    status: 'idea',
    progress: 0,
  },
  // Creativity
  {
    ...base('p-photo-walks', at(130), at(64), at(64), ['creativity', 'photography']),
    title: 'Saturday photo walks',
    summary: 'One hour, one neighbourhood. The phone camera is fine.',
    goalIds: ['g-creativity'],
    status: 'paused',
    progress: 0.35,
  },
  {
    ...base('p-night-bus', at(50), at(9), at(9), ['creativity', 'writing']),
    title: 'Short story: the night bus',
    summary: 'The last bus home, told in ten stops.',
    goalIds: ['g-creativity'],
    status: 'active',
    progress: 0.15,
  },
  {
    ...base('p-podcast', at(170), at(150), at(150), ['creativity']),
    title: 'Start a podcast',
    summary: 'Recorded one episode and realised I would rather write.',
    goalIds: ['g-creativity'],
    status: 'abandoned',
    progress: 0.1,
  },
  // People
  {
    ...base('p-sunday-calls', at(100), at(5), at(5), ['people', 'family']),
    title: 'Sunday calls home',
    summary: 'Ring Mum and Dad every Sunday afternoon. Twenty minutes is enough.',
    goalIds: ['g-people'],
    status: 'active',
    progress: 0.6,
  },
  {
    ...base('p-host-dinner', at(90), at(47), at(47), ['people', 'friends', 'food']),
    title: 'Host a dinner for friends',
    summary: 'Six people, one big pot of something. Stop waiting for the flat to be perfect.',
    goalIds: ['g-people'],
    status: 'paused',
    progress: 0.25,
  },
  {
    ...base('p-birthdays', at(160), at(110), at(110), ['people']),
    title: 'Remember birthdays properly',
    summary: 'Every birthday in the calendar with a reminder a week before.',
    goalIds: ['g-people'],
    status: 'done',
    progress: 1,
  },
];

const actions: Action[] = [
  { ...base('a-1', at(6), at(3)), projectId: 'p-5k', text: 'Run 2 of week four: 20 minutes, easy pace' },
  { ...base('a-2', at(6), at(6)), projectId: 'p-5k', text: 'Book the parkrun on the 12th' },
  { ...base('a-3', at(55), at(50)), projectId: 'p-5k', text: 'Buy proper running shoes', doneAt: at(50) },
  { ...base('a-4', at(40), at(38)), projectId: 'p-meal-prep', text: 'Write a four-recipe rotation' },
  { ...base('a-5', at(4), at(1)), projectId: 'p-budget-app', text: 'Add the category dropdown' },
  { ...base('a-6', at(4), at(4)), projectId: 'p-budget-app', text: 'Show the month total at the top of the page' },
  { ...base('a-7', at(140), at(130)), projectId: 'p-budget-app', text: 'Set up the project with a blank page', doneAt: at(130) },
  { ...base('a-8', at(14), at(12)), projectId: 'p-user-notes', text: 'Ask Priya to try adding an expense on her phone' },
  { ...base('a-9', at(64), at(64)), projectId: 'p-photo-walks', text: 'Walk the canal path at golden hour' },
  { ...base('a-10', at(10), at(9)), projectId: 'p-night-bus', text: 'Write stop three' },
  { ...base('a-11', at(30), at(20)), projectId: 'p-night-bus', text: 'Write stops one and two', doneAt: at(20) },
  { ...base('a-12', at(7), at(5)), projectId: 'p-sunday-calls', text: 'Call this Sunday and ask about the garden' },
  { ...base('a-13', at(48), at(47)), projectId: 'p-host-dinner', text: 'Pick a date in the next month' },
  { ...base('a-14', at(48), at(47)), projectId: 'p-host-dinner', text: 'Text the group about dates' },
  { ...base('a-15', at(160), at(110)), projectId: 'p-birthdays', text: 'Add every birthday to the calendar', doneAt: at(110) },
];

const notes: Note[] = [
  {
    ...base('n-1', at(35), at(35), at(35), ['health', 'running']),
    title: 'Running feels bad for ten minutes, then fine',
    body: 'Every single time. The trick is to not decide anything until minute twelve.',
  },
  {
    ...base('n-2', at(20), at(20), at(20), ['side-project']),
    kind: 'idea',
    title: 'Colour the month total instead of drawing charts',
    body: 'Green if under the monthly limit, amber if within ten percent, red past it. No charts needed.',
  },
  {
    ...base('n-3', at(12), at(12), at(12), ['side-project', 'users']),
    title: 'What confused Sam',
    body: 'He never saw the add button on his phone. It is below the fold. Move it to the top.',
  },
  {
    ...base('n-4', at(52), at(52), at(52), ['creativity', 'writing']),
    kind: 'idea',
    title: 'Story idea: the night bus',
    body: 'Ten stops, ten passengers, one driver who knows all of them. Each stop is a chapter.',
  },
  {
    ...base('n-5', at(80), at(80), at(80), ['health', 'food']),
    title: 'Meal prep that actually worked',
    body: 'Chilli, rice, roasted veg. Four boxes. It was fine to eat the same thing twice.',
  },
  {
    ...base('n-6', at(30), at(30), at(30), ['people', 'family']),
    title: 'Why I keep skipping the calls',
    body: 'It is never the call. It is the twenty minutes before, deciding to. Set a reminder and just dial.',
  },
  {
    ...base('n-7', at(66), at(66), at(66), ['creativity', 'photography']),
    kind: 'idea',
    title: 'Photo walk theme: doors',
    body: 'Only photograph doors for a month. A constraint makes it easier to start.',
  },
  {
    ...base('n-8', at(9), at(9), at(9), ['health']),
    title: 'Energy log, week one',
    body: 'Better on days I walk at lunch. Worse after big lunches. Obvious, but now I have seen it.',
  },
];

const links: Link[] = [
  {
    ...base('l-1', at(60), at(60), at(60), ['health', 'running']),
    url: 'https://example.org/couch-to-5k',
    title: 'Couch to 5K plan',
    whySaved: 'The plan I am following. Week four is the one everyone quits.',
  },
  {
    ...base('l-2', at(118), at(118), at(118), ['health', 'food']),
    url: 'https://example.org/batch-cooking-for-beginners',
    title: 'Batch cooking for beginners',
    whySaved: 'Simple recipes that keep for five days.',
  },
  {
    ...base('l-3', at(28), at(28), at(28), ['side-project', 'users']),
    url: 'https://example.org/first-ten-users',
    title: 'How to get your first ten users',
    whySaved: 'Ask people you know, watch them use it, and do not explain.',
  },
  {
    ...base('l-4', at(95), at(95), at(95), ['creativity', 'photography']),
    url: 'https://example.org/one-lens-one-year',
    title: 'One lens, one year',
    whySaved: 'Constraints again. One lens for a year, better photos.',
  },
  {
    ...base('l-5', at(88), at(88), at(88), ['people', 'food']),
    url: 'https://example.org/hosting-without-stress',
    title: 'Hosting without stress',
    whySaved: 'One-pot dinners for six. Cook ahead, enjoy the evening.',
  },
];

const memories: Memory[] = [
  {
    ...base('m-1', at(20), at(20), at(20), ['health', 'running']),
    title: 'First run without stopping',
    body: 'Twenty minutes, slow, along the river. Nobody cheered. I did, quietly.',
    occurredAt: at(20),
    goalId: 'g-health',
  },
  {
    ...base('m-2', at(12), at(12), at(12), ['side-project']),
    title: 'Priya used the app and it did not crash',
    body: 'She added her coffee. It showed 3.20 in the total. Small, but it worked.',
    occurredAt: at(12),
    projectId: 'p-budget-app',
  },
  {
    ...base('m-3', at(6), at(6), at(6), ['people', 'family']),
    title: "Dad's story about the allotment",
    body: 'He told me the whole history of the shed on Sunday. I had never asked.',
    occurredAt: at(6),
    goalId: 'g-people',
  },
  {
    ...base('m-4', at(70), at(70), at(70), ['creativity', 'photography']),
    title: 'The canal at golden hour',
    body: 'Went out for one photo and stayed an hour. The light on the water did the work.',
    occurredAt: at(70),
    projectId: 'p-photo-walks',
  },
  {
    ...base('m-5', at(370), at(370), at(370), ['people', 'friends', 'food']),
    title: "Jo's birthday dinner",
    body: 'Cooked for eight. Burnt the bread. Nobody minded.',
    occurredAt: at(370),
    goalId: 'g-people',
  },
];

const threads: Thread[] = [
  { ...base('t-1', at(35)), fromId: 'n-1', toId: 'p-5k', kind: 'supports', why: 'The rule that keeps me running past minute ten.' },
  { ...base('t-2', at(60)), fromId: 'l-1', toId: 'p-5k', kind: 'supports', why: 'The plan itself.' },
  { ...base('t-3', at(12)), fromId: 'n-3', toId: 'p-budget-app', kind: 'supports', why: "Sam's confusion is the next fix." },
  { ...base('t-4', at(20)), fromId: 'n-2', toId: 'p-budget-app', kind: 'supports', why: 'Replaces the charts I was dreading.' },
  { ...base('t-5', at(52)), fromId: 'n-4', toId: 'p-night-bus', kind: 'supports', why: 'The whole shape of the story.' },
  { ...base('t-6', at(66)), fromId: 'n-7', toId: 'p-photo-walks', kind: 'supports', why: 'A theme makes it easier to leave the house.' },
  { ...base('t-7', at(30)), fromId: 'n-6', toId: 'p-sunday-calls', kind: 'supports', why: 'Set the reminder. Stop deciding.' },
  { ...base('t-8', at(88)), fromId: 'l-5', toId: 'p-host-dinner', kind: 'supports', why: 'One pot makes hosting possible.' },
  { ...base('t-9', at(80)), fromId: 'n-5', toId: 'p-meal-prep', kind: 'supports', why: 'Proof it works when I actually do it.' },
  { ...base('t-10', at(6)), fromId: 'm-3', toId: 'g-people', kind: 'reminds-me-of', why: 'This is what the calls are for.' },
  { ...base('t-11', at(25)), fromId: 'p-budget-app', toId: 'p-one-page-site', kind: 'blocks', why: 'No website before the app works.' },
  { ...base('t-12', at(28)), fromId: 'l-3', toId: 'p-user-notes', kind: 'supports', why: 'How to ask without leading them.' },
  { ...base('t-13', at(9)), fromId: 'n-8', toId: 'g-health', kind: 'supports', why: 'Lunchtime walks are the cheapest win.' },
];

const scenarios: Scenario[] = [
  {
    ...base('s-1', at(8), at(8), at(8)),
    name: 'Two evenings a week on the budget app',
    goalId: 'g-side-project',
    hoursPerWeek: 4,
    consistency: 0.7,
    focus: 0.85,
    rest: 0.6,
  },
  {
    ...base('s-2', at(8), at(8), at(8)),
    name: 'Everything at once, no rest',
    goalId: 'g-side-project',
    hoursPerWeek: 6,
    consistency: 0.5,
    focus: 0.1,
    rest: 0.25,
  },
];

export const demoRecords: MuseumRecords = { goals, projects, actions, notes, links, memories, threads, scenarios, reflections: [] };
