# Project Baseline

## Scope Baseline

- Core race types in initial scope: Duck, Horse, Rocket.
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
- Core engine remains independent from UI, storage, and connector implementations.
- Deployment process must be reproducible and idempotent.

## Current Implementation Snapshot

- Phase 1 tooling is active with TypeScript, ESLint, Prettier, and Vitest.
- Minimal modular source boundaries exist for apps and core packages.
- Foundation smoke test is in place and running in CI.
- Phase 2 started with deterministic RNG, race session orchestration, and modular extension contracts.
- Web-viewer prototype is active: PixiJS scene renders a moving racer on an S-curve path with a cinematic `CameraController` (intro overview, slower intro transition, runtime-aware zoom pulses, and finish overview).
- `RaceSessionConfig` supports optional `cameraSettings` overrides so admin-managed races can tune cinematic behavior without changing viewer code.
- Track authoring workflow is active in the web-viewer: variable point-count path editor with live preview and TrackDefinition JSON export (copy/download + JSON reload).
- Track editor now supports background-image-assisted point placement, drag-to-edit points, and preview smoothing toggle for fast curve tuning.
- Track editor now supports a broadcast preview mode (camera follow and zoom rides) to evaluate the same perspective players will see during races.
- Broadcast preview is now fullscreen and high-DPI for player-like visual validation.
- Replay lane-fit tooling is now included: track-normal racer offsets and live lane-width control for curve/water alignment checks.
- Replay load simulation now scales up to 100 racers via packed formation layout for stress-testing dense race visuals.
- Lane-board overlay mode provides left/right boundary guides directly in replay/broadcast validation.
- Editor controls now include tooltip guidance for clearer parameter intent during track creation.
- Replay label visibility modes (`All`, `Leaders + Focus`, `Hover Only`) are implemented for high-density readability.
- Focus racer selection is implemented and persists a highlighted racer marker/name during replay and broadcast previews.
- Broadcast preview now includes a live leaderboard overlay that keeps both leaders and the focused racer discoverable.
- Replay visual policy logic is now extracted to a pure helper module so editor simulation and runtime race playback can reuse one behavior source.
- Track mapping, lane-board bounds, and path-normal geometry are now extracted to shared layout helpers for preview/runtime reuse.
- World transform reset and background clamping behavior are now extracted to shared Pixi transform helpers.
- Web-viewer entry now uses a thin bootstrap (`main.ts`) with studio feature composition moved to `studio-app.ts`.
- Surface bootstrap now dispatches by URL mode (`studio` default, `runtime` optional) through a dedicated dispatcher module.
- Runtime surface entry is now isolated in `runtime-app.ts` to prepare real race playback without studio coupling.
- Studio surface internals are now split into dedicated modules (`studio-dom`, `studio-render`, `studio-editor-helpers`) to reduce `studio-app.ts` complexity.
- Studio point-edit event flow (pointer interactions + preset buttons) is now extracted into `studio-point-editor-controller` to keep orchestrator responsibilities tighter.
- Studio replay frame tick behavior is now extracted into `studio-replay-controller` to decouple replay simulation/camera flow from studio composition.
- Studio single-preview frame tick behavior is now extracted into `studio-single-preview-controller` to decouple non-replay runner/camera flow from studio composition.
- Studio background image flow (load/clear/layout) is now extracted into `studio-background-controller` to decouple asset lifecycle from studio composition.
- Studio control-panel event wiring is now extracted into `studio-ui-controls-controller` to decouple UI listener wiring from studio composition.
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
