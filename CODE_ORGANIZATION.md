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
  - Exposes read-only catalog endpoints and validated launch endpoint (`POST /api/v1/races/start`).
- `apps/api/src/catalog.ts`
  - File-backed content catalog loaders for manifests + referenced JSON files.
  - Provides endpoint-ready metadata payloads (id/display/raceType + runtime metadata).
- `apps/api/src/race-launch-options.ts`
  - Modular launch-option resolver pipeline used by start-race endpoint validation.
  - Designed for additive extension: add new starter options by adding resolver units, not by rewriting route logic.
- `apps/api/src/app.ts`
  - Also stores launched race bootstrap records and serves runtime bootstrap payloads by race id.
- `apps/api/src/index.ts`
  - API package entry exports app factory and stable API app id.

## Shared Launch Contracts

- `packages/shared-types/src/race-launch.ts`
  - Shared launch request/resolved config contracts and baseline constraints.
  - Keeps API/admin/runtime launch option vocabulary consistent across modules.
- `packages/shared-types/src/runtime-bootstrap.ts`
  - Shared runtime bootstrap payload contract consumed by API and viewer runtime client.

## Web Admin Module Map

- `apps/web-admin/src/ops-launch-model.ts`
  - Pure selector-model helpers for Ops launch flow.
  - Resolves default/explicit track+racer selections and builds id-only start-race request payloads.
- `apps/web-admin/src/index.ts`
  - Web-admin package entry exports Ops launch helpers, orientation option metadata for UI dropdowns, and stable web-admin app id.

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
  - Binds visible studio surface selectors (race type/category/size/profile) to shared effect resolution.
  - Applies authoring-time on-track sprite-size control for single preview.
- `apps/web-viewer/src/studio-paths.ts`
  - Shared studio path-resolution helpers for centerline/boundary preview and replay path derivation.
  - Keeps coast-end semantics and boundary midpoint rules in one reusable module.
- `apps/web-viewer/src/studio-track-edit-helpers.ts`
  - Pure centerline/boundary edit-state helpers for point editing and boundary generation.
  - Keeps track-edit state transitions out of the studio app orchestration flow.
- `apps/web-viewer/src/studio-dom.ts`
  - Centralized studio DOM resolution and control typing.
  - Removes duplicated selector/ID wiring from app orchestrators.
- `apps/web-viewer/src/studio-render.ts`
  - Shared studio drawing/export helpers (grid, path markers, lane boards, leaderboard rows, JSON export).
  - Keeps render-specific logic separate from runtime orchestration flow.
- `apps/web-viewer/src/studio-editor-helpers.ts`
  - Small pure editor helpers (rounding, view clamping, nearest-point hit testing).
  - Unit-testable utility layer for pointer editing behavior.
- `apps/web-viewer/src/studio-generators.ts`
  - Auto-generation helpers for dev workflows (track templates and sprite-sheet generation from source image).
  - Keeps generator logic isolated from studio surface orchestration.
- `apps/web-viewer/src/studio-point-editor-controller.ts`
  - Owns stage pointer editing flow and preset point-button wiring for studio authoring.
  - Keeps event-heavy point-edit logic out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-replay-controller.ts`
  - Owns replay-mode frame tick flow (racer placement, label policy, leaderboard refresh, broadcast camera handoff).
  - Keeps replay simulation and broadcast-follow behavior out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-replay-utils.ts`
  - Pure replay helper layer (cinematic plan, finish/coast progress transitions, coast decay math, path metrics, run-path/coast-end safety mapping, collision/separation policy, transient-state reset, label-application policy, camera selection, and ranking helper functions).
  - Keeps low-level replay math/policy utilities separate from frame orchestration flow.
- `apps/web-viewer/src/studio-replay-racer-builder.ts`
  - Builds and resets replay racer sprites/labels/hover handlers for studio replay mode.
  - Keeps replay racer-view construction lifecycle out of studio app orchestration.
- `apps/web-viewer/src/studio-single-preview-controller.ts`
  - Owns single-runner preview tick flow used outside replay mode.
  - Keeps preview-only runner/camera update behavior out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-background-controller.ts`
  - Owns background image load/clear/layout behavior for editor and broadcast view states.
  - Keeps background asset lifecycle and cover/contain layout transitions out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-preset-store.ts`
  - Owns studio preset persistence helpers (localStorage preset metadata + IndexedDB background image assets).
  - Keeps persistence and storage-fallback behavior out of studio composition/orchestration flow.
- `apps/web-viewer/src/studio-preset-select-state.ts`
  - Pure preset-dropdown selection model helper derived from preset store state.
  - Keeps preset select fallback/selection policy logic out of studio app orchestration.
