# Architecture

## Current architecture (the mind-first redesign, Phases 11–16)

```
src/
  app/        App routes, error boundary, PWA, deploy-safe loading (lazyRoom)
  mind/       the model and everything about it, all pure and tested
    types.ts      galaxies, goals, projects (6 shapes), steps (6 kinds), thoughts, journal, reviews
    migrate.ts    the old rooms → one mind (lossless, with a report)
    switchover.ts the one-time move on first open (backup first, old stores untouched)
    repo.ts       the only code touching the mind.* IndexedDB stores
    store.ts      the open mind in memory (Zustand); ops.ts are the named actions
    select.ts     shared views, search, suggested homes; today.ts, week.ts, shapes.ts, recurrence.ts
    backup.ts     format 4, reads every older format; files.ts export, import, pre-move copy
    demo.ts       Alex's Next Chapter
  sky/        the 3D sky: engine.ts (three.js), model.ts, route.ts, SkyStage.tsx (lazy)
  shell/      MindShell, dock, capture sheet, picker, breadcrumbs, glyphs
  places/     sky (list view and overlays), today, unsorted, clear, search, goal, project,
              journal, review, settings, welcome, tour
  data/       the old room model's database and backups, kept so old data can always move in
```

- **Storage:** IndexedDB version 4. The `minds` and `mind.*` stores hold the model; the version 1–3 stores are kept read-only for history and migration.
- **Routes:**
  - `/` is the sky, or its list view (`?galaxy=`, `?goal=` move closer);
  - `/goal/:id` and `/project/:id` are plates beside the star or planet;
  - `/today`, `/unsorted`, `/clear`, `/search`, `/journal`, `/review`, `/settings`;
  - `/welcome` is the tour on a first visit, otherwise the chooser; `/tour` is the tour.
- **Sky:** routes drive the camera. Taps in the sky navigate. Only a structural change rebuilds the scene. When 3D is unavailable, a calm 2D field and the list view take over.

The sections below describe the original room model and are kept for history.


## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript | Required. Strict mode on. |
| Build | Vite | Required. Fast, static output, first-class PWA plugin. |
| Routing | React Router (hash-free, `BrowserRouter`) | Cloudflare Pages serves `index.html` for unknown paths via `_redirects`. |
| Local data | IndexedDB via `idb` | Thin promise wrapper, no ORM, no magic. |
| State | Zustand | Small, no boilerplate, works with async loaders. |
| Motion | Framer Motion (`motion` package) | Room transitions, layout animation. |
| 3D | React Three Fiber + drei (lazy, only Observatory and Workshop) | Loaded on demand; never on the entrance path. **Status:** the Observatory dome (`Sky3D.tsx`) is live; drei is not used. The 2D canvas renderer remains the permanent fallback. |
| Graph layout | d3-force (Archive only) | Deterministic with a seeded RNG. |
| PWA | `vite-plugin-pwa` (Workbox) | Precache app shell; offline after first load. |
| Fonts | Self-hosted in `/public/fonts` | Offline; no third-party requests. |
| Tests | Vitest + Testing Library | Store and repository logic, import/export round-trip. |

No backend. No environment variables reach the client bundle except `VITE_APP_VERSION`. There is no `.env` with secrets by design.

## Directory layout

```
src/
  app/            App shell: router, layout, providers, error boundary
  rooms/          One folder per room (entrance, observatory, archive, workshop, future, cabinet)
  components/     Shared museum components (Plaque, Instrument, Vitrine, Doorway, Compass)
  data/
    db.ts         IndexedDB schema + open/upgrade
    repo/         One repository per object type (CRUD, queries)
    seed/         Fictional demo museum content
    backup.ts     Export / import (schema-versioned JSON)
  store/          Zustand stores (museum, ui, settings)
  lib/            Pure utilities: ids, dates, seeded rng, colour
  styles/         tokens.css, base.css, motion.css
  types/          Domain types
public/
  fonts/
  icons/          PWA icons
  _redirects      Cloudflare Pages SPA fallback
```

## Data model

All records share a base:

```ts
interface BaseRecord {
  id: string;            // ulid, sortable
  museumId: string;      // which museum this belongs to ("demo" | user ulid)
  createdAt: number;     // epoch ms
  updatedAt: number;
  lastVisitedAt: number; // drives Cabinet + Workshop dust
  tags: string[];
}
```

