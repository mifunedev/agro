# PRD: Remove CI steps and path filters that prove nothing

Status: DRAFT

## User Stories

### US-001: Remove the no-op Lint and Format check steps

**Description:** As a maintainer, I want CI to run only failable steps, so a green check carries real evidence.

**Acceptance Criteria:**

- [ ] `grep -c 'pnpm run lint\|pnpm run format:check' .github/workflows/ci-harness.yml .github/workflows/release.yml` prints `0` for each file.
- [ ] The `Typecheck`, `Build`, and `Test` steps stay in both files with their current `run:` commands.
- [ ] The `Run pnpm security audit` step stays in both files.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Trim the harness CI path filters

**Description:** As a maintainer, I want the `ci-harness.yml` path filters to name only live, non-redundant globs so that the filter list matches the repository.

**Acceptance Criteria:**

- [ ] The `push.paths` list and the `pull_request.paths` list in `ci-harness.yml` contain no `packages/**`, `.oh/**`, or `oh.json` entry.
- [ ] The two lists contain no `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, or `.agro/knowledge/**` entry.
- [ ] The two lists still contain `.agro/**`, `.claude/hooks/**`, `agro.json`, and `.example.env`.
- [ ] `bash .agro/evals/probes/knowledge-path-single-owner.sh` exits 0, and the probe accepts `.agro/**` as the knowledge filter.
- [ ] Red test: before the probe change, the probe exits 1 against the trimmed workflow with the message `ci-harness.yml push paths do not include .agro/knowledge/**`.
- [ ] `bash .agro/evals/probes/harness-ci-core-paths.sh` exits 0.
- [ ] `bash .agro/evals/probes/harness-ci-hooks-paths.sh` exits 0.
- [ ] The trigger text in `.agro/evals/README.md` names `.agro/**` as the filter that covers probe edits.

### US-003: Remove the dead `.oh/` filters from the compatibility workflow

**Description:** As a maintainer, I want `sandbox-compatibility.yml` to name no retired `.oh/` path so that each filter can match a real file.

**Acceptance Criteria:**

- [ ] `grep -c '"\.oh/' .github/workflows/sandbox-compatibility.yml` prints `0`.
- [ ] For each removed `.oh/` entry, the matching `.agro/` path exists on disk and stays in the filter list.
- [ ] The compatibility workflow keeps the `.devcontainer/Dockerfile` filter and adds no `.agro/**` filter.
- [ ] `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.

### US-004: Narrow the boot-guard trigger to image and boot inputs

**Description:** As a maintainer, I want the sandbox boot guard to run only for image and boot inputs. A skill or probe edit then does not rebuild the image.

**Acceptance Criteria:**

- [ ] The `push.paths` list and the `pull_request.paths` list in `sandbox-boot-guard.yml` are identical.
- [ ] Each list holds exactly these entries: `.devcontainer/**`, `.agro/cli/**`, `.agro/scripts/**`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, and `.github/workflows/sandbox-boot-guard.yml`.
- [ ] Each list contains no `.agro/**`, `.oh/**`, `packages/oh/**`, or `oh.json` entry.
- [ ] Red test: before the probe change, `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 1 against the narrowed workflow.
- [ ] After the probe change, `bash .agro/evals/probes/sandbox-boot-guard-ci.sh` exits 0.
- [ ] The probe fails when a boot-guard filter list contains `.agro/**` or `packages/oh/**`.
- [ ] The probe fails when a boot-guard filter list omits `.agro/cli/**`, `.agro/scripts/**`, or `.agro/install/**`.
- [ ] The build, boot smoke, upgrade smoke, image verifier, and optional harness install steps stay in the workflows unchanged.
- [ ] `pnpm test:scripts` exits 0.

### US-005: Align `/ci-status` and the feat template with the real gates

**Description:** As an agent, I want `/ci-status` and the feat issue template to name the real CI steps so that my pre-flight commands match CI.

**Acceptance Criteria:**

- [ ] The "CI Pipeline Steps" list in `.agro/skills/ci-status/SKILL.md` names `pnpm run typecheck`, `pnpm run build:harness`, and `pnpm test:scripts`.
- [ ] The list names no Lint, Format check, Prisma, or Playwright step.
- [ ] The "Local Pre-flight" command in the skill contains no `lint` or `format:check` token.
- [ ] The NO RUN bullet for `ci-harness.yml` names no `packages/**` filter.
- [ ] The NO RUN list describes the narrowed boot-guard trigger.
- [ ] `.github/ISSUE_TEMPLATE/feat.md` line 41 names `pnpm run typecheck` and contains no `pnpm run lint` or `pnpm run format:check` token.

## Summary

The operator reviewed the PR pipelines and found three defects. The root `package.json` defines `lint` as `echo "No root lint configured"`. The root `package.json` defines `format:check` as `echo "No root format check configured"`. `ci-harness.yml` lines 100 to 104 and `release.yml` lines 54 to 58 run both scripts, so both steps always pass.

The `packages/` directory, the `.oh/` directory, and `oh.json` do not exist at the repository root. `ci-harness.yml` still names `packages/**`, `.oh/**`, and `oh.json`. `sandbox-boot-guard.yml` still names `.oh/**`, `packages/oh/**`, and `oh.json`. `sandbox-compatibility.yml` names five `.oh/scripts/*` and `.oh/cli/**` files.

`ci-harness.yml` lists `.agro/**` and also lists `.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, and `.agro/knowledge/**`. The `.agro/**` glob already matches the four narrower globs.

`sandbox-boot-guard.yml` lists `.agro/**`. Any control-plane edit rebuilds and boots the sandbox image.

The approach is five small edits. Each edit updates the probe that pins the old literal in the same story.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths`, steps `Lint` and `Format check` | Harness CI trigger and validate job |
| `.github/workflows/release.yml` | steps `Lint` and `Format check` in the validate job | Release validation |
| `.github/workflows/sandbox-boot-guard.yml` | `on.push.paths`, `on.pull_request.paths` | Image build and boot trigger |
| `.github/workflows/sandbox-compatibility.yml` | `.oh/` entries in lines 20 to 44 | Compatibility trigger |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | `has '".agro/**"'` and `has '"packages/oh/**"'` at lines 30 and 31 | Pins the old boot-guard filters |
| `.agro/evals/probes/knowledge-path-single-owner.sh` | `push_paths` and `pr_paths` checks at lines 50 to 55 | Pins the `.agro/knowledge/**` literal |
| `.agro/evals/probes/harness-ci-core-paths.sh` | `extract_paths` | Requires `agro.json` and `.example.env` |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | `hook_path_count` | Requires `.claude/hooks/**` twice |
| `.agro/evals/README.md` | trigger text at line 178 | Names `.agro/evals/**` as a filter |
| `.agro/skills/ci-status/SKILL.md` | NO RUN list at line 106, "CI Pipeline Steps", "Local Pre-flight" | Agent CI guidance |
| `.github/ISSUE_TEMPLATE/feat.md` | acceptance item at line 41 | Feat issue gate text |
| `package.json` | scripts `lint` and `format:check` | The echo-only scripts |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub Actions `CI: Harness` | Modify | The job drops two steps. The trigger drops dead and redundant globs. |
| GitHub Actions release validate job | Modify | The job drops two steps. |
| GitHub Actions `CI: Sandbox Boot Guard` | Modify | The trigger covers image and boot inputs only. |
| GitHub Actions sandbox compatibility | Modify | The trigger drops dead `.oh/` entries. |
| `/ci-status` skill | Modify | The skill text matches the real gates. |
| Feat issue template | Modify | The acceptance item names the real gate commands. |

## Storage

N/A. The task changes workflow YAML, probes, and Markdown. The task adds no persistent state.

## Architectural Decisions

- The workflow files own the CI contract. The probes assert durable invariants of that contract. The probes do not assert a list of literals that duplicates a broader glob.
- `.agro/**` in `ci-harness.yml` covers every control-plane subtree. The knowledge probe accepts `.agro/**` as coverage for `.agro/knowledge/**`.
- The `.agro/scripts/**` glob covers the compose wrapper, the boot smoke script, the upgrade smoke script, the first-install smoke script, `harness-config.sh`, and the image verifier. The boot guard drops those six single-file entries.
- The Dockerfile runs `COPY --chown=sandbox:sandbox . /opt/agro-seed/` at line 135. A skill edit changes the seed content of the image. The operator accepts that the boot guard does not rebuild for that edit. The release job still builds and smoke-tests the image before publication.
- Image boot testing stays on pull requests. The task does not move the boot guard to release-only.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/knowledge-path-single-owner.sh` | Trimmed workflow with `.agro/**` passes; workflow without `.agro/**` or `.agro/knowledge/**` fails | US-002 |
| `.agro/evals/probes/harness-ci-core-paths.sh` | Existing cases | US-002 keeps `agro.json` and `.example.env` |
| `.agro/evals/probes/harness-ci-hooks-paths.sh` | Existing cases | US-002 keeps `.claude/hooks/**` |
| `.agro/evals/probes/sandbox-boot-guard-ci.sh` | Required boot-input globs; banned `.agro/**` and `packages/oh/**`; compatibility checks | US-003, US-004 |
| `.agro/evals/probes/boot-lint-glob.sh` | Existing cases | Boot-lint shellcheck globs stay intact |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | Existing workflow wiring case | US-004 keeps the first-install smoke wiring |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | Existing workflow wiring cases | US-004 keeps the upgrade smoke wiring |

Run each probe with `bash <probe path>`. Run the script tests with `pnpm test:scripts`.

## Design Principles

- Code is the source of truth. A CI step that cannot fail is a false claim, so the task deletes the step.
- Delete obsolete paths. Do not keep dormant filters for retired trees.
- Keep one source of truth. One broad glob replaces the narrower duplicates.
- A probe asserts the invariant, not an obsolete literal.
- Change the canonical `.agro/skills/ci-status/SKILL.md`. Do not patch a provider mirror.

## Out of Scope

- Moving image boot testing to release-only.
- Removing eval probes, typecheck, tests, boot smoke, upgrade smoke, or the optional harness install job.
- Adding a real lint tool or a real format tool.
- Path filters in `publish-cli.yml` and `close-issues-on-development.yml`.
- Documentation changes in `mifunedev/agro-web`. No public CLI verb or term changes.

## Open Questions

1. Does the task delete the echo-only `lint` and `format:check` scripts from `package.json`, or keep them for local use? The issue does not say. The default plan keeps them.
2. Do `docs/release-requirements-1019-boot-fix.md` and the two RFC files that name `sandbox-boot-guard.yml` describe the old filter list? The plan did not read those three files. The implementer checks the three files and updates only a live statement of the filter contract.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] Each probe in `.agro/evals/probes/` exits 0 or reports SKIPPED.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `git grep -n '"packages/\*\*"\|"packages/oh/\*\*"\|"\.oh/\|"oh\.json"' -- .github/workflows` prints no line.
- [ ] The workflows keep each step for eval probes, typecheck, tests, boot smoke, upgrade smoke, and optional harness install.

## Lessons

Filled by the advisor before undraft.
