# PRD: Prune Dead CI Gates

Status: DRAFT

Tracks GitHub issue #1092.

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As an operator, I want CI to run only steps that detect a defect so that a green check reports a real result.

**Acceptance Criteria:**

- [ ] `grep -nE 'pnpm run (lint|format:check)' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints no line.
- [ ] `grep -nE 'name: (Lint|Format check)$' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints no line.
- [ ] Both workflows keep the `pnpm run security:audit`, `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test:scripts` steps.
- [ ] The `ci` job in `ci-harness.yml` keeps the name `Lint, Typecheck, Build & Test` until the operator answers open question 1.
- [ ] `bash .agro/evals/probes/docs-build-fast-path.sh` exits 0.
- [ ] `bash .agro/evals/probes/pnpm-audit-ci-gate.sh` exits 0.
- [ ] `bash .agro/evals/probes/boot-lint-glob.sh` exits 0.
- [ ] `pnpm test:scripts` exits 0, and `release-reservation.test.ts` still finds `needs: [validate, boot-lint, eval-probes]`.

### US-002: Prune the harness CI path filters

**Description:** As an operator, I want each `ci-harness.yml` path filter to add a real trigger so that the filter list states the true trigger set.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists in `ci-harness.yml` do not contain `packages/**`, `.oh/**`, or `oh.json`.
- [ ] The two lists do not contain `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, or `.agro/knowledge/**`.
- [ ] The two lists still contain `.agro/**`, `agro.json`, `.example.env`, and `.claude/hooks/**`.
- [ ] The two lists hold the same entries in the same order.
- [ ] `knowledge-path-single-owner.sh` accepts `.agro/**` or `.agro/knowledge/**` in each event list as knowledge coverage.
- [ ] `knowledge-path-single-owner.sh` reports a failure when a fixture copy of `ci-harness.yml` holds neither `.agro/**` nor `.agro/knowledge/**` in one event list.
- [ ] `harness-ci-core-paths.sh` reports a failure for each path filter whose literal prefix before the first `*` names no existing path.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.

### US-003: Narrow the boot guard to image and boot inputs

**Description:** As an operator, I want boot input changes alone to trigger the boot guard so that a skill edit skips the image build.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists in `sandbox-boot-guard.yml` each contain exactly these entries, in this order: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`.
- [ ] The two lists do not contain `.agro/**`, `.oh/**`, `packages/oh/**`, or `oh.json`.
- [ ] `sandbox-boot-guard-ci.sh` requires each of the eight entries above.
- [ ] `sandbox-boot-guard-ci.sh` reports a failure when a fixture copy of the workflow holds `.agro/**`, `packages/oh/**`, `.oh/**`, or `oh.json` as a path filter.
- [ ] `sandbox-boot-guard-ci.sh` no longer requires the per-script filters that `.agro/scripts/**` covers.
- [ ] The `paths` lists in `sandbox-compatibility.yml` contain no entry that starts with `.oh/`.
- [ ] The jobs `sandbox-boot-guard` and `sandbox-upgrade-guard` keep every current step.
- [ ] `sandbox-compatibility.yml` keeps the `optional-harness-install` job.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.
- [ ] `pnpm test:scripts` exits 0.

### US-004: Align `/ci-status` and the feat issue template with the real gates

**Description:** As an agent, I want `/ci-status` and the feat template to name the gates that CI runs so that local pre-flight checks match CI.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` lists the `CI: Harness` steps in workflow order: pnpm security audit, install, typecheck, build, test.
- [ ] The same file names the `boot-lint` and `eval-probes` jobs of `CI: Harness`.
- [ ] The same file does not name Lint, Format check, Prisma, or Playwright as a CI step.
- [ ] The Local Pre-flight block runs `pnpm run typecheck && pnpm run build:harness && pnpm test:scripts && bash .agro/skills/eval/run.sh`.
- [ ] The NO RUN bullet for `ci-harness.yml` names both `push` and `pull_request` triggers and does not name `packages/**`.
- [ ] The NO RUN list names `sandbox-boot-guard.yml` with its path filters from US-003.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` does not contain `pnpm run lint`, `format:check`, or `pnpm -r run type-check`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names `pnpm run typecheck` and `pnpm test:scripts` in one acceptance criterion.
- [ ] `ls -la .claude/skills/ci-status/SKILL.md` resolves through the `.claude/skills -> ../.agro/skills` link.

## Summary

Verified current state at `85a774a`:

- `package.json` defines `lint` as `echo "No root lint configured"` and `format:check` as `echo "No root format check configured"`. The Lint and Format check steps in `ci-harness.yml` and `release.yml` run these two scripts. Each step exits 0 on every commit.
- `packages/`, `.oh/`, and `oh.json` do not exist. `ci-harness.yml` still filters on `packages/**`, `.oh/**`, and `oh.json`. `sandbox-boot-guard.yml` still filters on `.oh/**`, `packages/oh/**`, and `oh.json`. `sandbox-compatibility.yml` filters on five `.oh/scripts/*` and `.oh/cli/**` file paths.
- `ci-harness.yml` lists `.agro/**` and also `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. The four narrower globs add no trigger.
- `sandbox-boot-guard.yml` filters on `.agro/**`. Thus a skill, probe, or task edit builds and boots the image.
- `sandbox-boot-guard-ci.sh` requires `".agro/**"` and `"packages/oh/**"`. `knowledge-path-single-owner.sh` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` event lists.
- `/ci-status` lists Lint, Format check, Prisma, and Playwright steps that no workflow runs. The feat template asks for `pnpm run lint && pnpm run format:check && pnpm -r run type-check`.
- No vitest file pins a path filter or a Lint step.
- `bash .agro/skills/eval/run.sh` exits 1 at `85a774a` with three unrelated regressions: `next-dev-prod`, `prd-output-path-contract`, and `skills-vendored`.

Selected approach: edit the three workflows, update the three probes that pin the old literals, and correct the two documents. Keep every gate that detects a defect. Keep boot testing on pull requests.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, `jobs.ci` steps | Harness CI trigger and gate steps |
| `.github/workflows/release.yml` | `jobs.validate` steps | Release validation steps |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot trigger |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Compatibility trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks for path filters | Boot guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `extract_paths`, `REQUIRED` | Harness CI path filter probe |
| `.agro/skills/ci-status/SKILL.md` | NO RUN list, CI Pipeline Steps, Local Pre-flight | Agent CI guidance |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria checklist | Feature issue gate list |
| `package.json` | `scripts.lint`, `scripts.format:check` | The no-op scripts behind the removed steps |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions `CI: Harness` | Modified | Loses the Lint and Format check steps. Trigger set stays equal. |
| GitHub Actions `Release` | Modified | The `validate` job loses the Lint and Format check steps. |
| GitHub Actions `CI: Sandbox Boot Guard` | Modified | Triggers on image and boot inputs only. |
| GitHub Actions `CI: Sandbox Compatibility` | Modified | Loses dead `.oh/` filters. Trigger set stays equal. |
| `/ci-status` skill | Modified | States the real steps and triggers. |
| Feat issue template | Modified | States the real local gates. |

## Storage

N/A. The task changes workflow YAML, probes, and Markdown. The task adds no persistent state.

## Architectural Decisions

- **Source of truth:** The workflow YAML owns the gate set. The probes assert the YAML. `/ci-status` and the feat template describe the YAML and do not define a gate.
- **Boot guard input set:** The Dockerfile copies from `.devcontainer/`, `.agro/scripts/`, `.agro/cli/`, and `.agro/install/`. The compose files and the entrypoint read `agro.json`, `.example.env`, and `.dockerignore`. These inputs plus the workflow file form the trigger set.
- **Accepted gap:** The Dockerfile also runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`. A change outside the trigger set changes the seed content but not the boot path. The issue accepts this gap. `sandbox-compatibility.yml` and `release.yml` still build the image on their own triggers.
- **Probe contract:** A probe asserts coverage, not a literal. `.agro/**` counts as knowledge coverage.
- **Canonical source:** Edit `.agro/skills/ci-status/SKILL.md`. Do not edit the `.claude/skills` mirror.
- **Execution location:** The application agent edits files and runs probes inside the sandbox. The root orchestrator owns the branch, the commit, and the pull request.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Requires the eight boot-input filters. Fails on `.agro/**`, `packages/oh/**`, `.oh/**`, or `oh.json`. Fails on a `.oh/` filter in the compatibility workflow. | US-003 |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Passes with `.agro/**` alone. Fails with neither glob in one event list. | US-002 |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Fails when a filter prefix names no existing path. | US-002 |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Still passes. | US-002 |
| `.agro/evals/probes/docs-build-fast-path.sh`, `pnpm-audit-ci-gate.sh`, `boot-lint-glob.sh`, `eval-ci-gate.sh` | Still pass. | US-001 |
| `.agro/scripts/__tests__/*.test.ts` via `pnpm test:scripts` | Still pass. | US-001, US-003 |
| `bash .agro/skills/eval/run.sh` | Reports no REGRESSION beyond the three at `85a774a`. | All stories |

Write each probe change first. Run the probe against the current workflow and observe the failure. Then edit the workflow and observe the pass. For each negative case, run the probe against a temporary workflow copy under `$TMPDIR`. Do not commit the copy.

## Design Principles

- A CI step that cannot fail does not stay in CI.
- A path filter names a path that exists and that no other filter already covers.
- A probe asserts behavior, not a literal string that a broader glob makes redundant.
- Keep every gate that detects a defect: eval probes, typecheck, tests, boot smoke, upgrade smoke, and optional-harness-install.
- Write no explanatory comment in tracked code.

## Out of Scope

- Moving image boot testing to release only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or optional-harness-install.
- Adding a real lint or format tool.
- Removing the `lint` and `format:check` scripts from `package.json`. Open question 2 tracks this.
- Removing `.claude/hooks/**` from `ci-harness.yml`. Open question 3 tracks this.
- Changing `release.yml` triggers.
- Documentation changes in `mifunedev/agro-web`. No public page names these CI steps or filters. Open question 4 confirms.

## Open Questions

1. Does branch protection require the check name `Lint, Typecheck, Build & Test`? If no, rename the `ci` job to `Typecheck, Build & Test`. If yes, keep the name, or update branch protection in the same change.
2. Remove the `lint` and `format:check` scripts from `package.json` after the steps go? No gate calls them after US-001.
3. `.claude/hooks` is a symlink to `../.agro/hooks`. Git records the symlink as one blob at `.claude/hooks`, so `.claude/hooks/**` matches no changed path. `.agro/**` covers the hook scripts. `harness-ci-hooks-paths.sh` pins the literal. Remove the filter and relax the probe in this task, or in a follow-up?
4. Does any `mifunedev/agro-web` page list the removed Lint or Format check steps?
5. Must the boot guard also trigger on `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`? The entrypoint fingerprints these files and runs `pnpm install` on drift. The issue list omits them.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION except `next-dev-prod`, `prd-output-path-contract`, and `skills-vendored`.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `git diff --name-only development...HEAD` lists only the files in Key Integration Points, excluding `package.json` unless open question 2 resolves to remove the scripts.
- [ ] On the pull request, `CI: Harness` runs and passes.
- [ ] On the pull request, `CI: Sandbox Boot Guard` runs and passes. The diff touches `.github/workflows/sandbox-boot-guard.yml`, which is one of its eight filters.

## Lessons

Filled by the advisor before undraft.
