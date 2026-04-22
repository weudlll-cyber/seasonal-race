# Seasonal Race

A modular, extensible race-game platform with multiple race types (Duck, Horse, Rocket), reusable branding, and a maintainable architecture.

## Product Goals

- Support multiple race types through a plugin-style contract.
- Keep race visuals attractive with lightweight procedural animations.
- Provide a responsive race viewer and an admin panel.
- Maintain strict engineering quality: typed contracts, tests, CI, security checks.
- Local-first workflow for development and validation before any production rollout.
- Production-ready VPS deployment with a secure one-command install script as end goal.

## Planned Tech Stack

- Frontend: React + TypeScript + Vite + PixiJS + Framer Motion
- Backend: Node.js + Fastify + TypeScript
- Database: PostgreSQL + Prisma
- Realtime: WebSocket with SSE fallback
- Workspace: pnpm monorepo

## Repository Structure

- `apps/`: runnable applications (`web-viewer`, `web-admin`, `api`)
- `packages/`: shared and domain packages (`race-engine`, `race-types`, `branding`, `shared-types`)
- `docs/`: architecture, standards, roadmap, test strategy, security plan
- `tests/`: cross-package integration, e2e, performance, and security suites
- `scripts/`: automation and release scripts

## Quality Gates

- `corepack pnpm run ci:light`: lint + formatting checks
- `corepack pnpm run content:validate`: validates track/racer content JSON + manifests
- `corepack pnpm run ci:extended`: light gate + content validation + typecheck + tests
- `corepack pnpm run ci:full`: extended gate + dependency security checks

## Local Package Manager Setup

- Use Corepack to run pnpm without global admin installation.
- Recommended commands:
  - `corepack pnpm --version`
  - `corepack pnpm install`
  - `corepack pnpm run ci:full`
- Keep `pnpm-lock.yaml` committed for reproducible CI runs.

## Deployment Direction

- Development and feature validation happen locally first.
- Final target environment is a VPS.
- Deployment must be reproducible with a single install command based on hardened defaults.
- See `docs/VPS_DEPLOYMENT.md` for rollout and hardening details.
- Visual MVP scope and asset minimums are documented in `docs/VISUAL_MVP_CHECKLIST.md`.

## Replay Preview Notes

