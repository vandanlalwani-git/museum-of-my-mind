# The Museum of My Mind — Product Brief

## Mind first (direction from Phase 10 onwards, approved 2026-10-10)

**This is a museum for one person's mind.** It is a place to see, sort and walk through thoughts, ideas, goals, plans and ambitions, especially when life feels crowded or confusing. Goals give thoughts direction. Tasks and tracking are a useful extra, kept in a quiet room at the back, and must never take over. If a screen starts to feel like a to-do app, it is wrong.

The owner's test: someone in a transitional, confusing period should come away calmer and clearer, never more confused, never pressured.

### The model

- **Galaxies:** areas of life, as many as the keeper wants (Personal, Career, Family, Creativity…). All of them live in one museum.
- **Goals (stars):** directions measured in years, each with a one-line reason why it matters.
- **Projects (planets):** something you can finish, keep up, or explore. A project has one of six shapes:
  - a list to finish
  - a number to reach
  - a habit to keep
  - getting ready for a day
  - a climb in levels
  - a question to explore
- **Steps:** something you can do in one sitting. A step is one of six kinds:
  - one-off
  - repeating
  - a session with an amount
  - waiting on someone
  - someday
  - a milestone
- **Thoughts:** ideas, questions, worries and links. They wait in Unsorted until given a home. Thoughts linked to a goal circle it as moons. An open question flickers until it is answered.
- **Journal:** what happened and how it felt, kept apart from goals, with "On this day".
- **Weekly review:** a Sunday check-in made on the device with no AI. It shows what moved and what went quiet, and you choose one or two goals to focus on next week.

### Mind-first rules

1. Thoughts are the most visible things in the museum. Steps are the least visible, and never appear in the sky.
2. Progress is shown as light, not numbers, until you open a project.
3. A goal's page leads with why it matters, then the thoughts around it, then its projects.
4. Today stays small: a thought first, then at most two focus goals with one step each.
5. There are no streaks, red counts, badges, notifications, or "overdue". Words such as task, to-do, deadline and productivity never appear on screen.
6. Capturing never asks for a decision. Everything can wait in Unsorted.
7. "Clear my mind" lets the keeper pour out many thoughts at once and sort them later.

### Places

The dock holds **Sky · Today · Capture · Journal · Search**, with Settings behind a gear. The Sky is the visual home (see `design-system.md`, "The sky and its plates"). The Workshop, Future Gallery, Cabinet, the Archive wall and the Library are retired in Phase 16. Their useful parts move to goal and project pages, Today, the Journal and the weekly review.

### Demo

The demo becomes a guided tour you scroll through once, using the fictional Alex's museum. Once the keeper has a museum of their own, the tour moves to Settings.

The sections below describe the original room model. It stays live until the new shell replaces it in Phase 12, and its code is retired in Phase 16.


## One line

A local-first, game-like digital museum for one person's goals, ideas, notes, links, projects, and memories. It should feel like walking through a private observatory at night, not like opening a SaaS dashboard.

## Who it is for

One person. There are no accounts, teams, or sharing features. The museum lives in the visitor's own browser and belongs to them completely.

## Why it exists

Most personal knowledge tools optimise for capture and retrieval. They are efficient and forgettable. This product optimises for *relationship*: the visitor should want to return, wander, and rediscover what they once cared about. The metaphor of a museum does real work here. Rooms give ideas a place. Artifacts give unfinished projects weight. Constellations make goals feel like something you navigate by rather than a checklist you fail.

## Product promises (non-negotiable)

1. **Local-first.** All data lives in IndexedDB in the visitor's browser. No hosted database, no login, no subscriptions, no analytics, no telemetry.
2. **Durable.** Works after refresh, after a browser restart, and offline after the first load.
3. **Portable.** Import and export a complete backup as a single JSON file at any time.
4. **Deployable anywhere static.** Ships as a static site (Cloudflare Pages target). No server-side code.
5. **Installable.** A real PWA install experience with an offline service worker.
6. **Safe.** No API keys ever live in client-side code. Any future AI-assisted feature must go through an optional, user-supplied key stored locally or through a separate worker the user deploys themselves.
7. **Compelling with no personal data.** A seeded, fictional demo museum lets a first-time visitor experience every room immediately.

## The rooms

| Room | Purpose | The feeling |
|---|---|---|
| **Entrance** | Choose the demo museum or begin building your own. Returning visitors are greeted and let straight in. | Arrival. A door opening. |
| **Observatory** | Goals rendered as constellations. Projects orbit their goal. Next actions are the nearest, brightest points. | Navigating by stars. |
| **Archive** | A connected map of notes, ideas, and links. Follow threads between them. | A reading room with strings on the wall. |
| **Workshop** | Unfinished projects as physical artifacts on benches. Dust settles on what has been neglected. | Half-built things you can pick up again. |
| **Future Gallery** | A deterministic "what if?" simulator. Change an assumption, watch the museum's future rearrange. It is a thinking tool, not a prediction engine, and says so. | A model of a city under glass. |
| **Cabinet of Curiosities** | Rediscover forgotten items. Surfaces what has not been touched in a long time, in a way that feels like a gift rather than a nag. | Opening a drawer you forgot you had. |

## Core objects

- **Goal** — a direction. Has a title, a why, a horizon (season, year, decade, lifetime), and a state.
- **Project** — a bounded effort that serves zero or more goals. Has progress, status, and last-touched date.
- **Action** — a next physical step attached to a project.
- **Note** — a thought, a quote, a fragment. Can link to anything.
- **Link** — a URL with a title, a why-saved note, and tags.
- **Memory** — a dated moment, optionally attached to a goal or project.
- **Thread** — a typed relationship between any two objects (supports, inspired-by, blocks, reminds-me-of).

Everything carries `createdAt`, `updatedAt`, `lastVisitedAt`, and tags. The Cabinet of Curiosities and Workshop dust both derive from `lastVisitedAt`.

## Demo museum

The demo belongs to **Alex**, a fictional person with a full-time job who is making gradual, real progress on four ordinary things: feeling stronger and more energetic (a beginner 5K plan, weekday meal prep), shipping a small side project (a personal budget app, early user notes), making more time for creativity (photo walks, a short story), and being more intentional with people (Sunday calls home, hosting friends). The material is warm and specific but written in short, everyday language so a first-time visitor understands what every item means within seconds. It is fiction; nothing in it references a real person.

The demo is loaded into a separate, clearly labelled museum so the visitor can switch to their own without losing either. When the demo content changes, `DEMO_SEED_VERSION` is bumped and returning visitors get the refreshed demo; personal museums are never touched.

## Out of scope for v1

- Multi-user, sync, or cloud backup
- Mobile-native apps (the PWA must, however, be usable on a phone)
- Any prediction, scoring, or "AI insight" feature that claims to know the future
- Rich text editing beyond simple markdown

## Success criteria

- A first-time visitor understands the concept in under thirty seconds without reading instructions.
- The demo museum makes at least one person say "I want mine to look like this."
- A returning visitor can find something they forgot within one minute in the Cabinet.
- Lighthouse performance and accessibility scores of 90+ on the entrance and every room.
- Full backup export and re-import round-trips with zero loss.
