# Project Baseline

## Scope Baseline

- Core race types in initial scope: Duck, Horse, Rocket.
- Viewer visual baseline for MVP is top-down (bird-eye) broadcast presentation; frontal/side camera rendering is out of MVP scope.
- Brand system applies to all race types.
- Admin panel manages players, presets, race settings, and brand profiles.
- Extensibility model must support low-friction race-type additions.
- Track model must support easy addition of new track layouts and effects.
- Name-list system must support import/export and reusable list presets.
- Results must be exportable (at minimum JSON and CSV).
- Integration layer must support connecting existing bots through adapters/webhooks.
- Local-first testing is mandatory before VPS rollout.
- VPS hosting is the production target with one-command installation support.

## Engineering Baseline

- Monorepo with strict TypeScript boundaries.
- Versioned REST API under `/api/v1`.
- Deterministic race simulation mode with reproducible seed.
- CI quality gates with staged strictness (light, extended, full).
- Content validation gate integrated in CI extended/full stages.
- Core engine remains independent from UI, storage, and connector implementations.
- Deployment process must be reproducible and idempotent.

## Current Implementation Snapshot

- Phase 1 tooling is active with TypeScript, ESLint, Prettier, and Vitest.
- Minimal modular source boundaries exist for apps and core packages.
- Foundation smoke test is in place and running in CI.
- Starter content catalog is now established with tracked track files, racer lists, and manifests under `content/`.
- Manifest and content JSON validation now enforces schema, duplicate-id checks, and minimum track-point counts.
- API content-catalog endpoints are active for selection workflows (`/api/v1/catalog/tracks`, `/api/v1/catalog/racers`) with endpoint tests covering success and invalid-file handling.
- API race launch endpoint is active (`/api/v1/races/start`) and enforces id-based selection with validation for required ids, existence, and track/racer race-type compatibility.
- Ops/Admin launch selector model is now in place to default valid selections and generate id-only start-race request payloads.
- Ops/Admin launch helpers now support an explicit `trackOrientation` launch option that is mapped into launch `options.trackOrientation` for runtime direction control.
- Ops/Admin launch model now includes UI-ready orientation option metadata plus default selected orientation state for upcoming launch dropdown controls.
- Launch configuration contracts are now centralized in shared types (`race-launch`) and API option resolution is modularized, so future starter features can be added as new option resolvers instead of route rewrites.
- Runtime bootstrap endpoint is now active (`/api/v1/races/:raceId/runtime-bootstrap`) and provides launched race config plus track/racer metadata for viewer startup.
- Runtime viewer wiring now resolves race id from URL and consumes runtime bootstrap payload through a dedicated runtime client helper.
- Runtime viewer playback now renders movement on bootstrap-provided track geometry (viewport-mapped) and drives lap timing from launch duration.
- Runtime viewer now supports orientation toggles for race direction variability (`left-to-right` and `top-to-bottom`) via runtime query and launch options.
- Contract regression coverage now includes a full launch-to-runtime path test (admin launch model -> API start -> runtime bootstrap payload consistency assertions).
- Visual MVP requirement and optional polish split is now documented in `docs/VISUAL_MVP_CHECKLIST.md`.
- Phase 2 started with deterministic RNG, race session orchestration, and modular extension contracts.
- Web-viewer prototype is active: PixiJS scene renders a moving racer on an S-curve path with a cinematic `CameraController` (intro overview, slower intro transition, runtime-aware zoom pulses, and finish overview).
- `RaceSessionConfig` supports optional `cameraSettings` overrides so admin-managed races can tune cinematic behavior without changing viewer code.
- Track authoring workflow is active in the web-viewer: variable point-count path editor with live preview and TrackDefinition JSON export (copy/download + JSON reload).
- Track editor now supports background-image-assisted point placement, drag-to-edit points, and preview smoothing toggle for fast curve tuning.
- Track editor now supports named saved test presets (local browser storage) that restore points plus replay/editor controls for fast repeated validation cycles.
- Studio track preview now supports orientation switching (`left-to-right` and `top-to-bottom`) for race-direction variability tests.
- Studio control panel layout is now compact and track-definition-first, with replay/preset/advanced controls collapsed by default to keep primary authoring controls visible without mandatory scrolling.
- Studio orientation switching now applies to the actual editable geometry (curve and boundaries), not only playback direction metadata, so authored path layout visibly updates when toggling direction.
- Studio editing now supports precision zoom (mouse wheel, zoom slider, and reset action) for accurate boundary-point placement on dense track maps.
- Studio now includes auto track template generation in the dev surface (S-curve, oval, zigzag, river bend) with configurable point density.
- Studio now includes automatic racer-pack generation from one source image, including deterministic variant tint/pattern assignment and downloadable generated sheet PNG + frame metadata JSON.
- Studio racer-pack generator now includes quick presets (`Minimal`, `Balanced`, `Max Contrast`) to keep high-contrast multi-racer setup one-click simple.
- Studio replay racer rendering now consumes generated racer-pack visuals directly (with built-in fallback auto-pack), keeping replay/broadcast look consistent with exported pack output.
- Track metadata and raw JSON controls are now optional advanced sections so default test workflow stays lightweight.
- Track editor now supports a broadcast preview mode (camera follow and zoom rides) to evaluate the same perspective players will see during races.
- Broadcast preview is now fullscreen and high-DPI for player-like visual validation.
- Replay lane-fit tooling is now included: track-normal racer offsets and live lane-width control for curve/water alignment checks.
- Replay load simulation now scales up to 100 racers via packed formation layout for stress-testing dense race visuals.
- Lane-board overlay mode provides left/right boundary guides directly in replay/broadcast validation.
- Editor controls now include tooltip guidance for clearer parameter intent during track creation.
- Replay label visibility modes (`All`, `Leaders + Focus`, `Hover Only`) are implemented for high-density readability.
- Focus racer selection is implemented and persists a highlighted racer marker/name during replay and broadcast previews.
- Broadcast preview now includes a live leaderboard overlay that keeps both leaders and the focused racer discoverable.
- Leaders-focus label mode now follows live race placement changes instead of sticking to static racer IDs.
- Replay leaderboard rank ordering now follows live placement/progress rather than racer number.
- Replay start now uses a staged formation blend for a realistic race launch feel.
- Replay broadcast now includes a short pre-start lineup hold with no pre-race camera roam, clearly stronger in/out zoom contrast via variable camera beats with tighter leader framing, and per-racer finish/coast triggering when each racer crosses the line.
- Post-finish coast now continues racers forward at a reduced speed while preserving their relative finish spread.
- Top-five order is now locked once those racers finish, while lower finish positions may still reshuffle during coast-out.
- Replay leaderboard rendering now decouples finish-order ranking from displayed progress percent so output remains within 0-100%.
- Broadcast camera now allows a higher zoom ceiling so leader-focused cinematic beats produce visibly closer framing.
- Camera interpolation is now tuned slower for smoother broadcast pan/zoom transitions.
- Replay finish now supports a two-endpoint flow: penultimate track point as finish line and final track point as coast-zone end, with per-racer deceleration through that zone.
- Studio editor now enforces at least three control points with explicit role colors: start (green), finish (yellow), coast-end (red).
- Coast braking is now distributed by finish order so trailing racers decelerate earlier/stronger and avoid collapsing into a single line at coast end.
- Preset background images now persist through a dedicated IndexedDB asset store (with fallback path), improving reliability for larger local images.
- Broadcast camera now allows stronger leader close-ups while retaining slower interpolation for smoother motion.
- Broadcast replay now overlays an explicit finish-line guide plus coast-end marker for clearer manual validation.
- Coast-out now applies stronger finish-order braking and per-racer spread targets to prevent late-pack collapse into one line.
- Finish/coast geometry now anchors directly to authored control points (penultimate=finish, final=coast end) so broadcast spacing matches editor intent.
- Replay data generation now lets each racer reach progress=1.0 at their own natural time instead of forcing all racers to 1.0 in a synthetic final frame; this eliminates the "all racers accelerate and pack together at finish" artifact that no controller-side fix could override.
- Finish-phase controller uses a clean 3-state model: normal replay-driven, crossed-finish/post-data coast with carried rate + gentle decay, and finished-at-coast-end. No global result-lock or pre-finish frame lookups needed.
- Replay movement remains continuous until coast endpoint, while displayed results stay locked at finish-line crossing order.
- Leaders-focus name labeling now uses live progress leaders (not result-lock sorting), with strict top-5-only selection and deterministic tie handling.
- Top-5 leaders now receive stronger visual emphasis (marker alpha, sprite scale, z-order) to improve quick identification in dense packs.
- Replay volatility model now keeps frequent overtakes but with reduced momentum/surge extremes for more realistic acceleration/deceleration.
- Replay simulation now adds a mild early/mid anti-persistence top-pack pressure (with slight chaser assist) so initial leaders are less likely to remain unchanged through the whole race.
- Replay mid-race variability is now slightly increased (additional surge density and mild coefficient lift) to improve natural leader churn.
- Finish camera framing now prioritizes uncrossed racers during the late phase so finish-line plus late crossers stay visible longer.
- Finish camera run-in now uses progress-mapped centerline anchors instead of post-collision sprite offsets, removing finish-area camera shake.
- Finish pacing now enforces no synthetic slowdown before the line: racers keep strong approach speed until crossing, and only then transition into coast deceleration.
- Coast settling now includes deterministic time-complete freeze in addition to stop-progress threshold, with freeze-at-current-position (no last-frame snap to stop target) to prevent rare never-settle oscillation and end-position jump artifacts.
- Studio replay controller internals were cleaned by removing unused per-racer world-history fields and replacing per-racer frame scans with a precomputed per-frame progress map.
- Studio replay controller readability was further improved by extracting small behavior-preserving helpers (clip-zone threshold constant, linear-decay coast helper, finish-camera centerline mapper).
- Studio replay controller comments were normalized for clarity/maintenance without changing replay behavior.
- Studio replay controller formatting was additionally normalized by splitting dense expressions into readable blocks, without changing replay behavior.
- Replay row-lag formation offsets now fade out through race progression so late-race leading order reflects live performance instead of fixed row/index spacing.
- Run-out stopping now distributes by crossing order with a wider spread window and mild jitter, so trailing racers settle earlier and leaders coast farther instead of converging onto one final line.
- Studio track editor now supports two-boundary authoring (left/right lines) with boundary-side editing controls, boundary-aware JSON/preset persistence, and midpoint path derivation for replay/runtime movement.
- Replay/broadcast racer lateral spacing now adapts to measured boundary corridor width along track progress, so racers can use the full authored track width in boundary mode.
- Boundary-mode replay now preserves authored finish/rollout spacing in broadcast by deriving semantic finish/coast points from boundary control-point midpoints.
- Replay lateral behavior now uses continuous free-swim steering (non-rigid lane locking) with smooth second-order side transitions, front-traffic avoidance, and stronger local anti-collision separation to reduce overlaps.
- Finished racers now anchor at their reached rollout stop-progress and cannot snap backward toward the finish line (strict monotonic progress guard).
- Post-finish coast now uses order-aware exponential deceleration with phase-smoothed braking, so front finishers do not brake abruptly at the line and carry speed farther while later finishers still brake earlier.
- Later finishers now receive deterministic rollout stop targets distributed across nearly the full authored coast zone (front finishers near coast-end, later finishers progressively closer to finish).
- Stopped racers are now permanently pixel-locked at their final world-space position; no frame-to-frame path recalculation can cause drift or reversal.
- Coast zone path segment is now always projected forward along the race-path tangent direction, with dot-product safety check preventing backward segments even if authored coast point is misplaced.
- Race centerline in boundary mode is now derived only from boundary points excluding the final (coast-end) point, so the racePath naturally ends at the finish line. Convention: first point = start, penultimate = finish, last = coast-zone end.
- Pixel-space collision avoidance now uses sprite-diameter separation with moderated coast-zone push and reduced post-finish lateral drift, preventing overlap while avoiding finish-area jitter.
- Collision amplification now starts only after a short inside-coast buffer, reducing abrupt offsets at finish-line crossing.
- Near finish-line crossing, coast-zone collision response is now lateral-only (no tangential push), preventing brief stop-like jolts.
- Studio replay data generation now incorporates run-seeded variance so consecutive races are no longer identical and produce less predictable lead persistence.
- Replay name tags now render from a dedicated overlay layer above racer sprites, enforcing consistent non-occluded label visibility.
- Coast rollout now uses a smooth two-phase per-racer braking model (cruise segment then progressive brake segment), removing abrupt deceleration at line crossing.
- Brake-start timing is order-aware and tied to each racer’s rollout target: leaders brake latest, later finishers brake progressively earlier.
- Coast-zone stop mapping guarantees a minimum rollout distance beyond the finish line for every racer.
- Coast entry now enforces continuous forward progression in a short finish-crossing window, then transitions into visible progressive braking toward each racer's stop point.
- Rollout lateral control now expands toward boundary limits, allowing racers to use nearly full track width in coast zone.
- Coast-zone collision handling now increases lateral spread deeper in rollout so the pack distributes across width instead of remaining compressed near center.
- Replay start pacing now uses a smooth launch ramp with early no-overshoot capping, avoiding burst-then-slow behavior and keeping acceleration natural up to race pace.
- Early start pack spacing is restored with stronger initial row separation that still fades quickly, preserving readability without long-term start-row bias.
- Early start pack spacing now also applies a temporary visual longitudinal spread along track direction, preventing start clumping while keeping race-progression fairness intact.
- Replay visual policy logic is now extracted to a pure helper module so editor simulation and runtime race playback can reuse one behavior source.
- Track mapping, lane-board bounds, and path-normal geometry are now extracted to shared layout helpers for preview/runtime reuse.
- World transform reset and background clamping behavior are now extracted to shared Pixi transform helpers.
- Web-viewer entry now uses a thin bootstrap (`main.ts`) with studio feature composition moved to `studio-app.ts`.
- Surface bootstrap now dispatches by URL mode (`studio` default, `runtime` optional) through a dedicated dispatcher module.
- Surface bootstrap now also supports an `admin` mode with a complete web launch console (track/racer selection, orientation selector, request preview, and start-race action wired to API catalogs).
- Runtime surface entry is now isolated in `runtime-app.ts` to prepare real race playback without studio coupling.
- Studio surface internals are now split into dedicated modules (`studio-dom`, `studio-render`, `studio-editor-helpers`) to reduce `studio-app.ts` complexity.
- Studio point-edit event flow (pointer interactions + preset buttons) is now extracted into `studio-point-editor-controller` to keep orchestrator responsibilities tighter.
- Studio replay frame tick behavior is now extracted into `studio-replay-controller` to decouple replay simulation/camera flow from studio composition.
- Studio single-preview frame tick behavior is now extracted into `studio-single-preview-controller` to decouple non-replay runner/camera flow from studio composition.
- Studio background image flow (load/clear/layout) is now extracted into `studio-background-controller` to decouple asset lifecycle from studio composition.
- Studio control-panel event wiring is now extracted into `studio-ui-controls-controller` to decouple UI listener wiring from studio composition.
- Broadcast mode now resizes the renderer to the real viewport so race playback fills the full screen area.
- Broadcast mode now supports `Esc` as a direct return shortcut back to editor mode.
- Authored-to-broadcast track remapping now uses distinct source/target viewport dimensions to keep race path aligned with the background image in broadcast mode.
- UI architecture direction is documented as separate Studio (authoring), Ops (launch-only controls), and Viewer (runtime playback) app responsibilities.

## Visual Baseline

- Curved tracks supported by path-based movement (not X-axis-only).
- Lightweight procedural animation effects:
  - Duck: water motion, wake, bubbles.
  - Horse: gallop bounce, dust particles.
  - Rocket: cloud parallax, flame particles.

## Security Baseline

- Input validation at all API boundaries.
- Authn/Authz required for admin actions.
- Dependency scanning in full CI gate.

## Test Baseline

- Unit tests for engine, config validation, and domain services.
- Integration tests for API + persistence + race lifecycle.
- E2E tests for admin-to-viewer flow.
- Deterministic simulation regression suite.
