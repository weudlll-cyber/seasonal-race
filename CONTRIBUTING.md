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
- Keep files modular, avoid redundancy, and remove dead code.
- Ensure every source file has a descriptive top header block.
- Header minimum fields for TypeScript files:
  - `File: <workspace-relative-path>`
  - `Model: GPT-5.3-Codex`
  - `Purpose: <short module responsibility description>`
- Optional but recommended header fields: `Usage`, `Dependencies`.
- Add inline comments where reasoning is not obvious.
- Keep inline comments concise and intent-focused; avoid commentary for trivial assignments.

## Quality Gates

- During iteration: targeted checks allowed.
- Before PR/merge: full gate required.
- Before merge: explicit hygiene gate required.
- Before every push: full gate + manual security/source-hygiene review required.
- Use:
  - `corepack pnpm run ci:light`
  - `corepack pnpm run hygiene:merge`
  - `corepack pnpm run ci:extended`
  - `corepack pnpm run ci:full`

## Pull Request Checklist

- [ ] Scope and intent are clear.
- [ ] Tests updated or added.
- [ ] Architecture and API docs updated if needed.
- [ ] Security impact reviewed.
- [ ] Merge hygiene gate is green (`corepack pnpm run hygiene:merge`).
- [ ] Full CI gate is green.
