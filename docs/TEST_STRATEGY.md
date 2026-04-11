# Test Strategy

## Goals
- Prevent regressions in simulation behavior.
- Ensure API and UI workflows remain stable.
- Keep race results reproducible in deterministic mode.

## Test Layers
1. Unit tests
- Engine math and state transitions
- Validation schemas
- Utility and mapping functions

2. Integration tests
- API routes and service orchestration
- Persistence and transaction behavior
- Realtime event streaming contracts

3. End-to-end tests
- Admin creates players/preset/brand
- Race starts and viewer displays progress
- Results and replay retrieval

4. Simulation regression tests
- Seed-based deterministic snapshots
- Statistical sanity checks for random events

5. Non-functional tests
- Performance: concurrent race sessions and viewer frame stability
- Security: authz, payload abuse, dependency vulnerabilities

## Gate Policy
- Local iteration: targeted tests allowed.
- PR: extended gate.
- Merge/release: full gate required.
