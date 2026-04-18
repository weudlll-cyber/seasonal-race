# Code Organization

## Monorepo Layers

1. `apps/*`

- Entry points and runtime composition.
- No business logic duplication.

2. `packages/*`

- Reusable domain modules.
- Clear contracts for race engine, race types, branding, and shared types.

3. `tests/*`

- End-to-end and cross-package integration tests.

4. `content/*`

- Git-tracked runtime content source (tracks, racer lists, manifests).
- Validated by `content:validate` before PR merge.

5. `scripts/*`

- Operational automation scripts (quality gates, deployment, content validation/sync).

6. `docs/*`

- Source of truth for architecture, standards, and process.

## Dependency Rules

- `apps` may depend on `packages`.
- `packages` may depend on `shared-types` and utility libraries.
- `race-types` adapters depend on `race-engine` contracts only.
- No circular dependencies.

## API Module Map

- `apps/api/src/app.ts`
  - Fastify app factory with versioned API route registration.
  - Exposes read-only catalog endpoints for track and racer selection.
- `apps/api/src/catalog.ts`
  - File-backed content catalog loaders for manifests + referenced JSON files.
  - Provides endpoint-ready metadata payloads (id/display/raceType + runtime metadata).
- `apps/api/src/index.ts`
  - API package entry exports app factory and stable API app id.

## Modularity Rules

- New race types must be implemented as adapters, not core-engine edits.
- New brand profiles must be schema-first and validated at API/UI boundaries.
- Keep files and functions small; split by responsibility.

## Web Viewer Module Map

- `apps/web-viewer/src/main.ts`
  - Thin entry bootstrap only.
  - Dispatches to the active app surface module via URL mode (`?mode=studio` or `?mode=runtime`).
- `apps/web-viewer/src/app-surface-dispatcher.ts`
  - Resolves startup surface selection for entry bootstrap.
- `apps/web-viewer/src/studio-app.ts`
  - Studio surface composition and interactive track editor wiring.
  - Orchestrates mode switches, Pixi stage lifecycle, and module composition.
- `apps/web-viewer/src/studio-dom.ts`
  - Centralized studio DOM resolution and control typing.
  - Removes duplicated selector/ID wiring from app orchestrators.
- `apps/web-viewer/src/studio-render.ts`
  - Shared studio drawing/export helpers (grid, path markers, lane boards, leaderboard rows, JSON export).
  - Keeps render-specific logic separate from runtime orchestration flow.
- `apps/web-viewer/src/studio-editor-helpers.ts`
  - Small pure editor helpers (rounding, view clamping, nearest-point hit testing).
  - Unit-testable utility layer for pointer editing behavior.
- `apps/web-viewer/src/studio-point-editor-controller.ts`
  - Owns stage pointer editing flow and preset point-button wiring for studio authoring.
  - Keeps event-heavy point-edit logic out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-replay-controller.ts`
  - Owns replay-mode frame tick flow (racer placement, label policy, leaderboard refresh, broadcast camera handoff).
  - Keeps replay simulation and broadcast-follow behavior out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-single-preview-controller.ts`
  - Owns single-runner preview tick flow used outside replay mode.
  - Keeps preview-only runner/camera update behavior out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-background-controller.ts`
  - Owns background image load/clear/layout behavior for editor and broadcast view states.
  - Keeps background asset lifecycle and cover/contain layout transitions out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-ui-controls-controller.ts`
  - Owns studio toggle/input listener wiring for preview, replay, broadcast, and lane/racer controls.
  - Keeps UI event wiring and button/label text updates out of the studio surface orchestrator.
- `apps/web-viewer/src/runtime-app.ts`
  - Runtime race surface entry isolated from studio authoring controls.
  - Serves as dedicated integration point for real game playback logic.
- `apps/web-viewer/src/camera.ts`
  - `CameraController` for smooth world follow/zoom behavior.
  - Receives camera-ready race state and applies interpolated world transform.
- `apps/web-viewer/src/track-editor-utils.ts`
  - Reusable path utilities for editor mode.
  - Builds TrackDefinition output and interpolates movement over variable point-count paths.
- `apps/web-viewer/src/replay-utils.ts`
  - Deterministic in-memory replay frame generation for local authoring checks.
  - Time-based replay sampling helper used by broadcast and replay preview modes.
- `apps/web-viewer/src/replay-visual-policy.ts`
  - Pure helper module for replay racer IDs, pack layout, name-display policy, focus behavior, and leaderboard row building.
  - Designed for reuse across editor replay simulation and future runtime race views.
- `apps/web-viewer/src/track-layout-helpers.ts`
  - Pure geometry helpers for track normals, lane-board bounds, and authored-to-broadcast background point remapping.
  - Designed for reuse by studio editing previews and runtime race playback.
- `apps/web-viewer/src/world-transform-utils.ts`
  - Shared Pixi world transform helpers for camera reset and background clamping.
  - Keeps camera-bound behavior consistent across preview and runtime surfaces.
- `apps/web-viewer/src/scene.ts`
  - Layered scene builder (background, environment, obstacles, racers, trails, bursts, finish).
  - Asset load with placeholder fallback to keep rendering resilient during asset gaps.
- `apps/web-viewer/src/viewer-model.ts`
  - Fixed-step simulation adapter (`100ms`) from race session to viewer-facing state.
  - Produces both racer state and camera-ready state.

## Planned App Separation

- `apps/web-studio` (planned)
  - Design/admin surface for track, racer, and race-preset authoring.
  - Supports draft/validate/publish flow for versioned content.
- `apps/web-ops` (planned)
  - Race operations surface for selecting published assets and starting races.
  - No structural content edits; launch-time parameters only.
- `apps/web-viewer`
  - Runtime race rendering and spectator-facing playback behavior.
  - Reuses shared policy/helpers from viewer modules and packages.
