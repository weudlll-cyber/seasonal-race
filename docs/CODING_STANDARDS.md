# Coding Standards

## Language and Typing

- TypeScript with strict mode enabled.
- Avoid `any` unless explicitly justified.
- Prefer interfaces and discriminated unions for domain models.

## Design Principles

- Keep modules cohesive and loosely coupled.
- Follow SOLID where practical.
- Use dependency injection for replaceable dependencies.
- Avoid hard-coded constants if configuration fits better.

## Naming

- Files: kebab-case
- Types/Interfaces: PascalCase
- Variables/Functions: camelCase
- Constants: UPPER_SNAKE_CASE

## Formatting and Linting

- ESLint and Prettier are required.
- Keep import order deterministic.
- Fail CI on lint or format violations.

## Documentation

- Public modules require purpose and usage notes.
- API changes must include OpenAPI updates.
- Keep docs synchronized with implementation in the same change set.
- Each source file must include a clear top header with purpose, usage, dependencies, and edge-case notes.
- Add inline comments only where logic is non-obvious; comments must explain intent, not restate code.

## Source Hygiene

- Remove dead code and avoid duplicated logic.
- Prefer extracting shared utilities over copy/paste.
- Keep source files and functions small and composable.
- Target file size under 300 lines; split files approaching 500+ lines.

## Commits and Branches

- Conventional commit format.
- Feature/fix/chore branch naming.
- Squash or clean history before merge.
