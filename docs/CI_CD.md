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

## Release Expectations
- Tag-based release workflow.
- Build artifacts generated from clean main branch.
- Rollback procedure documented before first production release.
