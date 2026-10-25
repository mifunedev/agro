# PRD: CI runtime optimizations

Status: DRAFT

## User Stories

### US-001: Release reuses the CI: Harness workflow

**Description:** As the operator, I want `release.yml` to call `ci-harness.yml` so that one definition gates both PRs and releases.

**Acceptance Criteria:**

- [ ] `ci-harness.yml` declares `workflow_call` in its `on:` block.
- [ ] `ci-harness.yml` lists `development` as its only push branch. The list does not contain `main`.
- [ ] The `ci-harness.yml` path filters for `push` and `pull_request` contain `.github/workflows/release.yml`.
- [ ] `release.yml` has no `validate` job body and no `boot-lint` job body. One job runs `uses: ./.github/workflows/ci-harness.yml`.
- [ ] The `reserve` job in `release.yml` needs the job that calls `ci-harness.yml`.
- [ ] When `release.yml` calls `ci-harness.yml`, the concurrency group expression resolves to a value that contains `github.run_id`. Two release runs on `main` do not cancel each other.
- [ ] When a PR or a `development` push starts `ci-harness.yml`, the concurrency group stays `ci-harness-${{ github.ref }}` with `cancel-in-progress: true`.
- [ ] The README badge for `ci-harness.yml` uses `branch=development`.
- [ ] `.agro/scripts/__tests__/release-reservation.test.ts` asserts the new `needs` list and the `uses:` line.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Remove main pushes and narrow the Boot Guard path filter

**Description:** As the operator, I want Boot Guard and Compatibility to skip `main` pushes and unrelated script changes so that they stop re-testing validated commits.

**Acceptance Criteria:**

- [ ] `sandbox-boot-guard.yml` and `sandbox-compatibility.yml` list `development` as their only push branch.
- [ ] The `sandbox-boot-guard.yml` filters list each boot-path script by name in place of `.agro/scripts/**`. The list holds `docker-compose.sh`, `check-host-port.sh`, `paths.sh`, `provision-python.sh`, `sandbox-healthcheck.sh`, `sandbox-boot-smoke.sh`, `sandbox-upgrade-smoke.sh`, `cli-first-install-smoke.sh`, `verify-sandbox-image.sh`, `install.sh`, and `link-providers.sh`.
- [ ] The `sandbox-boot-guard.yml` filters keep `.agro/cli/**` and exclude `.agro/cli/**/__tests__/**` and `.agro/cli/**/*.md` with `!` patterns.
- [ ] The `ci-status` skill at `.agro/skills/ci-status/SKILL.md` lists the new Boot Guard filter.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Move the optional-harness install job off PR pushes

**Description:** As a developer, I want the optional-harness install job to run after merge so that my PR checks finish in about 2.5 minutes.

**Acceptance Criteria:**

- [ ] The `optional-harness-install` job in `sandbox-compatibility.yml` has `if: github.event_name != 'pull_request'`.
- [ ] The `base-node-pnpm-parity` job still runs on `pull_request`.
- [ ] The job step calls `agro harness list --json` one time and reads each harness `binary` from that output. Lines 100 and 143 no longer call the command twice.
- [ ] The step still fails when the catalog declares no installable harness.
- [ ] `pnpm test:scripts` exits 0.

### US-004: Delete retired alias checks and unread variables

**Description:** As a maintainer, I want to delete checks that compare a value with itself so that each remaining check can fail.

**Acceptance Criteria:**

- [ ] The `publish-image` job in `release.yml` builds 2 tags plus the smoke tag, pushes 2 tags, and runs `agro --version` one time.
- [ ] `release.yml` has no `oh_version` variable and no `Verify the agro and agro version tags share one digest` step.
- [ ] `.agro/scripts/verify-release-aliases.sh` and `.agro/scripts/__tests__/verify-release-aliases.test.ts` do not exist.
- [ ] `git grep -n verify-release-aliases` returns no line outside `CHANGELOG.md` and `.agro/tasks/`.
- [ ] `.agro/skills/release/SKILL.md` and `.agro/scripts/README.md` name 2 GHCR tags and do not name `verify-release-aliases.sh`.
- [ ] `sandbox-boot-guard.yml` has no `LEGACY_IMAGE` key.
- [ ] `release-reservation.test.ts` asserts 2 `docker push` lines and no `oh_version`.
- [ ] `pnpm test:scripts` exits 0.

### US-005: Add job timeouts

**Description:** As the operator, I want each CI job to have a timeout so that a registry stall cannot hold a runner for 360 minutes.

