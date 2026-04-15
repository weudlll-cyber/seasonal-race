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

4. `docs/*`

- Source of truth for architecture, standards, and process.

## Dependency Rules

- `apps` may depend on `packages`.
- `packages` may depend on `shared-types` and utility libraries.
- `race-types` adapters depend on `race-engine` contracts only.
- No circular dependencies.

## Modularity Rules

- New race types must be implemented as adapters, not core-engine edits.
- New brand profiles must be schema-first and validated at API/UI boundaries.
- Keep files and functions small; split by responsibility.

## Web Viewer Module Map

- `apps/web-viewer/src/main.ts`
  - Viewer bootstrap and interactive track editor wiring.
  - Handles click-to-place points, live preview runner, and JSON import/export actions.
- `apps/web-viewer/src/camera.ts`
  - `CameraController` for smooth world follow/zoom behavior.
  - Receives camera-ready race state and applies interpolated world transform.
- `apps/web-viewer/src/track-editor-utils.ts`
  - Reusable path utilities for editor mode.
  - Builds TrackDefinition output and interpolates movement over variable point-count paths.
- `apps/web-viewer/src/scene.ts`
  - Layered scene builder (background, environment, obstacles, racers, trails, bursts, finish).
  - Asset load with placeholder fallback to keep rendering resilient during asset gaps.
- `apps/web-viewer/src/viewer-model.ts`
  - Fixed-step simulation adapter (`100ms`) from race session to viewer-facing state.
  - Produces both racer state and camera-ready state.
