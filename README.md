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
- Phase 2 core contracts are in progress: race session orchestration, deterministic RNG, adapter registry, and extensibility interfaces.
- See `PROJECT_BASELINE.md` and `docs/ROADMAP_PHASES.md` for milestone details.

## Language Policy

- Conversation language can be German.
- Game UI text, source code, comments, commit messages, and project documentation are English only.
