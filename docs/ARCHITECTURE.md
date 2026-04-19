# Architecture

## System Overview

The platform is split into five major concerns:

1. Frontend applications (`web-viewer`, `web-admin`)
2. Backend API (`api`)
3. Race engine (`race-engine`)
4. Race type adapters (`race-types/*`)
5. Branding subsystem (`branding`)

## Runtime Flow

1. Admin configures players, race settings, and brand profile.
2. API exposes read-only content catalogs (`GET /api/v1/catalog/tracks`, `GET /api/v1/catalog/racers`) for selector UIs.
3. Ops/Admin submits id-based launch payload (`trackId`, `racerListId`) plus modular starter options (`durationMs`, `winnerCount`, `brandingProfileId`, and extensible `options`) to `POST /api/v1/races/start`.
4. API validates ids and modular options through a dedicated option-resolver layer, then starts a race session with the selected race-type adapter.
5. Viewer runtime fetches `GET /api/v1/races/:raceId/runtime-bootstrap` to initialize race metadata and launch configuration, maps bootstrap track geometry to the active viewport, and applies launch duration timing to runtime playback.
   Runtime direction orientation is configurable (`left-to-right` or `top-to-bottom`) via runtime query and launch options.
6. Race engine runs deterministic or non-deterministic simulation ticks.
7. State and events are streamed to viewer clients.
8. Results and replay metadata are persisted.

## Race Engine Contract

Each race adapter should implement:

- `initialize(context)`
- `tick(deltaMs)`
- `getState()`
- `finalize()`

Race session orchestration is provided through `createRaceSession(...)` and includes:

- deterministic RNG for seeded runs
- secure RNG fallback for non-seeded runs
- tick and elapsed-time tracking

## Visual Strategy

### MVP Viewpoint Decision

- Top-down (bird-eye) presentation is the locked MVP camera direction.
- Frontal/side cinematic racer views are explicitly post-MVP.
- See `docs/VISUAL_MVP_CHECKLIST.md` for required vs optional visual scope.

### Design goal

The races should feel **broadcast-quality** — not a game but a live event.
Smooth motion, layered atmosphere, particles and distortion everywhere.
All effects are driven by code + JSON config; no custom shaders needed for the MVP.

---

### How curved tracks work

`TrackDefinition.points` is an array of 2D points that form a polyline.
`interpolatePosition(points, t)` maps normalized progress [0,1] to a 2D coordinate.

The viewer now includes an interactive track editor workflow:

- click on canvas to place path points
- drag existing points to refine the route
- use as many points as needed for complex curves
- keep fewer points for straight/simple tracks
- import a background track image and mark points directly on top
- optional smoothing toggle for curved preview while preserving explicit point export
- broadcast preview toggle with cinematic camera follow/zoom to validate final spectator perspective
- orientation toggle for preview direction (`left-to-right` and `top-to-bottom`) to compare race flow variants quickly
- fullscreen broadcast layout for player-like framing (editor chrome hidden)
- broadcast camera is clamped to background bounds to avoid black void areas around the track
- replay lane-fit controls: lane offsets along track normal + adjustable lane width for water/track adherence
- dynamic replay racer count up to 100 using packed formation rows (instead of one impossible-wide single row)
- optional lane-board overlays show left/right replay boundaries directly on the track image
- replay name visibility modes (`All`, `Leaders + Focus`, `Hover Only`) for better readability under dense racer packs
- focus racer selector to keep one racer highlighted/visible while validating broadcast discoverability
- broadcast leaderboard overlay that lists leaders and includes focused racer when outside the top set
- replay visual policy extracted to a pure helper module so preview simulation and runtime race playback reuse identical rules
- track layout geometry (normals, lane bounds, background point remap) extracted to shared helpers for preview/runtime reuse
- world transform reset/background clamp extracted to shared helpers for consistent camera-bound behavior across surfaces
- export TrackDefinition JSON (copy/download)
- reload edited JSON back into the canvas for iteration

### Planned App Roles

- Studio app (planned): authoring for tracks, racers, presets, and internal design settings with draft/validate/publish workflow
- Ops app (planned): race launch and operations with selectable published assets and runtime parameters only (no structural edits)
- Viewer app (active): race rendering/broadcast playback that consumes published content and shared runtime policies
- Entrypoint pattern: keep `main.ts` thin as surface dispatcher/bootstrap and place feature logic into dedicated surface modules (for example `studio-app.ts`)
- Current dispatch contract: `?mode=studio` (default) or `?mode=runtime` selected by `app-surface-dispatcher`