- `apps/web-viewer/src/studio-file-utils.ts`
  - Shared browser utility helpers for studio file download and local image loading.
  - Keeps Blob/data-url/image-loader utility behavior out of studio app orchestration.
- `apps/web-viewer/src/studio-racer-pack-utils.ts`
  - Shared runtime racer-pack fallback, frame sprite extraction, and preview-size helpers.
  - Keeps pack-cache and sprite extraction behavior out of studio app orchestration.
- `apps/web-viewer/src/studio-geometry-state.ts`
  - Shared geometry-state orientation rotation helper for centerline and boundaries.
  - Keeps duplicated orientation-rotation wiring out of studio app orchestration.
- `apps/web-viewer/src/studio-editor-view-state.ts`
  - Pure editor zoom/view transform math helpers for centered zoom and world positioning.
  - Keeps editor camera/zoom state math out of studio app orchestration.
- `apps/web-viewer/src/studio-surface-effects-state.ts`
  - Pure helper layer for studio surface-setup selection resolution and particle-emitter state transitions.
  - Keeps surface selector inference and emitter-state update flow out of studio app orchestration.
- `apps/web-viewer/src/studio-generator-ui-state.ts`
  - Pure helper layer for generator preset resolution and sprite-sheet warning text policy.
  - Keeps generator policy calculations out of studio app orchestration.
- `apps/web-viewer/src/studio-sprite-preview-state.ts`
  - Pure helper layer for sprite-preview frame/variant animation state progression.
  - Keeps preview animation stepping policy out of studio app orchestration.
- `apps/web-viewer/src/studio-sprite-preview-render.ts`
  - Shared sprite-preview canvas drawing and texture extraction helpers.
  - Keeps preview rendering logic out of studio app orchestration.
- `apps/web-viewer/src/studio-track-json-load-state.ts`
  - Pure helper layer for parsing and normalizing studio track JSON imports.
  - Keeps JSON load validation/normalization flow out of studio app orchestration.
- `apps/web-viewer/src/studio-preset-actions.ts`
  - Shared helper layer for studio preset build/save/load/delete state logic.
  - Keeps preset lifecycle parsing and persistence flow out of studio app orchestration.
- `apps/web-viewer/src/studio-runner-preview-texture.ts`
  - Shared helper layer for runner preview texture selection and scale policy.
  - Keeps ticker rendering-policy calculations out of studio app orchestration.
- `apps/web-viewer/src/studio-ui-controls-controller.ts`
  - Owns studio toggle/input listener wiring for preview, replay, broadcast, and lane/racer controls.
  - Keeps UI event wiring and button/label text updates out of the studio surface orchestrator.
- `apps/web-viewer/src/studio-ui-state.ts`
  - Applies current studio runtime state snapshot to control values and toggle button labels.
  - Keeps UI state synchronization mapping out of studio app orchestration.
- `apps/web-viewer/src/surface-effects.ts`
  - Shared surface-effect profile system (profile resolution, category mapping, size scaling, particle emission/tick/draw helpers, and motion-style pose helpers).
  - Central extension point for adding new race-world themes (water, sand, snow, ash, space, neon, etc.) and category-specific visual intensity behavior.
- `apps/web-viewer/src/runtime-app.ts`
  - Runtime race surface entry isolated from studio authoring controls.
  - Serves as dedicated integration point for real game playback logic.
  - Applies shared surface-effect profile/category behavior and motion-style glyph rendering for runtime visual feedback.
  - Auto-scales runtime racer sprite size from racer count for consistent readability.
  - Consumes runtime bootstrap payload when `raceId` is provided in URL query.
- `apps/web-viewer/src/admin-app.ts`
  - Dedicated admin launch surface (`?mode=admin`) with catalog fetch, id selectors, orientation control, payload preview, and race start actions.
  - Reuses web-admin launch model helpers so UI launch requests stay contract-aligned with API/runtime flow.
- `apps/web-viewer/src/runtime-bootstrap-client.ts`
  - URL/query helpers + API fetch wrapper for runtime bootstrap payload loading.
- `apps/web-viewer/src/runtime-track.ts`
  - Pure runtime geometry helpers that map bootstrap track points to the active viewport.
  - Provides runtime track sampling fallback so playback still runs when bootstrap track data is incomplete.
- `apps/web-viewer/src/track-orientation.ts`
  - Shared orientation normalization and point-rotation helpers for runtime race direction variants.
  - Supports configurable playback direction (`left-to-right` and `top-to-bottom`) without changing core track data.
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
