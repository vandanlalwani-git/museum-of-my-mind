# The Museum of My Mind

A private, local-first museum for one person's goals, ideas, notes, links, projects, and memories. Six rooms, no account, no server database, no tracking. Everything lives in your browser's IndexedDB and can be exported as one file.

- **Entrance** — walk into Alex's demo museum, or build your own.
- **Observatory** — goals as constellations, projects in orbit, the next action lit.
- **Archive** — notes, ideas, links, and memories on a wall, tied together with threads you tie yourself.
- **Workshop** — unfinished projects as things on a bench, with a table of what is worth picking up and why.
- **Future Gallery** — a "what if?" over a goal's next year, with every assumption stated. A model, never a forecast.
- **Cabinet of Curiosities** — one forgotten drawer at a time, chosen by rules you can read.

## Run it

```bash
npm ci
npm run dev
```

`npm test` runs the test suite; `npm run build` produces the static site in `dist/`.

## Use it

**Create a personal museum.** Open the entrance, choose *An empty museum* (or *A separate collection* if you already have one), give it a name, and open the doors. Everything you add stays in this browser.

**Export a backup.** Keeper's desk (top right) → *Export everything*. One JSON file holds every museum in this browser. Keep it somewhere you trust; the desk shows when you last exported.

**Restore it elsewhere.** On the other device, open the museum, go to the keeper's desk, choose *Merge* (keep what is there) or *Replace* (overwrite matching museums), and *Import a backup*.

**Ask my AI (optional).** Off by default; the museum is complete without it. Keeper's desk → turn on *Ask my AI* → *Open "Ask my AI"*. Pick a question, tick the exact items Claude may read, read the preview of what will be sent, enter your own Anthropic API key (kept only in this tab's memory), and send. Every suggestion is accepted, edited, or rejected by you; only what you accept is applied. The key is never stored, never in the address bar, never in backups, and can be forgotten at any moment from the keeper's desk.

## Deploy

Live at <https://museum-of-my-mind.pages.dev>, built from `main` on Cloudflare Pages' free plan: a static site plus one Pages Function for the optional reflection relay. See `docs/deploy.md`.
