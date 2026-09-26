# PRD: Drop no-op CI gates and narrow the boot-guard trigger

Status: DRAFT

## User Stories

### US-001: Remove no-op steps and dead filters from harness CI

**Description:** As a maintainer, I want harness CI to run only real gates so that a green check proves a behavior.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` contain no step named `Lint` and no step named `Format check`.
- [ ] The Typecheck, Build, and Test steps and the `boot-lint` job stay in both workflows.
- [ ] The `ci-harness.yml` push and pull_request path lists contain none of `packages/**`, `.oh/**`, `oh.json`.
- [ ] The `ci-harness.yml` path lists contain none of `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`, and keep `.agro/**`.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` in both path lists as coverage of the knowledge tree.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0.

### US-002: Narrow the boot-guard trigger to image and boot inputs

**Description:** As a maintainer, I want boot-guard to run only on image inputs so that skill edits skip image rebuilds.

**Acceptance Criteria:**

- [ ] The `.github/workflows/sandbox-boot-guard.yml` push and pull_request path lists equal this set: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, `.github/workflows/sandbox-boot-guard.yml`.
- [ ] The boot-guard path lists contain none of `.agro/**`, `.oh/**`, `packages/oh/**`, `oh.json`.
- [ ] The boot smoke, upgrade smoke, and optional-harness-install jobs stay in `sandbox-boot-guard.yml`.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires the narrowed set and fails when `.agro/**` or `packages/oh/**` appears in the boot-guard path lists.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.
- [ ] A red test comes first: the updated probe exits 1 against the unchanged workflow.

### US-003: Align ci-status and the feat template with the real gates

**Description:** As an agent, I want the documented gates to match CI so that local checks mirror the pipeline.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` lists no lint step, no format step, and no `packages/**` path filter.
- [ ] The trigger summary in `.agro/skills/ci-status/SKILL.md` matches the path lists of US-001 and US-002.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` names `pnpm run typecheck` as the type-check gate and names no lint or format command.
- [ ] `package.json` contains no `lint` script and no `format:check` script.
- [ ] `git grep -n 'format:check' -- .github .agro/skills package.json` prints no line.

## Summary

The root `package.json` defines `lint` and `format:check` as `echo` commands. `ci-harness.yml` lines 100-104 and `release.yml` lines 54-58 run both. The `ci-harness.yml` path lists name deleted trees. The lists also repeat globs that `.agro/**` covers. The `sandbox-boot-guard.yml` path lists include `.agro/**`, so each skill or probe edit rebuilds the image. `sandbox-boot-guard-ci.sh` lines 30-31 require `.agro/**` and `packages/oh/**`. `knowledge-path-single-owner.sh` lines 50-55 require the literal `.agro/knowledge/**`. The plan deletes the no-op steps and scripts. The plan prunes the filters and narrows boot-guard to image inputs. The plan updates the probes and documentation to the new contract.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, `Lint`, `Format check` | Harness CI trigger and gates |
| `.github/workflows/release.yml` | `Lint`, `Format check` | Release gates |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image rebuild trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks at lines 30-31 | Boot-guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths`, `pr_paths` | Knowledge coverage probe |
| `.agro/skills/ci-status/SKILL.md` | trigger summary, gate list | Agent CI guide |
| `.github/ISSUE_TEMPLATE/feat.md` | quality checklist line 41 | Feature issue gate list |
| `package.json` | `lint`, `format:check` scripts | No-op scripts |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions triggers | Modify | Fewer paths start harness CI and boot-guard. |
| CI job steps | Remove | The Lint and Format check steps leave both workflows. |
| pnpm scripts | Remove | `pnpm run lint` and `pnpm run format:check` stop existing. |

## Storage

N/A. The change edits workflow, probe, and documentation files and keeps no state.

## Architectural Decisions

- The workflow files own the trigger contract. The probes pin that contract.
- `.agro/**` in `ci-harness.yml` is the single glob for the control plane.
- Boot-guard triggers on inputs to the image and to the boot path. `.agro/scripts/**` covers the compose, smoke, and verifier scripts, so the per-script entries leave the list.
- The job name `Lint, Typecheck, Build & Test` stays, because branch protection can require it by name.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | narrowed set present; `.agro/**` and `packages/oh/**` absent | US-002 trigger contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `.agro/**` counts as knowledge coverage | US-001 filter pruning |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | line 172 compatibility check stays green | No regression in the compatibility workflow |

Run `bash .agro/evals/probes/<probe>.sh` for each probe, then run the full /eval suite.

## Design Principles

- Delete a gate that proves nothing. Keep each gate that tests behavior.
- Keep one source of truth for each trigger path.
- Keep image boot testing on pull requests.

## Out of Scope

- Move of image boot testing to release-only.
- Removal of eval probes, typecheck, tests, boot smoke, upgrade smoke, or optional-harness-install.
- A real lint or format tool.
- Changes to `.github/workflows/sandbox-compatibility.yml` triggers.

## Open Questions

1. Does branch protection require the check names of the removed steps? The plan assumes only job names count.
2. Do `.agro/evals/probes/agro-compat-inventory.sh`, `.agro/evals/probes/host-workspace-namespace.sh`, or `.agro/evals/probes/sandbox-registry.sh` pin a removed filter literal? The implementer runs each probe and updates any probe that pins a removed literal.
3. Does `release.yml` carry the same dead path filters? The implementer applies the US-001 pruning there when present.

## Acceptance Criteria

- [ ] All story criteria pass.
- [ ] The full /eval suite reports no REGRESSION.
- [ ] CI on the pull request runs the harness CI and boot-guard workflows green.

## Lessons

Filled by the advisor before undraft.
