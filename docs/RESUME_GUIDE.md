# Resume Guide

Use this file to quickly continue work after interruptions.

## Current Project State

- Bootstrap repository structure exists.
- Core architecture and standards docs exist.
- Phase 1 foundation tooling is active.
- Phase 2 race-engine core contracts are in progress.

## Next Recommended Action

1. Continue Phase 2 race-engine implementation.

2. Add first race adapter (Duck) on top of core contracts.

3. Start local vertical-slice validation (admin start -> viewer progression -> result object).

4. Prepare VPS deployment runbook and install script hardening checks.

## Always Run Before Push

- `corepack pnpm run ci:full`
- Confirm docs reflect the latest implementation state.
