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

## Refactor Guardrails

- Only refactor when there is a clear benefit: bug risk reduction, duplication removal, readability, or easier extension.
- In dedicated refactor phases, larger coherent restructures are allowed when they clearly reduce long-term complexity.
- Outside dedicated refactor phases (especially during feature delivery), prefer small clean changes and avoid deferring structural cleanup.
- Before changing code, identify one concrete hotspot and one measurable target (for example: remove duplicate logic, reduce file size, extract one cohesive helper).
- Keep each refactor batch scoped so it can be reviewed quickly and reverted safely.
- Do not mix unrelated concerns in one refactor commit.
- For each extracted helper/module, add or update regression tests that prove behavior parity.
- If a refactor increases complexity or introduces indirection without clear gain, stop and choose the smaller change.
- Keep orchestration files focused on wiring; move dense policy/math/state transitions into pure helpers.
- After each batch, update architecture/status docs immediately so future work starts from an accurate baseline.

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
- [ ] Refactor necessity is explicit (why this change is needed now).
- [ ] Refactor scope matches context: cohesive larger batch in refactor phase, minimal clean change in feature phase.
- [ ] Tests updated or added.
- [ ] Architecture and API docs updated if needed.
- [ ] Security impact reviewed.
- [ ] Merge hygiene gate is green (`corepack pnpm run hygiene:merge`).
- [ ] Full CI gate is green.
