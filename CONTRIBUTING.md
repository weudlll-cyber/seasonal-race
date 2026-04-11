# Contributing

## Branching
- `main` is protected.
- Use short-lived branches:
  - `feature/<topic>`
  - `fix/<topic>`
  - `chore/<topic>`

## Commit Style
- Conventional Commits:
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `docs: ...`
  - `test: ...`
  - `chore: ...`
  - `security: ...`

## Development Rules
- Keep all code and docs in English.
- Add or update tests for behavior changes.
- Update relevant docs in the same commit as code changes.
- Avoid hard-coded values when configuration is possible.

## Quality Gates
- During iteration: targeted checks allowed.
- Before PR/merge: full gate required.
- Use:
  - `pnpm ci:light`
  - `pnpm ci:extended`
  - `pnpm ci:full`

## Pull Request Checklist
- [ ] Scope and intent are clear.
- [ ] Tests updated or added.
- [ ] Architecture and API docs updated if needed.
- [ ] Security impact reviewed.
- [ ] Full CI gate is green.