The **background art** is a wide scene image (wider than 1920px) that represents the whole
track from bird's eye perspective. The camera pans and zooms into the part of the
background matching the current action — the image just needs to visually match the curve
described by the points array. No pixel coordinates in the image encode path data.

Example: a duck canal with an S-curve has a background that is ~4000px wide and shows
the canal bending left then right. The `TrackPoint[]` array describes the same S-curve
mathematically. The camera follows the leader's position along that path.

---

### Camera system

The viewer has a virtual camera sitting over a large `app.stage` container.
Moving the camera = shifting and scaling `app.stage` — PixiJS handles all math.

| Camera behavior            | When it triggers    | How                                                           |
| -------------------------- | ------------------- | ------------------------------------------------------------- |
| **Intro overview hold**    | Race start          | Start zoomed out and hold full-track framing briefly          |
| **Intro focus transition** | After intro hold    | Slow lerp from overview zoom into leader-follow framing       |
| **Follow leader**          | Every tick          | Stage position tracks leading racer via `interpolatePosition` |
| **Runtime pulse zoom**     | During race runtime | Mild in/out zoom pulses; pulse count defaults from duration   |
| **Finish overview**        | Finish detected     | Camera eases back out to show winners and full result context |

All transitions use **easing functions** (ease-in-out) — no instant jumps.
The `CameraController` is a plain TypeScript class; it reads from `RaceStateSnapshot`
and writes `stage.position` + `stage.scale` each animation frame.

`RaceSessionConfig.cameraSettings` can override cinematic defaults per session:

- `expectedDurationMs`
- `zoomPulseCount`
- `zoomPulseStrength`
- `introOverviewHoldSeconds`
- `introTransitionSeconds`

---

### PixiJS layer stack (bottom → top, every race type)

| Z-order | Layer                              | Technique                                                 |
| ------- | ---------------------------------- | --------------------------------------------------------- |
| 0       | Background scene                   | Sprite — wide PNG/WebP, camera pans over it               |
| 1       | Environment surface (water / dirt) | `TilingSprite` — offset advances each frame               |
| 2       | Surface distortion                 | `DisplacementFilter` on layer 1 — scrolling grayscale map |
| 3       | Ambient particles                  | `@pixi/particle-emitter` always-on instances              |
| 4       | Obstacles / decorations            | Static sprites at positions from `interpolatePosition()`  |
| 5       | Racer sprites                      | `AnimatedSprite` from spritesheet atlas, runtime-tinted   |
| 6       | Per-racer trail/wake               | `@pixi/particle-emitter` instance following each racer    |
| 7       | Burst effects                      | One-shot emitters triggered by engine event type          |
| 8       | Finish line                        | Static sprite at last `TrackPoint`                        |
| 9       | UI overlay (fixed to screen)       | Names, rank badge, gap timer — does NOT move with camera  |

The UI overlay (layer 9) is a separate `app.stage` child that is **not** inside the
camera container — so name labels and rank numbers stay fixed on screen regardless of
camera position.

---

### Duck Race — specific effects

| Effect                       | Technique                                                       | Asset needed                                 |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Water wobble                 | `DisplacementFilter` + scrolling grayscale map                  | `displacement-water.png` (256×256 grayscale) |
| Scrolling water surface      | `TilingSprite` + `environmentScrollSpeed`                       | `water-tile.png` (512×512 tileable)          |
| Rising bubbles (ambient)     | `@pixi/particle-emitter` — slow upward drift, alpha fade        | `bubble.png` (~16×16)                        |
| Wake trail behind each duck  | Per-racer `@pixi/particle-emitter` — white foam, short lifetime | `foam.png` (~16×16)                          |
| Splash burst on acceleration | Burst emitter on `duck.tick` event — radial water drops         | `water-drop.png` (~8×8)                      |
| Duck sprite                  | `AnimatedSprite` — idle bob + racing paddle + celebrate         | `duck.png` + `duck.json` spritesheet         |
| Finish line                  | Static sprite                                                   | `finish-flag.png`                            |

### Horse Race — specific effects

