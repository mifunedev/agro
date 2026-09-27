# PRD: Prune CI gates that prove nothing

Status: DRAFT

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As an operator, I want to remove each CI step that always exits 0 so that each green check reports a real gate.

**Acceptance Criteria:**

- [ ] `git grep -n 'pnpm run lint\|pnpm run format:check' -- .github/workflows` prints no line.
- [ ] `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` still run `pnpm run security:audit`, `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test:scripts`.
- [ ] `bash .agro/evals/probes/docs-build-fast-path.sh` exits 0.
- [ ] `bash .agro/evals/probes/pnpm-audit-ci-gate.sh` exits 0.
- [ ] `bash .agro/evals/probes/audit-shellcheck-coverage.sh` exits 0.

### US-002: Remove dead and redundant path filters

**Description:** As an operator, I want each CI path filter to name a real, uncovered path so that the filters show the triggers.

**Acceptance Criteria:**

- [ ] The edited `knowledge-path-single-owner.sh` accepts `.agro/**` as knowledge coverage and exits 0 on the edited `ci-harness.yml`.
- [ ] The edited `knowledge-path-single-owner.sh` exits 1 when the push paths or the `pull_request` paths list neither `.agro/**` nor `.agro/knowledge/**`.
- [ ] `git grep -n 'packages/\*\*\|"\.oh/\|"oh\.json"' -- .github/workflows` prints no line.
- [ ] The push paths and the `pull_request` paths of `ci-harness.yml` do not list `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, or `.agro/knowledge/**`.
- [ ] The push paths and the `pull_request` paths of `ci-harness.yml` still list `.agro/**`, `.claude/hooks/**`, `agro.json`, and `.example.env`.
- [ ] `sandbox-compatibility.yml` keeps each `.agro/` and `.devcontainer/` filter and drops each `.oh/` filter.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0 after the `sandbox-compatibility.yml` edit.

### US-003: Narrow the sandbox boot guard to image and boot inputs

**Description:** As an operator, I want the boot guard to run only for image inputs so that a skill edit starts no image build.

**Acceptance Criteria:**

- [ ] Red test first: the edited `.agro/evals/probes/sandbox-boot-guard-ci.sh` exits 1 against the current `sandbox-boot-guard.yml`.
- [ ] The edited probe requires `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, and `.github/workflows/sandbox-boot-guard.yml` in the workflow.
- [ ] The edited probe reports a REGRESSION when the workflow lists `.agro/**`, `packages/oh/**`, `.oh/**`, or `oh.json` as a path filter.
- [ ] The push paths and the `pull_request` paths of `sandbox-boot-guard.yml` hold the same list, and that list is the list in the second criterion.
- [ ] The boot guard jobs, the upgrade smoke job, and the image verifier step stay unchanged.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0 after the workflow edit.

### US-004: Align the documented gates with the real gates

**Description:** As an agent, I want `/ci-status` and the feat template to name the real CI gates so that I run the real checks.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` lists the steps that `ci-harness.yml` runs and names no Lint, Format check, Prisma, or Playwright step.
- [ ] The NO RUN section of `.agro/skills/ci-status/SKILL.md` names the real `ci-harness.yml` triggers and the narrowed `sandbox-boot-guard.yml` triggers.
- [ ] The Local Pre-flight block in `.agro/skills/ci-status/SKILL.md` runs `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`, and `bash .agro/skills/eval/run.sh`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names no `pnpm run lint` and no `pnpm run format:check` command.
- [ ] The paragraph at `.agro/README.md:88` no longer claims that the workflows keep the `packages/oh/**` filter.
- [ ] `bash .agro/evals/probes/continual-learning-20260911b.sh` exits 0.
- [ ] The provider link check `<link check command>` exits 0.

## Summary

Issue 1092 holds the operator review of the PR pipelines. The task removes each CI step and each path filter with no effect. The task keeps each gate with a real failure path.

Verified current state:

- `package.json:15` defines `lint` as `echo "No root lint configured"`. `package.json:16` defines `format:check` as an echo. Both scripts always exit 0.
- `ci-harness.yml:100-104` and `release.yml:54-58` run both scripts as CI steps.
- The paths `packages/`, `.oh/`, and `oh.json` do not exist in the repository.
- `ci-harness.yml:9-55` lists `packages/**`, `.oh/**`, and `oh.json`. The same lists add `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**` next to `.agro/**`.
- `sandbox-boot-guard.yml:9-41` lists `.agro/**`, `.oh/**`, `packages/oh/**`, and `oh.json`. Each `.agro/scripts/<file>` filter duplicates the coverage of `.agro/**`.
- `sandbox-compatibility.yml:15-44` lists five `.oh/` paths that name no file.
- `sandbox-boot-guard-ci.sh:30-31` requires `.agro/**` and `packages/oh/**` in the boot guard.
- `knowledge-path-single-owner.sh:50-55` requires the literal `.agro/knowledge/**` in `ci-harness.yml`.
- `.agro/skills/ci-status/SKILL.md:105-133` documents Lint, Format check, Prisma, and Playwright steps that CI does not run.
- `.github/ISSUE_TEMPLATE/feat.md:41` asks for `pnpm run lint && pnpm run format:check`.

Selected approach: edit the three workflows, then update each probe that pins a removed literal. Update the probes before the workflows so that each probe change starts red.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, steps `Lint` and `Format check` | Harness CI triggers and steps |
| `.github/workflows/release.yml` | job `Validate`, steps `Lint` and `Format check` | Release validation steps |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot triggers |
| `.github/workflows/sandbox-compatibility.yml` | `on.push.paths`, `on.pull_request.paths` | Compatibility triggers with dead `.oh/` filters |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` calls at lines 29-42 | Boot guard trigger contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` at lines 50-55 | Knowledge CI coverage contract |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `REQUIRED` | Core path contract; stays green |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `.claude/hooks/**` count | Hook path contract; stays green |
| `.agro/skills/ci-status/SKILL.md` | NO RUN section, CI Pipeline Steps, Local Pre-flight | Agent-facing gate description |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria line 41 | Issue-facing gate description |
| `.agro/README.md` | lines 88-89 | Stale claim about kept legacy filters |
| `.devcontainer/Dockerfile` | `COPY` at lines 54-56, 94-116, 135 | Evidence for the image input set |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions `CI: Harness` | Modify | Drops two steps and eleven redundant or dead path filters per event |
| GitHub Actions `Release` | Modify | Drops two steps from `Validate` |
| GitHub Actions `CI: Sandbox Boot Guard` | Modify | Triggers only on image and boot inputs |
| GitHub Actions `Sandbox compatibility` | Modify | Drops dead `.oh/` filters |
| `/ci-status` skill | Modify | Documents the real steps and triggers |
| Feat issue template | Modify | Names the real pre-push checks |

## Storage

N/A. The task changes workflow configuration, probes, and documentation. The task adds no persistent state.

## Architectural Decisions

- The workflow YAML is the source of truth for the gates. The probes assert the durable contract. `/ci-status` and the feat template describe the workflows and follow them.
- The boot guard input set is `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, and the workflow file. The Dockerfile `COPY` lines at 54-56 and 94-116 read only from these paths.
- `Dockerfile:135` copies the full build context into `/opt/agro-seed/`. A skill edit changes that seed without a boot guard run. The operator accepted this trade in issue 1092. The release workflow still builds and smoke-tests the image on each push to `main` or `master`.
- `.agro/**` in `ci-harness.yml` covers each `.agro/` subtree. The probes accept `.agro/**` as coverage for `.agro/knowledge/**`.
- `.claude/hooks/**` stays in `ci-harness.yml`, because `.agro/**` does not cover that path.
- The job name `Lint, Typecheck, Build & Test` stays unchanged in this task. Open question 2 holds the rename decision.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Requires the eight narrowed filters; rejects `.agro/**`, `packages/oh/**`, `.oh/**`, `oh.json` | US-003 trigger contract; red on the current workflow |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Accepts `.agro/**` or `.agro/knowledge/**` in both events; rejects absence of both | US-002 knowledge coverage |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Existing cases | `agro.json` and `.example.env` stay in `ci-harness.yml` |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Existing cases | `.claude/hooks/**` stays in `ci-harness.yml` |
| `.agro/evals/probes/docs-build-fast-path.sh` | Existing cases | The Build step stays `pnpm run build:harness` |
| `.agro/evals/probes/pnpm-audit-ci-gate.sh` | Existing cases | The security audit gate stays |
| `.agro/evals/probes/eval-ci-gate.sh` | Existing cases | The eval probe gate stays |
| `.agro/evals/probes/continual-learning-20260911b.sh` | Existing cases | `/ci-status` keeps the no-run-is-not-a-pass rule |
| `bash .agro/skills/eval/run.sh` | Full probe suite | No probe regresses |

## Design Principles

- Code is the source of truth. A CI step that always exits 0 is a false claim, so the task deletes the step.
- Delete obsolete paths. A filter that names no file is dormant, so the task deletes the filter.
- Keep one source of truth for each policy. The workflows own the gates. The docs follow the workflows.
- Assert the durable invariant in a probe, not an obsolete literal.
- Keep every gate that can fail: eval probes, typecheck, tests, boot smoke, upgrade smoke, and `optional-harness-install`.

## Out of Scope

- Move the image boot test to the release workflow only.
- Remove eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- Add a real lint or format tool.
- Change branch protection or required status check settings.
- Change `mifunedev/agro-web`. The public docs do not describe these CI triggers.

## Open Questions

1. Does the task delete the `lint` and `format:check` scripts from `package.json`? Recommendation: delete both scripts, because no caller remains after US-001 and US-004.
2. Does branch protection require the check name `Lint, Typecheck, Build & Test`? If no protection requires the name, rename the job to `Typecheck, Build & Test`.
3. What is the provider link check command? Replace `<link check command>` in US-004 with the verified command.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `git grep -n 'packages/\*\*\|packages/oh\|"\.oh/\|"oh\.json"\|pnpm run lint\|pnpm run format:check' -- .github .agro/skills/ci-status` prints no line.
- [ ] `ci-harness.yml`, `release.yml`, and `sandbox-compatibility.yml` still hold the eval probe job, the typecheck step, the test step, the boot smoke, the upgrade smoke, and the `optional-harness-install` job.
- [ ] `CHANGELOG.md` holds one entry for this change, per `.agro/skills/git/SKILL.md`.
- [ ] CI on the task pull request is green, as `/ci-status` reports.

## Lessons

Filled by the advisor before undraft.
