# Code Organization

## Monorepo Layers

1. `apps/*`

- Entry points and runtime composition.
- No business logic duplication.

2. `packages/*`

- Reusable domain modules.
- Clear contracts for race engine, race types, branding, and shared types.

3. `tests/*`

- End-to-end and cross-package integration tests.

4. `docs/*`

- Source of truth for architecture, standards, and process.

## Dependency Rules

- `apps` may depend on `packages`.
- `packages` may depend on `shared-types` and utility libraries.
- `race-types` adapters depend on `race-engine` contracts only.
- No circular dependencies.

## Modularity Rules

- New race types must be implemented as adapters, not core-engine edits.
- New brand profiles must be schema-first and validated at API/UI boundaries.
- Keep files and functions small; split by responsibility.
