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

5. Quality strategy
- Tiered quality gates (light, extended, full) must exist and remain green before merge.
