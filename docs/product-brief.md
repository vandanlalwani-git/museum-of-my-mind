# The Museum of My Mind — Product Brief

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

The demo belongs to a fictional visitor, **Ilse Marrow**, a lighthouse-keeper turned amateur astronomer who is restoring a tide-clock, learning to cast bronze, writing a field guide to fog, and trying to visit every lighthouse on a stretch of coast. Her museum is warm, specific, and slightly melancholy. It is fiction; nothing in it references a real person.

The demo is loaded into a separate, clearly labelled museum so the visitor can switch to their own without losing either.

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
