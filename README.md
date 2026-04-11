# Seasonal Race

A modular, extensible race-game platform with multiple race types (Duck, Horse, Rocket), reusable branding, and a maintainable architecture.

## Product Goals
- Support multiple race types through a plugin-style contract.
- Keep race visuals attractive with lightweight procedural animations.
- Provide a responsive race viewer and an admin panel.
- Maintain strict engineering quality: typed contracts, tests, CI, security checks.

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
- `pnpm ci:light`: lint + formatting checks
- `pnpm ci:extended`: light gate + typecheck + tests
- `pnpm ci:full`: extended gate + dependency security checks

## Local Package Manager Setup
- Use Corepack to run pnpm without global admin installation.
- Recommended commands:
	- `corepack pnpm --version`
	- `corepack pnpm install`
	- `corepack pnpm run ci:full`
- Keep `pnpm-lock.yaml` committed for reproducible CI runs.

## Current Status
- Project bootstrap and documentation baseline created.
- Implementation has not started yet.
- See `PROJECT_BASELINE.md` and `docs/ROADMAP_PHASES.md` for milestone details.

## Language Policy
- Conversation language can be German.
- Game UI text, source code, comments, commit messages, and project documentation are English only.
