# PRD: boat.dev hand provider

Status: DRAFT

## User Stories

### US-001: Probe the boat CLI and one live sandbox

**Description:** As the advisor, I want recorded `boat` output from a live sandbox so that the synthetic fixtures and the transport choice rest on measured behavior.

**Acceptance Criteria:**

- [ ] Before the probe creates a sandbox, the probe runs `boat limits --json`. If `canStart` is not `true`, the probe creates nothing and stays open.
- [ ] The probe creates one `small` sandbox with `boat new --json --no-env --name agro-hand-probe`, records each JSON Lines event, and deletes the sandbox with `boat delete <id> --yes`.
- [ ] The probe records `boat info <id> --json` and one `boat list --json` entry for the sandbox, and compares both with the synthetic fixture `.agro/cli/src/commands/__tests__/fixtures/boat-list.json`.
- [ ] The probe records the error code that `boat new --no-auto-stop` returns on the trial tier, and the maximum `--ttl` that the trial tier accepts.
- [ ] The probe records that `boat ssh <id> 'printf x; exit 3'` prints `x` on stdout with no banner and exits 3.
- [ ] The probe records that `git push` and `git fetch` succeed with `GIT_SSH_COMMAND="boat ssh"`, `GIT_SSH_VARIANT=simple`, and the remote `<id>:projects/probe/repo`.
- [ ] The probe records that `BOAT_ID` holds the sandbox id inside the sandbox.
- [ ] `boat list --json` after the probe shows no sandbox that the probe created.
- [ ] The operator adds a card so that `canStart` is `true`. (external)

### US-002: Add `boat` to the hand provider ids

**Description:** As an operator, I want `hands.provider` to accept `boat` so that I select boat.dev hands for one brain.

**Acceptance Criteria:**

- [ ] `HAND_PROVIDER_IDS` in `.agro/cli/src/lib/host-config.ts` equals `["console", "exedev", "boat"]`.
- [ ] `agro config set hands.provider boat` exits 0 and writes `{ "hands": { "provider": "boat" } }` to the host config.
- [ ] `agro config set hands.provider aws` exits 1, and stderr contains `hands.provider must be one of console, exedev, boat`.
- [ ] `.agro/cli/src/lib/__tests__/host-config.test.ts` accepts `boat` in the `it.each` case, and the anchored rejection regex ends in `console, exedev, boat$`.
- [ ] `docs/configuration.md` § Field reference lists `boat` for `hands.provider`. `.agro/cli/src/__tests__/docs-reference.test.ts` passes.

### US-003: Read and run on boat hands through `boat ssh`