**Acceptance Criteria:**

- [ ] Each job in `ci-harness.yml`, `sandbox-boot-guard.yml`, `sandbox-compatibility.yml`, `release.yml`, `publish-cli.yml`, and `close-issues-on-development.yml` sets `timeout-minutes`.
- [ ] Each value matches the table in Architectural Decisions.
- [ ] A test in `.agro/scripts/__tests__/ci-workflow-contract.test.ts` fails when a job in `.github/workflows/` has no `timeout-minutes`.
- [ ] `pnpm test:scripts` exits 0.

## Summary

The council audit measured CI over 30 days. Each change runs the same checks on the PR, on the `development` push, on the `main` push, and in Release. The repository is public, so the cost is runner capacity and wait time.

Verified facts:

- `development` and `main` have no branch protection and no rulesets. All 20 recent PRs merged into `development` as squash commits.
- Release fast-forwards a `development` commit to `main`. Commit `ab950bc7` ran CI on `development` at 03:28 and all suites again on `main` at 03:31.
- `release.yml` jobs `validate` and `boot-lint` copy `ci-harness.yml` and have drifted. The Release shellcheck list omits the `escalate` and `typesafe-ai` scripts. Release run 39500185455 failed Validate on a commit that CI: Harness passed.
- Boot Guard uses about 53% of job-minutes. Of 98 commits that started Boot Guard in 30 days, 56 changed only `.agro/cli/**` and 15 changed only other `.agro/scripts/**` files.
- The `optional-harness-install` job takes 5 to 7 minutes and ran 76 times on PRs in 30 days. Other PR checks finish in about 2.5 minutes.
- `release.yml` compares `agro --version` with itself, pushes 2 tags twice, and compares one tag digest with itself. The `oh` alias retirement in #1136 left these checks.
- `LEGACY_IMAGE` in `sandbox-boot-guard.yml` has no reader. `sandbox-upgrade-smoke.sh:33` reads `SEED_IMAGE`.
- No job sets `timeout-minutes`. Run 39710685010 took 744 seconds during a registry stall.

