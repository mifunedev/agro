# PRD: Prune no-op CI gates and narrow boot-guard paths

Status: DRAFT

## User Stories

### US-001: Remove no-op steps and dead harness path filters

**Description:** As an operator, I want harness CI to run only real gates so that green checks carry meaning.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` contain no step that runs `pnpm run lint` or `pnpm run format:check`.
- [ ] The `ci-harness.yml` push and pull_request path filters contain none of `"packages/**"`, `".oh/**"`, `"oh.json"`.
- [ ] The `ci-harness.yml` path filters contain none of `".agro/skills/**"`, `".agro/hooks/**"`, `".agro/evals/**"`, `".agro/knowledge/**"`, and still contain `".agro/**"` for both events.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `".agro/**"` as coverage for knowledge changes on both event types.
- [ ] `.agro/evals/probes/harness-ci-core-paths.sh` and `.agro/evals/probes/harness-ci-hooks-paths.sh` exit 0 against the edited workflow.
- [ ] The Typecheck, test, eval-probe, and boot-lint jobs remain in both workflows.

### US-002: Narrow boot-guard triggers to image and boot inputs

**Description:** As an operator, I want boot-guard to rebuild the image only for boot inputs so that skill edits skip the rebuild.

**Acceptance Criteria:**

- [ ] The push and pull_request path filters in `.github/workflows/sandbox-boot-guard.yml` equal this set: `".devcontainer/**"`, `".agro/cli/**"`, `".agro/scripts/**"`, `".agro/install/**"`, `"agro.json"`, `".example.env"`, `".dockerignore"`, `".github/workflows/sandbox-boot-guard.yml"`.
- [ ] `sandbox-boot-guard.yml` contains none of `".agro/**"`, `".oh/**"`, `"packages/oh/**"`, `"oh.json"`.
- [ ] Red test first: `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits non-zero against the old workflow after the probe update, then exits 0 after the workflow edit.
- [ ] The updated probe reports a regression when `".agro/**"` or `"packages/oh/**"` returns to the boot-guard filters.
- [ ] The boot smoke, upgrade smoke, and image verifier steps remain in `sandbox-boot-guard.yml`.

### US-003: Align /ci-status and the feat template with the real gates

**Description:** As an agent, I want CI documentation to name the real gates so that pre-flight checks match CI.

**Acceptance Criteria:**

- [ ] The "CI Pipeline Steps" list in `.agro/skills/ci-status/SKILL.md` names only steps that `ci-harness.yml` runs.
- [ ] The "Local Pre-flight" command in `.agro/skills/ci-status/SKILL.md` runs `pnpm run typecheck` and `pnpm test`, and does not run lint or format check.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` line 41 names `pnpm run typecheck` and drops the lint and format commands.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ci-status/SKILL.md` reports no new finding on the edited lines.

## Summary

The root `package.json` defines `lint` and `format:check` as `echo` commands, so the Lint and Format check steps always pass. The `ci-harness.yml` filters name deleted trees and list `.agro` subtrees that `".agro/**"` already covers. The `sandbox-boot-guard.yml` filters include `".agro/**"`, so each skill or probe edit rebuilds the sandbox image. The /ci-status skill lists Prisma and Playwright steps that CI does not run. The approach deletes the no-op steps and dead globs, narrows boot-guard to image and boot inputs, and updates each probe that pins an old literal. Boot testing stays on pull requests.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, Lint and Format check steps | Harness CI gates |
| `.github/workflows/release.yml` | Lint and Format check steps near line 55 | Release validate job |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image boot trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks at lines 30-34, `chas` check at line 119 | Boot-guard contract probe |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | CI knowledge check near line 49 | Knowledge path probe |
| `.agro/evals/probes/harness-ci-core-paths.sh` | path literal checks | Harness CI path probe |
| `.agro/skills/ci-status/SKILL.md` | "CI Pipeline Steps", "Local Pre-flight" | Agent CI guide |
| `.github/ISSUE_TEMPLATE/feat.md` | line 41 checklist item | Feature issue gate list |
| `package.json` | `lint`, `format:check`, `typecheck` scripts | Source of the no-op commands |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions triggers | Modify | Fewer paths start harness CI and boot-guard. |
| PR check list | Modify | The Lint and Format check steps disappear from the harness job. |
| /ci-status skill | Modify | The step list and pre-flight command match CI. |

## Storage

N/A. The change edits workflow files, probes, and docs. The change adds no persistent state.

## Architectural Decisions

- The workflow files are the source of truth for gates. Probes assert durable invariants, not the old literal list.
- `".agro/scripts/**"` replaces the individual script paths in boot-guard, because the glob covers each of them.
- Boot-guard keeps its pull_request trigger. The change does not move boot testing to release.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | requires the new path set; rejects `".agro/**"` and `"packages/oh/**"` | US-002 contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | accepts `".agro/**"` as knowledge coverage | US-001 filter removal |
| `.agro/evals/probes/harness-ci-core-paths.sh` | exits 0 after the filter edit | US-001 core paths |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | exits 0 after the filter edit | US-001 hook paths |
| `.agro/evals/probes/eval-ci-gate.sh` | exits 0 | Eval probe gate stays |
| `.agro/evals/probes/pnpm-audit-ci-gate.sh` | exits 0 | Audit gate stays |
| `.agro/evals/probes/boot-lint-glob.sh` | exits 0 | Boot-lint job stays |

Run each probe with `bash <probe path>` in the sandbox. Run the full suite with the /eval skill before the PR.

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives.
- Keep one source of truth for each gate.
- Keep every real gate: eval probes, typecheck, tests, boot smoke, upgrade smoke, and optional-harness-install.

## Out of Scope

- Moving image boot testing to release-only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or optional-harness-install.
- Adding a real lint or format tool.
- Changing `.github/workflows/sandbox-compatibility.yml` or `.github/workflows/publish-cli.yml`.
- Changing the public documentation in the agro-web repository.

## Open Questions

1. Does the `chas` check for `node-pnpm-parity.sh` at line 119 of `.agro/evals/probes/sandbox-boot-guard-ci.sh` target boot-guard? If yes, `".agro/scripts/**"` triggers on that script, and the probe needs a decision.
1. Does the `chas` check for `node-pnpm-parity.sh` at line 119 of `.agro/evals/probes/sandbox-boot-guard-ci.sh` target boot-guard? If yes, the `".agro/scripts/**"` filter starts boot-guard on a parity script change, and the operator decides which rule wins.
3. Do `.agro/evals/README.md` and `.agro/evals/probes/audit-stale-references.sh` pin a removed literal? The implementer checks both with `git grep`.

## Acceptance Criteria

- [ ] Each probe in the Test Plan exits 0 in the sandbox.
- [ ] `git grep -n 'pnpm run lint' -- .github/workflows` prints no line.
- [ ] `git grep -n 'packages/oh' -- .github/workflows` prints no line.
- [ ] `sandbox-boot-guard.yml` has no `".agro/**"` path filter.
- [ ] The PR checks pass on the task branch.

## Lessons

Filled by the advisor before undraft.