**Description:** As an operator, I want `list`, `exec`, `fetch`, and `create --project` to reach boat hands through `boat ssh`. Then a changed IP or host key never breaks a hand.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/hands/boat-provider.ts` exports `createBoatProvider`, `boatPreflight`, and `BOAT_PREFIX = "agro-hand-"`. Each `boat` call goes through `LifecycleRunner` with `--json`.
- [ ] `HandProvider` in `.agro/cli/src/lib/hands/provider.ts` gets the optional member `sshCommand?: () => string[]`. The boat provider returns `["boat", "ssh"]`. The console and exe.dev providers do not define the member.
- [ ] When the provider defines `sshCommand`, `runSsh` in `.agro/cli/src/commands/hands.ts` runs `boat ssh <id> <remote>`, and `gitEnv` sets `GIT_SSH_COMMAND=boat ssh` and `GIT_SSH_VARIANT=simple`. When the provider does not define it, `runSsh` and `gitEnv` produce the same argv and env as before.
- [ ] A boat `Hand` has `sshDest` equal to the sandbox id. `pushProject` adds the remote `<id>:projects/<owner>/<repo>`. No boat code path writes to a `known_hosts` file or passes `HostKeyAlias`.
- [ ] `boatPreflight` runs `boat list --json`. If `boat` is missing, the preflight exits 2 and names `https://docs.boat.dev/cli-reference`. If the output has `"code":"unauthorized"`, the preflight exits 2 and names `boat login`.
- [ ] `list` returns only sandboxes whose name starts with `agro-hand-`, and shows each name without the prefix. `resolve` accepts a name without the prefix or a sandbox id. If two sandboxes match one name, `resolve` fails and names both ids.
- [ ] `agro hands list --json` prints one JSON array on stdout on success and prints nothing on stdout on failure. A malformed `boat list --json` output makes the command exit 1 with `boat list returned invalid JSON`.
- [ ] An error event on stdout makes the call fail with the `error` and `code` values, also when `boat` exits 0. A non-zero exit with no error event fails with the exit status.
- [ ] The branches `providerId === "exedev"` in `printRunning`, `runList`, and the console-only flag refusals in `runHands` apply to each provider that is not `console`. `printExedevList` becomes `printNamedList`.
- [ ] `.agro/cli/src/commands/__tests__/fixtures/boat-list.json` holds a synthetic `{"pageInfo":{...},"sandboxes":[...]}` capture with one marked and one unmarked sandbox. `.agro/cli/src/commands/__tests__/hands-boat.test.ts` covers each criterion above with a fake runner.
- [ ] The existing `hands.test.ts`, `hands-exedev.test.ts`, and `hands-project.test.ts` pass with no edit. `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-004: Manage the boat hand lifecycle with guards

**Description:** As an operator, I want `create`, `fork`, `pause`, `resume`, and `destroy` on boat hands so that I manage the full hand lifecycle from the brain.

**Acceptance Criteria:**

- [ ] `create` runs `boat new --json --no-env --no-auto-stop --name agro-hand-<name>`. `create` reads the sandbox id from the `ready` event and returns the hand. If the timeout expires after the id is known, `create` fails and prints the id and `agro hands destroy <name> --yes`.
- [ ] If `boat new` returns the trial-tier refusal code for `--no-auto-stop`, `create` runs `boat new` again with `--ttl <BOAT_TRIAL_TTL_SECONDS>` and prints `trial tier: hand <name> stops after <hours> hours` on stderr. `fork` and `resume` apply the same fallback. No retry follows a `rate_limited` or HTTP 429 error.
- [ ] `fork` runs `boat fork <id> --wait --json --no-auto-stop --name agro-hand-<name>`. `pause` runs `boat stop <id>` and polls `boat info` until the status is `archived` or `stopped`. `resume` runs `boat resume <id> --no-auto-stop`. A poll that reaches `error` fails with the status.
- [ ] `destroy` runs `boat delete <id> --yes` only after `confirmDestroy` gets confirmation or `--yes`. The prompt shows the name and the id.
- [ ] Before each write verb, the provider runs `boat info <id> --json` and refuses a sandbox whose name does not start with `agro-hand-`.
- [ ] When `BOAT_ID` is set in the brain environment, each write verb and the fork source refuse that sandbox id with `refusing to <verb> <name>: it is this brain`. The ref `self` is refused.
- [ ] When `inContainer()` is true and `BOAT_ID` is unset, each write verb refuses with `CONTAINER_REFUSAL`. `list`, `exec`, and `fetch` still run.
- [ ] `agro hands create` on the boat provider refuses the console-only flags and `--spec`, and exits 1 with `<flag> applies only to console hands`.
- [ ] `hands-boat.test.ts` covers each criterion above with a fake runner, a fake clock, and a fake sleep. A test greps `boat-provider.ts` and finds no `BOAT_API_KEY` and no `.config` string.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-005: Document boat hands

**Description:** As an operator, I want the hands documentation to name the boat provider so that I select and operate it without reading code.

**Acceptance Criteria:**

- [ ] The `handsHelp` text in `.agro/cli/src/commands/hands.ts` lists `console`, `exedev`, and `boat`, and states that boat hands use `boat ssh`.
- [ ] `docs/lifecycle-commands.md` has a `### boat.dev hands` section. The section states `boat login` as the credential, the `agro-hand-` name prefix, `--no-env`, `--no-auto-stop` with the trial fallback, the `boat ssh` transport, and the loss of the Docker build cache on stop and fork. The section states that no live run has verified the provider until US-006 passes.
- [ ] `.agro/skills/sandbox/references/hands.md` has a `boat` column in the provider table, and `.agro/skills/sandbox/SKILL.md` names boat hands in the `hands` route.
- [ ] `CHANGELOG.md` § `[Unreleased]` has one entry for the boat hand provider.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file under `docs/` and `.agro/skills/`.

