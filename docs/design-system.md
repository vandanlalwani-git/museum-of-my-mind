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

---

# The sky and its plates (redesign, approved 2026-10-10)

Approved from the Phase 10 prototype (https://claude.ai/artifact/FmWLWxbWrGgvYRroBbrxKi). This part governs every redesigned screen. Where it differs from the sections above, it wins.

## The idea

The museum is one living 3D sky. Each galaxy is an area of life. Goals are stars, projects are planets, and thoughts drift as faint light: unsorted thoughts form a small cloud in their galaxy, and linked thoughts circle their goal as moons. Pages never replace the sky. They are plates held in front of it, with the sky still moving behind. You never leave the sky; you move closer to things inside it.

## Light hierarchy

Light tells you what matters, so it is spent carefully.

1. **Goal stars are the brightest points at every distance.** Each has a white-gold core, a warm halo, and a thin horizontal line of light. Their size follows the camera, so they stay bright from far away and never flood the view up close. A goal nobody has touched lately is dimmer, but still brighter than its galaxy.
2. **Galaxy centres stay quiet.** A centre is not a goal. Arm particles brighten towards the outside, and the core glow is barely there.
3. **Planets are lit by their star**, with a soft rim. Progress shows as light: a ring that closes and a glow that grows. Numbers appear only on the project's own page.
4. **Open questions flicker** gently in a cool white (`--question`). Nothing else in the sky moves to get attention.
5. **Labels** use Cormorant for the names of things and Inter for captions, always with a soft dark halo (`--halo`) so they stay readable over bright arms.

## Galaxy hues

A galaxy takes one hue from a fixed set and never a free colour. Each hue has a tint for its arms and labels and a core for its pale centre.

| Hue | Tint | Core |
|---|---|---|
| gold | `#e2c486` | `#efe0bf` |
| verdigris | `#8fbb9f` | `#d3e5d8` |
| copper | `#d2a283` | `#f0ddcd` |
| steel | `#9eb0cf` | `#dfe5f0` |
| parchment | `#e8dcc4` | `#f5efe2` |

Hues are assigned in this order and repeat after the fifth galaxy.

## Zoom levels

| Level | You see | Tap |
|---|---|---|
| Mind | Every galaxy with its name and counts; on laptops, goal names faintly; an empty "+ New galaxy" ring | a galaxy (anywhere on it) or a star |
| Galaxy | Its goals, its open questions, and its cloud of unsorted thoughts | a star, a question, the cloud, or another galaxy |
| Solar system | The star, its planets with orbits and rings, and thought moons | a planet, a moon, or the star |
| Goal page | A plate beside (laptop) or below (phone) the star | a project row |
| Project page | A plate beside or below the planet, which stops orbiting while you look | — |

Everything in the sky can be tapped as an object, not only by its label. Tap targets are at least 24px in radius around a thing's centre, and bigger when the thing itself is bigger. Planets and moons slow almost to a stop while the pointer rests on them or a finger is down. Steps never appear in the sky.

Galaxies arrange themselves in a loose grid sized to the screen: up to three in a row on a laptop, two columns on a phone. There is always room for one more.

## Plates

- Ground `rgba(13,15,22,0.94)`, a gold hairline border, 2px corners, a faint inner top highlight, and the deep shadow.
- No blur behind them. The sky shows around a plate, never through it.
- Pages open with a clip reveal, from the right on a laptop and from below on a phone, so their layout never moves while they open.

## Dock

- The same five places, in the same order, on every screen size: **Sky · Today · Capture · Journal · Search**.
- On a laptop it is a floating plate at the bottom centre. On a phone it is a bar along the bottom edge with the safe-area inset.
- Capture is the only filled control: a gold disc. Its keyboard shortcut is N, and / or ⌘K opens Search.
- Settings sit behind a gear at the top right.

## Motion language

Motion means "you are moving through the sky". It is never decoration.

- **Camera flights** between levels take 1.1 to 2.6 seconds depending on distance, ease in and out, and rise slightly mid-flight.
- **The title lift:** when a page opens, the thing's name rises from the sky and becomes the page title (about 1 second).
- **Letting go of a thought:** it shrinks to a point of light and arcs into its place (about 1.7 seconds), then a soft flash. A memory flies into the Journal button instead.
- **Arrival:** a slow drift from deep space into your galaxies (about 4 seconds), skippable with any tap or key.
- **Ambient motion:** galaxies turn very slowly, planets orbit, and thoughts drift. The pointer adds a little parallax on a laptop, and dragging looks around.
- **Going back:** scroll or pinch out, Esc, or the breadcrumb.
- **Reduced motion:** every flight becomes a short fade, and all ambient motion stops.

## Laptop and phone

One stage, two arrangements, switched by the stage width (700px), never by device detection. The phone gets a wider field of view, stacked galaxies, sheets that rise from below the dock, and a full-width capture sheet. The laptop gets side plates, a floating dock, a centred capture plate and keyboard shortcuts.

## Performance

- The canvas keeps the pixel budget from `lib/surface.ts`.
- Particle counts drop on small screens.
- Glows are additive sprites rather than a post-processing pass.
- A calm 2D sky replaces the 3D one when 3D drawing is unavailable.
