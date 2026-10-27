# PRD: Sandbox guard for lifecycle verbs, release dispatch to agro-web, and delegate location rules

Status: DRAFT

## User Stories

### US-001: Refuse `destroy`, `stop`, and `restart` inside a sandbox

**Description:** As an operator, I want the guarded lifecycle verbs to refuse inside a sandbox so that an agent cannot wipe its own sandbox.

**Acceptance Criteria:**

- [ ] `runDestroy` in `.agro/cli/src/commands/lifecycle.ts` checks `runningInsideSandbox()` before `routeVerb`, the confirmation prompt, and any runner call.
- [ ] `runComposeVerb` checks `runningInsideSandbox()` before `routeVerb` for the verbs `stop`, `restart`, and `destroy`.
- [ ] Inside a sandbox, each of the three verbs writes `` `agro <verb>` manages the sandbox container from the host — you are already inside the sandbox. Run it on the host, at the project root. `` to stderr through `HostOnlyError`, returns 1, and makes 0 runner calls.
- [ ] `agro ps` and `agro logs` keep their current behavior inside a sandbox.
- [ ] Red tests in `.agro/cli/src/__tests__/lifecycle.test.ts` fail before the change and pass after the change. The destroy test reproduces #1531: `runDestroy({ bin: "agro", yes: true, name: "agro-sbx-1525-capture", ... })` inside a sandbox makes no runner call.
- [ ] `pnpm run typecheck` exits 0. `pnpm test:scripts` exits 0.

### US-002: Send the `agro-release` dispatch to agro-web after each release

**Description:** As an operator, I want each AGRO release to trigger the agro-web docs sync so that the site shows the released docs.

**Acceptance Criteria:**

- [ ] The `finalize` job in `.github/workflows/release.yml` ends with a step named `Notify agro-web of the release`.
- [ ] The step sends `POST repos/mifunedev/agro-web/dispatches` with `event_type` `agro-release` and `client_payload.ref` equal to `v${{ needs.reserve.outputs.releaseVersion }}`.
- [ ] The step reads the token from the secret `AGRO_WEB_DISPATCH_TOKEN`. The step prints a `::warning::` and exits 0 when the secret is empty.
- [ ] A failed dispatch does not fail the release run: the step sets `continue-on-error: true` and prints a `::warning::` with the HTTP status.
- [ ] A test in `.agro/scripts/__tests__/` asserts the step name, its position as the last step of `finalize`, the event type, the ref expression, and the secret name.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds an entry for the dispatch and for the US-001 guard.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Add execution location, directory, and fork CI rules to the procedures

**Description:** As the operator, I want the procedures to state where each worker runs and who approves fork CI. Then no agent acts on infrastructure without consent.

**Acceptance Criteria:**

- [ ] The `## Dispatch record` table in `.agro/skills/delegate/SKILL.md` holds an `Execution location` row: `host` or `sandbox`. The advisor decides the value with `/etc/agro/sandbox`, or with `/.dockerenv` plus a non-empty `SANDBOX_NAME`.
- [ ] The `## Worker brief` list holds a rule: in a sandbox, never run `agro sandbox`, `agro destroy`, `agro stop`, `agro restart`, or raw `docker compose` for the current project.
- [ ] The `## Waves` section holds a rule: the advisor never sends parallel shell calls that change the working directory. Each parallel call uses absolute paths, for example `git -C <path>`.
- [ ] `.agro/skills/git/SKILL.md` holds a rule for pull requests from a fork: an agent never approves an `action_required` workflow run, for example with `gh api repos/<owner>/<repo>/actions/runs/<id>/approve`. Only the operator approves a fork run. The agent verifies the fork change locally in the sandbox instead.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md .agro/skills/git/SKILL.md` reports no finding on a changed line.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-004: Record the manual review evidence

**Description:** As the advisor, I want test and workflow evidence for the three changes so that the PR `## Manual review` section shows the observed behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/sandbox-guard-release-dispatch/evidence/manual-review.md` holds the command and output of the US-001 lifecycle tests and the US-002 workflow test.
- [ ] The transcript holds the `git diff` of the US-003 skill change.
- [ ] The advisor runs no `destroy`, `stop`, or `restart` command in the sandbox. A failed guard would stop the live sandbox, so the unit tests carry the proof.

## Summary

Issue #1531 reports that `agro destroy agro-sbx-1525-capture --yes` inside `agro-sbx-local` stopped the current sandbox. The grounding confirms the path:

- `runDestroy` calls `routeVerb` and can take the Compose route. That route runs `docker-compose.sh down -v` against the current project.
- `runComposeVerb` runs `stop` and `restart` the same way.
- The only existing guards are `runSandbox` (`lifecycle.ts:195`), `sandbox.ts:347`, and `LocalExecutionTarget.provision` and `destroy` (`local-target.ts:56-61`). `LocalExecutionTarget.destroy` refuses only on the target route.

