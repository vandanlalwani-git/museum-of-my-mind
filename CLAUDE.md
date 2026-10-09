# The Museum of My Mind — permanent rules

Read `docs/product-brief.md`, `docs/design-system.md`, and `docs/architecture.md` before making product or visual decisions. These rules are permanent and override convenience.

## What this is

A polished, portfolio-quality, local-first, game-like digital museum for one person's goals, ideas, notes, links, projects, and memories. It must feel cinematic, quietly magical, and deeply personal. It is not a SaaS dashboard.

**Mind first, never a task tracker.** The museum exists to see, sort and walk through thoughts, ideas, goals and ambitions. Tracking is a quiet extra and must never dominate. Follow the mind-first rules in `docs/product-brief.md`:
- Thoughts are the most visible things; steps never appear in the sky.
- Progress shows as light, not numbers.
- Goal pages lead with why it matters.
- Today stays small.
- No streaks, red counts, badges, notifications or "overdue".
- Never use the words task, to-do, deadline or productivity on screen.

## Visual direction (never dilute)

- Dark academic observatory: obsidian, deep navy, old gold, parchment, muted green. Tokens live in `src/styles/tokens.css`; never hard-code colours in components.
- Precise typography, spatial depth, beautiful motion. Subtle sound is optional and off by default.
- No generic dashboard cards. No stock imagery. No unnecessary gradients. No "AI app" clichés (sparkles, neon, glass blur cards, rainbow gradients).
- The redesigned museum stands on one living 3D sky (galaxies, goal stars, project planets, drifting thoughts). Pages are 2D plates held in front of it; see "The sky and its plates" in `docs/design-system.md`. Text and controls are always 2D, fast, and legible. 3D lazy-loads, never blocks first paint, and falls back to a calm 2D sky.
- Goal stars are the brightest points in the sky, and galaxy centres stay quiet. Everything in the sky can be tapped as an object, not only by its label.
- Laptop and phone are one app, with the same dock, words and sky arranged for the screen, never two designs.
- Corner radius is 2px. Emoji are never UI icons.

## Technical rules (never break)

- React + TypeScript + Vite. Strict TypeScript.
- IndexedDB (via `idb`) is the only database. No hosted database, ever.
- Must work after refresh, after browser restart, and offline after first load.
- Import/export backup is a first-class feature and must round-trip losslessly.
- Static-site deployable to Cloudflare Pages. No server code.
- No login, no subscriptions, no analytics, no telemetry, no external database, no third-party scripts.
- Never put API keys in client-side code, the repo, `.env`, storage, backups, URLs, or logs. The optional "Ask my AI" feature is bring-your-own-key: the key lives in tab memory only and is relayed once per confirmed request through `functions/api/reflect.ts`, which stores and logs nothing. Never add a deployed secret for it.
- The fictional demo museum ("Alex's Next Chapter": a person with a full-time job making gradual progress on health, a side project, creativity, and relationships) must always seed cleanly and make the app understandable within seconds with zero personal data. Use short, everyday language in seed content; no specialist crafts or invented lore. Never reference a real person. Bump `DEMO_SEED_VERSION` whenever the demo content changes so returning visitors get the refreshed demo; own museums are never touched by the seed.
- PWA install experience is required.
- Deterministic rendering for the Archive layout and Future Gallery (seeded PRNG). The Future Gallery is a "what if?" simulator, not a prediction engine, and its copy must say so.

## Places

The redesign (Phases 10–17 in `docs/implementation-plan.md`) has a dock of **Sky · Today · Capture · Journal · Search**, with Settings behind a gear.
- One museum holds any number of galaxies.
- Goal → Project → Step. Projects come in six shapes and steps in six kinds; the model is in `src/mind/types.ts`.
- The old rooms (Entrance, Observatory, Archive, Workshop, Future Gallery, Cabinet) stay live until the new shell replaces them in Phase 12, and their code is retired in Phase 16.

## Working conventions

- Repositories are the only code that touches IndexedDB. Stores call repositories. Components call stores.
- Every phase is committed, pushed and deployed on its own, so it can be reverted. Reverting code does not undo stored data. So any change to the database schema or the stored records must:
  - keep the old records untouched;
  - save a backup first;
  - land in the same phase as the screens that use it.
- Every room is lazy-loaded behind `AppShell`.
- Keep the entrance chunk small; it is the first impression.
- Honour `prefers-reduced-motion` in every animation.
- Commit messages: imperative, present tense, one line under 72 chars, body if needed.
- Before any release, run `scripts/pointer-audit.js` (see docs/deploy.md) at phone and desktop sizes and confirm key forms with real clicks. Scripted `.click()` calls bypass whatever is drawn on top of a control and are not proof that a person can use it.
- Load rooms with `lazyRoom` from `src/app/updates.ts`, never bare `React.lazy`, so a page left open across a deploy recovers instead of crashing.
- Every text field and dropdown is at least 16px, and every control has a 44px touch zone on touch screens.
- Do not deploy without explicit approval.
