# Quality Gates

This project uses a strict, tiered gate model.

## Gate Matrix

1. Commit gate (light)

- Command: `corepack pnpm run ci:light`
- Purpose: quick local confidence (lint + formatting)

2. Pull request gate (extended)

- Command: `corepack pnpm run ci:extended`
- Purpose: enforce lint/format + content validation + type safety + tests

2a. Content validation gate

- Command: `corepack pnpm run content:validate`
- Purpose: validate content manifests and JSON entries (schema shape, duplicate ids, file references, minimum track points)

2b. Merge hygiene gate (explicit)

- Command: `corepack pnpm run hygiene:merge`
- Purpose: explicit pre-merge hygiene validation (lint + typecheck) as a dedicated required CI step

3. Merge/release gate (full)

- Command: `corepack pnpm run ci:full`
- Purpose: full confidence including dependency security checks
- Note: dependency audit tolerates temporary registry endpoint failures so CI is not blocked by npm audit API outages; rerun audit before merge if a registry warning appears.

## Rules

- Do not open PR with a failing extended gate.
- Do not bypass content validation failures.
- Do not merge with a failing merge hygiene gate.
- Do not merge with a failing full gate.
- Update docs in the same change when behavior/contracts change.
- Before every push, run the full gate and a manual source-hygiene review.

## Mandatory Pre-Push Checklist

- Run: `corepack pnpm run ci:full`
- Run: `corepack pnpm run hygiene:merge`
- Verify no high/critical dependency findings remain unresolved.
- Confirm no unnecessary dead code, debug leftovers, or duplicate logic were introduced.
- Confirm touched source files include clear file headers and meaningful inline comments where logic is non-obvious.
- Review file size growth and split oversized files before push whenever practical.

## File Size Hygiene Targets

- Prefer source files under 300 lines.
- If a source file exceeds 500 lines, split or justify in PR notes.
- Keep functions focused and short; extract helpers instead of growing monoliths.