- Track authoring now supports a two-boundary mode (left/right lines) in addition to centerline mode; racers run on a derived midpoint path between both boundaries.
- In boundary mode, broadcast/replay lateral spread now follows the real left/right corridor width at each point along the track (not only fixed lane-width spacing).
- In boundary mode, finish-line and rollout-point spacing in broadcast now follows the boundary control points (finish = boundary penultimate midpoint, rollout = boundary endpoint midpoint), preserving authored distance.
- Replay racers now use continuous free-swim lateral steering (not rigid lanes) with smooth side transitions, front-traffic avoidance, and stronger local anti-collision spacing to reduce overlaps.
- After reaching rollout stop-progress, racers now stay anchored there and no longer snap backward toward the finish line (strict monotonic progress guard).
- Post-finish coast now uses order-aware, phase-smoothed braking: front finishers decelerate more gradually right after crossing and carry speed farther toward coast-end, while later finishers still settle earlier.
- Later finishers now map their stop targets deterministically across nearly the full authored coast zone: first finisher near coast-end, later finishers progressively closer to the finish line.
- Stopped racers are now permanently pixel-locked at their final position — no path recalculation or coordinate drift can cause any backward movement.
- Coast zone is now always projected forward along the race-path end tangent, with a dot-product safety check so even a misplaced coast point cannot create backward segments.
- In boundary mode, the race centerline is now built only from boundary points up to (not including) the final coast-end point. Convention: first = start, penultimate = finish line, last = coast-zone end — works for any number of control points.
- Pixel-space collision avoidance now uses sprite-diameter separation with moderated coast-zone push and reduced post-finish lateral drift, preventing overlap while avoiding jittery "dancing" at the line.
- Finish-line transition now uses reduced collision amplification until racers are clearly inside coast zone, preventing abrupt lateral offsets exactly at line crossing.
- Coast-zone collision response at line crossing is now lateral-only (no tangential push), removing brief stop-like jolts at the finish line.
- Leader name tags in leaders-focus mode now track live on-track front positions and are capped strictly to top-5 (no focus-racer override in this mode).
- Name tags now render on a dedicated overlay layer above racer sprites, giving a consistent rule: labels are never hidden behind racer circles.
- The live top-5 are now visually emphasized with stronger marker opacity, slight scale lift, and higher draw priority for faster readability.
- Replay dynamics are intentionally high-variance but now softened to avoid unrealistic speed spikes and hard slowdowns.
- Early/mid race dynamics now include stronger top-pack anti-persistence pressure, local front-pack chase compression, and softer-but-more-frequent surge phases for clearly more overtakes without extreme speed jumps.
- Replay generation now uses a per-run seed in studio mode, so each new replay run evolves differently instead of repeating the exact same race pattern.
- Coast rollout now uses a smooth two-phase profile per racer: an initial near-constant cruise segment after finish, then a progressive brake segment toward the personal stop point.
- Brake-start timing is order-aware: leaders begin braking later (nearer coast-end), while later finishers begin braking earlier and stop sooner.
- Coast stop mapping keeps a minimum rollout distance beyond the finish line for all racers, avoiding immediate line-cross slowdowns.
- Coast entry now uses a short no-stall crossing window (continuous forward motion over the line), followed by progressively stronger braking toward the stop point.
- Rollout lateral control now expands toward boundary limits, allowing racers to use nearly full track width in coast zone.
- Coast-zone collision handling now increases lateral spreading deeper in rollout so the pack distributes across width instead of remaining compressed near center.
- Start pacing now uses a smooth launch ramp with early no-overshoot capping, so racers accelerate naturally toward race pace instead of spiking above it and then dropping.
- Finish broadcast framing now prioritizes racers that have not crossed the line yet in the final phase, improving visibility of late finish-line crossings.
- Finish camera framing now follows progress-mapped centerline anchors in the run-in, so finish shots remain stable even when collision separation jitters racer sprites laterally.
- Pre-finish pacing now avoids synthetic stalls: racers keep pressure to the finish line and only decelerate after crossing.
- Coast freeze now locks by coast-time completion as well as stop-progress threshold, and freezes at the current world position (no final snap-to-target), preventing rare oscillation and end-frame jump artifacts.
- Replay tick internals were cleaned up by removing unused per-racer world-history fields and switching replay-frame lookup to a per-frame map, reducing controller noise and avoiding repeated linear searches.
- Replay tick readability is further improved via small helper extractions (clip-zone threshold constant, linear-decay coast helper, and finish-camera centerline mapper) without behavior changes.
- Replay tick comments were normalized for clarity and maintainability (no behavior change).
- Replay tick formatting was additionally normalized (long expressions split into readable blocks) with no behavior change.
- Row-based formation lag now fades out much earlier and at reduced strength, minimizing start-row bias in visible race order.
- Early start pack spacing is restored via stronger initial row separation while still fading quickly to avoid persistent start-position advantage.
- Early start pack spacing now includes a temporary longitudinal spread along track direction (visual-only), preventing vertical start clumping without affecting race fairness.
- Post-finish coast now uses a slightly wider per-racer stop window: trailing racers settle earlier while leaders coast farther, improving end-of-race spread.

## Current Status

- Project bootstrap and documentation baseline created.
- Phase 1 foundation tooling is active (TypeScript, ESLint, Prettier, Vitest).
- Content starter catalogs are now tracked under `content/tracks`, `content/racers`, and `content/manifests`.
- Content manifests and referenced JSON files are now validated by `content:validate` and enforced in CI extended/full gates.
- API now exposes read-only catalog endpoints for Phase 3 selection flow:
  - `GET /api/v1/catalog/tracks`
  - `GET /api/v1/catalog/racers`
- API now exposes a launch endpoint that accepts catalog ids only and validates track/racer compatibility:
  - `POST /api/v1/races/start`
