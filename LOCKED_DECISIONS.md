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
- Brands through schema-driven profiles and validated APIs.
- Tracks through pluggable path and environment configuration.
- Player name lists through provider/import adapters (manual, file, API).
- Results through export adapters (JSON, CSV, webhook payload).
- External integrations through connector adapters (for bots and other services).

5. Modularity-first rule

- New race types, tracks, brands, list providers, and export targets must be addable without changing core engine behavior.
- Core modules may expose contracts only; implementation details stay behind module boundaries.

6. Quality strategy

- Tiered quality gates (light, extended, full) must exist and remain green before merge.
