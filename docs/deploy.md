# Deploying to Cloudflare Pages (free plan)

The museum is a static site plus one Pages Function. Nothing here costs money on the free plan, and no secret is ever configured on the server.

## One-time setup in the Cloudflare dashboard

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Choose the GitHub repository `museum-of-my-mind` (private is fine; Cloudflare asks for access to that repository only).
3. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

4. Environment variables (build): **none required**. The repository commits an `.npmrc` with `legacy-peer-deps=true`, so Cloudflare's plain `npm ci` installs cleanly. (Without it the install aborts, because `@react-three/fiber` declares a peer range below React 19.3 while the app runs 19.3. No `NPM_FLAGS` variable is needed.)
5. Save and deploy. The site appears at `https://museum-of-my-mind.pages.dev` (or a similar `*.pages.dev` name if that one is taken).

**Current status:** this is already set up. The project `museum-of-my-mind` is connected to the GitHub repository, builds from `main`, and serves at <https://museum-of-my-mind.pages.dev>. Pushing to `main` triggers a new production build.

Do **not** add an Anthropic key anywhere in Cloudflare. "Ask my AI" is bring-your-own-key: the key travels once per confirmed request, from the person's browser, through `/api/reflect`, and is never stored.

## What the repository already contains

- `public/_redirects` — SPA fallback so every room URL (`/observatory`, `/archive`, …) loads on refresh.
- `public/_headers` — strict Content-Security-Policy and security headers; `/api/*` is `no-store` and `noindex`.
- `public/_routes.json` — only `/api/reflect` invokes a Pages Function. Every other path is static. If the free Functions quota is ever exhausted, only "Ask my AI" is affected; the museum itself keeps working.
- `functions/api/reflect.ts` — the relay. Same-origin only (plus localhost), body limit, key-shape check, one forwarded request, validated result, short error codes, no logging.
- `.npmrc` — `legacy-peer-deps=true`, so `npm ci` succeeds on Cloudflare, in CI, and in a fresh clone with no flags.
- `wrangler.toml` — output directory and Functions compatibility date, for CLI deploys.
- The service worker (`vite-plugin-pwa`) precaches the app shell and fonts so the museum opens offline after the first visit.

## Deploying from the command line instead

```bash
npx wrangler login
npm ci
npm run build
npx wrangler pages deploy dist --project-name museum-of-my-mind --branch main
```

This uploads directly and bypasses the Git build, which is useful for a quick publish. Normal changes only need a push to `main`.

## After the first deploy, check

- Open the `pages.dev` URL on desktop and a phone; enter the demo; visit every room from the compass; refresh on a room URL.
- Export a backup from the keeper's desk, then import it (merge) and confirm the counts.
- Turn the network off and reload: the museum should open from the service worker. (Workbox precaches `index.html` under a revision key, so check the cache with `caches.match('/index.html', { ignoreSearch: true })`, not a plain match.)
- Browser devtools → Network: ordinary use makes no request to `/api/reflect`.
- Keeper's desk → turn on "Ask my AI" → choose items → preview: the flow stops at the key field and explains what will be sent; go back without sending.

## Custom domain

Not needed. A custom domain is free to attach on Pages if you own one, but nothing here requires it.
