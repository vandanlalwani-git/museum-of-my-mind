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

## Phase 5 — Cabinet of Curiosities (done 2026-09-14)

- [x] One drawer at a time, with two more waiting below and arrow keys between them. Chosen by stated rules in `rules.ts` (tested for determinism, daily variety, exclusions): not opened in a while, tied to a goal in the sky, old and unfinished, shares a tag with something touched this week, a memory from around this date. Every drawer says why it opened.
- [x] Actions that do what they say and nothing else: open it, still interesting (counts as opened), make it a project (with a thread back), add as a next step to an active project, set a resting project in motion, put it away for 60 days (`restUntil`), archive it or set it aside, show something else (session only).
- [x] Quiet empty states for a new museum and for a fully seen day. Demo drawers come from Alex's older material.

## Phase 6 — Final polish and settings (done 2026-09-14)

- [x] Sound: two procedural Web Audio sounds (a hinge on room change, a small bell when something is kept). Never before a user gesture, only with the toggle on, silent under reduced motion.
- [x] Typography steps down one size below 400px.
- [x] Workshop cards show the single strongest reason; all reasons stay in the panel.
- [x] Archive wall switches to lit-only labels past 60 visible items.
- [x] Settings: "About this museum" plaque (counts, last touched, last backup), demo-only "Reload the demo collection", guarded deletion of a personal museum (type its name; export offered first; the demo can never be deleted).
- [x] Threads can be re-tied in place (relation and reason) in the Archive and the Workshop.
- [x] Future Gallery: a typical project size dial (small, medium, large) plus a per-project rough size set in the Workshop; the reading names every sized project and calls the sizes guesses.
- [x] Accessibility sweep by DOM audit in every room (every control named, every field labelled, canvases and maps described). **Lighthouse could not run**: no Chromium-based browser is installed on this Mac and no software was installed to provide one.

## Phase 7 — Optional "Ask my AI" (bring your own Claude key)

See docs/architecture.md, "Ask my AI".

## Phase 8 — Production readiness and free deployment

See docs/deploy.md.

## Decisions needed from the owner

See the session summary. Notable: font licensing/self-hosting choice, whether the demo museum and own museum can co-exist (planned: yes), and whether the Future Gallery may reference dates.

## Phase 9 — Daily-use simplification (done 2026-09-23)

- [x] **Today** is the new home (`/`), answering four questions and nothing else: what matters most (one goal, switchable), the next small thing (one step: done, not today, or choose another), one frictionless capture field with a single optional follow-up, and one forgotten thing with a one-line reason (still matters, make it a step, hide, or show another). Selection rules live in `rooms/today/selection.ts` and are tested.
- [x] Adding a first step never requires learning what a project is: if the focus goal has none, a holder project is created quietly behind the interface. The data model is unchanged; only the vocabulary is.
- [x] Navigation is **Today, Library, Settings**, with Explore one quiet step away. The entrance moved to `/welcome` and is now only the museum chooser.
- [x] **Library** (`/library`): one searchable list of goals, projects, notes, links, and memories, with inline creation of a goal or project. Rows open the room that knows the item best.
- [x] **Explore** (`/explore`): Observatory, the wall, Workshop, Future Gallery, and the Cabinet, all intact, plus Ask my AI shown as off and unobtrusive. The Observatory is also linked from Today as "See the bigger picture".
- [x] **Mobile zoom crash fixed.** `lib/surface.ts` gives every canvas an absolute pixel budget, divides pinch zoom out of the device ratio, coalesces resize bursts into one frame, and skips reallocation when the buffer would not change. Verified on the Observatory: a simulated 3x pinch produces an identical buffer and 40 rapid resizes cause zero reallocations.
- [x] The home route no longer pulls in the heavy rooms, so the first-load bundle fell from 133KB to 118KB gzipped.
- Nothing was deleted: every room, record type, and feature from Phases 0 through 8 still exists behind the simpler surface.
