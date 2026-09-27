# PRD: Prune no-op CI steps and dead path filters

Status: DRAFT

Source: issue #1092 (`work/issue-1092.md`).

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As a maintainer, I want CI to run only failable steps so that a green check proves a real gate.

**Acceptance Criteria:**

- [ ] `grep -nE 'pnpm run (lint|format:check)' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints no line.
- [ ] `.github/workflows/ci-harness.yml` job `ci` still runs `pnpm run security:audit`, `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test:scripts`.
- [ ] `.github/workflows/release.yml` job `validate` still runs the security audit, typecheck, build, test, and pnpm pin drift steps.
- [ ] `pnpm test:scripts` exits 0. The `release-reservation.test.ts` assertion `needs: [validate, boot-lint, eval-probes]` still passes.

### US-002: Remove dead and redundant path filters from harness CI

**Description:** As a maintainer, I want each `ci-harness.yml` path filter to name a real, uncovered path so that the list states the true triggers.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists in `.github/workflows/ci-harness.yml` contain none of `packages/**`, `.oh/**`, `oh.json`, `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`.
- [ ] Both lists still contain `.agro/**`, `.claude/hooks/**`, `agro.json`, `.example.env`, `.devcontainer/**`, `AGENTS.md`, and `.github/workflows/ci-harness.yml`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` or `.agro/knowledge/**` as coverage for knowledge changes, on both events.
- [ ] `.agro/evals/probes/harness-ci-core-paths.sh` reports `REGRESSION` when a `ci-harness.yml` path filter matches no tracked file. The check uses `git ls-files` against each filter.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh`, `bash .agro/evals/probes/harness-ci-core-paths.sh`, and `bash .agro/evals/probes/harness-ci-hooks-paths.sh` each exit 0.
- [ ] A scratch copy of `ci-harness.yml` with `oh.json` added back to `push.paths` makes `harness-ci-core-paths.sh` exit 1. The implementer records this negative check in `evidence.md`.

### US-003: Narrow the boot-guard trigger to image and boot inputs

**Description:** As a maintainer, I want the image build to run only on image input changes so that a skill edit skips the build.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists in `.github/workflows/sandbox-boot-guard.yml` equal this set: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`.
- [ ] Neither list contains `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json`, or `.agro/scripts/harness-config.sh`.
- [ ] `.github/workflows/sandbox-compatibility.yml` contains no `.oh/` path filter. The `.agro/` counterpart of each removed filter stays.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires each path in the set above. The probe no longer requires `".agro/**"`, `"packages/oh/**"`, or `".agro/scripts/harness-config.sh"`.
- [ ] `sandbox-boot-guard-ci.sh` reports `REGRESSION` when the boot-guard path lists contain `".agro/**"`, `packages/`, `.oh/`, or `oh.json`.
- [ ] The `sandbox-boot-guard` job, the `sandbox-upgrade-guard` job, and the `optional-harness-install` job keep every step they have today. `git diff` shows changes only inside the `on:` blocks of both workflows.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0, and `pnpm test:scripts` exits 0.

### US-004: Align `/ci-status` and the feat issue template with the real gates

**Description:** As a coding agent, I want `/ci-status` and the feat template to match the workflows so that I run the real checks.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` § "CI Pipeline Steps" lists the steps of `ci-harness.yml` job `ci` in workflow order. The list names no Lint, Format check, Prisma, or Playwright step.
- [ ] The "Local Pre-flight" command in `.agro/skills/ci-status/SKILL.md` runs `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`. The command names no `lint` or `format:check` script.
- [ ] The NO RUN section of `.agro/skills/ci-status/SKILL.md` describes the `ci-harness.yml`, `sandbox-boot-guard.yml`, `sandbox-compatibility.yml`, and `release.yml` triggers as the workflows define them after US-002 and US-003. The section names no `packages/**` filter.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names no `pnpm run lint`, `pnpm run format:check`, or `pnpm -r run type-check` command. The template names `pnpm run typecheck` and `pnpm test:scripts`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .github/ISSUE_TEMPLATE/feat.md` shows no new finding on changed lines.

## Summary

Verified current state:

- `package.json:15` defines `lint` as `echo "No root lint configured"`. `package.json:16` defines `format:check` as `echo "No root format check configured"`. Both always exit 0.
- `ci-harness.yml` job `ci` and `release.yml` job `validate` (lines 54–58) run both scripts as steps.
- `packages/`, `.oh/`, and `oh.json` do not exist. `ci-harness.yml` names `packages/**`, `.oh/**`, and `oh.json`. `sandbox-boot-guard.yml` names `.oh/**`, `packages/oh/**`, and `oh.json`. `sandbox-compatibility.yml` names five `.oh/scripts/*` and `.oh/cli/**` paths.
- `ci-harness.yml` names `.agro/**` and also `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. `.agro/**` covers all four.
- `sandbox-boot-guard.yml` names `.agro/**`. The filter starts the image build and boot smoke for every control-plane edit.
- `.agro/scripts/harness-config.sh` does not exist. The boot-guard filter for it can never match.
- `knowledge-path-single-owner.sh` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` events. `sandbox-boot-guard-ci.sh` requires `".agro/**"`, `"packages/oh/**"`, and `".agro/scripts/harness-config.sh"`.
- `.agro/skills/ci-status/SKILL.md:116-133` lists Lint, Format, Prisma, and Playwright steps that no workflow runs. `.github/ISSUE_TEMPLATE/feat.md:41` names the no-op commands and a nonexistent `type-check` script.

Selected approach: delete the dead steps and filters, keep every real gate, and move each probe from an exact obsolete literal to the durable invariant.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, job `ci` | Harness CI trigger and validation steps |
| `.github/workflows/release.yml` | job `validate` | Release validation steps |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot smoke trigger |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Compatibility trigger with dead `.oh/` filters |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks for path filters | Boot-guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `extract_paths`, `REQUIRED` | Harness CI path probe |
| `.agro/skills/ci-status/SKILL.md` | NO RUN list, "CI Pipeline Steps", "Local Pre-flight" | Agent CI diagnosis guide |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria checklist | Feature issue template |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `needs: [validate, boot-lint, eval-probes]` | Release job graph test |
| `CHANGELOG.md` | `[Unreleased]` | Change record under `/git` § Changelog |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions check list on a PR | Modified | The `CI: Harness` job shows no Lint or Format check step. |
| PR trigger set for `CI: Sandbox Boot Guard` | Narrowed | A PR that changes only `.agro/skills/`, `.agro/evals/`, `.agro/hooks/`, `.agro/knowledge/`, or `.agro/tasks/` does not start the boot guard. |
| `/ci-status` skill | Modified | Documented steps and triggers match the workflows. |
| Feat issue template | Modified | Acceptance checklist names real commands. |

## Storage

N/A. The task changes workflow configuration, probes, and documentation. The task adds no persistent state.

## Architectural Decisions

- The workflow files own the trigger and step contract. Probes assert the invariant. `/ci-status` describes the workflow files and owns no policy.
- The boot guard triggers on image and boot inputs only. `.devcontainer/Dockerfile:135` runs `COPY . /opt/agro-seed/`, so an edit anywhere in the repository changes the image content. The issue accepts this. The image build and boot smoke do not read skill, probe, or knowledge content during boot. Harness CI and the eval probe gate still run for those edits.
- `.agro/scripts/**` covers the explicit script filters (`docker-compose.sh`, `sandbox-boot-smoke.sh`, `sandbox-upgrade-smoke.sh`, `cli-first-install-smoke.sh`, `verify-sandbox-image.sh`). The workflow drops the explicit entries.
- Boot testing stays on PRs. The task does not move it to release-only.
- The `lint` and `format:check` scripts in `package.json` stay. `.husky/pre-commit` runs `pnpm run lint`. Open question 2 covers their removal.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Requires the new path set; rejects `.agro/**`, `packages/`, `.oh/`, `oh.json` in boot-guard paths | US-003 contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Accepts `.agro/**` as knowledge coverage on push and pull_request | US-002 knowledge coverage |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Rejects a path filter that matches no tracked file | US-002 dead-filter guard |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Unchanged; must stay green | `.claude/hooks/**` coverage kept |
| `.agro/evals/probes/eval-ci-gate.sh` | Unchanged; must stay green | Eval gate kept |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Unchanged; must stay green | Release job graph kept |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts`, `sandbox-upgrade-smoke.test.ts` | Unchanged; must stay green | Boot-guard steps kept |

Order: change each probe first and confirm the probe exits 1 against the current workflow. Then change the workflow and confirm the probe exits 0. Run `bash .agro/skills/eval/run.sh` and `pnpm test:scripts` last. Both commands must exit 0.

## Design Principles

- Code is the source of truth. Add no explanatory comment to a workflow or probe.
- A CI step that cannot fail is not a gate. Delete the step.
- A path filter that names no file is not a trigger. Delete the filter.
- A probe asserts the durable invariant, not an obsolete literal.
- Keep the change inside `on:` blocks and the listed steps. Keep every real gate.

## Out of Scope

- Moving image boot testing to release-only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- Adding a real linter or formatter.
- Removing the `lint` and `format:check` scripts from `package.json` or `.husky/pre-commit`.
- Changing the public documentation in `mifunedev/agro-web`. No public page names these steps or filters. Open question 3 covers confirmation.

## Open Questions

1. Branch protection can require the check name `Lint, Typecheck, Build & Test`. The plan keeps the job name. Does the operator want the job renamed to `Typecheck, Build & Test`? A rename requires a matching branch-protection update.
2. Does the operator want the echo-only `lint` and `format:check` scripts deleted from `package.json`, with `.husky/pre-commit` changed to run `pnpm run typecheck && pnpm run test`? The plan keeps both scripts.
3. Does any page in `mifunedev/agro-web` name the Lint or Format check step or the `packages/**` filter? The plan assumes no page does.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 with no `REGRESSION` line.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `git diff --name-only` lists only the files in Key Integration Points, `.agro/evals/RESULTS.md`, and the task folder.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one entry that names issue #1092.
- [ ] The PR shows `CI: Harness` and `CI: Sandbox Boot Guard` green. `CI: Sandbox Boot Guard` runs on the PR because the PR changes `.github/workflows/sandbox-boot-guard.yml`.

## Lessons

Filled by the advisor before undraft.
