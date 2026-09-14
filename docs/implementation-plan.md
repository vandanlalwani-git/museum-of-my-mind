# Implementation Plan

Each phase ends with a runnable app. Phases are ordered so the durable core (data, shell, entrance) exists before any room that depends on it.

## Phase 0 — Foundations (this session)

- [x] Docs: product brief, design system, architecture, CLAUDE.md, this plan.
- [x] Vite + React + TS scaffold, strict TS, path alias `@/`.
- [x] Design tokens, base styles, motion tokens, reduced-motion handling.
- [x] IndexedDB schema v1 via `idb`; repositories for all seven record types plus museums and meta.
- [x] Zustand stores: museum (hydrate, active museum, CRUD), ui (quiet messages), settings.
- [x] Fictional demo seed with stable ids and timestamps (Ilse Marrow originally; replaced by "Alex's Next Chapter" in Phase 2.5).
- [x] App shell: top bar, compass, room transition, quiet-message region, error boundary, offline-safe fonts.
- [x] Entrance: first-visit arrival, two doorways (Enter the demo / Build your own), returning-visitor greeting, museum switcher.
- [x] Placeholder room routes (lazy) so the compass works end to end.
- [x] PWA manifest + service worker + `_redirects` + `_headers` (no deploy).
- [x] Vitest: repository CRUD and hydrate smoke tests.

## Phase 1 — Observatory (done 2026-09-14)

- [x] Goal, project, and next-action editors: create, edit, rest/wake, fulfil, release, revisit, finish, set aside, complete, undo, let go.
- [x] 2D constellation renderer on canvas: goals as glowing stars, projects in tilted orbits, next actions as gold companions, the goal's next action pulsing. Deterministic layout from ids (`layout.ts`, tested).
- [x] Panel: sky index (in the sky / beneath the horizon / adrift) and goal detail with projects and actions.
- [x] Empty museum: an invitation and a three-line guide instead of a blank state.
- [x] Keyboard navigation across goals on the canvas; the panel is the accessible list equivalent; list-only fallback if the canvas cannot draw.
- [x] Responsive: sky above, panel below on narrow screens; compass scrolls in one row.
- [x] Phase 1.5 (done 2026-09-14): React Three Fiber dome behind the 2D canvas. Lazy chunk (~240KB gzipped) loaded only when the Observatory opens and only when WebGL is available, motion is not reduced, the device is not low-powered, and the session has not fallen back. The 2D canvas stays the complete fallback and keeps drawing labels, lines, click targets, and the accessible alternative. A performance guard drops the dome for the session if frames stay slow.

## Phase 2 — Archive (done 2026-09-14)

- [x] Capture in one line: thought, idea, link, or memory. Enter keeps it; the first line becomes the title.
- [x] Item panel: full content, tags, edit (per kind), put away / bring back, let go (with inline confirm), and threads with the keeper's own "why".
- [x] Threads between any two things, including goals and projects in the Observatory, in either direction, with a typed relation.
- [x] The wall: seeded d3-force SVG map of items, tag hubs, and threads. Goals and projects appear only when a thread reaches them. Pan, zoom, hover to light neighbours, keyboard-focusable nodes, search dims non-matches.
- [x] Index with search across titles, bodies, addresses, and tags; tag filters; put-away section.
- [x] Empty state invitation and three-line guide. No inferred connections anywhere; nothing links unless the keeper tags or threads it.
- [x] Demo seed versioning: the fictional museum refreshes itself when its content changes (`DEMO_SEED_VERSION`).
- [ ] Not built, by decision: AI interpretation of notes.

## Phase 2.5 — Relatable demo collection (done 2026-09-14)

- [x] Demo replaced with "Alex's Next Chapter": four everyday goals (health, a side project, creativity, people), twelve projects across every state, fifteen actions, eight notes and ideas, five links, five memories, thirteen threads with reasons. Short, plain language throughout.
- [x] `DEMO_SEED_VERSION` bumped so returning visitors get the new demo; own museums untouched. Entrance, settings, docs, and tests updated.

## Phase 3 — Workshop (done 2026-09-14)

- [x] Projects as artifacts: a progress dial, a plaque, a lamp when in motion, dust proportional to days untouched, a cloth when set aside, a seal when finished. Each shows what it is, which goal it serves, state, progress, last touch, and the smallest next step.
- [x] Shelves by state (on the bench, in motion, resting, ideas, finished, set aside) and a "worth picking up" table chosen by stated rules with reasons (`pickup.ts`, tested).
- [x] Full lifecycle: start, edit (title, summary, state, progress, goals served, tags), rest, resume, finish, set aside, revisit, let go (with inline confirm; removes steps and threads). Steps: add, complete, undo, let go.
- [x] One shared operations module (`store/ops.ts`) and shared `ActionList` / `ProjectEditor` components now serve the Observatory and Workshop, so no data is forked. Deep links: `/observatory?goal=`, `/archive?item=`, `/workshop?project=`.
- [x] Empty bench invitation for a new personal museum. No 3D here: the 2D artifacts are fast and legible on phones.

## Phase 4 — Future Gallery (done 2026-09-14)

- [x] Four dials (hours a week, consistency, focus, rest and recovery) over a chosen goal's unfinished projects. Deterministic model in `model.ts` with every assumption stated and readable in the room (tested: monotonic, clamped, consistency brightens, scattering trades speed for breadth, thin rest fades).
- [x] Twelve-month timeline as an instrument face: goal brightness at 3, 6, 12 months; a rising track per project; "could finish" milestones; waiting projects dashed. Accessible text alternative.
- [x] Calm plain-language reading of each scenario; "waiting is not failing"; copy says it is a way of looking, not a forecast.
- [x] Kept what-ifs: a new `scenarios` store (IndexedDB v2 migration, backup schema 2, version 1 files still import). Keep, load, edit, save changes, let go. Two demo scenarios for Alex.
- [x] Empty states: no goals (invitation to the Observatory); a goal with nothing unfinished (invitation to the Workshop).
- [ ] Settings polish from the old plan (delete own museum, update prompt control) rolls into Phase 7.

## Phase 5 — Cabinet of Curiosities

- Ranks by staleness + serendipity (seeded daily shuffle); one drawer at a time; "keep", "revisit", "let it go".

## Phase 7 — Polish and ship

- Sound toggle with two sounds.
- Lighthouse pass, bundle audit, a11y sweep.
- Cloudflare Pages deploy (only after approval).

## Decisions needed from the owner

See the session summary. Notable: font licensing/self-hosting choice, whether the demo museum and own museum can co-exist (planned: yes), and whether the Future Gallery may reference dates.
