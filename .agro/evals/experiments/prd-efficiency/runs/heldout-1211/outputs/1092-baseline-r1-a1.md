# PRD: Prune no-op CI gates and dead path filters

Status: DRAFT

Source: `work/issue-1092.md` (issue #1092).

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As an operator, I want each CI step to prove a real property so that a green run carries real evidence.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` has no step named `Lint` and no step named `Format check`.
- [ ] `.github/workflows/release.yml` has no step named `Lint` and no step named `Format check`.
- [ ] `grep -nE 'pnpm run lint|pnpm run format:check' .github/workflows/*.yml` prints no line.
- [ ] Both workflows keep the `Run pnpm security audit`, `Typecheck`, `Build`, and `Test` steps in their current order.
- [ ] `bash .agro/evals/probes/docs-build-fast-path.sh` exits 0.
- [ ] `bash .agro/evals/probes/pnpm-audit-ci-gate.sh` exits 0.

### US-002: Prune dead and redundant ci-harness path filters

**Description:** As an operator, I want the `CI: Harness` path filters to name only live, non-redundant paths so that the trigger list states the real trigger set.

**Acceptance Criteria:**

- [ ] The `push` and `pull_request` path lists in `ci-harness.yml` contain none of these entries: `packages/**`, `.oh/**`, `oh.json`.
- [ ] The same lists contain none of these entries: `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`.
- [ ] The same lists still contain `.agro/**`, `agro.json`, `.example.env`, `.claude/hooks/**`, `.devcontainer/**`, and `.github/workflows/ci-harness.yml`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` passes when each event's path list contains `.agro/**` or `.agro/knowledge/**`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` reports a failure when an event's path list contains neither `.agro/**` nor `.agro/knowledge/**`.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0 against the edited workflow.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.

### US-003: Narrow the sandbox boot guard to image and boot inputs

**Description:** As an operator, I want boot-input changes alone to trigger the boot guard so that skill edits skip the image build.

**Acceptance Criteria:**

- [ ] Each of the `push` and `pull_request` path lists in `.github/workflows/sandbox-boot-guard.yml` equals the boot input set.
- [ ] The boot input set is `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, and `.github/workflows/sandbox-boot-guard.yml`.
- [ ] Neither path list contains `.agro/**`, `.oh/**`, `packages/oh/**`, or `oh.json`.
- [ ] Neither path list names a single file under `.agro/scripts/`, because `.agro/scripts/**` covers each such file.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires `.agro/cli/**`, `.agro/scripts/**`, and `.agro/install/**`.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` reports a failure when the workflow contains `".agro/**"`, `"packages/oh/**"`, `".oh/**"`, or `"oh.json"`.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0 against the edited workflow.
- [ ] Every job and step in `sandbox-boot-guard.yml` other than the `on:` block stays byte-identical to the base commit.
- [ ] `pnpm test:scripts` exits 0, including `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` and `.agro/scripts/__tests__/cli-first-install-smoke.test.ts`.

### US-004: Align `/ci-status` and the feat issue template with the real gates

**Description:** As an agent, I want `/ci-status` and the feat template to name the gates that CI runs so that local pre-flight matches CI.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` contains no `pnpm run lint`, no `format:check`, no `prisma`, no `test:e2e`, and no `packages/**`.
- [ ] The "CI Pipeline Steps" section of `.agro/skills/ci-status/SKILL.md` lists the `CI: Harness` gates: `pnpm run security:audit`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`, the boot-lint job, and `bash .agro/skills/eval/run.sh`.
- [ ] The same section names the `CI: Sandbox Boot Guard` workflow and its path scope from US-003.
- [ ] The "NO RUN" bullet for `ci-harness.yml` matches the path lists from US-002.
- [ ] The "Local Pre-flight" command in `.agro/skills/ci-status/SKILL.md` runs only commands that exist in `package.json` or under `.agro/`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` contains no `pnpm run lint`, no `format:check`, and no `type-check`.
- [ ] The feat template has one checklist item that names `pnpm run typecheck`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Summary

Verified current state at commit `85a774a`:

- `package.json` defines `lint` as `echo "No root lint configured"` and `format:check` as `echo "No root format check configured"`.
- `ci-harness.yml` runs both scripts in the `ci` job. `release.yml` runs both scripts in the `validate` job.
- The paths `packages/`, `.oh/`, and `oh.json` do not exist in the repository.
- `ci-harness.yml` lists `.agro/**` and also lists `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`.
- `sandbox-boot-guard.yml` lists `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json`, and six single files under `.agro/scripts/`.
- `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires the literals `".agro/**"` and `"packages/oh/**"`.
- `.agro/evals/probes/knowledge-path-single-owner.sh` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` events.
- `.agro/skills/ci-status/SKILL.md` describes a Prisma and Playwright pipeline that this repository does not run.
- `.github/ISSUE_TEMPLATE/feat.md` names `pnpm run lint`, `pnpm run format:check`, and `pnpm -r run type-check`.

The `.devcontainer/Dockerfile` copies `.devcontainer/`, `.agro/cli/`, `.agro/install/`, and single files under `.agro/scripts/`.
The Dockerfile also runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`.
The seed copy makes every tracked file an image input.
The issue selects the narrow boot-and-image set anyway.
This plan follows that decision.

Selected approach: delete the no-op steps and the dead filters, then update the probes to the new contract.
The plan keeps every real gate.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, `jobs.ci.steps` | Harness CI triggers and steps |
| `.github/workflows/release.yml` | `jobs.validate.steps` | Release validation steps |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Boot guard triggers |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` path-filter assertions | Boot guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/skills/ci-status/SKILL.md` | "NO RUN" bullet, "CI Pipeline Steps", "Local Pre-flight" | Agent CI reference |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria checklist | Feature issue gates |
| `CHANGELOG.md` | Unreleased section | Change record per `.agro/skills/git/SKILL.md` |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `CI: Harness` workflow | Modified | Drops two no-op steps and seven dead or redundant path filters |
| `Release` workflow | Modified | Drops two no-op steps from `validate` |
| `CI: Sandbox Boot Guard` workflow | Modified | Triggers only on image and boot inputs |
| `/ci-status` skill | Modified | Names the real gates and the real local pre-flight |
| Feat issue template | Modified | Names the real local gates |

## Storage

N/A. The change edits workflow files, probes, and docs. The change adds no persistent state.

## Architectural Decisions

- The workflow `on:` blocks own the trigger contract. The probes verify the contract. The `/ci-status` skill describes the contract.
- `.agro/**` covers every `.agro/` subtree in `CI: Harness`. A subtree glob next to `.agro/**` adds no trigger.
- The boot guard trigger set equals the image and boot inputs from the issue. The `/opt/agro-seed/` copy does not widen the set.
- The boot guard keeps its PR trigger. Image boot testing does not move to release-only.
- The change edits canonical sources under `.agro/`. `.claude/skills` is a symlink to `.agro/skills`, so no mirror edit applies.

Affected surfaces:

- **Host and sandbox:** applied. Edits and probe runs happen in the sandbox checkout. CI runs on GitHub runners.
- **Lifecycle door:** not applicable. No `agro` verb changes.
- **Canonical and provider surfaces:** applied. `/ci-status` lives at `.agro/skills/ci-status/SKILL.md`.
- **Root and scaffold:** applied to this orchestrator repository. `.agro/manifest.json` ships skills to initialized projects, so the `/ci-status` text reaches them.
- **Interactive and headless processes:** not applicable. The change starts no process.
- **Local and remote operation:** not applicable. The change touches CI only.
- **Parallel operation:** not applicable. The change adds no shared mutable state.
- **Public documentation:** not applicable. `mifunedev/agro-web` documents no CI step or path filter <confirm with the operator>.
- **Verification:** applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Edit the probe first. The probe fails against the base workflow because the workflow contains `".agro/**"` and `"packages/oh/**"`. The probe passes after the US-003 edit. | US-003 contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Passes with `.agro/**` alone. Fails when a temporary copy of the workflow lacks both `.agro/**` and `.agro/knowledge/**`. | US-002 coverage rule |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Passes after US-002 | Core filters stay present |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Passes after US-002 | `.claude/hooks/**` stays present |
| `.agro/evals/probes/docs-build-fast-path.sh` | Passes after US-001 | Build step stays `pnpm run build:harness` |
| `.agro/evals/probes/pnpm-audit-ci-gate.sh` | Passes after US-001 | Security audit gate stays |
| `.agro/evals/probes/boot-lint-glob.sh` | Passes after US-001 | Boot-lint job stays intact |
| `.agro/evals/probes/eval-ci-gate.sh` | Passes after US-001 | Eval probe job stays |
| `.agro/scripts/__tests__/*.test.ts` | `pnpm test:scripts` exits 0 | Workflow-reading unit tests stay green |
| Full probe suite | `bash .agro/skills/eval/run.sh` reports no REGRESSION | No other probe pins a removed literal |

## Design Principles

- Code is the source of truth. Add no explanatory comment to a workflow or a probe.
- Delete obsolete paths. Leave no dormant filter.
- Keep one source of truth per policy. The workflow owns the trigger. The probe verifies the trigger.
- Keep every real gate: eval probes, typecheck, tests, boot smoke, upgrade smoke, and `optional-harness-install`.
- Change only the `on:` blocks and the two no-op steps in the workflows.

## Out of Scope

- Moving image boot testing to release-only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- Adding a real linter or formatter.
- Deleting the `lint`, `format`, and `format:check` scripts from `package.json`. `.husky/pre-commit` runs `pnpm run lint`.
- Renaming the `ci` job `Lint, Typecheck, Build & Test`. A branch-protection rule can require that name.
- Changing `.github/workflows/sandbox-compatibility.yml` or `.github/workflows/publish-cli.yml`.

## Open Questions

1. Does the operator want the `lint`, `format`, and `format:check` scripts deleted from `package.json`, with `.husky/pre-commit` changed to match? This plan keeps them.
2. Does a branch-protection rule require the job name `Lint, Typecheck, Build & Test`? If no rule requires the name, the job can drop `Lint` from its name. This plan keeps the name.
3. `.claude/hooks` is a symlink to `../.agro/hooks`, so the `.claude/hooks/**` filter can match no path. `harness-ci-hooks-paths.sh` requires the filter. Does the operator want the filter and the probe literal removed in this task? This plan keeps both.
4. Does `mifunedev/agro-web` document any CI step or path filter that this change affects?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` reports zero REGRESSION results.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `git diff --stat` against the base commit touches only these files: `.github/workflows/ci-harness.yml`, `.github/workflows/release.yml`, `.github/workflows/sandbox-boot-guard.yml`, `.agro/evals/probes/sandbox-boot-guard-ci.sh`, `.agro/evals/probes/knowledge-path-single-owner.sh`, `.agro/skills/ci-status/SKILL.md`, `.github/ISSUE_TEMPLATE/feat.md`, `CHANGELOG.md`.
- [ ] `CHANGELOG.md` has one Unreleased entry for this change.
- [ ] On the pull request, `CI: Harness` and `CI: Sandbox Boot Guard` both run and pass, because the change edits both trigger files.

## Lessons

Filled by the advisor before undraft.
