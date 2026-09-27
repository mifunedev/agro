# PRD: CI gates that prove something

Status: DRAFT

## User Stories

### US-001: Remove no-op steps and dead filters from harness CI and release

**Description:** As an operator, I want each harness CI step and each path filter to name real work. Then a green check means a real gate passed.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` contain no `pnpm run lint` step and no `pnpm run format:check` step.
- [ ] `package.json` defines no `lint` script and no `format:check` script.
- [ ] The `push.paths` list and the `pull_request.paths` list in `ci-harness.yml` contain none of `packages/**`, `.oh/**`, `oh.json`.
- [ ] The `ci-harness.yml` path lists contain none of `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`, and each list keeps `.agro/**`.
- [ ] The `ci-harness.yml` path lists keep `.claude/hooks/**`, `agro.json`, and `.example.env`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` or `.agro/knowledge/**` in each event path list, and the probe exits 0 against the edited workflow.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` and `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exit 0.
- [ ] Red test: before the probe edit, `knowledge-path-single-owner.sh` exits 1 against the edited workflow. After the probe edit, the probe exits 0.

### US-002: Narrow the sandbox boot guard to image and boot inputs

**Description:** As an operator, I want the sandbox boot guard to run only on image or boot input changes. Then a skill, probe, or knowledge edit does not rebuild the sandbox image.

**Acceptance Criteria:**

- [ ] The `push.paths` list and the `pull_request.paths` list in `.github/workflows/sandbox-boot-guard.yml` each equal this set: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`.
- [ ] `sandbox-boot-guard.yml` contains none of `".agro/**"`, `".oh/**"`, `"packages/oh/**"`, `"oh.json"`.
- [ ] `.github/workflows/sandbox-compatibility.yml` contains no path filter that starts with `.oh/`.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires `.agro/cli/**`, `.agro/scripts/**`, and `.agro/install/**` in the boot guard path filters.
- [ ] `sandbox-boot-guard-ci.sh` reports a regression when the boot guard names `".agro/**"`, `".oh/**"`, `"packages/oh/**"`, or `"oh.json"`.
- [ ] Red test: the edited probe exits 1 against the current `sandbox-boot-guard.yml`, and the probe exits 0 against the narrowed workflow.
- [ ] The boot guard jobs, the boot smoke, the upgrade smoke, and the `optional-harness-install` job keep their steps unchanged.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Align CI documentation with the real gates

**Description:** As an agent that reads `/ci-status` or the feature template, I want the documented gates to match the workflows. Then local pre-flight runs the checks that CI runs.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` lists the `CI: Harness` steps in workflow order: `pnpm run security:audit`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`.
- [ ] `.agro/skills/ci-status/SKILL.md` names the Boot Path Lint job and the Eval Probe Regression Gate job, and names no Prisma step and no Playwright step.
- [ ] The local pre-flight block in `.agro/skills/ci-status/SKILL.md` runs `pnpm run typecheck && pnpm run build:harness && pnpm test:scripts && bash .agro/skills/eval/run.sh`.
- [ ] The NO RUN section of `.agro/skills/ci-status/SKILL.md` lists `push` and `pull_request` triggers for `ci-harness.yml` and names no `packages/**` filter.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` contains no `pnpm run lint` and no `pnpm run format:check`, and the gate line names `pnpm run typecheck && pnpm test:scripts`.
- [ ] `.agro/README.md` does not state that the legacy `packages/oh/**` filters stay in place.
- [ ] `.agro/evals/README.md` states that `.agro/**` triggers the eval gate for probe edits and `RESULTS.md` edits.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ci-status/SKILL.md` reports no finding on the edited lines.

## Summary

Issue #1092 (`work/issue-1092.md`) reports three CI defects. This plan removes each defect.

Verified current state:

- `package.json:15` defines `lint` as `echo "No root lint configured"`. `package.json:16` defines `format:check` as `echo "No root format check configured"`. Both scripts always exit 0.
- `ci-harness.yml:100-104` and `release.yml:54-58` run both no-op scripts.
- `ci-harness.yml:9-31` and `ci-harness.yml:33-55` name `packages/**`, `.oh/**`, and `oh.json`. The repository root has no `packages/`, no `.oh/`, and no `oh.json`.
- `ci-harness.yml` names `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**` next to `.agro/**`. The `.agro/**` glob matches each of those paths.
- `sandbox-boot-guard.yml:9-41` names `.agro/**`, `.oh/**`, `packages/oh/**`, and `oh.json`. The `.agro/**` glob starts the image build for each skill edit, probe edit, and knowledge edit.
- `sandbox-compatibility.yml:20-44` names five `.oh/` paths that match no file.
- `.agro/evals/probes/sandbox-boot-guard-ci.sh:30-31` requires `".agro/**"` and `"packages/oh/**"`.
- `.agro/evals/probes/knowledge-path-single-owner.sh:50-55` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` event blocks.
- `.agro/skills/ci-status/SKILL.md:106` and `.agro/skills/ci-status/SKILL.md:116-133` describe Lint, Format, Prisma, and Playwright steps. The workflows run no such step.
- `.github/ISSUE_TEMPLATE/feat.md:41` asks for `pnpm run lint && pnpm run format:check && pnpm -r run type-check`.

Selected approach: delete the no-op steps and scripts. Delete the dead filters and the redundant filters. List the image inputs in the boot guard, and move each probe to the new contract. Then align the docs with the workflows.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, steps `Lint` and `Format check` | Harness CI triggers and steps |
| `.github/workflows/release.yml` | `Validate` job steps `Lint` and `Format check` | Release validation |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot trigger |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Compatibility trigger with dead `.oh/` filters |
| `package.json` | `scripts.lint`, `scripts.format:check` | No-op scripts |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks at lines 29-35 | Boot guard path contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI trigger contract |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `REQUIRED` | Core config trigger contract; no edit |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `hook_path_count` | `.claude/hooks/**` trigger contract; no edit |
| `.agro/skills/ci-status/SKILL.md` | NO RUN list, CI Pipeline Steps, Local Pre-flight | Agent CI guidance |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria gate line | Feature issue gate |
| `.agro/README.md` | lines 88-90 | Path filter history note |
| `.agro/evals/README.md` | line 178 | Eval gate trigger note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `CI: Harness` workflow | Modified | Two steps removed. Path filters reduced. |
| `Release` workflow `Validate` job | Modified | Two steps removed. |
| `CI: Sandbox Boot Guard` workflow | Modified | Triggers limited to image and boot inputs. |
| `pnpm run lint`, `pnpm run format:check` | Removed | Both scripts leave `package.json`. |
| `/ci-status` skill | Modified | Documents the real steps and the real triggers. |
| Feature issue template | Modified | Gate line names the real commands. |

## Storage

N/A. The change edits workflow files, probes, and docs. The change adds no persistent state.

## Architectural Decisions

- The workflow files own the CI contract. The probes pin the durable invariant: required inputs present, dead filters absent. The probes do not pin redundant literals.
- A path filter must match a tracked path. A filter that names a deleted tree gives false confidence.
- The boot guard runs on image inputs and boot inputs only. `.devcontainer/Dockerfile:55-56` and `.devcontainer/Dockerfile:94-116` copy from `.agro/scripts/`, `.agro/cli/`, and `.agro/install/`.
- `.devcontainer/Dockerfile:135` copies the full repository into `/opt/agro-seed/`. A skill edit changes the seed content, but the seed copy does not change boot behavior. The harness CI job and the eval gate still run on each `.agro/**` edit.
- Release keeps its image build and boot smoke. The boot guard stays a PR gate and a push gate.
- Removal of the no-op scripts from `package.json` follows the repository rule to delete obsolete paths.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Requires `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`; rejects `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json` | US-002 boot guard contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Accepts `.agro/**` as knowledge coverage in each event block | US-001 filter reduction |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `agro.json` and `.example.env` stay in both event blocks | US-001 regression floor |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `.claude/hooks/**` stays in both event blocks | US-001 regression floor |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | Existing cases | US-002 keeps the upgrade smoke wiring |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Existing cases | US-002 keeps the install smoke wiring |
| `bash .agro/skills/eval/run.sh` | Full probe suite | No green probe turns red |

## Design Principles

- Code is the source of truth. A CI step that always passes is a false claim.
- Delete obsolete paths. Do not keep a dead filter to keep a probe green.
- Pin the invariant, not the literal.
- Keep one source of truth. The docs describe the workflows and add no second contract.

## Out of Scope

- A move of the image boot test to release only.
- Removal of eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- A new lint tool or a new format tool.
- Edits to `.agro/evals/datasets/**` fixtures that name `format:check`.
- Changes to archived task files under `.agro/tasks/archive/`.
- Changes to `mifunedev/agro-web`. The public docs name no root lint gate. Confirm this in Open Question 2.

## Open Questions

1. The `ci-harness.yml` job name is `Lint, Typecheck, Build & Test`. A branch protection rule can require that name. Does the operator want the job renamed to `Typecheck, Build & Test`? This plan keeps the current name until the operator answers.
2. Does `mifunedev/agro-web` document `pnpm run lint` or `pnpm run format:check`? This plan did not read the `mifunedev/agro-web` repository.

## Acceptance Criteria

- [ ] `git grep -n 'pnpm run lint\|format:check' -- .github package.json .agro/skills/ci-status` returns no match.
- [ ] `git grep -n 'packages/\*\*\|packages/oh/\*\*\|"\.oh/\|"oh\.json"' -- .github/workflows` returns no match.
- [ ] `sandbox-boot-guard.yml` names no `".agro/**"` filter.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.

## Lessons

Filled by the advisor before undraft.
