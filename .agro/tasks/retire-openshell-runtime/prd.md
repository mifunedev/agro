# PRD: Retire the OpenShell runtime

Status: DRAFT

## User Stories

### US-001: Remove the OpenShell runtime from the CLI and the image

**Description:** As an operator, I want the CLI and the sandbox image to hold no OpenShell code. Then Docker is the only persistent sandbox runtime.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/execution/openshell-target.ts`, `.agro/cli/src/__tests__/openshell-target.test.ts`, `.agro/cli/src/__tests__/openshell-runtime-contract.test.ts`, `.devcontainer/openshell-main.sh`, and `.devcontainer/agro-image-env.sh` do not exist.
- [ ] The worker renames `.devcontainer/openshell-policy.yaml` to `.devcontainer/egress-policy.yaml`. The new file holds only the `version` key and the `network_policies` section. `egressAllowHosts({ version: 1 })` returns the same host list as before the rename.
- [ ] `lib/execution/index.ts` exports `defaultImage(config)` in place of `openshellImage(config)`. `defaultImage` returns `image.ref` when `image.ref` is not empty, and `officialImageRef(AGRO_VERSION)` otherwise. `agro run` container mode uses `defaultImage` when `--image` is absent.
- [ ] `RUNTIME_CATALOG` holds `docker` and `microsandbox` only. `SANDBOX_RUNTIMES` equals `["docker"]`. The agro.json `runtime` field accepts only `"docker"`.
- [ ] `agro sandbox install openshell` exits 1 and prints `unknown runtime "openshell"`.
- [ ] The worker deletes each code path that only a non-docker runtime reaches. The paths are the OpenShell branches in `commands/sandbox.ts`, `lib/execution/index.ts`, `lib/registry.ts`, `commands/egress.ts`, and `lib/runtimes/verbs.ts`, plus the OpenShell lines of the `controllers/sandbox.ts` help text.
- [ ] `git grep -n -i openshell -- .agro/cli .devcontainer` prints nothing.
- [ ] `agro run -- pnpm run typecheck` exits 0.
- [ ] `agro run -- pnpm test` exits 0.

### US-002: Remove OpenShell from the docs, the sandbox skill, and the changelog

**Description:** As an operator, I want the docs and the sandbox skill to describe only the Docker runtime. Then no instruction routes work to a removed runtime.

**Acceptance Criteria:**

- [ ] `docs/runtimes/openshell.md` and `.agro/skills/sandbox/checks/openshell-journey.sh` do not exist.
- [ ] `.agro/skills/sandbox/references/validation.md` has no OpenShell journey scenario, and its contents list has no link to that scenario.
- [ ] Routing case R8 in `.agro/scripts/__tests__/fixtures/sandbox-routing/cases.json` asks for a persistent Docker workspace. The R8 oracle stays `{ "route": "lifecycle", "owners": ["lifecycle", "herdr", "worktrees"] }`.
- [ ] `instructionFiles` in `.agro/scripts/__tests__/helpers/sandbox-routing.ts` does not list `docs/runtimes/openshell.md`. The provenance test in `.agro/scripts/__tests__/sandbox-routing.test.ts` names only existing documents.
- [ ] `CHANGELOG.md` `## [Unreleased]` has a `### Removed` entry for `agro sandbox install openshell` and the OpenShell runtime.
- [ ] `git grep -n -i openshell -- ':!.agro/tasks' ':!CHANGELOG.md' ':!.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json'` prints nothing.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file in `docs/` and `.agro/skills/sandbox/`.

### US-003: Record the sandbox routing replay again

**Description:** As a maintainer, I want the routing replay to match the new instruction files so that the routing test proves the current sandbox skill.

**Acceptance Criteria:**

- [ ] Seventeen fresh decision-only agents record one decision each for R1 to R17 against the final instruction files and `cases.json`.
- [ ] Each record in `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` matches its oracle.
- [ ] The provenance in `decisions.json` comes from `sourceProvenance()`.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/sandbox-routing.test.ts` exits 0.
- [ ] `agro run -- pnpm test` exits 0.

### US-004: Capture the manual review transcript

**Description:** As a reviewer, I want a command transcript from the branch CLI so that I can see the removed runtime. The transcript also shows the kept `agro run` default image.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-openshell-runtime/evidence/manual-review.md` holds the commands and the observed output.
- [ ] The transcript builds the branch CLI with `agro run -- pnpm run build:harness`.
- [ ] The transcript shows `node .agro/cli/dist/agro.js sandbox install openshell` exits 1 with `unknown runtime "openshell"`.
- [ ] The transcript shows `node .agro/cli/dist/agro.js sandbox install --help` lists no `openshell` runtime.
- [ ] The transcript creates a new temp git project, and the project does not exist before the run. The project agro.json sets `image.ref` to `alpine:3.20`. In the project, `node <worktree>/.agro/cli/dist/agro.js run -- cat /etc/alpine-release` exits 0 and prints the Alpine version. The transcript deletes the temp project at the end.

