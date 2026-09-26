# PRD: Remove no-op CI gates and narrow the boot-guard trigger

Status: DRAFT

## User Stories

### US-001: Remove no-op steps and dead filters from harness CI

**Description:** As an operator, I want harness CI to run only real gates so that a green check proves a real result.

**Acceptance Criteria:**

- [ ] `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` contain no step that runs `pnpm run lint` or `pnpm run format:check`.
- [ ] The push and pull_request path lists in `.github/workflows/ci-harness.yml` name none of these globs: packages/**, .oh/**, oh.json.
- [ ] The same path lists drop the globs that `.agro/**` covers: .agro/skills/**, .agro/hooks/**, .agro/evals/**, .agro/knowledge/**.
- [ ] The same path lists keep `.agro/**`, `agro.json`, `.example.env`, `.claude/hooks/**`, and the workflow file.
- [ ] `.agro/evals/probes/knowledge-path-single-owner.sh` accepts `.agro/**` as coverage for the knowledge tree.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.
- [ ] The typecheck, test, boot-lint, and eval-probes jobs stay unchanged in both workflows.

### US-002: Narrow the sandbox boot-guard trigger to image inputs

**Description:** As an operator, I want the image rebuild to run only for boot inputs so that control-plane edits stay fast.

**Acceptance Criteria:**

- [ ] The push and pull_request path lists in `.github/workflows/sandbox-boot-guard.yml` equal this set: .devcontainer/**, .agro/cli/**, .agro/scripts/**, .agro/install/**, agro.json, .example.env, .dockerignore, and the workflow file.
- [ ] Those path lists name none of these globs: .agro/**, .oh/**, packages/oh/**, oh.json.
- [ ] Those path lists name no single file under `.agro/scripts` because .agro/scripts/** covers each one.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` requires each glob in the new set.
- [ ] `.agro/evals/probes/sandbox-boot-guard-ci.sh` reports a failure when the workflow names .agro/** or packages/oh/**.
- [ ] Red test: before the workflow edit, the updated probe exits 1 against the current `.github/workflows/sandbox-boot-guard.yml`.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0 after the workflow edit.
- [ ] The boot smoke, upgrade smoke, and optional-harness-install jobs stay unchanged.

### US-003: Align /ci-status and the feat template with the real gates

**Description:** As an agent, I want the documented gates to match CI so that pre-flight checks run real commands.

**Acceptance Criteria:**

- [ ] The "CI Pipeline Steps" list in `.agro/skills/ci-status/SKILL.md` names only steps that the ci job in `.github/workflows/ci-harness.yml` runs.
- [ ] The "Local Pre-flight" command in `.agro/skills/ci-status/SKILL.md` runs `pnpm run typecheck` and `pnpm test`, and names no lint or format script.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` line 41 names `pnpm run typecheck` and `pnpm test` in place of the lint and format commands.
- [ ] The provider link check reports no broken ci-status link.

## Summary

The root `package.json` defines `lint` and `format:check` as `echo` commands, so both CI steps always pass. `.github/workflows/ci-harness.yml` lines 100-104 and `.github/workflows/release.yml` lines 54-58 run these steps. The harness CI path lists name packages/**, .oh/**, and oh.json, and none of these paths exist. The same lists repeat four globs that `.agro/**` covers. `.github/workflows/sandbox-boot-guard.yml` triggers on `.agro/**`, so each skill or probe edit rebuilds the sandbox image. The plan removes the no-op steps and the dead filters. The plan narrows the boot-guard trigger to image and boot inputs. The plan updates the probes that pin the old literals. The plan corrects /ci-status and the feat template to list the real gates.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | on.push.paths, on.pull_request.paths, ci job steps Lint and Format check | Harness CI trigger and gates |
| `.github/workflows/release.yml` | validate job steps Lint and Format check | Release gates |
| `.github/workflows/sandbox-boot-guard.yml` | on.push.paths, on.pull_request.paths | Image boot trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has` checks at lines 29-37 | Pins the boot-guard path contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | checks at lines 52-55 | Pins the knowledge glob in harness CI |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `extract_paths` | Pins agro.json and .example.env in harness CI |
| `.agro/skills/ci-status/SKILL.md` | "CI Pipeline Steps", "Local Pre-flight" | Documented gates |
| `.github/ISSUE_TEMPLATE/feat.md` | line 41 | Feature checklist gate |
| `package.json` | scripts `lint`, `format:check` | Source of the no-op commands |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| CI: Harness workflow | Modified | Two fewer steps and a shorter path list |
| Release workflow | Modified | Two fewer validate steps |
| CI: Sandbox Boot Guard workflow | Modified | Trigger limited to image and boot inputs |
| /ci-status skill | Modified | Gate list matches the ci job |

## Storage

N/A. The change edits workflow files, probes, and docs. The change adds no persistent state.

## Architectural Decisions

- The workflow YAML is the source of truth for each gate. Probes and docs follow the YAML.
- The boot-guard trigger covers each path that the image build or the boot smoke reads. Skills, hooks, evals, knowledge, and tasks stay outside the trigger.
- The harness CI keeps `.agro/**` as the single glob for the control plane.
- Edit the canonical `.agro/skills/ci-status/SKILL.md`. Do not edit the provider mirror under `.claude/skills`.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Requires the new glob set; rejects .agro/** and packages/oh/** | US-002 boot-guard contract |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Accepts `.agro/**` as knowledge coverage | US-001 path cleanup |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Keeps agro.json and .example.env in both path lists | US-001 regression floor |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Keeps `.claude/hooks/**` in harness CI | US-001 regression floor |
| Full probe suite through /eval | Every probe reports PASS or SKIPPED | No probe regression |

## Design Principles

- Delete obsolete paths. Do not keep dormant alternatives.
- A gate that cannot fail is not a gate. Remove each gate of that kind.
- Keep one source of truth for each policy. The workflow owns the gates.
- Add no comments to the workflow files.

## Out of Scope

- A move of image boot testing to the release workflow only.
- Removal of eval probes, typecheck, tests, boot smoke, upgrade smoke, or optional-harness-install.
- The addition of a real linter or a real formatter.
- Changes to `.github/workflows/sandbox-compatibility.yml` and `.github/workflows/publish-cli.yml`.

## Open Questions

1. Must the implementer delete the `lint` and `format:check` scripts from `package.json`? The default keeps the scripts and removes only the CI steps.
2. Does a branch protection rule require the ci job name "Lint, Typecheck, Build & Test"? The default keeps the name. A rename needs operator approval.
3. Which command runs the provider link check for the ci-status mirror under `.claude/skills`? The plan writes `<link check command>` until the operator names the command.
4. Does the /ci-status step list keep the Prisma and Playwright rows? The ci job does not run those rows, so the default removes them.

## Acceptance Criteria

- [ ] No workflow under `.github/workflows` runs `pnpm run lint` or `pnpm run format:check`.
- [ ] No workflow under `.github/workflows` names packages/**, packages/oh/**, .oh/**, or oh.json in a path filter.
- [ ] `.github/workflows/sandbox-boot-guard.yml` does not trigger on .agro/**.
- [ ] Each probe under `.agro/evals/probes` reports PASS or SKIPPED.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `<link check command>` exits 0.

## Lessons

Filled by the advisor before undraft.
