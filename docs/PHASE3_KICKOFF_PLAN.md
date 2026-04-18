# Phase 3 Kickoff Plan (Viewer and Admin)

## Goal

Ship the first end-to-end launch flow where Ops/Admin selects published content, starts a race, and Viewer runs runtime playback from session data instead of studio-only controls.

## Start State (Prepared)

- Main branch protection restored with required status check: checks.
- Baseline merged on main: replay stabilization + hygiene gate.
- Working branch for next phase: feature/phase3-viewer-admin-kickoff.

## Priority Order

1. Content Catalog Foundation (do this first)

- Create starter content files from worklist first unchecked items:
  - content/tracks/duck-canal-s-curve.json
  - content/tracks/horse-arena-oval.json
  - content/tracks/mixed-zigzag-demo.json
  - content/racers/duck-default.json
  - content/racers/horse-default.json
  - content/manifests/tracks.manifest.json
  - content/manifests/racers.manifest.json
- Add content validation (shape, required ids, minimum points).
- Add CI content validation hook.

2. API Selection Endpoints

- Add read-only catalog endpoints:
  - GET /api/v1/catalog/tracks
  - GET /api/v1/catalog/racers
- Return id, displayName, type, and metadata needed by UI selectors.
- Add tests for success and invalid-file handling.

3. Ops/Admin Launch Flow

- Add selectors in admin/ops surface for track id and racer list id.
- Keep launch screen operation-only (no structural editing).
- Start-race request must pass selected catalog ids.

4. Runtime Viewer Wiring

- Use runtime surface as primary playback target for launched races.
- Feed runtime app with session snapshots/events and shared visual policies.
- Keep studio mode isolated for authoring only.

5. Contract and Regression Coverage

- Add integration tests for launch flow:
  - content id selection -> API session start -> viewer runtime payload acceptance.
- Keep deterministic mode regression tests active.
- Keep ci:full green on every phase PR.

## Definition of Done for Phase 3 Slice 1

- Ops/Admin can launch with selected track+racer catalog ids.
- API validates selected ids and starts session.
- Viewer runtime can play launched session data.
- Tests cover catalog endpoints and launch path.
- Docs updated: README, PROJECT_BASELINE, CODE_ORGANIZATION, ARCHITECTURE.

## Commit Sequence Recommendation

1. feat(content): add starter content catalogs and manifests
2. test(content): add content validation and CI hook
3. feat(api): expose track and racer catalog endpoints
4. feat(ops): add launch selectors wired to catalog ids
5. feat(viewer): connect runtime playback to launched session feed
6. docs: update phase-3 flow and runbooks
