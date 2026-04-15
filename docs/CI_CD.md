# CI/CD Plan

## Gate Levels

1. Light gate (commit-level intent)

- Lint
- Formatting check

2. Extended gate (PR-level intent)

- Light gate
- Typecheck
- Unit/integration tests

3. Full gate (merge/release intent)

- Extended gate
- Dependency audit
- Optional performance/security suites

## GitHub Workflow Policy

- Pull requests to `main` run at least extended gate.
- Pushes to `main` run full gate.
- Failing gate blocks merge.

## Package Manager and Lockfile Policy

- CI uses pnpm via Corepack-compatible setup.
- `pnpm-lock.yaml` must be committed and kept up to date.
- Dependency install in CI runs with frozen lockfile mode.

## Release Expectations

- Tag-based release workflow.
- Build artifacts generated from clean main branch.
- Rollback procedure documented before first production release.
- VPS deployment must be executable from a single command.
- Install process must be idempotent and documented in a runbook.