### US-006: Record a live review on boat.dev

**Description:** As the advisor, I want a command transcript from a live boat account so that the PR manual review section rests on real evidence.

**Acceptance Criteria:**

- [ ] Before the review creates a sandbox, the review runs `boat limits --json` on the brain host. If `canStart` is not `true`, the review creates nothing and stays open.
- [ ] `.agro/tasks/boat-hands/evidence/manual-review.md` records `agro hands create --provider boat --project <owner>/<repo>`, `exec`, `pause`, `resume`, `exec` after the resume, `fork`, `fetch`, and `destroy` of the hand and of the fork.
- [ ] `boat list --json` after the review shows no sandbox that the review created.
- [ ] The operator approves the billable run and runs it from the brain host. (external)

## Summary

boat.dev sells persistent Ubuntu 24.04 VMs with Docker, Compose, systemd, and passwordless `sudo`. The `boat` CLI (`1.0.105`) has a global `--json` flag. The probe of 2026-11-25 verified the verb surface, the error event shape `{"event":"error","error":...,"code":...,"status":...}`, and the `boat list --json` shape. The probe found no tag flag. `boat info self` reads `BOAT_ID`, which boat sets inside its sandboxes. The account cannot start a sandbox until the operator adds a card, so US-001 and US-006 are external stories.

AGRO has a `HandProvider` interface with the `console` and `exedev` implementations. The exe.dev provider calls a CLI through `LifecycleRunner`, keeps no token, and fences authority with a tag and a brain guard. The boat provider follows that shape.

Three independent explorers agreed on one transport. Per the boat documentation, the IP and the host key change after each resume and each fork. `runSsh` pins host keys with `StrictHostKeyChecking=accept-new`, and `pushProject` stores the SSH address in the git remote. A plain SSH transport would break after the first resume. The boat provider therefore routes exec and git through `boat ssh <id>`, which manages the key and the host key itself. The git remote holds the sandbox id, which never changes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `HAND_PROVIDER_IDS` | Provider id registry |
| `.agro/cli/src/lib/hands/provider.ts` | `HandProvider`, `Hand` | Provider seam; gets `sshCommand?` |
| `.agro/cli/src/lib/hands/exedev-provider.ts` | `createExedevProvider`, `CONTAINER_REFUSAL` | Pattern to follow |
| `.agro/cli/src/lib/hands/boat-provider.ts` | `createBoatProvider`, `boatPreflight`, `BOAT_PREFIX`, `BOAT_TRIAL_TTL_SECONDS` | New provider |
| `.agro/cli/src/commands/hands.ts` | `runSsh`, `gitEnv`, `pushProject`, `printRunning`, `runList`, `printExedevList`, `runHands`, `handsHelp` | Transport hook, generic branches, dispatch |
| `.agro/cli/src/lib/execution/runner.ts` | `LifecycleRunner` | Process runner |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `hands.provider` host config field | Extended enum | Adds `boat` |
| `agro hands --provider` | Extended enum | Accepts `boat` |
| `agro hands list --json` | Unchanged contract | Boat rows use the exe.dev row shape |
| `agro hands create` flags | Refusal | Console-only flags exit 1 on the boat provider |
| `HandProvider.sshCommand` | New optional member | Replaces `ssh` for exec and git |
| `docs/`, `.agro/skills/sandbox/` | Documentation | Boat provider section and table column |

## Storage

The provider stores no state. The `boat` CLI keeps its session from `boat login` on the brain host. AGRO reads no boat credential. The ownership mark is the sandbox name prefix `agro-hand-` at boat.dev. The git remote `hand-<id>` holds `<id>:projects/<owner>/<repo>`.

## Architectural Decisions