The selected approach removes duplicate runs, keeps `development` push runs, and deletes checks that cannot fail.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on:`, `concurrency:`, jobs `ci`, `boot-lint` | Single validation definition for PRs, `development`, and Release |
| `.github/workflows/release.yml` | jobs `validate`, `boot-lint`, `reserve`, `publish-image` | Calls `ci-harness.yml`; loses duplicate alias checks |
| `.github/workflows/sandbox-boot-guard.yml` | `on:` paths, `LEGACY_IMAGE` | Narrowed filter; unread key removed |
| `.github/workflows/sandbox-compatibility.yml` | `on:`, job `optional-harness-install` | Post-merge only; one `harness list` call |
| `.github/workflows/publish-cli.yml` | job `publish-npm` | Timeout |
| `.github/workflows/close-issues-on-development.yml` | job `close-linked-issues` | Timeout |
| `.agro/scripts/__tests__/release-reservation.test.ts` | lines 390, 440-470 | Pins `needs`, tags, and alias checks |
| `.agro/scripts/verify-release-aliases.sh` | whole file | Deleted |
| `.agro/scripts/__tests__/verify-release-aliases.test.ts` | whole file | Deleted |
| `.agro/skills/release/SKILL.md` | lines 30-33, 195-198 | Tag list and manual check |
| `.agro/skills/ci-status/SKILL.md` | lines 98-100 | Filter description |
| `.agro/scripts/README.md` | line 16 | Script index |
| `README.md` | line 7 | CI badge branch |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions triggers | Modified | `main` pushes stop starting CI: Harness, Boot Guard, and Compatibility |
| Release workflow | Modified | Release gates on the `ci-harness.yml` reusable call |
| GHCR tags | Unchanged | Release publishes the same 2 distinct tags; the duplicate pushes end |
| README badge | Modified | The badge reports `development` status |

## Storage

N/A. The change edits workflow files, tests, and documentation. The change stores no state.

## Architectural Decisions

- `ci-harness.yml` is the single source of truth for validation. Release calls the file and keeps no copy.
- `development` push runs stay. Squash merges create a new tree, and no rule requires a fresh PR check. These runs are the only test of the merged tree.
- The concurrency group cancels superseded runs only for PR and `development` events. A called run uses a group that contains `github.run_id`, so `release.yml` keeps its rule at lines 3-4.
- The called `boot-lint` job keeps `runs-on: ${{ vars.CI_RUNNER || 'ubuntu-latest' }}`. Release accepts the same runner policy as PR CI.
- Boot Guard keeps `.agro/cli/**` because `cli-first-install-smoke.sh` tests the whole CLI bundle. Boot Guard drops script files that the boot path does not read.
- The Docker layer cache stays out. The cache saves at most about 1 minute per Boot Guard job and hides breakage in unpinned `curl | sh` installers.
- Timeout values derive from the 30-day maximum and the internal smoke deadlines:

| Workflow | Job | `timeout-minutes` | Basis |
|---|---|---|---|
| `ci-harness.yml` | `ci` | 20 | 744-second stall maximum |
| `ci-harness.yml` | `boot-lint` | 10 | 25-second maximum |
| `sandbox-boot-guard.yml` | `sandbox-boot-guard` | 45 | `BOOT_SMOKE_TIMEOUT_SECONDS: "1200"` plus build |
| `sandbox-boot-guard.yml` | `sandbox-upgrade-guard` | 45 | `UPGRADE_SMOKE_TIMEOUT_SECONDS: "1200"` plus build |
| `sandbox-compatibility.yml` | `base-node-pnpm-parity` | 10 | 19-second maximum |
| `sandbox-compatibility.yml` | `optional-harness-install` | 45 | Two 600-second waits plus installs |
| `release.yml` | `reserve`, `finalize` | 10 | 10-second maximum |
| `release.yml` | `publish-image` | 45 | `BOOT_SMOKE_TIMEOUT_SECONDS: "900"` plus build and push |
| `publish-cli.yml` | `publish-npm` | 15 | 23-second maximum |
| `close-issues-on-development.yml` | `close-linked-issues` | 10 | 8-second maximum |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | `reserve` needs the CI call; `uses: ./.github/workflows/ci-harness.yml`; 2 `docker push` lines; no `oh_version` | US-001, US-004 |
| `.agro/scripts/__tests__/ci-workflow-contract.test.ts` | Each job sets `timeout-minutes`; no push list in the three CI workflows contains `main`; `optional-harness-install` skips `pull_request`; the called concurrency group contains `github.run_id` | US-001, US-002, US-003, US-005 |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Existing wiring assertions still pass | US-002 |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | Existing assertions still pass | US-004 |

Write each new assertion first. Confirm that the assertion fails, then change the workflow.

## Design Principles

- Keep one source of truth for each policy: `ci-harness.yml` owns validation.
- Delete obsolete paths. Do not keep a check that cannot fail.
- Keep each change that removes coverage explicit, with its measured saving.
- Do not change branch protection. That change is an admin action outside this task.

## Out of Scope

- Branch protection and required status checks.
- Docker layer caching.
- Removal of `development` push runs.
- Exclusion of `.agro/cli/src/**` from the Boot Guard filter.
- A manual-review evidence story. The task changes no user interface, server, CLI, or API. GitHub runs the changed workflows on the PR, and `/ci-status` reports the result.

## Open Questions

None. The operator approved the plan on 2026-10-24. The approval accepts the timeout table and post-merge detection for the optional-harness install job.

## Acceptance Criteria

- [ ] Each story passes its acceptance criteria.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] On the PR for this task, CI: Harness and Boot Guard finish green, and the `optional-harness-install` job shows as skipped.

## Lessons

- Claim: GitHub rejects `timeout-minutes` on a job that calls a reusable workflow. Evidence: `release.yml` jobs `ci-harness` and `publish-cli` use `uses:`. Outcome: fixed in this PR. The contract test exempts `uses:` jobs, and the called jobs carry the timeouts.
- Claim: in a called workflow, `github.workflow` holds the caller's name. Evidence: the `ci-harness.yml` concurrency expression keys on `'CI: Harness'`, and `release-reservation.test.ts` pins the expression. Outcome: fixed in this PR.
- Claim: `.agro/skills/git/SKILL.md` described four GHCR tags after the alias checks went away. Evidence: lines 241-244 before this PR. Outcome: fixed in this PR.
- Claim: the narrowed Boot Guard filter removes about 15% of Boot Guard triggers, because 56 of 98 triggering commits changed only `.agro/cli/**`. Evidence: `git log` over 30 days. Outcome: dropped. `cli-first-install-smoke.sh` tests the whole CLI bundle, and the plan keeps `.agro/cli/**` in scope.
- Claim: the sandbox has no `actionlint`. Evidence: `command -v actionlint` exits 1. Outcome: dropped. GitHub validates the workflow syntax on push.
