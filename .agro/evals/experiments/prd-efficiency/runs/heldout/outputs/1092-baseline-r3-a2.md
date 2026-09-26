# PRD: Remove no-op CI gates and dead path filters, and narrow the boot guard

Status: DRAFT

Source: `work/issue-1092.md` (issue #1092).

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As an operator, I want CI and release to run only failable steps so that a green check proves a real gate.

**Acceptance Criteria:**

- [ ] `grep -nE 'pnpm run (lint|format:check)' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints no line and exits 1.
- [ ] `ci-harness.yml` job `ci` still runs these steps in this order: `pnpm run security:audit`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`.
- [ ] `release.yml` job `validate` still runs `pnpm run security:audit`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`, and `bash .agro/scripts/check-pnpm-pin.sh`.
- [ ] The `boot-lint` and `eval-probes` jobs in both workflows are unchanged.
- [ ] `bash .agro/evals/probes/pnpm-audit-ci-gate.sh`, `bash .agro/evals/probes/docs-build-fast-path.sh`, `bash .agro/evals/probes/boot-lint-glob.sh`, and `bash .agro/evals/probes/eval-ci-gate.sh` each exit 0.

### US-002: Remove dead and redundant path filters from harness CI and sandbox compatibility

**Description:** As an operator, I want each path filter to name a real, uncovered path so that the trigger list is true.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists of `ci-harness.yml` contain none of: `packages/**`, `.oh/**`, `oh.json`, `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`.
- [ ] The `push.paths` and `pull_request.paths` lists of `ci-harness.yml` still contain `.agro/**`, `agro.json`, `.example.env`, `.claude/hooks/**`, and `.github/workflows/ci-harness.yml`.
- [ ] `grep -nF '".oh/' .github/workflows/sandbox-compatibility.yml` prints no line and exits 1.
- [ ] Each `.agro/...` filter in `sandbox-compatibility.yml` that existed before this change still exists after it.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` as coverage for `.agro/knowledge/**` on both event types, and still reports a regression when neither `.agro/**` nor `.agro/knowledge/**` is present.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh`, `bash .agro/evals/probes/harness-ci-core-paths.sh`, and `bash .agro/evals/probes/harness-ci-hooks-paths.sh` each exit 0.

### US-003: Narrow the sandbox boot guard to image and boot inputs

**Description:** As an operator, I want only image or boot inputs to start the boot guard so that a skill edit skips the image build.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists of `sandbox-boot-guard.yml` are each exactly: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`. Open questions 1 and 2 can add entries to this list.
- [ ] The boot guard filter lists contain none of: `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json`, or a single file under `.agro/scripts/`.
- [ ] The jobs `sandbox-boot-guard` and `sandbox-upgrade-guard` keep every step. The diff for `sandbox-boot-guard.yml` changes only the `on:` block.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires the eight filters above and reports a regression when the boot guard lists `.agro/**`, `packages/oh/**`, `.oh/**`, or `oh.json`.
- [ ] The probe still checks the compose validation, the local image build, the image verifier, the boot smoke, the upgrade smoke, and the `sandbox-compatibility.yml` jobs.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.
- [ ] If a copy of the workflow adds `".agro/**"` to the boot guard filters, the probe run against that copy exits 1.

### US-004: Align `/ci-status` and the feat issue template with the real gates

**Description:** As an agent, I want `/ci-status` and the feat template to name the real CI gates so that local checks match CI.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` names no `lint`, `format:check`, `type-check`, Prisma, or Playwright step.
- [ ] The `/ci-status` pipeline section lists the `ci-harness.yml` job `ci` steps in order: `pnpm run security:audit`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`. It also names the `boot-lint` and `eval-probes` jobs.
- [ ] The `/ci-status` NO RUN section states the real `on:` filters for `ci-harness.yml`, `sandbox-boot-guard.yml`, `sandbox-compatibility.yml`, and `release.yml`, and names no `packages/**` path.
- [ ] The `/ci-status` local pre-flight command is `pnpm run typecheck && pnpm run build:harness && pnpm test:scripts && bash .agro/skills/eval/run.sh`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names no `pnpm run lint`, `format:check`, or `pnpm -r run type-check`, and names `pnpm run typecheck`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`.
- [ ] The edit lands in `.agro/skills/ci-status/SKILL.md`. `.claude/skills` remains a symlink to `../.agro/skills`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no finding in the lines that this story changes in each of the two files.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

## Summary

Verified current state, at commit `85a774a`:

- `package.json` defines `lint` as `echo "No root lint configured"` and `format:check` as `echo "No root format check configured"`. The Lint and Format check steps in `ci-harness.yml` and `release.yml` always pass.
- `ci-harness.yml` lists `packages/**`, `.oh/**`, and `oh.json` in both path lists. No `packages/`, `.oh/`, or `oh.json` path exists in the repository. The same lists also name `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. The `.agro/**` filter in the same lists covers each of those four globs.
- `sandbox-boot-guard.yml` lists `.agro/**`, `.oh/**`, `packages/oh/**`, and `oh.json`. The `.agro/**` filter starts an image build, a CLI-first install smoke, a full boot smoke, and an upgrade smoke for each control-plane edit.
- `sandbox-compatibility.yml` lists five `.oh/scripts/*.sh` and `.oh/cli/src/commands/harness.ts` filters next to their `.agro/` equivalents.
- `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires `".agro/**"` and `"packages/oh/**"` on the boot guard. `.agro/evals/probes/knowledge-path-single-owner.sh` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` path lists.
- `.agro/skills/ci-status/SKILL.md` describes Lint, Format check, Prisma, and Playwright steps that no workflow runs. The same file states that `ci-harness.yml` runs on push only, with `packages/**` in the filter.
- `.github/ISSUE_TEMPLATE/feat.md` asks for `pnpm run lint && pnpm run format:check && pnpm -r run type-check`. Of those three, only `typecheck` exists in `package.json`, and its name is `typecheck`, not `type-check`.

Selected approach: edit three workflow `on:` blocks and two step lists, update the two probes to the new contract, and correct two documents. Add no new workflow, probe, or script.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, job `ci` steps `Lint`, `Format check` | Harness CI triggers and core gate |
| `.github/workflows/release.yml` | job `validate` steps `Lint`, `Format check` | Release validation gate |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot trigger |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Compatibility build trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks for path filters | Boot guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `REQUIRED` | Must stay green; no change planned |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `.claude/hooks/**` count | Must stay green; no change planned |
| `.agro/skills/ci-status/SKILL.md` | NO RUN list, `## CI Pipeline Steps`, `## Local Pre-flight` | Agent-facing CI description |
| `.github/ISSUE_TEMPLATE/feat.md` | `## Acceptance Criteria` | Issue author checklist |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry under `/git` policy |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions `CI: Harness` | Modify | Two steps removed. The trigger list loses dead and redundant filters. The set of files that start the workflow does not change. |
| GitHub Actions `Release` | Modify | Two steps removed from `validate`. |
| GitHub Actions `CI: Sandbox Boot Guard` | Modify | Trigger list narrowed to image and boot inputs. |
| GitHub Actions `CI: Sandbox Compatibility` | Modify | Dead `.oh/` filters removed. The set of files that start the workflow does not change. |
| `/ci-status` skill | Modify | Text matches the real workflows. |
| Feat issue template | Modify | Checklist names real commands. |
| `mifunedev/agro-web` | N/A | `/ci-status` is an in-repo agent skill. No lifecycle verb or public term changes. <open question 4 confirms> |

## Storage

N/A. The change edits workflow YAML, probes, and Markdown. No state persists.

## Architectural Decisions

- **Source of truth:** each workflow `on:` block owns its trigger set. The probes assert the contract. `/ci-status` and the feat template describe the workflows. The workflows do not follow those two documents.
- **Boot guard input set:** the operator decision in the issue defines the set. `.agro/scripts/**` covers `docker-compose.sh`, `sandbox-boot-smoke.sh`, `sandbox-upgrade-smoke.sh`, `cli-first-install-smoke.sh`, `harness-config.sh`, `verify-sandbox-image.sh`, and `link-providers.sh`. The explicit single-file entries are redundant and go away.
- **Accepted risk:** `.devcontainer/Dockerfile` line 135 runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`, so each tracked file is part of the image. `.devcontainer/entrypoint.sh` fingerprints the root pnpm manifests and runs `link-providers.sh`, which reads `.agro/skills/`. After this change, an edit to `package.json`, `pnpm-lock.yaml`, `crons/**`, or `.agro/skills/**` does not start the boot guard. Open questions 1 and 2 record this gap. The issue forbids a move of boot tests to release-only, so `release.yml` gets no boot job.
- **Filter redundancy:** GitHub matches a changed file against any listed glob. Removal of a glob that `.agro/**` already covers does not change the trigger set of `ci-harness.yml`.
- **Job names:** the job `ci` keeps the display name `Lint, Typecheck, Build & Test`. Branch protection can require the check by that name. Open question 3 records the rename decision.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Update the probe first. The probe exits 1 on the current workflow. After the workflow edit, the probe exits 0. | US-003 contract |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Add `".agro/**"` to the boot guard in a temporary repository copy. The probe exits 1 on that copy. | US-003 negative case |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Update the probe first. With `.agro/**` present and `.agro/knowledge/**` absent in a temporary copy, the probe exits 0. With both absent, the probe exits 1. | US-002 coverage rule |
| `.agro/evals/probes/harness-ci-core-paths.sh`, `harness-ci-hooks-paths.sh`, `pnpm-audit-ci-gate.sh`, `docs-build-fast-path.sh`, `boot-lint-glob.sh`, `eval-ci-gate.sh` | Run unchanged; each exits 0. | US-001 and US-002 do not break existing gates |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts`, `sandbox-upgrade-smoke.test.ts`, `issue-templates.test.ts` | `pnpm vitest run <file>`; each exits 0. | Workflow steps and template stay intact |
| Full suite | `bash .agro/skills/eval/run.sh` and `pnpm test:scripts` each exit 0. | No regression |
| Workflow syntax | `<workflow lint command>` against the four edited workflows exits 0. | YAML stays valid. Open question 5. |

## Design Principles

- Delete obsolete paths. Do not leave a dormant alternative.
- A CI step that cannot fail is not a gate. Remove it.
- Keep one source of truth: the workflow owns the trigger set, and each document describes it.
- A probe asserts the durable invariant, not an obsolete literal (`/ci-status` guidance on probe updates).
- Keep the change minimal: no new workflow, no new probe, no new script.

## Out of Scope

- A move of image boot testing to release-only.
- Removal or weakening of eval probes, `typecheck`, tests, the boot smoke, the upgrade smoke, or `optional-harness-install`.
- The addition of a real lint or format tool.
- Removal of the `lint`, `format`, and `format:check` scripts from `package.json`, unless open question 6 selects it.
- Changes to historical documents under `docs/rfcs/`, `docs/release-requirements-1019-boot-fix.md`, or `.agro/evals/datasets/`.
- A rename of the `openharness-sandbox-boot-guard` image tag or of any job ID.

## Open Questions

1. Add `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` to the boot guard filters? `entrypoint.sh` fingerprints these manifests and the boot guard runs `pnpm install --frozen-lockfile`.
   A. No. Keep the issue list. (Default for this plan.)
   B. Yes. Add all three.
2. Add `crons/**` or `.agro/skills/**` to the boot guard filters? The entrypoint reads `crons/`, and `link-providers.sh` reads `.agro/skills/` at boot.
   A. No. Keep the issue list. (Default for this plan.)
   B. Add `crons/**` only.
   C. Add both.
3. Rename the `ci` job display name `Lint, Typecheck, Build & Test`?
   A. No. Keep the name so that branch protection keeps its required check. (Default for this plan.)
   B. Yes. Rename it to `Typecheck, Build & Test` and update branch protection in the same change.
4. Does `mifunedev/agro-web` document the CI gates or `/ci-status`? This plan assumes no.
5. Which workflow syntax check does this repository accept? No `actionlint` step exists in CI. Supply `<workflow lint command>` or accept a manual YAML parse with `node -e` and the `yaml` package.
6. Delete the `lint`, `format`, and `format:check` echo scripts from `package.json`?
   A. No. Keep them. (Default for this plan.)
   B. Yes. Delete the three scripts in US-001.

## Acceptance Criteria

- [ ] Each story acceptance criterion above passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 and reports no REGRESSION.
- [ ] `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test:scripts` each exit 0 in the sandbox.
- [ ] `git diff --stat` for the task names only files in the Key Integration Points table.
- [ ] `CHANGELOG.md` `## [Unreleased]` carries one entry that cites issue #1092.
- [ ] On the task pull request, `CI: Harness` runs and passes. `CI: Sandbox Boot Guard` runs, because the pull request changes `.github/workflows/sandbox-boot-guard.yml`, and passes.

## Lessons

Filled by the advisor before undraft.
