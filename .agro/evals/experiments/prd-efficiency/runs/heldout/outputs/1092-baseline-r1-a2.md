# PRD: Prune dead CI gates and narrow the boot guard

Status: DRAFT

Source: `work/issue-1092.md` (issue #1092).

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As a maintainer, I want CI to run only failable steps so that a green check proves a real gate.

**Acceptance Criteria:**

- [ ] `grep -nE 'pnpm run (lint|format:check)' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints no line.
- [ ] The `ci` job in `.github/workflows/ci-harness.yml` still runs these steps in this order: `pnpm run security:audit`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build:harness`, `pnpm test:scripts`.
- [ ] The `validate` job in `.github/workflows/release.yml` still runs `pnpm run typecheck`, `pnpm run build:harness`, and the release test step that the job runs today.
- [ ] The job keys `ci`, `boot-lint`, and `eval-probes` in `ci-harness.yml` keep their current names.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-002: Prune dead and redundant path filters in harness CI

**Description:** As a maintainer, I want each `ci-harness.yml` path filter to be live and unique so that the trigger list is true.

**Acceptance Criteria:**

- [ ] The `push.paths` and `pull_request.paths` lists in `ci-harness.yml` contain none of these entries: `packages/**`, `.oh/**`, `oh.json`, `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`.
- [ ] The `push.paths` and `pull_request.paths` lists in `ci-harness.yml` still contain `.agro/**`, `.claude/hooks/**`, `agro.json`, and `.example.env`.
- [ ] The `push.paths` list and the `pull_request.paths` list in `ci-harness.yml` hold the same entries.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` exits 0 when each event path list contains `.agro/**` or `.agro/knowledge/**`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` exits 1 when an event path list contains neither `.agro/**` nor `.agro/knowledge/**`.
- [ ] `.agro/evals/probes/harness-ci-core-paths.sh` exits 1 when either event path list contains `packages/**`, `.oh/**`, or `oh.json`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-003: Narrow the boot guard to image and boot inputs

**Description:** As a maintainer, I want the boot guard to run only on image or boot inputs so that skill edits skip the image build.

**Acceptance Criteria:**

- [ ] The `push.paths` list and the `pull_request.paths` list in `.github/workflows/sandbox-boot-guard.yml` each hold exactly these entries: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`, plus each entry that Open Question 1 adds.
- [ ] `sandbox-boot-guard.yml` names none of these entries: `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json`, `.agro/scripts/harness-config.sh`.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires each entry of the narrowed list.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` exits 1 when `sandbox-boot-guard.yml` contains `".agro/**"`, `"packages/oh/**"`, `".oh/**"`, or `"oh.json"` as a path filter.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` exits 1 when a path filter in `sandbox-boot-guard.yml` names a literal file that does not exist.
- [ ] The jobs `sandbox-boot-guard` and `sandbox-upgrade-guard` keep every step that they run today.
- [ ] `.github/workflows/sandbox-compatibility.yml` is unchanged, and its `optional-harness-install` job stays present.
- [ ] `.github/workflows/release.yml` still does not build or boot the sandbox image as a replacement for the boot guard.
- [ ] `.agro/README.md` no longer states that the legacy `packages/oh/**` filters stay to keep the path probes green.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm test:scripts` exits 0.

### US-004: Align `/ci-status` and the feat template with the real gates

**Description:** As an agent, I want `/ci-status` and the feat template to name real CI steps so that a pre-flight run proves what CI proves.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` names no Lint step, no Format check step, no Prisma step, and no Playwright step.
- [ ] The "CI Pipeline Steps" section of `.agro/skills/ci-status/SKILL.md` lists the `ci-harness.yml` jobs `ci`, `boot-lint`, and `eval-probes`, and the `ci` job steps in workflow order.
- [ ] The "NO RUN" section of `.agro/skills/ci-status/SKILL.md` states that `ci-harness.yml` triggers on push and on pull_request, and lists the path filters that US-002 leaves.
- [ ] The "NO RUN" section names `sandbox-boot-guard.yml` and lists the path filters that US-003 leaves.
- [ ] The "Local Pre-flight" command in `.agro/skills/ci-status/SKILL.md` is `pnpm run typecheck && pnpm run build:harness && pnpm test:scripts && bash .agro/skills/eval/run.sh`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` has no `pnpm run lint`, no `pnpm run format:check`, and no `pnpm -r run type-check`.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names `pnpm run typecheck` and `pnpm test:scripts` in the check criterion.
- [ ] `.claude/skills/ci-status/SKILL.md` resolves through the `.claude/skills` symlink to the edited canonical file.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ci-status/SKILL.md` reports no finding on a line that this story changes.

## Summary

Verified current state at commit `85a774a`:

- `package.json` defines `lint` as `echo "No root lint configured"` and `format:check` as `echo "No root format check configured"`. Both scripts exit 0 on every run.
- `ci-harness.yml` runs `pnpm run lint` and `pnpm run format:check` in the `ci` job. `release.yml` runs both scripts in the `validate` job at lines 54 to 58.
- The directories `packages/` and `.oh/` and the file `oh.json` do not exist. `ci-harness.yml` and `sandbox-boot-guard.yml` still name them as path filters.
- `ci-harness.yml` names `.agro/**` and also names `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. The `.agro/**` glob covers the other four entries.
- `sandbox-boot-guard.yml` names `.agro/**`. Any edit under `.agro/` therefore builds and boots the sandbox image.
- `sandbox-boot-guard.yml` names `.agro/scripts/harness-config.sh`. That file does not exist.
- `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires the literals `".agro/**"`, `"packages/oh/**"`, and `".agro/scripts/harness-config.sh"`.
- `.agro/evals/probes/knowledge-path-single-owner.sh` requires the literal `.agro/knowledge/**` in both `ci-harness.yml` event path lists.
- `.agro/skills/ci-status/SKILL.md` describes a pipeline with Lint, Format check, Prisma, and Playwright steps. That pipeline does not exist in this repository. The skill also states that `ci-harness.yml` triggers on push only.
- `.github/ISSUE_TEMPLATE/feat.md` line 41 asks for `pnpm run lint && pnpm run format:check && pnpm -r run type-check`.

Selected approach: delete the no-op steps and the dead or redundant filters. Narrow the boot guard to the image and boot inputs that the issue names. Change each probe to the new contract. Add negative checks so that the dead entries cannot return. Rewrite the `/ci-status` pipeline description and the feat-template criterion to name the real commands.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, job `ci` steps `Lint`, `Format check` | Harness CI triggers and the no-op steps |
| `.github/workflows/release.yml` | job `validate` steps `Lint`, `Format check` | Release validation no-op steps |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Boot guard triggers |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` path-filter checks | Boot guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` checks | Knowledge CI coverage probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `REQUIRED`, `extract_paths` | Harness CI core path probe |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `.claude/hooks/**` count | Stays green; `.claude/hooks/**` stays in both lists |
| `.agro/skills/ci-status/SKILL.md` | "NO RUN", "CI Pipeline Steps", "Local Pre-flight" | Agent-facing CI description |
| `.github/ISSUE_TEMPLATE/feat.md` | Acceptance Criteria checklist | Contributor-facing check command |
| `.agro/README.md` | lines 88 to 90 | States that legacy filters stay for the probes |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts`, `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | workflow content assertions | Read `sandbox-boot-guard.yml`; must stay green |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions check `CI: Harness` | Behavior | Runs on the same `.agro/**` edits. Drops two steps that always pass. |
| GitHub Actions check `CI: Sandbox Boot Guard` | Behavior | No longer runs for edits under `.agro/skills/`, `.agro/hooks/`, `.agro/evals/`, `.agro/knowledge/`, `.agro/tasks/`, or `.agro/plans/`. |
| `/ci-status` skill | Documentation | Names the real jobs, steps, triggers, and pre-flight command. |
| Feat issue template | Documentation | Names `pnpm run typecheck` and `pnpm test:scripts`. |

## Storage

N/A. The change edits workflow triggers, workflow steps, probes, and documentation. The change adds no persistent state.

## Architectural Decisions

- The workflow YAML files are the source of truth for CI gates. Probes pin the contract. `/ci-status` and the feat template describe the contract and follow the YAML.
- The boot guard triggers on image and boot inputs only. The Dockerfile copies `.agro/cli/`, `.agro/install/`, and named files from `.agro/scripts/` and `.devcontainer/`. `entrypoint.sh` sources `.agro/scripts/compat.sh` and runs `.agro/scripts/link-providers.sh`.
- Known trade-off: `.devcontainer/Dockerfile` line 135 runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/`. The image seed therefore holds every tracked `.agro/` file. After this change, an edit to a seeded file outside the narrowed list does not rebuild the image in PR CI. The issue accepts this trade-off. Open Question 1 asks whether an extra `.agro/` path belongs on the list.
- Each probe gains a negative check for the retired entries. A deleted filter cannot return without a REGRESSION.
- The `ci` job keeps its key. Open Question 2 covers the display name.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Fails on `".agro/**"`, `"packages/oh/**"`, `".oh/**"`, `"oh.json"`; fails on a literal filter that names no file; passes on the narrowed list | US-003 |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Passes with `.agro/**` only; fails when the knowledge path and `.agro/**` are both absent | US-002 |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Fails on `packages/**`, `.oh/**`, `oh.json` in either event list | US-002 |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Unchanged; stays PASS | US-002 |
| `.agro/evals/probes/pnpm-audit-ci-gate.sh`, `docs-build-fast-path.sh`, `boot-lint-glob.sh`, `eval-ci-gate.sh` | Unchanged; stay PASS | US-001 |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts`, `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | Unchanged; stay green | US-003 |
| Full probe suite | `bash .agro/skills/eval/run.sh` | All stories |
| Full script tests | `pnpm test:scripts` | All stories |

Write each negative probe case first. Run the probe against a temporary copy of the workflow that holds a retired entry. Confirm that the probe exits 1. Then edit the workflow. Confirm that the probe exits 0 against the real workflow.

## Design Principles

- Delete obsolete paths. Do not keep a dead filter to keep a probe green. Change the probe.
- A CI step must be able to fail. A step that always exits 0 is not a gate.
- Keep one source of truth. The workflow YAML owns the gates. Documentation follows the YAML.
- Edit the canonical `.agro/skills/ci-status/SKILL.md`. Do not edit the `.claude/skills` mirror.
- Add no comments to tracked code. Express the contract in probe checks and failure messages.

## Out of Scope

- Moving image boot testing to release-only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or `optional-harness-install`.
- Adding a real linter or formatter.
- Changes to `.github/workflows/sandbox-compatibility.yml`, `publish-cli.yml`, or `close-issues-on-development.yml`.
- Changes to the `lint`, `format:check`, and `format` scripts in `package.json`, and to `.husky/pre-commit`. See Open Question 3.
- Changes to historical records: `CHANGELOG.md`, `.agro/knowledge/raw/`, `.agro/plans/archive/`, `.agro/evals/RESULTS.md`, and `.agro/evals/datasets/`.
- Public documentation in `mifunedev/agro-web`. The change alters internal CI only and no user-facing term.

## Open Questions

1. Does the boot guard list need `.agro/manifest.json`, `.agro/hooks/**`, or another `.agro/` path that the image seed or boot reads? The issue list omits these paths. The plan uses the issue list as written until the operator answers.
2. Must the `ci` job display name `Lint, Typecheck, Build & Test` change? A branch-protection rule can require the current check name. Confirm the required check names in the repository settings: `<required status checks>`. The plan keeps the current name until the operator answers.
3. Must `package.json` drop the `lint`, `format:check`, and `format` scripts, and must `.husky/pre-commit` stop calling `pnpm run lint`? The issue names only the workflow steps. The plan leaves both files unchanged.

## Acceptance Criteria

- [ ] Each story acceptance criterion above passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] A PR that edits only a file under `.agro/skills/` triggers `CI: Harness` and does not trigger `CI: Sandbox Boot Guard`.
- [ ] A PR that edits a file under `.devcontainer/`, `.agro/cli/`, `.agro/scripts/`, or `.agro/install/` triggers `CI: Sandbox Boot Guard`.
- [ ] `git grep -nE '"(packages/\*\*|packages/oh/\*\*|\.oh/\*\*|oh\.json)"' -- .github/workflows` prints no line.

## Lessons

Filled by the advisor before undraft.