Object types: `Goal`, `Project`, `Action`, `Note`, `Link`, `Memory`, `Thread`. Threads are typed edges: `{ fromId, toId, kind: 'supports' | 'inspired-by' | 'blocks' | 'reminds-me-of' }`.

`Museum` is a top-level record: `{ id, name, kind: 'demo' | 'own', createdAt, visitorName? }`.

### IndexedDB schema (v1)

Database name `museum-of-my-mind`. One object store per type, keyed by `id`, each with an index on `museumId` and on `[museumId+updatedAt]`. A `meta` store holds `{ key: 'activeMuseumId' }`, `{ key: 'schemaVersion' }`, and settings.

Migrations are numbered and live in `db.ts`. The `upgrade` callback switches on `oldVersion` and falls through.

### Repository layer

Each repository exposes `list(museumId)`, `get(id)`, `put(record)`, `remove(id)`, plus type-specific queries (e.g. `projects.byGoal(goalId)`). Repositories are the only code that touches `idb`. Stores call repositories; components call stores.

### Store layer

- `useMuseumStore` — active museum id, list of museums, loaded records for the active museum, and CRUD actions that write to the repo then update memory. Loading is a single `hydrate(museumId)` that reads all stores in one transaction (personal data volumes are small; thousands of records load in tens of milliseconds).
- `useUiStore` — current room, transitions, quiet message queue, sound toggle.
- `useSettingsStore` — reduced motion override, visitor name, persisted to the `meta` store.

### Backup format

```json
{
  "format": "museum-of-my-mind-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-09-14T00:00:00.000Z",
  "museums": [ ... ],
  "records": { "goals": [], "projects": [], "actions": [], "notes": [], "links": [], "memories": [], "threads": [] }
}
```

Import validates `format` and `schemaVersion`, runs migrations if older, and offers **merge** (skip ids that exist) or **replace** (wipe target museum first). Export is a `Blob` download; import is a file input. Both are pure functions over the data plus one transaction.

### Seed

`data/seed/demo.ts` builds Alex's museum from typed literal data with a fixed base timestamp, so ids and dates are stable across runs. On boot the demo is seeded if missing, or re-seeded if the stored `demoSeedVersion` is older than `DEMO_SEED_VERSION`. "Restore the demo museum" in settings wipes and re-seeds on demand. Own museums are never touched.

## Routing

```
/                 Entrance
/observatory      Observatory
/archive          Archive
/workshop         Workshop
/future           Future Gallery
/cabinet          Cabinet of Curiosities
/settings         Backup, import, sound, reset
```

Every room route is lazy-loaded. The entrance is in the main chunk. Room routes render inside `AppShell`, which owns the top bar, compass, quiet-message region, and page transition. The shell refuses to render a room until a museum is active and redirects to `/` otherwise.

## PWA

`vite-plugin-pwa` with `registerType: 'prompt'`. A custom install prompt lives in the shell as a small "Keep this museum" instrument that appears only after `beforeinstallprompt` fires and the visitor has entered a room at least once. Service worker precaches the build and fonts, and uses `NetworkFirst` for nothing, because there is no network. Updates show one quiet message: "A newer wing has been built. Reload to visit."

## Offline guarantees

- All assets are precached on first load.
- No runtime network requests are made by the app. Link records open in a new tab via the browser, not fetched.
- IndexedDB is the only persistence. `localStorage` is used only for a single `hasVisited` flag to skip the entrance's first-time animation.

## Observatory rendering

`rooms/observatory/layout.ts` is a pure function from goals and projects to normalised positions (goals on a golden-angle spiral, projects on tilted orbits). `SkyCanvas.tsx` draws that layout on a 2D canvas each animation frame (or once, under reduced motion) and hit-tests pointer events against the last frame's positions. All mutations flow through `useMuseumStore.upsert/remove`, which write to IndexedDB before updating memory, so every change survives refresh.

### The dome (3D layer)

