# Quality Gates

This project uses a strict, tiered gate model.

## Gate Matrix
1. Commit gate (light)
- Command: `pnpm ci:light`
- Purpose: quick local confidence (lint + formatting)

2. Pull request gate (extended)
- Command: `pnpm ci:extended`
- Purpose: enforce lint/format + type safety + tests

3. Merge/release gate (full)
- Command: `pnpm ci:full`
- Purpose: full confidence including dependency security checks

## Rules
- Do not open PR with a failing extended gate.
- Do not merge with a failing full gate.
- Update docs in the same change when behavior/contracts change.