The release workflow publishes the GitHub Release in the `finalize` job but sends no event to agro-web. `mifunedev/agro-web` `pages.yml` already accepts `repository_dispatch` type `agro-release` with `client_payload.ref` as the release tag, and rebuilds daily as a backstop. In this session the site advertised unreleased commands, and the synced pages stayed stale until a manual rebuild.

The delegate procedure names the execution directory but not the execution location. A worker brief that assumed the host led to the #1531 incident. Parallel advisor calls with relative `cd` paths pushed a stray branch to the wrong remote.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/lifecycle.ts` | `runDestroy`, `runComposeVerb`, `COMPOSE_VERBS` | Guard placement |
| `.agro/cli/src/lib/execution/detect.ts` | `runningInsideSandbox`, `SANDBOX_MARKER_FILE`, `DOCKERENV_FILE` | Sandbox detection |
| `.agro/cli/src/lib/execution/local-target.ts` | `HostOnlyError` | Refusal message |
| `.github/workflows/release.yml` | job `finalize`, `needs.reserve.outputs.releaseVersion` | Dispatch step |
| `.agro/skills/delegate/SKILL.md` | `## Dispatch record`, `## Worker brief`, `## Waves` | Procedure rules |
| `.agro/skills/git/SKILL.md` | pull request rules | Fork CI approval rule |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro destroy`, `agro stop`, `agro restart` | Changed | Each verb refuses inside a sandbox with exit status 1. |
| Release workflow | Changed | `finalize` sends `agro-release` with the tag to agro-web. |
| Delegate procedure | Changed | The dispatch record names the execution location. |
| Git procedure | Changed | Only the operator approves a workflow run from a fork. |

## Storage

N/A. The change adds no persistent state. The operator stores the secret `AGRO_WEB_DISPATCH_TOKEN` in the GitHub repository settings.

## Architectural Decisions

- One check, `runningInsideSandbox()`, and one message, `HostOnlyError`, cover every host-only verb. The guard runs before `routeVerb`, so no route can reach Compose.
- `ps` and `logs` stay allowed, because the two verbs read state and change nothing.
- The dispatch step runs last in `finalize`, after the release is public, and cannot fail the release.
- A missing secret skips the dispatch with a warning. The daily agro-web rebuild stays the backstop.
- The canonical skill source is `.agro/skills/delegate/SKILL.md`. Provider mirrors stay symlinks.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `destroy`, `stop`, and `restart` refuse inside a sandbox with 0 runner calls; `ps` still runs | US-001 |
| `.agro/scripts/__tests__/` new or existing release workflow test | step name, last position, event type, ref expression, secret name | US-002 |
| `bash .agro/scripts/link-providers.sh --check` | skill links resolve | US-003 |

Run `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness`.

## Design Principles

- Fail closed inside the sandbox for every verb that changes the sandbox container.
- Keep one source of truth for the refusal message.
- Add no explanatory comments to tracked code.
- A notification step never decides the outcome of a release.

## Out of Scope

- The `agro-web` workflow and the generated landing agent list. A later agro-web PR owns that change.
- A harness contribution guide.
- Live runs of the guarded verbs in the sandbox.

## Open Questions

None. The operator must create the secret `AGRO_WEB_DISPATCH_TOKEN` before the first dispatch takes effect. A fine-grained token with Contents read and write on `mifunedev/agro-web`, or a GitHub App with the same access, sends `repository_dispatch`.

## Acceptance Criteria

- [ ] Inside a sandbox, `agro destroy`, `agro stop`, and `agro restart` exit 1 and make no Docker or Compose call.
- [ ] The release workflow sends `agro-release` with the tag to `mifunedev/agro-web` and never fails a release on that step.
- [ ] The delegate procedure names the execution location and the parallel-call rule, and the git procedure reserves fork CI approval for the operator.
- [ ] `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness` exit 0.
- [ ] `.agro/tasks/sandbox-guard-release-dispatch/evidence/manual-review.md` exists.

## Lessons

1. Claim: `canonical-publish-contract.test.ts` matched any `continue-on-error:` after `publish-cli:` in the whole file. Evidence: the US-002 worker stopped as BLOCKED when the new `finalize` step failed that assertion. Outcome: fixed in this PR. The regex now covers only the `publish-cli` job block.
2. Claim: the advisor approved `action_required` fork CI runs for PR #1528 without operator consent. Evidence: the operator stated that the project does not run a fork PR on its infrastructure automatically. Outcome: fixed in this PR. `.agro/skills/git/SKILL.md` reserves fork run approval for the operator.
3. Claim: a guard denied a `jq --arg` call because the note text named a shell variable form. Evidence: the secret-exposure guard matched the note string, not an environment read. Outcome: dropped, because the finding is tooling friction with a simple rewording.