`Sky3D.tsx` is a lazy chunk mounted behind the 2D canvas with an orthographic camera whose world units equal CSS pixels, so both layers share `resolvePositions()` and `skyTime()` from `layout.ts` and agree on every star's position. The dome draws distant stars, drifting dust, additive halos for goal and project stars, orbital traces, and the selected goal's slow rings. Everything is procedural; no textures or models; no post-processing (bloom is faked with additive halos). The 2D canvas switches to overlay mode only after the dome's first frame, so the fallback is seamless. `lib/webgl.ts` decides eligibility; a performance guard disables the dome for the session on sustained slow frames. Dev-only inspection hooks (`?forceframes=1`, `?enter=<museumId>`) live in `main.tsx` and `App.tsx` and are compiled out of production.

## Archive rendering

`rooms/archive/graph.ts` builds the wall: item nodes (notes, ideas, links, memories that are not put away), one hub node per tag in use, and goal or project nodes only where a thread reaches them. Edges are explicit threads and tag membership. Layout is d3-force run synchronously to rest with a seeded random source, so the map is stable across reloads. `ArchiveMap.tsx` renders it as SVG with pan and zoom; every node is a focusable button. Note, link, and memory records gained optional `kind`, `archivedAt`, and thread `why` fields without a schema bump, because IndexedDB stores are schemaless and all readers treat the fields as optional.

## Ask my AI (optional, bring your own Claude key)

Off by default; the museum never calls the network unless the keeper turns it on and confirms a specific request. The pieces:

- `shared/reflect-schema.ts`: the request and result contracts, size limits, the tool schema handed to Claude, the system prompt (items are quoted data; instructions inside them are never followed), and validators used on both sides.
- `functions/api/reflect.ts`: the only server code, a Cloudflare Pages Function at `POST /api/reflect`. It checks the Origin (the app's own host, or localhost in development), the content type, a body limit, and the key's shape; forwards one request to Anthropic with the key in the `x-api-key` header; validates the tool-use result; and answers with `Cache-Control: no-store`. Errors are reduced to short codes; nothing from upstream is echoed; nothing is logged or stored. Any other method gets 405. Static routes never touch it because Pages only routes `/api/reflect` to it.
- `src/ai/session.ts`: the key lives in a module variable for the tab and nowhere else. It is never written to storage, backups, the URL, or logs, and is cleared on refresh, on an invalid-key answer, when the feature is turned off, or on demand at the keeper's desk.
- `src/ai/client.ts`: posts to the same-origin relay with the key in a header, maps failures to short codes, and re-validates the result.
- `src/rooms/reflect/Reflect.tsx`: choose a mode and the exact items, read a plain-language preview (what, how much, to which model, paid by whom, treated as quoted data), enter the key, send or go back, then Accept / Edit / Reject every proposal. Only accepted proposals are applied, through the same operations every room uses; the reflection text and counts are kept in a `reflections` store (IndexedDB v3, backup schema 3) and can be cleared.

If the relay is unavailable (no connection, or the free Functions quota is exhausted), the room says so and every other room is unaffected, because nothing else depends on it.

## Determinism

The Future Gallery and the Archive layout use a seeded PRNG (`mulberry32`) so the same inputs always render the same scene. This matters for trust: a "what if" simulator that shifts on refresh feels like a prediction; one that holds still feels like a model.

## Performance budgets

- Entrance route: under 120KB gzipped JS, no 3D, first contentful paint under 1s on a mid-range laptop.
  - **Variance (2026-09-14):** the Phase 0 entrance chunk measures 133KB gzipped (React 19, router, motion, zustand, idb, ulid). Accepted by the owner; do not optimise prematurely. Revisit if it passes 160KB.
- Room routes: 3D chunks lazy-loaded, under 400KB gzipped each.
- All ambient animation on canvas or CSS transforms; no layout thrash.

## Deployment

Static output in `dist/`. Cloudflare Pages: build command `npm run build`, output `dist`. `public/_redirects` contains `/* /index.html 200`. `public/_headers` sets a strict CSP that allows only `'self'` (no inline scripts except the Vite-hashed ones) and denies all `connect-src` except `'self'`.

## Security posture

- No secrets in the repo, ever. CI can grep for `sk-`, `key=`, and similar patterns. The reflection relay never stores the key it is handed; there is no deployed secret because the feature is bring-your-own-key.
- No third-party scripts.
- Import parser rejects unknown top-level keys and any record with a foreign `museumId` unless explicitly remapped.
