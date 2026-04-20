# Locked Decisions

The following decisions are locked unless explicitly changed via ADR:

1. Language policy

- User conversation may be German.
- Game text, code, comments, commit messages, and docs remain English.

2. Architecture direction

- TypeScript-first monorepo.
- Separate frontend, backend, race engine, race types, branding modules.

3. API strategy

- REST API with versioning (`/api/v1`) as baseline.

4. Extensibility strategy

- Race types through adapter/plugin contract.
- **`RaceTypeKey` is `string` (open type)** — built-in values exported via `KNOWN_RACE_TYPES`
  constants. Third-party or future race types supply their own key without touching shared-types.
- Each race type ships a `RaceTypeManifest` (assets, animations, default effect profile).
  Viewer resolves manifests via `RaceTypeManifestProvider` — no hardcoded type switches in viewer.
- Brands through schema-driven profiles and validated APIs.
- Tracks through pluggable path and environment configuration.
- Player name lists through provider/import adapters (manual, file, API).
- Results through export adapters (JSON, CSV, webhook payload).
- External integrations through connector adapters (for bots and other services).

5. Modularity-first rule

- New race types, tracks, brands, list providers, and export targets must be addable without
  changing core engine behavior or any existing source file.
- Adding a new race type = new adapter file + new manifest file + new asset folder. Zero other changes.
- Core modules may expose contracts only; implementation details stay behind module boundaries.
- No `switch (raceTypeKey)` or `if (raceTypeKey === 'duck')` in viewer, API, or engine code.
  All type-specific behavior flows through the plugin/manifest/provider pattern.

6. Quality strategy

- Tiered quality gates (light, extended, full) must exist and remain green before merge.

7. Delivery strategy

- Development and feature validation are local-first.
- Production target is VPS hosting.
- A secure one-command installation script is a mandatory release artifact.

8. Refactor discipline strategy

- Refactors must be necessity-driven.
- During dedicated refactor phases, larger coherent restructures are allowed.
- During feature implementation, changes must be clean-by-default so no later large cleanup wave is needed.
- Every refactor batch must include parity tests for affected behavior.
- Every refactor batch must update architecture/status docs in the same change set.
- Avoid creating new abstraction layers unless they remove clear duplication or reduce risk.