- Source of truth: boat.dev holds the sandbox list. `agro hands` keeps no local hand table.
- Transport: `boat ssh <id>` for exec and git. The address and the host key never reach AGRO.
- Authority fence: the provider resolves each ref to one id, re-reads the name with `boat info` before each write, and refuses a name without `agro-hand-`.
- Brain guard: `BOAT_ID` names the brain sandbox. Inside a container without `BOAT_ID`, write verbs refuse.
- Secrets: `create` passes `--no-env`, so no stored account secret reaches a hand.
- TTL: `--no-auto-stop`, with one named trial fallback constant.
- Execution location: `agro hands` runs on the brain host.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | accepts `boat`; anchored rejection message | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `config set hands.provider boat` | US-002 |
| `.agro/cli/src/commands/__tests__/hands-boat.test.ts` | missing CLI; unauthorized; malformed JSON; error event with exit 0; prefix filter; duplicate names; `--json` stdout purity; `boat ssh` argv; git env; remote URL; no `known_hosts` write | US-003 |
| `.agro/cli/src/commands/__tests__/hands-boat.test.ts` | create; timeout after id; trial fallback; no 429 retry; fork; pause; error state; destroy; unmarked, `BOAT_ID`, `self`, and container refusals; console-only flags; credential grep | US-004 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | docs name only real paths, verbs, and keys | US-002, US-005 |
| `hands.test.ts`, `hands-exedev.test.ts`, `hands-project.test.ts` | pass with no edit | No regression |

## Design Principles

- Follow the exe.dev provider shape. Add only the `sshCommand?` member to `HandProvider`.
- Keep the credential in the `boat` CLI.
- Address a hand by its sandbox id. Store no IP and no host key.
- Mark fixtures as synthetic until US-001 replaces them with captures.
- Refuse console-only flags explicitly.
- Add no explanatory comments to tracked code.

## Out of Scope

- A validation-driver adapter for boat in `.agro/skills/sandbox/adapters/`.
- The boat HTTP API and the SDKs.
- Saved snapshots, `boat run`, `boat prompt`, and the boat agents.
- Region selection and machine type selection.
- The legacy `box` CLI.

## Open Questions

1. Billing: the account reports `canStart: false` with `subscription_required`. US-001 and US-006 stay open until the operator adds a card.
2. Nobody has measured the trial refusal code for `--no-auto-stop` or the trial TTL cap. US-004 sets `BOAT_TRIAL_TTL_SECONDS = 7200` from the documented cap of 2 hours. US-004 matches the refusal with a named constant that US-001 confirms.
3. Nobody has measured `boat ssh` with binary stdin for `git push`. If US-001 shows a failure, a follow-up change replaces the transport with plain `ssh` and an AGRO-owned known-hosts file.

## Acceptance Criteria

- [ ] `agro hands list --provider boat --json` lists only `agro-hand-` sandboxes, as `hands-boat.test.ts` shows.
- [ ] No boat code path writes a `known_hosts` file, reads `BOAT_API_KEY`, or reads a `.config` path.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.
- [ ] The existing console and exe.dev hand tests pass with no edit.
- [ ] CI on the PR is green.

## Lessons