- API now exposes runtime bootstrap payload for launched races:
  - `GET /api/v1/races/:raceId/runtime-bootstrap`
- API runtime bootstrap persistence is now routed through a dedicated launch-store abstraction with an in-memory default and an optional file-backed implementation for incremental persistence rollout.
- API launch-store selection now supports env/config wiring (`SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH`) so file-backed persistence can be enabled without route-code changes.
- Race-id sequencing (`race-<n>`) is now owned by the launch store, so file-backed mode preserves id continuity across API restarts instead of resetting to `race-1`.
- File-backed launch-store loading now self-heals malformed/corrupted JSON by resetting to a safe empty store shape, keeping API launch/runtime bootstrap endpoints available.
- File-backed launch-store files are now schema-versioned and legacy unversioned files are migrated automatically during read.
- File-backed launch-store now persists a backup file and restores primary store data from backup when the primary file is corrupted.
- File-backed launch-store now prunes retained runtime bootstrap entries with configurable retention policy: max entries (default 500) and optional max age.
- API file-store retention can be configured via `SEASONAL_RACE_API_LAUNCH_STORE_MAX_ENTRIES` and `SEASONAL_RACE_API_LAUNCH_STORE_MAX_AGE_MS`.
- File-backed launch-store persistence now uses atomic writes (`temp -> rename`) for both primary and backup files to avoid half-written JSON artifacts.
- Optional strict durability mode now adds fsync-based flush steps around atomic file writes (configurable via `SEASONAL_RACE_API_LAUNCH_STORE_STRICT_DURABILITY`).
- Launch endpoint now supports modular starter options (`durationMs`, `winnerCount`, `brandingProfileId`, and extensible `options`) via shared contracts and option-resolver modules.
- Minimal modular app/package skeletons are in place for API, viewer, admin, engine, race types, branding, and shared types.
- Web-admin now includes an Ops launch selector model that defaults valid id selections and builds id-only launch payloads for API calls.
- Web-admin launch request helpers now include an explicit `trackOrientation` option that maps into launch `options.trackOrientation` for runtime direction control.
- Web-admin launch model now also exposes dropdown-ready orientation options and a default selected orientation state for UI wiring.
- Runtime viewer now includes a bootstrap client that resolves race id from URL and loads launch+track+racer payload for real race startup flow.
- Runtime playback now maps bootstrap track points to viewport geometry and uses launch duration for live runtime movement timing.
- Runtime playback now supports orientation variants (`left-to-right` default, `top-to-bottom`) via URL query (`orientation`) and launch options (`options.trackOrientation`).
- Web viewer prototype is running with PixiJS: a sprite follows an S-curve track and a cinematic camera starts in overview mode, transitions into leader focus, applies runtime-aware zoom pulses, and returns to an end overview.
- Race sessions can optionally provide `cameraSettings` to override cinematic defaults (expected duration, pulse count/strength, intro hold, intro transition).
- Web viewer includes an interactive track path editor: click-to-place variable point counts, live path preview, and TrackDefinition JSON copy/download for fast creation of many track layouts.
- Studio preview now supports a track orientation selector for quick visual direction comparison (`left-to-right` vs `top-to-bottom`) without changing core track content.
- Studio sidebar is now compact and definition-first: core track authoring controls stay visible while replay/preset/advanced blocks are collapsed by default to reduce scrolling.
- Switching studio track orientation now rotates the editable curve/boundary geometry directly, so left-to-right/top-to-bottom changes immediately adapt the authored path itself.
- Studio editor now includes precision zoom controls (wheel + slider + reset) so boundary points can be placed accurately on detailed map areas.
- Studio dev tools now include one-click auto track templates (S-curve, oval, zigzag, river bend) with configurable control-point count.
- Studio dev tools now include automatic racer-pack generation from a single uploaded 2D image, producing multiple racer variants with deterministic recoloring + pattern overlays for clear visual differentiation in races.
- Generated sprite-pack frames no longer include baked ground-shadow overlays, preventing mirrored/reflection artifacts in on-track preview.
- Racer-pack tinting now preserves more source-image detail, so duck/animal identity remains recognizable instead of turning into flat color blobs.
- Racer pack controls now include one-click presets (`Minimal`, `Balanced`, `Max Contrast`) for fast setup without manual slider tuning.
- Max-contrast sprite generation now auto-downscales output when needed to stay within browser canvas limits, preventing blank/broken preview sheets on large source images.
- Generator UI now shows a live pre-generate warning line indicating whether current settings fit at 100% scale or will be auto-scaled.
- Studio replay racers now render from the generated racer-pack look (with automatic fallback pack generation), so in-editor race visuals stay aligned with exported sprite-pack styling.
- Surface effects are now driven by an extensible profile + category model (`surface-effects`): water, sand, snow, ash, space, mud, and neon profiles can be selected/derived without changing core racer movement code.
- Surface profiles now differ not only by color but also by spray dynamics (launch force, turbulence, vertical kick, and cadence feel), creating clearer behavior differences such as splashy water vs heavier sand spray.
- Surface profiles now also use profile-specific particle shapes (for example bubbles/spray for water, flatter dust for sand, flakes for snow, embers for ash, plasma streaks for space) so differences are visible instantly.
- Studio now exposes direct surface selectors (race type, racer category, size class, and profile) so effect behavior can be forced visibly during tests instead of relying only on auto detection.
- Studio now includes a track-preview sprite-size slider so single-preview visuals can be tuned quickly during authoring.
- The same studio track-preview size slider now applies to both generated racer-pack sprites and the fallback preview runner, so size changes are always immediately visible.
- Replay/broadcast preview now also preserves this slider base-scale (it is no longer overwritten by per-frame label emphasis scaling).
- Emission intensity now scales by racer category and size class (small/medium/large/huge), so ducks emit lighter wake while heavier categories (e.g. elephant-like classes) emit denser trails.
- Studio and runtime surfaces now share the same effect setup resolver, making it easier to add new race worlds (for example: world-space plasma, ice/snow powder, ash track, desert sand) via profile IDs.
- Runtime racer motion now supports category-specific pose styles (glide/gallop/stomp/sail/thrust), so horse-like categories visibly animate differently from duck/ship/rocket styles.
- Category emission cadence now mirrors movement style (for example horse/hoof gallop = burst-burst-pause spray rhythm, heavy stomp = intermittent heavy bursts, ship = smooth wave-modulated wake).
- Runtime game mode now auto-scales racer sprite size from racer count to keep readability stable across small and large races.
- Runtime race view now generates and animates a full racer pack automatically (deterministic per-racer pace, lateral swim drift, and continuous movement) instead of rendering a single runner.
- Runtime race view now renders procedural water visuals (waves, ripples, and splash wake layering) directly from simulation state, so no static background image asset is required.
- Runtime racer glyphs now use per-racer procedural color palettes for better on-track differentiation in dense packs.
- Runtime racer behavior now supports deterministic presets (`arcade`, `balanced`, `chaotic`) that tune pace spread, pack interaction intensity, and lateral movement style.
- Runtime auto-simulation now applies pack-aware behavior layers (overtake impulses, leader/trailer rubber-banding, and close-range lateral conflict avoidance) for more natural multi-racer flow.
- Runtime behavior preset can be selected via query (`behavior=arcade|balanced|chaotic`) for controlled playtest tuning.
- Runtime water rendering now includes layered foam streaks and persistent wake decay trails for stronger motion readability in dense packs.
- Runtime splash/ripple intensity now scales by both racer speed and local track curvature, so hard turns create visibly stronger water disturbance.
- Runtime backdrop now adds image-free shore glint lines, preserving the no-background-image approach while improving edge contrast.
- Runtime now supports adaptive visual quality modes (`low`, `medium`, `high`, `auto`) via query (`quality`) with per-frame performance budgets.
- In `auto` quality mode, wave/foam segment density, ripple seed counts, wake persistence, and effect intensity scale down automatically under high racer density or slower frame times.
- Runtime keeps large-race readability by capping ripple/wake workload dynamically while preserving core racer motion and route visibility.
- Runtime HUD now renders a compact Top Pack leaderboard (top 3) with live progress and relative lead gaps.
- Runtime supports optional focus tracking via query (`focusRacer=<1-based-number>`), adding a highlight ring and live speed/progress/rank readout.
- Runtime camera now uses the shared `CameraController`, adding gentle follow/zoom motion in live playback instead of a fully static viewport.
- When `focusRacer` is set, camera framing blends toward that racer and slightly widens zoom when the focus drops behind the leader, improving readability without losing pack context.
- Track editor supports background image import, drag-to-edit points, and optional smooth-preview mode for curved route visualization.
- Track editor now supports named test presets (save/load/delete in local browser storage) so multiple setup variants can be restored quickly between iterations.
- Track metadata fields and JSON editing are now placed in optional advanced sections, keeping the default authoring flow focused on visual controls only.
- Track editor includes a broadcast preview mode with cinematic camera rides, so tracks can be validated in a player-like race perspective before publishing.
- Broadcast preview now renders in fullscreen spectator layout with high-DPI output and cover-scaled background framing.
- Replay racers use track-normal lane offsets (instead of fixed Y offsets) plus live lane-width tuning to stay in water/track zones on curves.
- Replay preview supports dynamic racer counts up to 100 with packed formation spacing, so dense-race readability can be checked early.
- Optional lane-board overlays render left/right boundary guides directly on the image for lane-fit validation.
- Editor controls include tooltips and helper hints to clarify each setting while authoring tracks.
- Broadcast preview now supports tighter spectator framing via zoom multiplier to avoid distant/flat race shots.
- Replay/broadcast markers include readable racer name flags (e.g. D1, D2...) to help players find their duck.
- Name display modes now support `All`, `Leaders + Focus`, and `Hover Only` to keep labels readable at high racer density.
- Focus racer control (by racer number) keeps one racer highlighted and always visible in replay/broadcast tests.
- Broadcast mode now includes a live leaderboard overlay that tracks leaders and still shows the focused racer even when off the top list.
- Leaders-focus label mode now updates continuously with live placement changes (labels are not pinned to static racer IDs).
- Replay leaderboard ordering is driven by current race placement (live progress), not racer number.
- Replay start now uses a compact staged formation that blends into race movement for a more realistic launch.
- Replay now shows a short pre-start lineup hold before race-time starts, with the camera locked to leaders and no intro overview jump across the track.
- Mid-race now performs much stronger and more contrasted in/out camera beats with tighter top-pack framing, so leader zoom moments are clearly visible.
- Post-finish coast now starts per racer when that racer actually crosses the line (not as one global switch), while top-five finish order remains locked and lower ranks can still reshuffle naturally.
- Leaderboard percentages now remain bounded to real progress (0-100%) even when finish-order ranking locks are active.
- Leader spotlight zoom now uses a higher camera zoom ceiling, so top-pack close-ups are visibly tighter in broadcast mode.
- Camera interpolation is now slower/smoother to reduce hectic pan/zoom swings during cinematic beats.
- Replay now supports a two-endpoint finish flow: penultimate path point acts as finish line and the final path point acts as coast-zone end, so post-finish racers decelerate individually through that zone instead of snapping to one line.
- Track authoring now enforces a minimum of 3 control points (start, finish, coast end); editor markers are color-coded as start=green, finish=yellow, coast-end=red.
- Post-finish coast now brakes trailing racers more aggressively than leaders to avoid pile-ups, producing a more natural irregular final formation.
- Named test presets now persist background images primarily via IndexedDB asset storage, reducing localStorage size-limit dropouts for image-backed setups.
- Leader spotlight zoom now supports a higher effective close-up ceiling while camera interpolation remains intentionally slow/smooth.
- Broadcast replay now shows a visible finish line guide and a coast-end marker to make finish/coast geometry explicit during testing.
- Post-finish spacing now uses stronger finish-order braking and per-racer target scatter to reduce line-collapse at the coast end.
- Replay finish/coast spacing now uses your authored control points directly (finish = penultimate point, coast end = final point) instead of deriving those from smoothed tail samples.
- Post-finish movement now uses per-racer time-based ease-out deceleration toward coast targets, so racers keep moving after finish and slow down smoothly instead of appearing to stop abruptly.
- If replay data runs out before all racers finish, unfinished racers now continue with conservative per-racer tail pace (with gap/row drag), preventing global acceleration bursts when the first finisher crosses.
- End-of-data finish continuation now uses strict per-racer local conservative pace (no shared trigger, no synthetic end sprint) so unfinished racers are not pulled together before the line.
- Final finish continuation now stays strictly racer-local (no hard predecessor-cap gating), with moderate conservative pace near end-of-data to avoid both packet surges and pre-finish stalling.
- Finish behavior now applies hard post-lock decoupling: once the first finish crossing locks results, all racers stop following replay-frame compression; uncrossed racers continue on carried local rate, crossed racers decay.
- Replay movement is continuous to the coast endpoint while ranking remains locked at finish-line crossing order (no displayed rank changes after crossing).
- Movement now ignores finish as a motion stop and continues to the coast endpoint, but displayed ranking is locked at the finish-line crossing order (no rank changes after crossing).
- Replay visual behavior is now centralized in a reusable policy helper module (`replay-visual-policy`) so editor simulation and future runtime race views share the same logic.
- Track mapping and lane-board geometry are now centralized in a reusable helper module (`track-layout-helpers`) shared by preview and runtime paths.
- Camera reset/background-bound clamping is now centralized in `world-transform-utils` to keep view behavior consistent across surfaces.
- Viewer entrypoint now uses a thin bootstrap `main.ts`, while studio authoring logic is hosted in `studio-app.ts` for cleaner multi-surface evolution.
- Bootstrap dispatch now supports explicit surface mode via URL (`?mode=studio` default, `?mode=runtime` for runtime entry).
- Bootstrap dispatch now supports a dedicated admin launch surface via URL (`?mode=admin`) with catalog loading, request preview, and race-start controls.
- Runtime entry logic now exists in `runtime-app.ts` as a dedicated, isolated surface for real game playback evolution.
- Studio orchestration is now further modularized with dedicated DOM, render, and editor-helper modules to keep `studio-app.ts` focused on flow composition.
- Studio point-edit interactions (stage pointer events + preset buttons) are now isolated in `studio-point-editor-controller.ts` to reduce event wiring noise in `studio-app.ts`.
- Studio replay tick behavior is now isolated in `studio-replay-controller.ts` so replay visuals/camera flow can evolve independently from core studio wiring.
- Studio single-preview tick behavior is now isolated in `studio-single-preview-controller.ts` so non-replay runner/camera flow stays decoupled from studio composition.
- Studio background image flow (load/clear/layout) is now isolated in `studio-background-controller.ts` so asset lifecycle stays decoupled from studio composition.
- Studio control-panel event wiring (toggles/inputs and display labels) is now isolated in `studio-ui-controls-controller.ts` so UI wiring stays decoupled from studio composition.
- Broadcast mode now resizes the renderer to the real viewport so race coverage uses the full screen instead of leaving unused side areas.
- Press `Esc` in broadcast mode to return directly to the editor controls.
- Track remapping for broadcast now uses separate authored-editor viewport and target-broadcast viewport dimensions, fixing path/background mismatch on wide screens.
- Architecture direction is now explicitly split into three app roles: Studio (design/admin), Ops (race launch with presets), and Viewer (runtime race playback).
- Phase 2 core contracts are in progress: race session orchestration, deterministic RNG, adapter registry, and extensibility interfaces.
- See `PROJECT_BASELINE.md` and `docs/ROADMAP_PHASES.md` for milestone details.

## Source Header Standard

- TypeScript source files use a top-of-file documentation block with `File`, `Model`, and `Purpose` fields.
- Current required model value in this workspace header format: `GPT-5.3-Codex`.
- Add concise inline comments only where intent is not obvious from the code itself.

## Language Policy

- Conversation language can be German.
- Game UI text, source code, comments, commit messages, and project documentation are English only.
