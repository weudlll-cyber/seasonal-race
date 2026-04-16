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
- `corepack pnpm run ci:extended`: light gate + typecheck + tests
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

## Current Status

- Project bootstrap and documentation baseline created.
- Phase 1 foundation tooling is active (TypeScript, ESLint, Prettier, Vitest).
- Minimal modular app/package skeletons are in place for API, viewer, admin, engine, race types, branding, and shared types.
- Web viewer prototype is running with PixiJS: a sprite follows an S-curve track and a cinematic camera starts in overview mode, transitions into leader focus, applies runtime-aware zoom pulses, and returns to an end overview.
- Race sessions can optionally provide `cameraSettings` to override cinematic defaults (expected duration, pulse count/strength, intro hold, intro transition).
- Web viewer includes an interactive track path editor: click-to-place variable point counts, live path preview, and TrackDefinition JSON copy/download for fast creation of many track layouts.
- Track editor supports background image import, drag-to-edit points, and optional smooth-preview mode for curved route visualization.
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
- Replay visual behavior is now centralized in a reusable policy helper module (`replay-visual-policy`) so editor simulation and future runtime race views share the same logic.
- Track mapping and lane-board geometry are now centralized in a reusable helper module (`track-layout-helpers`) shared by preview and runtime paths.
- Camera reset/background-bound clamping is now centralized in `world-transform-utils` to keep view behavior consistent across surfaces.
- Viewer entrypoint now uses a thin bootstrap `main.ts`, while studio authoring logic is hosted in `studio-app.ts` for cleaner multi-surface evolution.
- Bootstrap dispatch now supports explicit surface mode via URL (`?mode=studio` default, `?mode=runtime` for runtime entry).
- Runtime entry logic now exists in `runtime-app.ts` as a dedicated, isolated surface for real game playback evolution.
- Studio orchestration is now further modularized with dedicated DOM, render, and editor-helper modules to keep `studio-app.ts` focused on flow composition.
- Studio point-edit interactions (stage pointer events + preset buttons) are now isolated in `studio-point-editor-controller.ts` to reduce event wiring noise in `studio-app.ts`.
- Studio replay tick behavior is now isolated in `studio-replay-controller.ts` so replay visuals/camera flow can evolve independently from core studio wiring.
- Studio single-preview tick behavior is now isolated in `studio-single-preview-controller.ts` so non-replay runner/camera flow stays decoupled from studio composition.
- Studio background image flow (load/clear/layout) is now isolated in `studio-background-controller.ts` so asset lifecycle stays decoupled from studio composition.
- Studio control-panel event wiring (toggles/inputs and display labels) is now isolated in `studio-ui-controls-controller.ts` so UI wiring stays decoupled from studio composition.
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
