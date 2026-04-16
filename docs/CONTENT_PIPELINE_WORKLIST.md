# Content Pipeline Worklist

Purpose: Stop anytime and resume exactly from the next unchecked item.

## Locked Rule (Non-Negotiable)

- Single source of truth for tracks, racers, manifests, and future game content.
- Content is authored once in git, used locally, and synced to VPS from the same source.
- No duplicate manual maintenance for local and VPS.

## Current State

- [x] Create git-tracked content root folders:
  - [x] content/tracks
  - [x] content/racers
  - [x] content/manifests

## Phase 1 - Starter Content

- [ ] Add 3 example tracks in content/tracks:
  - [ ] duck-canal-s-curve.json
  - [ ] horse-arena-oval.json
  - [ ] mixed-zigzag-demo.json
- [ ] Add 2 example racer lists in content/racers:
  - [ ] duck-default.json
  - [ ] horse-default.json
- [ ] Add a content manifest in content/manifests:
  - [ ] tracks.manifest.json
  - [ ] racers.manifest.json

## Phase 2 - Local Runtime Sync

- [ ] Add local sync script: scripts/sync-content-local.ps1
- [ ] Target local runtime directory:
  - [ ] apps/api/runtime-content
  - [ ] apps/web-viewer/public/content
- [ ] Add package script shortcuts:
  - [ ] content:sync:local
  - [ ] content:validate

## Phase 3 - VPS Runtime Sync

- [ ] Add VPS sync script: scripts/sync-content-vps.sh
- [ ] Define VPS target directories:
  - [ ] /opt/seasonal-race/data/content/tracks
  - [ ] /opt/seasonal-race/data/content/racers
  - [ ] /opt/seasonal-race/data/content/manifests
- [ ] Integrate sync into deployment flow:
  - [ ] scripts/install-vps.sh calls sync step
  - [ ] post-sync verification output

## Phase 4 - Validation and Safety

- [ ] Add schema/type validation for content JSON files
- [ ] Add CI check to fail on invalid content files
- [ ] Add duplicate-id checks across manifests
- [ ] Add minimum path checks (for track points)

## Phase 5 - Selection Integration

- [ ] Expose track catalog endpoint in API
- [ ] Expose racer list catalog endpoint in API
- [ ] Add admin selectors for track and racer list
- [ ] Ensure race start uses selected ids only

## Phase 6 - Documentation and Runbook

- [ ] Add local usage guide section in README
- [ ] Add VPS sync runbook in docs/VPS_DEPLOYMENT.md
- [ ] Add troubleshooting section (missing file, invalid json, duplicate id)
- [ ] Add resume guide note referencing this worklist

## Resume Rule

- Always continue from the first unchecked item in this file.
- After each completed item, check it immediately in the same commit.
- Keep this file updated in every related PR.

## Suggested Commit Strategy

- feat(content): add starter content examples and manifests
- feat(content): add local sync pipeline
- feat(content): add vps sync pipeline
- test(content): add schema and validation checks
- feat(admin): add track and racer selection wiring
- docs(content): add local and vps usage runbook