1. Claim: the boat account cannot start a sandbox, so no live run backs this PR. Evidence: `boat limits --json` reports `canStart: false` with `subscription_required`. Outcome: dropped from this PR; US-001 and US-006 stay open as external stories, and the docs state that no live run has verified the provider.
2. Claim: three independent explorers agreed on `boat ssh <id>` as the transport, and that choice removed the host-key pinning and remote rewrite from the draft. Evidence: explorer reports; `hands-boat.test.ts` asserts the `boat ssh` argv and the git environment. Outcome: fixed in this PR.
3. Claim: an edit to any sandbox instruction file makes `sandbox-routing.test.ts` fail until 17 fresh decision-only records exist. Evidence: CI run 45773521517 failed with `stale source: instructionSha256`; commit `ae985c25` refreshed the record. Outcome: fixed in this PR. The plan did not list `decisions.json` in the `files` of the docs story. Future plans that edit `.agro/skills/sandbox/` give that file to the docs story.
4. Claim: `boat info self` reads `BOAT_ID`, so the brain guard reads `BOAT_ID` directly. Evidence: `boat info self --json` outside a sandbox printed `self can only be used inside a sandbox shell where BOAT_ID is set`. Outcome: fixed in this PR.
5. Claim: review round 1 found 10 defects. The worker fixed 7 in `972d8c91`. Evidence: `hands-boat.test.ts` tests for the destroy hint, duplicate names, the doubled prefix, `hasMore`, whole-stdout JSON, the final ready record, timeouts, and the trial notice. Outcome: fixed in this PR.
6. Claim: `agro hands resume` does not poll after `boat resume`. Evidence: `boat resume --help` states that the command waits until the sandbox is ready by default. Outcome: dropped, because the CLI already blocks.
7. Claim: without `--yes`, a boat destroy shows the prompt before the brain and container guards run. Evidence: review round 1. Outcome: dropped, because the guard still refuses after the prompt and no write happens.
8. Claim: the `hand-<id>` remote works only with the git environment that `agro hands` sets. Evidence: review round 1. Outcome: dropped, because the documented flows use `agro hands create --project` and `agro hands fetch`. A manual `git fetch hand-<id>` fails with an unknown host.
9. Claim: `boatPreflight` uses `NODE_READY_TIMEOUT_MS` and not `deps.timeoutMs`. Evidence: the round 1 worker report. Outcome: dropped, because both values are 15 minutes in `defaultDeps`.
10. Claim: `messageOf` prints `[object Object]` for the plain `{code, message}` spawn error that `spawnRunner` returns, and `exedev-provider.ts` uses `messageOf` in `failure()`. Evidence: the US-004 worker report; the boat provider reads `result.error?.message`. Outcome: dropped from this PR, because the defect is outside the change and gives a poor message, not a correctness or security risk.
11. Claim: a hook blocked a worker shell edit twice: a `python3` heredoc and a `sed` command that matched the secret-exposure pattern. Both times the worker made the same edit to its owned test file with the Edit tool. Evidence: worker reports for US-003 and the US-004 round 1 repair. Outcome: dropped. Neither edit read a secret or crossed a path guard. The repository rule treats a retry with another tool as a bypass, so future worker briefs say to report such a block as `BLOCKED`.
12. Claim: the local baseline failure in `sandbox-skill.test.ts` comes from the untracked directory `.agro/skills/remote-sandbox`. Evidence: `.agro/tasks/boat-hands/evidence/baseline.md`; CI passes. Outcome: dropped, because Git does not track the directory.
13. Claim: `boat list` lists only running sandboxes by default, so a paused hand disappears from `agro hands` and cannot resume. Evidence: `boat list --help` shows `--filter` with the default `r` and `--all`; review round 2 found the gap; commit `150b43e8` calls `boat list --all --json`. Outcome: fixed in this PR.
5. Claim: review round 1 found 10 defects, and the worker fixed 7 in `972d8c91`. Evidence: `hands-boat.test.ts` covers the destroy hint, duplicate names, the doubled prefix, and `hasMore`. The file also covers whole-stdout JSON, the final ready record, timeouts, and the trial notice. Outcome: fixed in this PR.
15. Claim: `agro hands` fails when `boat list` reports `hasMore`. Evidence: review round 2. Outcome: dropped, because `boat list --help` shows no cursor flag. The failure names the cause.
16. Claim: the reference `.agro/skills/sandbox/references/hands.md` links to the boat section on the `main` branch, which has no such heading before release. Evidence: review round 2. Outcome: dropped, because sibling references use the same absolute form and an edit to that file makes the routing fixture stale.
17. Claim: `agro hands exec` on a paused boat hand reaches `boat ssh` and fails with the boat error, not an AGRO message. The recovery hint also names `agro` when the CLI runs under another bin name. Evidence: review round 2. Outcome: dropped, because both give a poor message and break no correctness or security rule.
18. Claim: the trial fallback skips the `--ttl` retry when the refused output names a sandbox outside an error record, and that rule also applies to `resume`. Evidence: the round 2 worker report. Outcome: dropped from this PR. US-001 records the real refusal output and confirms the rule.
19. Claim: lean-out round 1 removed 113 lines net, with behavior unchanged. Evidence: commit `a3b861c3`: production +44/−73, tests +155/−238; 796/796 CLI tests pass. The advisor skipped a second round because the remaining code follows the exe.dev provider shape. Outcome: fixed in this PR.