| Effect                      | Technique                                                                 | Asset needed                                |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| Rolling dirt / heat shimmer | `DisplacementFilter` + slow-scrolling map                                 | `displacement-dirt.png` (256×256 grayscale) |
| Ground dust (ambient)       | `@pixi/particle-emitter` — horizontal drift near ground                   | `dust.png` (~24×24)                         |
| Sand burst per hoofstrike   | Burst emitter on `horse.hoofstrike` event — upward spray                  | `sand.png` (~12×12)                         |
| Horse trail shadowing       | Per-racer emitter — brown dust cloud behind hooves                        | `dust.png` (reuse)                          |
| Hurdles                     | `TrackObstacle[]` — sprites at fixed progress points from `EffectProfile` | `hurdle.png` (per obstacle)                 |
| Horse sprite                | `AnimatedSprite` — gallop cycle + celebrate                               | `horse.png` + `horse.json` spritesheet      |

### Asset requirements summary

| Asset                      | Format             | Size         | Used by                  |
| -------------------------- | ------------------ | ------------ | ------------------------ |
| `background-canal.png`     | PNG/WebP           | 1920×1080    | Duck background          |
| `background-track.png`     | PNG/WebP           | 1920×1080    | Horse background         |
| `water-tile.png`           | PNG (tileable)     | 512×512      | Duck TilingSprite        |
| `displacement-water.png`   | PNG grayscale      | 256×256      | Duck DisplacementFilter  |
| `displacement-dirt.png`    | PNG grayscale      | 256×256      | Horse DisplacementFilter |
| `duck.png` + `duck.json`   | PixiJS spritesheet | ≥64×64/frame | Duck AnimatedSprite      |
| `horse.png` + `horse.json` | PixiJS spritesheet | ≥96×64/frame | Horse AnimatedSprite     |
| `bubble.png`               | PNG                | 16×16        | Duck ambient particles   |
| `foam.png`                 | PNG                | 16×16        | Duck wake trail          |
| `water-drop.png`           | PNG                | 8×8          | Duck splash burst        |
| `dust.png`                 | PNG                | 24×24        | Horse ambient + trail    |
| `sand.png`                 | PNG                | 12×12        | Horse hoofstrike burst   |
| `hurdle.png`               | PNG                | 64×32        | Horse obstacles          |
| `finish-flag.png`          | PNG                | 128×64       | All race types           |

**Runtime tinting rule:** all racer sprites use a single grayscale/white base spritesheet
tinted at runtime via `BrandingProfile.palette` — no per-color variant sprites needed.

### EffectProfile contract

`EffectProfile` (in `shared-types`) binds all the above together in one JSON-serializable
object. The viewer loads it by `TrackDefinition.effectProfileId` at race start.
The engine and adapters never read it — visual and simulation layers are fully decoupled.

### Recommended creation tools

| Asset type                | Recommended tool                                          | Cost          |
| ------------------------- | --------------------------------------------------------- | ------------- |
| Background scene          | Midjourney / DALL-E 3 → touch up in GIMP                  | Free/Paid     |
| Spritesheet (duck, horse) | **Aseprite** — animates + exports PNG+JSON atlas directly | ~€20 one-time |
| Small particle textures   | Aseprite or even Paint.NET                                | Free          |
| Displacement maps         | GIMP Plasma filter (grayscale cloud)                      | Free          |
| Tileable water texture    | Photoshop / GIMP with Offset filter                       | Free          |
| Particle effect tuning    | pixijs.io/particle-emitter live editor (browser-based)    | Free          |

## Extensibility Model

New race type requirements:

1. Asset folder
2. Typed config schema
3. Adapter implementation
4. Registration manifest

New track requirements:

1. Path definition (Bezier/Spline/segments)
2. Environment effect profile (for water, dust, clouds)
3. Track metadata schema and manifest

New brand requirements:

1. JSON profile following schema
2. Optional UI form entry
3. API endpoint validation

New player-list provider requirements:

1. Import adapter contract (CSV, TXT, API, manual)
2. Validation and deduplication strategy
3. Reusable list persistence contract

New result export requirements:

1. Export adapter contract (JSON, CSV, webhook)
2. Versioned export payload schema
3. Delivery status and retry policy for remote endpoints

External integration requirements:

1. Connector contract for bots and third-party services
2. Event-driven publishing via integration events
3. Outbox pattern for reliable delivery

## Data Boundaries

- API contracts in shared types package.
- Engine is UI-agnostic and transport-agnostic.
- Frontends consume versioned DTOs from API.

## Integration Layer

- Integration adapters subscribe to domain events and convert them into provider-specific payloads.
- Core domain never depends on concrete bot SDKs.
- Connectors are configured through integration manifests and environment-safe credentials.
