# Roadmap and Milestones

## Phase 1: Foundation

- Monorepo setup
- Shared contracts package
- Initial CI gates
- Status: Completed

## Phase 2: Race Engine Core

- Tick loop and deterministic RNG
- Duck adapter reference implementation
- Basic replay event model
- Status: In progress (deterministic RNG, session orchestration, and adapter registry active)

## Phase 3: Viewer and Admin

- Viewer canvas integration
- Player list management
- Race setup and launch flow

## Phase 4: Branding System

- Brand profile schema
- Brand CRUD endpoints
- Runtime brand application

## Phase 5: Persistence

- Database schema and migrations
- Presets and race result persistence
- Race history endpoints

## Phase 6: Extensibility Framework

- Adapter registration and validation
- Horse and Rocket adapters as examples
- Plugin author guide

## Phase 7: Testing and QA

- Unit + integration + e2e suites
- Deterministic simulation regression tests
- Performance baseline

## Phase 8: Security Audit

- Threat model review
- Input validation and auth hardening
- Dependency and configuration scanning

## Phase 9: Documentation and Examples

- API docs
- Setup and onboarding guide
- New race type and brand creation guides

## Phase 10: Release and CI/CD

- Production image build
- Staging and release workflow
- Rollback and incident checklist
- Hardened VPS deployment runbook
- One-command install script for reproducible provisioning
