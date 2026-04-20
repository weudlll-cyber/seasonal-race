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
- `apps/`: runnable applications (`web-viewer`, `web-admin`, `api`)
- `packages/`: shared and domain packages (`race-engine`, `race-types`, `branding`, `shared-types`)
- `tests/`: cross-package integration, e2e, performance, and security suites

- Studio centerline/boundary edit-state helper logic is now isolated in `studio-track-edit-helpers.ts`, reducing state-transition noise in the main studio orchestrator.
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
- Studio replay low-level helper logic is now isolated in `studio-replay-utils.ts` so cinematic/coast/geometry math stays decoupled from frame orchestration.
- Replay run-path/coast safety derivation and broadcast camera selection/zoom policy are now isolated in `studio-replay-utils.ts`, reducing orchestration density in `studio-replay-controller.ts`.
- Replay pixel-space collision/separation policy is now isolated in `studio-replay-utils.ts`, reducing orchestration density in `studio-replay-controller.ts` while preserving finish/coast spread behavior.
- Replay transient racer-state reset and label-application policy are now isolated in `studio-replay-utils.ts`, further reducing orchestration density in `studio-replay-controller.ts` while preserving behavior.
- Replay finish/coast progress transition logic is now isolated in `studio-replay-utils.ts`, further reducing orchestration density in `studio-replay-controller.ts` while preserving behavior.
- Studio replay racer-view construction/reset logic is now isolated in `studio-replay-racer-builder.ts`, reducing view-lifecycle orchestration noise in studio app flow.
- Studio file/image utility helpers are now isolated in `studio-file-utils.ts`, reducing generic browser utility noise in studio orchestration.
- Runtime racer-pack fallback/sprite extraction/preview-size helpers are now isolated in `studio-racer-pack-utils.ts`, reducing replay sprite orchestration noise in studio app flow.
- Studio UI state synchronization mapping is now isolated in `studio-ui-state.ts`, reducing control-value and label synchronization noise in studio app flow.
- Studio geometry orientation rotation state updates are now isolated in `studio-geometry-state.ts`, reducing duplicated centerline/boundary orientation wiring in studio app flow.
- Generated template centerline orientation mapping is now routed through shared geometry helpers, removing inline orientation-rotation branching in studio app flow.
- Studio preset dropdown selection model logic is now isolated in `studio-preset-select-state.ts`, reducing preset-selection fallback wiring noise in studio app flow.
- Studio editor zoom/view-state math is now isolated in `studio-editor-view-state.ts`, reducing editor transform math wiring noise in studio app flow.
- Studio surface setup resolution and particle-emitter state transitions are now isolated in `studio-surface-effects-state.ts`, reducing selector/state wiring noise in studio app flow.
- Studio generator preset/highlight and generation-warning resolution logic is now isolated in `studio-generator-ui-state.ts`, reducing generator-policy wiring noise in studio app flow.
- Studio single-preview tick behavior is now isolated in `studio-single-preview-controller.ts` so non-replay runner/camera flow stays decoupled from studio composition.
- Studio background image flow (load/clear/layout) is now isolated in `studio-background-controller.ts` so asset lifecycle stays decoupled from studio composition.
- Studio preset persistence/storage helpers are now isolated in `studio-preset-store.ts` so preset metadata parsing and IndexedDB/localStorage fallback flow stay decoupled from studio composition.
- Studio control-panel event wiring (toggles/inputs and display labels) is now isolated in `studio-ui-controls-controller.ts` so UI wiring stays decoupled from studio composition.
- Studio preview/replay path derivation is now isolated in `studio-paths.ts`, centralizing centerline/boundary/coast semantics outside the main studio orchestrator.
- Broadcast mode now resizes the renderer to the real viewport so race coverage uses the full screen instead of leaving unused side areas.
- Press `Esc` in broadcast mode to return directly to the editor controls.
- Track remapping for broadcast now uses separate authored-editor viewport and target-broadcast viewport dimensions, fixing path/background mismatch on wide screens.
- Architecture direction is now explicitly split into three app roles: Studio (design/admin), Ops (race launch with presets), and Viewer (runtime race playback).
- Phase 2 core contracts are in progress: race session orchestration, deterministic RNG, adapter registry, and extensibility interfaces.
- CI workflow runtime is hardened for Node 24 JavaScript actions to reduce deprecation warning noise and lower future breakage risk.
- See `PROJECT_BASELINE.md` and `docs/ROADMAP_PHASES.md` for milestone details.

## Source Header Standard

- TypeScript source files use a top-of-file documentation block with `File`, `Model`, and `Purpose` fields.
- Current required model value in this workspace header format: `GPT-5.3-Codex`.
- Add concise inline comments only where intent is not obvious from the code itself.

## Language Policy

- Conversation language can be German.
- Game UI text, source code, comments, commit messages, and project documentation are English only.