## Summary

AGRO has two provisionable persistent runtimes: `docker` and the experimental `openshell`. The operator observed no use of `openshell`. Docker covers the sandbox boundary. This task deletes the OpenShell runtime. The deletion covers the install branch, the execution target, and the lifecycle verb refusals. The deletion also covers the entry files, the image entry scripts, the docs, the validation journey, and the tests.

Two parts of the OpenShell code serve Docker too, and the task keeps them under neutral names:

- `openshellImage(config)` sets the default image of `agro run` container mode. The task renames it to `defaultImage(config)` and keeps its behavior.
- `.devcontainer/openshell-policy.yaml` supplies the host list of the Docker `access.egress: "allowlist"` proxy through `policyHosts`. The task renames it to `.devcontainer/egress-policy.yaml` and removes the OpenShell-only `filesystem_policy` and `process` sections.

The `.agro/tasks/` records and the released `CHANGELOG.md` entries are history. The task keeps them.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/openshell-target.ts` | `OpenShellExecutionTarget`, `openshellPreflight`, `OPENSHELL_VERB_HINTS`, `createArgv` | Deleted |
| `.agro/cli/src/lib/execution/index.ts` | `resolveExecutionTarget`, `openshellImage` | Drop the OpenShell branch; rename to `defaultImage` |
| `.agro/cli/src/commands/run.ts` | `openshellImage` call at line 328 | Use `defaultImage` |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall`, `installOpenShell` | Delete the OpenShell install path |
| `.agro/cli/src/controllers/sandbox.ts` | help text | Remove the OpenShell lines |
| `.agro/cli/src/lib/runtimes/catalog.ts` | `CATALOG` | Remove the `openshell` entry |
| `.agro/cli/src/lib/runtimes/verbs.ts` | `OPENSHELL_VERBS`, `RUNTIME_NAMING`, `RuntimeUnsupportedError` | Remove the OpenShell policy and the code only it reaches |
| `.agro/cli/src/lib/registry.ts` | `openshellFiles` | Delete |
| `.agro/cli/src/lib/egress-policy.ts` | `egressAllowHosts` | Import `.devcontainer/egress-policy.yaml` |
| `.agro/cli/src/commands/egress.ts` | `RUNTIME_REFUSAL` | Remove the OpenShell refusal |
| `.devcontainer/Dockerfile` | `COPY` lines 110, 187 to 199 | Remove `openshell-main.sh` and `agro-image-env.sh`; copy the renamed policy if the image copies it |
| `.agro/scripts/__tests__/helpers/sandbox-routing.ts` | `instructionFiles` | Remove `docs/runtimes/openshell.md` |
| `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` | R1 to R17 records, provenance | Recorded again |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install openshell` | Removed | Exits 1 with `unknown runtime "openshell"` |
| agro.json `runtime` | Narrowed | Accepts only `"docker"` |
| `agro run` container mode | Unchanged | Default image stays `image.ref` or the official image |
| `agro egress`, lifecycle verbs | Removed branch | No OpenShell refusal |
| `docs/runtimes/openshell.md` | Removed | Docs page deleted |

## Storage

An entry with `runtime: "openshell"` in its agro.json fails validation after this change. The operator observed no such entry. The task adds no migration.

## Architectural Decisions

- Docker is the only provisionable persistent runtime. `microsandbox` stays a planned catalog entry.
- The egress host list stays one file, `.devcontainer/egress-policy.yaml`, read by `policyHosts`.
- Delete dead paths. Do not keep a runtime dispatch branch that no runtime reaches.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/run.test.ts` | default image cases at lines 296 and 303 | `agro run` default image stays the same |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `install openshell` | Exits 1 as an unknown runtime |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | runtime catalog | `SANDBOX_RUNTIMES` equals `["docker"]` |
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | runtime enum | Error names only `docker` |
| `.agro/cli/src/lib/__tests__/egress-policy.test.ts` | allowlist hosts | Hosts come from `egress-policy.yaml` |
| `.agro/cli/src/__tests__/lifecycle.test.ts`, `compose-verbs.test.ts`, `destroy.test.ts`, `egress.test.ts`, `execution-target.test.ts` | OpenShell cases | Deleted |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | replay grader, provenance | Replay matches the new instruction files |

