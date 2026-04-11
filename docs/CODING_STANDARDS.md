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

## Commits and Branches

- Conventional commit format.
- Feature/fix/chore branch naming.
- Squash or clean history before merge.
