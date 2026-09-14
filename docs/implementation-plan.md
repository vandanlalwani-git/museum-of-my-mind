# Implementation Plan

Each phase ends with a runnable app. Phases are ordered so the durable core (data, shell, entrance) exists before any room that depends on it.

## Phase 0 — Foundations (this session)

- [x] Docs: product brief, design system, architecture, CLAUDE.md, this plan.
- [x] Vite + React + TS scaffold, strict TS, path alias `@/`.
- [x] Design tokens, base styles, motion tokens, reduced-motion handling.
- [x] IndexedDB schema v1 via `idb`; repositories for all seven record types plus museums and meta.
- [x] Zustand stores: museum (hydrate, active museum, CRUD), ui (quiet messages), settings.
- [x] Fictional demo seed (Ilse Marrow) with stable ids and timestamps.
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

## Phase 2 — Archive

- Note, link, and thread editors. Simple markdown rendering.
- d3-force map with seeded layout; pan/zoom; thread-following focus mode.
- Search (client-side, title + body + tags).

## Phase 3 — Workshop

- Projects as artifacts on benches; dust derived from `lastVisitedAt`.
- "Pick up" interaction: marks visited, shows next actions, lets you complete one.
- R3F artifacts behind WebGL check.

## Phase 4 — Backup, settings, PWA polish

- Export/import UI with merge/replace; round-trip test.
- Custom install prompt; update prompt.
- Reset demo; delete own museum (with confirmation).

## Phase 5 — Future Gallery

- Deterministic simulator: sliders for hours/week, focus, and a "what if I dropped X" toggle; renders a rearranged constellation and workshop and shows the deltas. Copy states plainly it is a model, not a prediction.

## Phase 6 — Cabinet of Curiosities

- Ranks by staleness + serendipity (seeded daily shuffle); one drawer at a time; "keep", "revisit", "let it go".

## Phase 7 — Polish and ship

- Sound toggle with two sounds.
- Lighthouse pass, bundle audit, a11y sweep.
- Cloudflare Pages deploy (only after approval).

## Decisions needed from the owner

See the session summary. Notable: font licensing/self-hosting choice, whether the demo museum and own museum can co-exist (planned: yes), and whether the Future Gallery may reference dates.
