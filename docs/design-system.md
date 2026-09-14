# Design System — Dark Academic Observatory

## Mood

An observatory on a hill at two in the morning. Brass instruments, dark wood, a single reading lamp, the sky enormous above. Everything in the interface should feel like it was placed by someone who loved it. Nothing should feel generated.

We are not building a dashboard. We are not building a "space theme". The sky is quiet. The gold is old, not bright. The green is the green of oxidised copper and library lampshades.

## Palette

Colours are exposed as CSS custom properties on `:root`. Never hard-code a hex in a component.

| Token | Hex | Use |
|---|---|---|
| `--obsidian` | `#0a0b10` | Page ground. The deepest black we use. |
| `--obsidian-2` | `#10121a` | Raised panels, room floors. |
| `--navy` | `#141b2e` | Depth layer, distant sky, focus rings. |
| `--navy-2` | `#1c2540` | Hover states on navy surfaces. |
| `--gold` | `#c9a961` | Primary accent. Titles, active states, instrument markings. |
| `--gold-dim` | `#8a7440` | Secondary accent, borders, inactive markings. |
| `--gold-glow` | `rgba(201,169,97,0.18)` | Halos and soft light. |
| `--parchment` | `#e8dcc4` | Body text on dark ground. |
| `--parchment-dim` | `#a89f8c` | Secondary text, captions. |
| `--parchment-faint` | `#5f5a4f` | Placeholder text, hairlines. |
| `--verdigris` | `#5e8b6e` | Muted green. Progress, living things, "in motion". |
| `--verdigris-dim` | `#3b5a47` | Green borders and quiet states. |
| `--ember` | `#a8553f` | Rare. Warnings and "abandoned" only. |

Rules:
- Gold is for things the visitor should look at. Never more than one gold-lit thing competing in a viewport.
- Green means alive or in progress. Ember means dormant or at risk. Neither is decorative.
- No gradients except a single radial vignette on the page ground and light halos around gold points. No linear rainbow gradients, no glassmorphism blur cards.

## Typography

Two faces, both self-hosted from `/public/fonts` so the app works offline. (Until the font files are added, the stacks fall back to system serif and system sans.)

- **Display / headings:** `Cormorant Garamond` (weights 400, 500, 600, italic 400). Titles, room names, object names. Set with tight letter-spacing at large sizes and generous letter-spacing (`0.12em`, uppercase) for small labels.
- **Body / UI:** `Inter` (weights 400, 500). Body text, UI controls, metadata.
- **Numerals and instrument labels:** `Inter` with `font-variant-numeric: tabular-nums`.

Scale (rem, based on 16px):

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 0.6875 | 1.4 | Uppercase labels |
| `--text-sm` | 0.8125 | 1.5 | Captions, metadata |
| `--text-base` | 1 | 1.6 | Body |
| `--text-lg` | 1.25 | 1.4 | Lead paragraphs |
| `--text-xl` | 1.75 | 1.2 | Object titles |
| `--text-2xl` | 2.5 | 1.1 | Room titles |
| `--text-3xl` | 4 | 1 | Entrance title |

Measure: body text never exceeds 65 characters per line.

## Spacing and layout

An 8px base. Tokens `--space-1` (4px) through `--space-12` (96px). Rooms use full-bleed layouts with a maximum content width of 1280px for reading surfaces. The shell chrome is minimal: a thin top bar with the museum name and a room compass; no sidebars.

Depth is expressed with layering and parallax, not drop shadows. Shadows, where used, are large, soft, and nearly invisible (`0 24px 64px rgba(0,0,0,0.5)`).

## Motion

Motion should feel like a slow instrument settling, not like a UI bouncing.

- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint).
- Durations: `--dur-fast` 160ms (hover), `--dur-base` 360ms (state), `--dur-slow` 900ms (room transitions), `--dur-drift` 12s+ (ambient).
- Room transitions cross-fade with a slight vertical drift, never slide horizontally.
- Ambient motion (stars drifting, dust settling) runs at very low amplitude and pauses when `prefers-reduced-motion` is set.
- Nothing bounces. Nothing pulses to demand attention.

Library: Framer Motion for component transitions; plain CSS for ambient loops; requestAnimationFrame canvas for star fields.

## 3D

3D (React Three Fiber) is reserved for two places where it creates wonder: the Observatory sky and Workshop artifacts. Everything else is 2D and fast. 3D scenes must have a 2D fallback if WebGL is unavailable, and must lazy-load so they never block the entrance.

## Sound

Optional and off by default. A single toggle in the shell. If enabled: a soft door sound on entering a room, a faint tick when a next-action is completed. No music.

## Components

- **Plaque** — the small engraved label under any object. Uppercase, gold-dim, letter-spaced.
- **Instrument** — any interactive control. Thin gold hairline border, parchment text, gold fill on active. Never a rounded pill.
- **Vitrine** — a glass-case container for an object. Hairline border, obsidian-2 fill, subtle inner vignette.
- **Doorway** — the large entrance choice control. Full-height, responds to hover with a slow light bloom.
- **Compass** — the room navigator in the top bar. Six points, current room lit gold.

Corner radius is 2px everywhere. This is a museum, not an app store.

## Accessibility

- Every interactive element has a visible focus ring in `--gold` at 2px offset.
- Colour contrast: parchment on obsidian is 12.4:1; gold on obsidian is 8.1:1; parchment-dim on obsidian is 6.1:1. Never place gold-dim text on navy.
- All canvas and 3D scenes have an accessible text equivalent nearby.
- Reduced motion is honoured globally.

## What we never do

- Stock photography or illustrations of people.
- Emoji as UI icons.
- Card grids with drop shadows and a "+ New" button in the corner.
- Rainbow gradients, neon glows, or "AI sparkle" iconography.
- Toast notifications that stack. One quiet message at a time, in the bottom-left, that fades.
