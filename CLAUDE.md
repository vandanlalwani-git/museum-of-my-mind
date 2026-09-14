# The Museum of My Mind — permanent rules

Read `docs/product-brief.md`, `docs/design-system.md`, and `docs/architecture.md` before making product or visual decisions. These rules are permanent and override convenience.

## What this is

A polished, portfolio-quality, local-first, game-like digital museum for one person's goals, ideas, notes, links, projects, and memories. It must feel cinematic, quietly magical, and deeply personal. It is not a SaaS dashboard.

## Visual direction (never dilute)

- Dark academic observatory: obsidian, deep navy, old gold, parchment, muted green. Tokens live in `src/styles/tokens.css`; never hard-code colours in components.
- Precise typography, spatial depth, beautiful motion. Subtle sound is optional and off by default.
- No generic dashboard cards. No stock imagery. No unnecessary gradients. No "AI app" clichés (sparkles, neon, glass blur cards, rainbow gradients).
- Use 3D only where it creates wonder (Observatory sky, Workshop artifacts). Everything else is 2D, fast, and legible. 3D lazy-loads and never touches the entrance path.
- Corner radius is 2px. Emoji are never UI icons.

## Technical rules (never break)

- React + TypeScript + Vite. Strict TypeScript.
- IndexedDB (via `idb`) is the only database. No hosted database, ever.
- Must work after refresh, after browser restart, and offline after first load.
- Import/export backup is a first-class feature and must round-trip losslessly.
- Static-site deployable to Cloudflare Pages. No server code.
- No login, no subscriptions, no analytics, no telemetry, no external database, no third-party scripts.
- Never put API keys in client-side code. There is no `.env` with secrets. If an AI feature is ever added, the key is user-supplied and stored only locally, or routed through a worker the user deploys themselves.
- The fictional demo museum ("Alex's Next Chapter": a person with a full-time job making gradual progress on health, a side project, creativity, and relationships) must always seed cleanly and make the app understandable within seconds with zero personal data. Use short, everyday language in seed content; no specialist crafts or invented lore. Never reference a real person. Bump `DEMO_SEED_VERSION` whenever the demo content changes so returning visitors get the refreshed demo; own museums are never touched by the seed.
- PWA install experience is required.
- Deterministic rendering for the Archive layout and Future Gallery (seeded PRNG). The Future Gallery is a "what if?" simulator, not a prediction engine, and its copy must say so.

## Rooms

Entrance, Observatory, Archive, Workshop, Future Gallery, Cabinet of Curiosities. See the product brief for what each is for.

## Working conventions

- Repositories are the only code that touches IndexedDB. Stores call repositories. Components call stores.
- Every room is lazy-loaded behind `AppShell`.
- Keep the entrance chunk small; it is the first impression.
- Honour `prefers-reduced-motion` in every animation.
- Commit messages: imperative, present tense, one line under 72 chars, body if needed.
- Do not deploy without explicit approval.
