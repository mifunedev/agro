# Evidence — CLI-first release preparation

Task: `.agro/tasks/cli-first-release/`
Core PR: https://github.com/mifunedev/agro/pull/1031 (draft)
Web PR: https://github.com/mifunedev/agro-web/pull/54 (draft)
Exact core head at candidate CI: `c078c91e80647bc0c60cebb7ad1f11d929159d33`
Initial implementation audit: `audit-20260910T000714Z-867806` — `AUDIT-FAIL` (Gate 1: 11/13 stories pass)
Final implementation audit: `audit-20260910T002751Z-894377` — `AUDIT-PASS` (13/13; all five gates pass)
Initial core PR audit: `audit-20260910T000731Z-868073` — `PR-AUDIT-UNKNOWN` (CI was pending)
Initial web PR audit: `audit-20260910T000731Z-868077` — `PR-AUDIT-PROMOTABLE`

## 0. Why this is better than not doing it

Before: top-level `agro --help` described `update` as control-plane vendoring; an unselected image fell back to `ghcr.io/mifunedev/openharness:latest`; automatic release published and deprecated `@mifune/openharness`; docs-site builds could clone a moving branch while a SHA was requested; candidate bootstrap tests installed a version-printing stub.

After (measured):

- `agro --help` line: `agro update                 Upgrade the installed agro CLI` (advisor-observed built bundle).
- Unselected fallback: `DEFAULT_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest"` and image-only Compose third fallback the same.
- `publish-cli.yml` has a single `npm publish` of `@mifune/agro`; no `legacy_guard`.
- Exact-head Boot Guard 34418907048: pack installed `mifune-agro-0.9.0.tgz` as `packed_agro` version `0.9.0`; debian bootstrap `node_before=ABSENT` then nvm `v22.23.2` and `bootstrap_version=0.9.0`; recreation false `a229912b90fa` → `632cbe559293` same volume, credential `600 1000 1000`; recreation true `8989eb84e410` → `b533b3cd63c7`.
- Agro-web tests: 28 pass including SHA checkout and moving-branch pin. PR 54 Build docs SUCCESS, deploy SKIPPED.

Cost: ~1.3k lines of smoke/workflow/probe/docs plus agro-web builder tests. Planning-only CI green was not this evidence.

## 1. What the plan asked for

Review-ready core and linked agro-web implementation PRs covering CLI-first onboarding/help/image defaults, canonical-only npm publication with retained shim/GHCR, exact-commit docs builds, and real candidate install/recreation on existing Docker CI. No merge, live migration, or publication.

## 2. What was built

See `evidence/scope.md`, `onboarding.md`, `image-selection.md`, `release-contract.md`, `candidate.md`.

Observable:

- Product-aware top-level help and `ghcr.io/mifunedev/agro:latest` fallback with explicit `image.ref` preserved.
- Canonical-only automatic npm publish; independent shim pin coherence.
- `cli-first-install-smoke.sh` pack/bootstrap/seed/recreate on Boot Guard with pipefail.
- Agro-web detached SHA checkout and script fetch by resolved SHA; CLI-first installation/quickstart with historical clone/`install.sh` labeled not required.

Exact-head core CI on `c078c91e`: Lint/typecheck/test PASS, Eval probes PASS, Boot Path Lint PASS, Boot Guard PASS, legacy volume PASS.

## 3. Where they diverged, and why

- Recreation uses `agro stop` then `docker rm` of the recorded container then `agro sandbox install` (same name/image, volume kept). `agro stop` + `agro sandbox install` only restarted the same container ID, which US-011 rejects. `agro destroy` is `down -v` and would wipe storage.
- Knowledge pages and `prd.json` story flags may land in follow-up commits after `c078c91e`.
- US-009 historical clone/`install.sh` sections retained as labeled non-required path, as the PRD allows.

## 4. What remains unverified

- **US-009 browser:** resolved. The audit browser preflight passed with temporary user-space Chromium libraries. Agent-browser rendered desktop installation and mobile quickstart from corrected agro-web head `34485f68`. A read-only reviewer passed all four UI criteria. `ui-evidence.json` records screenshot hashes; screenshots remain ephemeral.
- **US-013:** awaits exact-head web CI, `evidence/closeout.md`, and final audits. PRs stay draft until those pass.
- The earlier `/audit implementation` Gate 1 failed as required at 11/13 stories. Rerun after US-013 evidence closes.
- STE still red on whole-file pre-existing findings in edited Markdown/skills.
- Live S1–S6 inventory, backup, migration, version selection, publication remain out of scope.

## Actual Knowledge Impact (partial)

NEEDS-REVIEW union assigned:

| Page | State |
|---|---|
| release-versioning | UPDATED (`f7b72f38`) |
| fresh-machine-setup | UPDATED (`f7b72f38`) |
| oh-cli-portable-lifecycle | UPDATED (`f7b72f38`) |
| agro-web-pipeline | REVERIFIED (`f7b72f38`, verified_at only) |
| compose-env-boundary | NOT-AFFECTED (no default-image claim) |
| managed-agents | NOT-AFFECTED (no default-image claim) |
