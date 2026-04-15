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