## Design Principles

- Code is the source of truth. Add no explanatory comments.
- Keep one source of truth for each policy.
- Remove obsolete paths instead of keeping dormant alternatives.

## Out of Scope

- `.agro/tasks/` records of earlier tasks.
- Released `CHANGELOG.md` entries.
- The `microsandbox` catalog entry and `agro run --isolation microvm`.
- A migration for existing `openshell` entries.

## Open Questions

None

## Acceptance Criteria

- [ ] `git grep -n -i openshell -- ':!.agro/tasks' ':!CHANGELOG.md' ':!.agro/cli/src' ':!docs/configuration.md'` prints nothing. The CLI source and `docs/configuration.md` name only the retired `openshell` value of `runtime`.
- [ ] Each acting verb refuses an entry with the retired `openshell` runtime with one line, and `agro sandbox list` lists the entry.
- [ ] `agro run -- pnpm run typecheck` exits 0.
- [ ] `agro run -- pnpm test` exits 0.
- [ ] `agro run` container mode resolves its default image through `defaultImage(config)`.
- [ ] CI is green on the PR.

## Lessons

- Claim: the plan did not list `.agro/scripts/__tests__/sandbox-skill.test.ts`. That test pins the count of validation scenarios and the count of files in `checks/`. Evidence: after US-002, `pnpm test` failed with "expected length 6, got 5". Outcome: fixed in this PR. The advisor added the file to US-002, and repair round 1 updated both counts in commit `6b0cae68`.
- Claim: US-001 could not pass its full-suite criterion alone, because `docs/` links named the renamed policy file and `docs/` belonged to US-002. Evidence: `docs-reference.test.ts` failed on `docs/configuration.md:130` and `docs/security-considerations.md:253` after `b9e9100d`. Outcome: fixed in this PR. The advisor moved the link criterion to US-002, and `docs-reference.test.ts` passes at `1ace98ee`.
- Claim: an agro.json entry with `runtime: "openshell"` now fails validation. Evidence: `SANDBOX_RUNTIMES` equals `["docker"]`. Outcome: dropped. The operator observed no OpenShell entry, and the plan puts a migration out of scope.
- Claim: an advisor wait loop that used `pgrep -f` matched its own shell and never ended. Evidence: two acceptance runs hung until the advisor stopped them. Outcome: dropped. The finding is tooling friction in the advisor session, not repository behavior.
- Claim: the plan treated a released `runtime: "openshell"` value as dead data. The code review of PR #1653 found that one such entry broke `agro sandbox list` (findings 1 to 5). The same entry made `agro destroy` delete the entry while the OpenShell sandbox kept running. Evidence: the review brief and the new `retired-runtime.test.ts`. Outcome: fixed in this PR. US-001 repair 1 reads the value as retired, and each acting verb refuses it with the removal steps.
- Claim: US-001 deleted two docker routing and naming tests together with the OpenShell tests (finding 6). Evidence: `git show b9e9100d -- .agro/cli/src/__tests__/lifecycle.test.ts`. Outcome: fixed in this PR. US-001 repair 1 restores the docker coverage.
- Claim: `agro shell` named `docker` as the missing binary for every target (finding 7). Evidence: `commands/lifecycle.ts`. Outcome: fixed in this PR. The error names the binary of the resolved target.
- Claim: the `runtime` field keeps multi-value machinery for one active value (finding 8). Evidence: `SANDBOX_RUNTIMES` and the runtime column. Outcome: dropped. The field must also parse the retired value, so the machinery has two values again, and the list column shows the retired state.
- Claim: US-002 rewrote two old sentences in `docs/lifecycle-commands.md` outside the OpenShell change (finding 9). Evidence: the US-002 diff. Outcome: dropped. The plan required a clean `ste-check.sh` result on each changed Markdown file, and a revert would change routing-hashed bytes again.
- Claim: the image no longer writes `/etc/agro/image-environment` or `/etc/profile.d/agro-image-env.sh` (finding 10). Evidence: `git grep` finds no other reader, and only `OPENSHELL_SANDBOX` activated the profile script. Outcome: dropped. A persistent home that sources the profile script gets no file, and the script did nothing outside OpenShell.
