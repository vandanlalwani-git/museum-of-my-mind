import type { Action, Goal, Link, Memory, Museum, MuseumRecords, Note, Project, Thread } from '@/types';

/**
 * The demo museum belongs to Ilse Marrow, a fictional lighthouse-keeper
 * turned amateur astronomer. Nothing here references a real person.
 *
 * Timestamps are fixed relative to a base so the seed is stable across runs,
 * and old enough that the Cabinet of Curiosities has something to surface.
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
  name: 'The Marrow Collection',
  kind: 'demo',
  visitorName: 'Ilse Marrow',
  createdAt: at(400),
  lastEnteredAt: at(3),
};

const goals: Goal[] = [
  {
    ...base('g-tide-clock', at(380), at(6), at(6), ['restoration', 'brass']),
    title: 'Make the tide-clock run again',
    why: 'It stopped the winter my grandmother left the light. I want to hear it tick in this house before the next one.',
    horizon: 'year',
    state: 'active',
  },
  {
    ...base('g-fog-guide', at(300), at(20), at(20), ['writing', 'weather']),
    title: 'Write a field guide to fog',
    why: 'Nobody has named the fogs of this coast. I have watched them for eleven years and can tell nine apart.',
    horizon: 'decade',
    state: 'active',
  },
  {
    ...base('g-lighthouses', at(360), at(90), at(90), ['travel', 'coast']),
    title: 'Stand in every lighthouse from Skerrin to Cape Ard',
    why: 'Twenty-three lights. I have stood in nine. It is a way of saying thank you.',
    horizon: 'lifetime',
    state: 'active',
  },
  {
    ...base('g-bronze', at(200), at(150), at(150), ['craft', 'metal']),
    title: 'Learn to cast bronze',
    why: 'The clock needs a new escapement wheel and no one alive makes them.',
    horizon: 'year',
    state: 'dormant',
  },
  {
    ...base('g-sky', at(390), at(2), at(2), ['astronomy']),
    title: 'Know the winter sky without a chart',
    why: 'The light is automated now. Someone should still be looking up.',
    horizon: 'season',
    state: 'active',
  },
];

const projects: Project[] = [
  {
    ...base('p-escapement', at(180), at(6), at(6), ['brass', 'clock']),
    title: 'Escapement wheel, cast and cut',
    summary: 'Model the wheel in wax, cast it, cut sixty teeth. The old wheel has forty-one left.',
    goalIds: ['g-tide-clock', 'g-bronze'],
    status: 'active',
    progress: 0.35,
  },
  {
    ...base('p-clock-case', at(370), at(210), at(210), ['wood', 'clock']),
    title: 'Refinish the clock case',
    summary: 'Strip the salt varnish, re-glue the split, oil the oak. Two weekends if the weather holds.',
    goalIds: ['g-tide-clock'],
    status: 'paused',
    progress: 0.6,
  },
  {
    ...base('p-fog-taxonomy', at(280), at(20), at(20), ['writing']),
    title: 'Name the nine fogs',
    summary: 'A page per fog: where it forms, what it smells like, what the birds do.',
    goalIds: ['g-fog-guide'],
    status: 'active',
    progress: 0.55,
  },
  {
    ...base('p-fog-photos', at(250), at(120), at(120), ['photography']),
    title: 'Photograph each fog at first light',
    summary: 'The plate camera, not the phone. Fog does not photograph honestly on a phone.',
    goalIds: ['g-fog-guide'],
    status: 'paused',
    progress: 0.2,
  },
  {
    ...base('p-northern-lights', at(340), at(90), at(90), ['travel']),
    title: 'The northern five, by bicycle',
    summary: 'Skerrin, Halden, Wrack Point, Cullen, and the Needle. Four days, one tent.',
    goalIds: ['g-lighthouses'],
    status: 'idea',
    progress: 0,
  },
  {
    ...base('p-crucible', at(200), at(150), at(150), ['metal']),
    title: 'Build a small crucible furnace',
    summary: 'Propane, firebrick, a graphite crucible. The shed roof needs a vent first.',
    goalIds: ['g-bronze'],
    status: 'paused',
    progress: 0.4,
  },
  {
    ...base('p-orion-drill', at(60), at(2), at(2), ['astronomy']),
    title: 'Winter constellation drill',
    summary: 'Ten minutes every clear night. Orion, Taurus, Gemini, Auriga, Canis Major. Then the faint ones.',
    goalIds: ['g-sky'],
    status: 'active',
    progress: 0.7,
  },
  {
    ...base('p-birdcount', at(330), at(300), at(300), ['birds']),
    title: 'Fulmar count from the gallery',
    summary: 'Started it, kept it for a month, stopped when the wind came. The notebook is on the sill.',
    goalIds: [],
    status: 'abandoned',
    progress: 0.15,
  },
];

const actions: Action[] = [
  { ...base('a-1', at(10), at(6)), projectId: 'p-escapement', text: 'Carve the wax master for the wheel' },
  { ...base('a-2', at(10), at(6)), projectId: 'p-escapement', text: 'Order two kilos of silicon bronze ingot' },
  { ...base('a-3', at(30), at(6)), projectId: 'p-escapement', text: 'Measure the old wheel with the vernier', doneAt: at(8) },
  { ...base('a-4', at(210), at(210)), projectId: 'p-clock-case', text: 'Buy oak-coloured hide glue' },
  { ...base('a-5', at(25), at(20)), projectId: 'p-fog-taxonomy', text: 'Write the page on the "harbour breath" fog' },
  { ...base('a-6', at(25), at(20)), projectId: 'p-fog-taxonomy', text: 'Ask Tomas about the fog the trawlers call "the wool"' },
  { ...base('a-7', at(120), at(120)), projectId: 'p-fog-photos', text: 'Reload the plate holders' },
  { ...base('a-8', at(90), at(90)), projectId: 'p-northern-lights', text: 'Check the ferry timetable to Skerrin' },
  { ...base('a-9', at(150), at(150)), projectId: 'p-crucible', text: 'Cut the vent hole in the shed roof' },
  { ...base('a-10', at(5), at(2)), projectId: 'p-orion-drill', text: 'Find Auriga without the chart three nights running' },
];

const notes: Note[] = [
  {
    ...base('n-1', at(300), at(300), at(300), ['fog']),
    title: 'The wool',
    body: 'Trawlermen call the thick white one "the wool". It comes in from the south-west on a falling tide and sits on the water like something asleep. Gulls go quiet. It smells faintly of iron.',
  },
  {
    ...base('n-2', at(250), at(250), at(250), ['clock', 'family']),
    title: 'What the tide-clock actually measures',
    body: 'It does not measure the tide. It measures the moon, and assumes the tide follows. A tide-clock is a promise the moon keeps most days.',
  },
  {
    ...base('n-3', at(45), at(45), at(45), ['astronomy']),
    title: 'Averted vision',
    body: 'You see faint stars by not looking at them. The edge of the eye is more sensitive than the centre. This is also true of ideas.',
  },
  {
    ...base('n-4', at(170), at(170), at(170), ['bronze']),
    title: 'Casting notes from the foundry visit',
    body: 'Pour at 1,050 degrees. Too hot and the wax pattern burns in the investment and you get pits. Ivo said: "Bronze remembers every hesitation."',
  },
  {
    ...base('n-5', at(15), at(15), at(15), ['writing']),
    title: 'Structure for the guide',
    body: 'Not by season. By where it comes from: sea fogs, valley fogs, the two that come from nowhere. Each with a name, a smell, a sound, and what the birds do.',
  },
  {
    ...base('n-6', at(320), at(320), at(320), ['family']),
    title: 'The keeper\'s log, 1961',
    body: 'Found grandmother\'s log in the lamp-room chest. She wrote the fog every morning in one word. "Wool." "Breath." "Nothing." I have been using her words without knowing.',
  },
];

const links: Link[] = [
  {
    ...base('l-1', at(180), at(180), at(180), ['bronze']),
    url: 'https://example.org/lost-wax-casting-primer',
    title: 'Lost-wax casting, a primer',
    whySaved: 'The clearest diagram of sprue placement I have found.',
  },
  {
    ...base('l-2', at(60), at(60), at(60), ['astronomy']),
    url: 'https://example.org/winter-sky-guide',
    title: 'A walking guide to the winter sky',
    whySaved: 'Teaches star-hopping from Orion\'s belt. Good drills.',
  },
  {
    ...base('l-3', at(290), at(290), at(290), ['fog', 'weather']),
    url: 'https://example.org/advection-fog',
    title: 'Advection fog and sea-surface temperature',
    whySaved: 'Explains why "the wool" only comes on a falling tide.',
  },
  {
    ...base('l-4', at(340), at(340), at(340), ['lighthouses']),
    url: 'https://example.org/northern-lights-register',
    title: 'Register of lights, northern section',
    whySaved: 'Which ones still allow visitors up the tower.',
  },
];

const memories: Memory[] = [
  {
    ...base('m-1', at(395), at(395), at(395), ['family', 'clock']),
    title: 'The night it stopped',
    body: 'February. She wound it as she always did and it ran for an hour and stopped at twenty past three. She said "well, then," and went to bed.',
    occurredAt: at(2200),
    goalId: 'g-tide-clock',
  },
  {
    ...base('m-2', at(88), at(88), at(88), ['lighthouses']),
    title: 'Ninth light, Cullen',
    body: 'Climbed it in rain. The keeper\'s wife gave me tea in a mug that said WORLD\'S OKAYEST DAD. The lens was the size of a small car.',
    occurredAt: at(92),
    goalId: 'g-lighthouses',
  },
  {
    ...base('m-3', at(170), at(170), at(170), ['bronze']),
    title: 'First pour at Ivo\'s foundry',
    body: 'The bronze went in like honey and the whole shed smelled of burnt sugar. I made a very ugly spoon. I have never been prouder of anything.',
    occurredAt: at(172),
    projectId: 'p-crucible',
  },
  {
    ...base('m-4', at(44), at(44), at(44), ['astronomy']),
    title: 'Auriga, unaided',
    body: 'Found Capella first, then the kids. Stood there in the cold for a long time not needing the chart.',
    occurredAt: at(44),
    goalId: 'g-sky',
  },
];

const threads: Thread[] = [
  { ...base('t-1', at(170)), fromId: 'n-4', toId: 'p-escapement', kind: 'supports' },
  { ...base('t-2', at(300)), fromId: 'n-1', toId: 'p-fog-taxonomy', kind: 'supports' },
  { ...base('t-3', at(290)), fromId: 'l-3', toId: 'n-1', kind: 'supports' },
  { ...base('t-4', at(320)), fromId: 'n-6', toId: 'g-fog-guide', kind: 'inspired-by' },
  { ...base('t-5', at(45)), fromId: 'n-3', toId: 'n-5', kind: 'reminds-me-of' },
  { ...base('t-6', at(150)), fromId: 'p-crucible', toId: 'p-escapement', kind: 'blocks' },
  { ...base('t-7', at(60)), fromId: 'l-2', toId: 'p-orion-drill', kind: 'supports' },
  { ...base('t-8', at(250)), fromId: 'n-2', toId: 'g-tide-clock', kind: 'reminds-me-of' },
];

export const demoRecords: MuseumRecords = { goals, projects, actions, notes, links, memories, threads };
