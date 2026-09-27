# PRD: Prune CI no-op gates and dead path filters

Status: DRAFT

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As the operator, I want each CI step to prove a property of the code so that a green run carries real evidence.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` contains no step that runs `pnpm run lint`.
- [ ] `.github/workflows/ci-harness.yml` contains no step that runs `pnpm run format:check`.
- [ ] `.github/workflows/release.yml` contains no step that runs `pnpm run lint`.
- [ ] `.github/workflows/release.yml` contains no step that runs `pnpm run format:check`.
- [ ] Both workflows keep the `Run pnpm security audit`, `Install dependencies`, `Typecheck`, `Build`, and `Test` steps in the current order.
- [ ] `release.yml` keeps the `Check pnpm pin drift` step and the `needs: [validate, boot-lint, eval-probes]` gate.
- [ ] `bash .agro/evals/probes/audit-shellcheck-coverage.sh` exits 0.
- [ ] `bash .agro/evals/probes/pnpm-audit-ci-gate.sh` exits 0.

### US-002: Remove dead and redundant path filters from harness CI

**Description:** As the operator, I want each `ci-harness.yml` path filter to name a live path once so that the filter list states the real triggers.

**Acceptance Criteria:**

- [ ] The `push.paths` list and the `pull_request.paths` list in `ci-harness.yml` contain no entry `packages/**`, `.oh/**`, or `oh.json`.
- [ ] Both lists contain no entry `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, or `.agro/knowledge/**`.
- [ ] Both lists still contain `.agro/**`, `.claude/hooks/**`, `agro.json`, and `.example.env`.
- [ ] Both lists contain the same entries in the same order.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` or `.agro/knowledge/**` as knowledge coverage in each event list.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.

### US-003: Narrow the sandbox boot guard to image and boot inputs

**Description:** As the operator, I want only image inputs to trigger the boot guard so that a skill edit skips the image build.

**Acceptance Criteria:**

- [ ] Each event list in `.github/workflows/sandbox-boot-guard.yml` contains exactly these entries: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`.
- [ ] Neither list contains `.agro/**`, `.oh/**`, `packages/oh/**`, or `oh.json`.
- [ ] Neither list names a single file under `.agro/scripts/`, because `.agro/scripts/**` covers each such file.
- [ ] The workflow jobs `Validate sandbox compose and image build` and `Boot a legacy volume against the fresh image` keep every step unchanged.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires `.agro/cli/**`, `.agro/scripts/**`, and `.agro/install/**`.
- [ ] `sandbox-boot-guard-ci.sh` reports a REGRESSION when the workflow names `".agro/**"`, `".oh/**"`, `"packages/oh/**"`, or `"oh.json"`.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.
- [ ] `pnpm test:scripts` passes, including `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` and `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts`.

### US-004: Remove retired `.oh/` filters from the compatibility workflow

**Description:** As the operator, I want the compatibility workflow to name only live files so that the filter list matches the repository.

**Acceptance Criteria:**

- [ ] `.github/workflows/sandbox-compatibility.yml` contains no path filter that starts with `.oh/`.
- [ ] Each `.agro/` counterpart of a removed `.oh/` entry stays in both event lists.
- [ ] The workflow still contains no `".agro/**"` filter.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.

### US-005: Guard the cleanup with one probe

**Description:** As the operator, I want a probe to fail on a no-op step or a dead filter so that the cleanup stays in place.

**Acceptance Criteria:**

- [ ] A new probe `.agro/evals/probes/ci-live-gates.sh` exists and follows the tier-A header of the other probes.
- [ ] The probe reads the `paths` lists of `ci-harness.yml`, `sandbox-boot-guard.yml`, and `sandbox-compatibility.yml`.
- [ ] For each path filter, the probe takes the prefix before the first `*` and reports a REGRESSION when no tracked path starts with that prefix.
- [ ] The probe reports a REGRESSION when `ci-harness.yml` or `release.yml` runs `pnpm run lint` or `pnpm run format:check`.
- [ ] The probe exits 0 on the changed tree.
- [ ] The probe exits 1 when a scratch copy of `ci-harness.yml` gets the entry `packages/**`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-006: Align `/ci-status` and the feat template with the real gates

**Description:** As an application agent, I want `/ci-status` and the feat template to name the real CI gates so that I run the real checks.

**Acceptance Criteria:**

- [ ] The `NO RUN` list in `.agro/skills/ci-status/SKILL.md` states the real `ci-harness.yml` triggers: push to `development` or `main` and `pull_request`, each with its path filter.
- [ ] The `NO RUN` list names `sandbox-boot-guard.yml` and its image and boot path filter.
- [ ] The `CI Pipeline Steps` section lists the real `CI: Harness` jobs: the security audit, install, typecheck, build, and test steps; `Boot Path Lint`; and `Eval Probe Regression Gate`.
- [ ] The `CI Pipeline Steps` section contains no Lint step, no Format check step, no Prisma step, and no Playwright step.
- [ ] The `Local Pre-flight` command runs `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` replaces the Lint + format + type-check criterion with a criterion that names `pnpm run typecheck`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ci-status/SKILL.md` reports no finding on the changed lines.

## Summary

Issue #1092 records a review of the pull-request pipelines. This plan applies the operator's decisions in that issue.

Verified current state:

- `package.json` defines `lint` and `format:check` as `echo` commands. `ci-harness.yml:100-104` and `release.yml:54-58` run both commands, and both commands exit 0 without a check.
- `packages/`, `.oh/`, and `oh.json` do not exist. `ci-harness.yml` names `packages/**`, `.oh/**`, and `oh.json`. `sandbox-boot-guard.yml` names `.oh/**`, `packages/oh/**`, and `oh.json`. `sandbox-compatibility.yml` names seven `.oh/scripts/*` and `.oh/cli/**` files.
- `ci-harness.yml` names `.agro/**` and also names `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. `.agro/**` covers the four narrower globs.
- `sandbox-boot-guard.yml` names `.agro/**`. Every edit under `.agro/` therefore builds and boots the sandbox image.
- `sandbox-boot-guard-ci.sh:30-31` requires `".agro/**"` and `"packages/oh/**"` on the boot guard. `knowledge-path-single-owner.sh:50-55` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` event lists.
- `.agro/skills/ci-status/SKILL.md:106` and `:116-133` describe a push-only filter with `packages/**`, plus Lint, Format, Prisma, and Playwright steps. The harness runs none of those steps.
- `.github/ISSUE_TEMPLATE/feat.md:41` asks for `pnpm run lint && pnpm run format:check && pnpm -r run type-check`.
- `.claude/skills` is a symlink to `.agro/skills`. The canonical `/ci-status` file is `.agro/skills/ci-status/SKILL.md`.

Selected approach: delete the dead steps and filters. Replace the boot guard's `.agro/**` glob with the four image and boot inputs from the issue. Move each affected probe to the new contract. Add one probe that rejects a no-op step or a dead filter. Keep every real gate.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, job `ci` steps `Lint` and `Format check` | Harness CI trigger and validation job |
| `.github/workflows/release.yml` | job `validate` steps `Lint` and `Format check` | Release validation gate |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot trigger |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Base-image and optional-harness compatibility trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` calls for path filters | Boot guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `REQUIRED` | Core path filter probe; stays unchanged |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `hook_path_count` | Hook path filter probe; stays unchanged |
| `.agro/evals/probes/ci-live-gates.sh` | new | Dead-filter and no-op-step guard |
| `.agro/skills/ci-status/SKILL.md` | step 7 `NO RUN` list, `CI Pipeline Steps`, `Local Pre-flight` | Agent-facing CI reference |
| `.github/ISSUE_TEMPLATE/feat.md` | `Acceptance Criteria` list | Feature issue default criteria |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions `CI: Harness` | Modify | Drops two no-op steps. Drops dead and redundant path filters. The trigger set stays equal for live paths. |
| GitHub Actions `Release` | Modify | Drops two no-op steps from `validate`. |
| GitHub Actions `CI: Sandbox Boot Guard` | Modify | Triggers only on image and boot inputs. |
| GitHub Actions `CI: Sandbox Compatibility` | Modify | Drops retired `.oh/` filters. |
| `/ci-status` skill | Modify | States the real triggers, jobs, and local pre-flight. |
| Feat issue template | Modify | States the real local checks. |

## Storage

N/A. The change edits workflow files, probes, and prose. The change adds no persistent state.

## Architectural Decisions

- **Source of truth:** each workflow file owns its trigger set. The probes assert the durable invariant, not a stale literal. `knowledge-path-single-owner.sh` accepts any glob that covers `.agro/knowledge/`.
- **Boot guard scope:** the image and boot inputs are `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, and the workflow file. The Dockerfile copies `.agro/cli/`, `.agro/install/`, and three files from `.agro/scripts/` into the image.
- **Accepted trade-off:** `.devcontainer/Dockerfile:135` copies the full build context into `/opt/agro-seed/`. A skill or probe edit changes that seed data but not the boot path. The issue excludes the rest of the control plane from the boot guard. `CI: Harness` and the eval probe gate still run on every `.agro/**` edit.
- **Canonical surface:** edit `.agro/skills/ci-status/SKILL.md`. Do not edit `.claude/skills/ci-status/SKILL.md`, because that path resolves through the `.claude/skills` symlink.
- **Kept scripts:** `package.json` keeps the `lint`, `format`, and `format:check` scripts. `.husky/pre-commit` runs `pnpm run lint`, so a script removal breaks the commit hook. Open question 2 tracks that removal.
- **Job name:** the `ci` job keeps the name `Lint, Typecheck, Build & Test`. A branch-protection rule can require that check name. Open question 1 tracks the rename.

Affected surfaces:

| Surface | Mark |
|---|---|
| Host and sandbox | Applied. The implementation owner edits files in the sandbox. GitHub runs the workflows. |
| Lifecycle door | Not applicable. No `agro` verb changes. |
| Canonical and provider surfaces | Applied. `/ci-status` changes in `.agro/skills/`. The `.claude/skills` symlink resolves unchanged. |
| Root and scaffold | Applied to the root only. The workflows and the issue template are root files. |
| Interactive and headless processes | Not applicable. No process starts. |
| Local and remote operation | Not applicable. The change is CI configuration. |
| Parallel operation | Applied. One worktree on one task branch owns the edits. |
| Public documentation | Not applicable. The change alters no user-facing term or behavior in `mifunedev/agro-web`. |
| Verification | Applied. See the test plan. |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/ci-live-gates.sh` | Write the probe first. The probe fails on the current tree. The probe passes after US-001 through US-004. The probe fails on a scratch workflow that names `packages/**`. | US-001, US-002, US-003, US-004, US-005 |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Change the probe first. The probe fails on the current workflow. The probe passes on the narrowed workflow. | US-003, US-004 |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | The probe passes after `.agro/knowledge/**` leaves `ci-harness.yml`. | US-002 |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Unchanged probe passes. | US-002 |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Unchanged probe passes. | US-002 |
| `.agro/evals/probes/eval-ci-gate.sh` | Unchanged probe passes. | Eval gate stays |
| `.agro/evals/probes/pnpm-audit-ci-gate.sh` | Unchanged probe passes. | Audit step order stays |
| `.agro/evals/probes/boot-lint-glob.sh` | Unchanged probe passes. | Boot lint stays |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Unchanged test passes. | Boot guard steps stay |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | Unchanged test passes. | Upgrade smoke stays |
| `bash .agro/skills/eval/run.sh` | Full suite reports no REGRESSION. | All probes |
| GitHub Actions on the task pull request | `CI: Harness` runs and passes. `CI: Sandbox Boot Guard` runs because the PR edits `sandbox-boot-guard.yml`, and the run passes. | Real CI paths |

## Design Principles

- Code is the source of truth. A CI step that proves nothing states a false fact. Delete the step.
- Delete obsolete paths. Do not keep a filter for a tree that no longer exists.
- Keep one source of truth for each policy. `.agro/**` covers the control plane in harness CI. Narrower duplicate globs add no trigger.
- Assert invariants in probes, not literals. A probe that pins a literal blocks a correct simplification.
- Add no tracked comments to workflows or probes beyond the machine-read probe header.
- Keep the change to the files in the integration table.

## Out of Scope

- Moving image boot tests to release-only runs.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- Adding a real linter or formatter.
- Removing the `lint`, `format`, or `format:check` scripts from `package.json`, or changing `.husky/pre-commit`.
- Changing the `.oh/` fallback in the `.devcontainer/docker-compose.yml` healthcheck.
- Changing historical records under `docs/rfcs/` and `.agro/evals/datasets/`.
- Changing branch-protection settings on GitHub.

## Open Questions

1. Rename the `ci` job from `Lint, Typecheck, Build & Test`?
   A. Keep the name. The name stays inaccurate, and branch protection stays safe. This plan selects A.
   B. Rename to `Typecheck, Build & Test`, and update each required-check rule to `<new required check name>` in the same change.
2. Remove the no-op `lint`, `format`, and `format:check` scripts from `package.json`?
   A. Keep the scripts. This plan selects A.
   B. Remove the scripts, and change `.husky/pre-commit` to `pnpm run typecheck && pnpm run test`.
3. Add `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` to the boot guard filter? `.devcontainer/entrypoint.sh:499-510` runs `pnpm install` at boot when `node_modules` is absent. The current boot guard filter omits the three manifests, and the issue list omits the three manifests.
   A. Follow the issue list. This plan selects A.
   B. Add the three manifests to the boot guard filter.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION on the task branch.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `git grep -nE '"(packages/\*\*|packages/oh/\*\*|\.oh/\*\*|oh\.json)"' .github/workflows` prints no line.
- [ ] `git grep -nE '"\.oh/(scripts|cli)/' .github/workflows` prints no line.
- [ ] `git grep -nE 'pnpm run (lint|format:check)' .github/workflows` prints no line.
- [ ] `git grep -n '".agro/\*\*"' .github/workflows/sandbox-boot-guard.yml` prints no line.
- [ ] The task pull request shows green `CI: Harness` and `CI: Sandbox Boot Guard` runs.

## Lessons

Filled by the advisor before undraft.
