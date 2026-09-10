# US-005 / US-006 evidence — canonical-only npm publication and shim integrity

Worktree: `/home/sandbox/harness/.worktrees/task/939-cli-first-release`
Branch: `task/939-cli-first-release`

## publish-cli.yml

The workflow publishes `@mifune/agro` only. Observed after the edit:

- one `npm publish --access public --provenance`
- no `legacy_guard`
- no `Publish @mifune/openharness`
- no `npm deprecate`
- no `.agro/scripts/npm-wait-version.sh`
- shim source remains at `.agro/cli/legacy/`

`release.yml` still runs `publish-cli` after `publish-image`, still promotes GHCR aliases, and still runs `notify-docs` after `finalize`. No `continue-on-error` on those jobs.

## Probes

```bash
bash .agro/evals/probes/version-parity.sh
# PASS: canonical version 0.9.0 agrees across package.json, .agro/cli/package.json, and CHANGELOG.md; retained shim v0.9.0 pins @mifune/agro@0.9.0
# PARITY_EXIT=0

bash .agro/evals/probes/agro-legacy-shim.sh
# PASS @mifune/openharness shim: v0.9.0, pins @mifune/agro@0.9.0, bin oh only, bin/oh.js is one import of @mifune/agro/dist/agro.js
# SHIM_EXIT=0
```

Canonical parity is root == CLI plus a dated CHANGELOG heading. Shim integrity is pin equals shim version, exact pin, bin `oh` only. The probes do not require the shim version to match a later canonical version.

## Tests

```bash
/home/sandbox/harness/node_modules/.bin/vitest run \
  .agro/scripts/__tests__/canonical-publish-contract.test.ts \
  .agro/scripts/__tests__/version-parity-contract.test.ts \
  .agro/scripts/__tests__/cli-first-install-smoke.test.ts \
  .agro/scripts/__tests__/release-reservation.test.ts \
  .agro/scripts/__tests__/get-agro.test.ts
# Test Files  5 passed (5)
# Tests  63 passed (63)
# VITEST_EXIT=0
```

`canonical-publish-contract.test.ts` executes the workflow `run:` bodies with a fake `npm` on PATH. Canonical publish failure exits non-zero. Success logs no `openharness` and no `deprecate`.

## Instructions

`.agro/skills/git/SKILL.md` and `.agro/skills/release/SKILL.md` now require no newly published `@mifune/openharness` version. GHCR alias promotion and `notify-docs` remain. Automatic docs dispatch is not the only documentation acceptance path.

STE:

```bash
bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/git/SKILL.md .agro/skills/release/SKILL.md
# STE_EXIT=1
```

15 findings, including pre-existing PASSIVE/LONG/COMPOUND hits. No 90-day or three-release gate was added.
