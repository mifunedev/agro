# PRD: boat.dev hand provider

Status: BLOCKED

## User Stories

### US-001: Probe the boat CLI and one live sandbox

**Description:** As the advisor, I want recorded `boat` CLI output so that the provider stories build on measured JSON shapes, not on documentation.

**Acceptance Criteria:**

- [ ] `.agro/tasks/boat-hands/evidence/probe.md` records `boat --help` and the help of `new`, `list`, `info`, `fork`, `stop`, `resume`, `delete`, and `ssh`, run on the brain host.
- [ ] Before the probe creates a sandbox, the probe runs `boat list --json`. If that command exits non-zero, the probe sets `blocked` and creates nothing.
- [ ] With operator approval, the probe creates one `small` sandbox with `boat new --json --name agro-probe-<date> --ttl 1h`, records each JSON Lines event, and deletes the sandbox with `boat delete <id> --yes`.
- [ ] The probe records `boat info <id> --json` before and after one `boat stop` and one `boat resume`. The record shows whether `ip`, `sshEndpoint`, and the host key change.
- [ ] The probe records whether `boat new` accepts a tag, label, or metadata flag. The probe records the field in `boat list --json` that holds the value.
- [ ] The probe records the output of `hostname` and of any identity file inside the sandbox that names the sandbox id.
- [ ] The probe records the exit status and the stderr of `boat list --json` with `BOAT_API_KEY=invalid` and with an empty `HOME`.
- [ ] The fixture `.agro/cli/src/commands/__tests__/fixtures/boat-list.json` holds one `boat list --json` capture. The capture keeps the id, name, status, `ip`, `sshEndpoint`, and the ownership field. The capture drops email, org, and billing fields.
- [ ] `boat list --json` after the probe shows no sandbox that the probe created.

### US-002: Add `boat` to the hand provider ids

**Description:** As an operator, I want `hands.provider` to accept `boat` so that I select boat.dev hands for one brain.

**Acceptance Criteria:**

- [ ] `HAND_PROVIDER_IDS` in `.agro/cli/src/lib/host-config.ts` equals `["console", "exedev", "boat"]`.
- [ ] `agro config set hands.provider boat` exits 0 and writes `{ "hands": { "provider": "boat" } }` to the host config.
- [ ] `agro config set hands.provider aws` exits 1, and stderr contains `hands.provider must be one of console, exedev, boat`.
- [ ] A host config with `hands.provider` set to a number makes `agro hands list` exit 1 with an error that names `hands.provider`.
- [ ] `docs/configuration.md` § Field reference lists `boat` for `hands.provider`. `.agro/cli/src/__tests__/docs-reference.test.ts` passes.
- [ ] `.agro/cli/src/lib/__tests__/host-config.test.ts` and `.agro/cli/src/__tests__/config-secret.test.ts` cover the value `boat`.

### US-003: Read and run on boat hands

- [ ] `.agro/cli/src/lib/hands/boat-provider.ts` exports `createBoatProvider` and `boatPreflight`. Both call the `boat` CLI with `--json` through `LifecycleRunner`. Neither reads, prints, or stores `BOAT_API_KEY`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/hands/boat-provider.ts` exports `createBoatProvider` and `boatPreflight`. Both call the `boat` CLI through `LifecycleRunner` with `--json`. Neither reads, prints, or stores `BOAT_API_KEY`.
- [ ] `boatPreflight` runs `boat list --json`. If `boat` is not on `PATH`, the preflight exits 2 and names the install command `curl -fsSL https://boat.dev/install | sh`. If the CLI reports an auth error, the preflight exits 2 and names `boat login`.
- [ ] `list` returns only sandboxes that have a name that starts with `agro-hand-`. A sandbox without the mark is not in the output.
- [ ] `resolve` returns a `Hand` with `sshDest` `user@<ip>`, or the host and port of `sshEndpoint` when the sandbox has no public IPv4. `hostKeyAlias` is `boat-<id>`. `remoteName` is `hand-<id>`.
- [ ] Before each SSH call, the provider pins the current host key for `boat-<id>` in the brain `known_hosts`. With a fresh `known_hosts`, `agro hands exec <hand> -- true` exits 0 with no prompt.
- [ ] After a `boat stop` and a `boat resume` change the IP and the host key, `agro hands exec <hand> -- true` exits 0, and `agro hands fetch <hand> --project <owner>/<repo>` uses the new address.
- [ ] `agro hands list --json` prints one JSON array on stdout and nothing else on stdout, on success and on failure. A malformed `boat list --json` output makes the command exit 1 with `boat list returned invalid JSON`.
- [ ] Inside a container whose hostname is not a sandbox id, a write verb refuses with the container refusal message, as the exe.dev provider does.
- [ ] `.agro/cli/src/commands/__tests__/hands-boat.test.ts` covers each criterion above with a fake runner and the US-001 fixture.

### US-004: Manage the boat hand lifecycle with guards

**Description:** As an operator, I want `create`, `fork`, `pause`, `resume`, and `destroy` on boat hands so that I manage the full hand lifecycle from the brain.

**Acceptance Criteria:**

- [ ] `create` runs `boat new --json` with `--name agro-hand-<name>` and `--no-auto-stop`. `create` waits for the `ready` event and then polls `boat info` until the status is `ready` or `idle`, or until the timeout expires.
- [ ] If `boat new` refuses `--no-auto-stop` on the trial tier, `create` runs `boat new` again with `--ttl <trial cap seconds>` and prints `trial tier: hand <name> stops after <hours> hours`. The same fallback applies to `fork` and `resume`. US-001 records the refusal code and the trial cap.
- [ ] An `{"event":"error"}` line from `boat new` makes `create` exit 1 and print the `error` and `code` values. An HTTP 429 code makes the message name the plan start limit.
- [ ] `fork` runs `boat fork <id> --json`, passes `--name agro-hand-<name>` and `--no-auto-stop`, and waits until the copy is `ready` or `idle`.
- [ ] `pause` runs `boat stop <id>` and polls `boat info` until the status is `stopped` or `archived`. `resume` runs `boat resume <id>` and polls until the status is `ready` or `idle`.
- [ ] `destroy` runs `boat delete <id> --yes` only after `agro hands destroy <hand>` gets confirmation or `--yes`.
- [ ] Each write verb refuses a sandbox without the ownership mark and refuses the sandbox that runs the brain.
- [ ] `agro hands create` refuses `--spec`, `--profile`, `--docker`, `--t3`, `--code-server`, `--desktop`, `--disposable`, `--ssh-key`, `--operator`, and `check` on the boat provider, and exits 1 with `<flag> applies only to console hands`.
- [ ] `printRunning` and the list printer in `.agro/cli/src/commands/hands.ts` print `name` and `ssh host` for boat hands, as for exe.dev hands.
- [ ] `.agro/cli/src/commands/__tests__/hands-boat.test.ts` covers each criterion above with a fake runner, a fake clock, and a fake sleep.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-005: Document boat hands

**Description:** As an operator, I want the hands documentation to name the boat provider so that I select and operate it without reading code.

**Acceptance Criteria:**

- [ ] The `handsHelp` text in `.agro/cli/src/commands/hands.ts` lists `console`, `exedev`, and `boat`.
- [ ] `docs/lifecycle-commands.md` has a `### boat.dev hands` section. The section states the credential, the ownership mark, the TTL policy, the SSH destination, and the loss of the Docker build cache on stop and fork.
- [ ] The provider table in `.agro/skills/sandbox/references/hands.md` has a `boat` column. `.agro/skills/sandbox/SKILL.md` names boat hands in the `hands` route.
- [ ] `CHANGELOG.md` § `[Unreleased]` has one entry for the boat hand provider.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file.

### US-006: Record a live review on boat.dev

- [ ] Before the review creates a sandbox, the review runs `agro hands list --provider boat --json`. If that command fails, the review sets `blocked` and creates nothing.

**Acceptance Criteria:**

- [ ] Before the review creates a sandbox, the review runs `agro hands list --provider boat --json`. If that command exits non-zero, the review sets `blocked` and creates nothing.
- [ ] `.agro/tasks/boat-hands/evidence/manual-review.md` records `agro hands create --provider boat --project <owner>/<repo>`, `exec`, `pause`, `resume`, `exec` after resume, `fork`, `fetch`, and `destroy` on the original hand and on the fork.
- [ ] The review runs with a fresh `known_hosts` path, passed inline as `GIT_SSH_COMMAND` or as an SSH option on the command.
- [ ] `boat list --json` after the review shows no sandbox that the review created.
- [ ] The operator approves the billable run before the first create. (external)

## Summary

boat.dev sells persistent Ubuntu 24.04 VMs with Docker, Compose, systemd, passwordless `sudo`, and `/dev/kvm`. The product exposes a `boat` CLI with a global `--json` flag and an HTTP API at `https://boat.dev/api/v1`. The CLI verbs `new`, `list`, `info`, `fork`, `stop`, `resume`, `delete`, and `ssh` map to the `HandProvider` operations. On September 15, 2026, boat.dev renamed the product from "Box" on ascii.dev. The old `box` surfaces had a Sunset date of 2026-10-31.

AGRO has a `HandProvider` interface in `.agro/cli/src/lib/hands/provider.ts` with two implementations: `console-provider.ts` and `exedev-provider.ts`. The exe.dev provider calls a CLI through `LifecycleRunner`, keeps no token, and fences authority with a tag and a brain guard. This plan adds a third provider with the same shape: `boat-provider.ts` calls the `boat` CLI, and the `boat` CLI owns the credential.

Three facts make boat different from exe.dev:

1. The IP and the host key change after each resume and each fork. `runSsh` in `hands.ts` uses `StrictHostKeyChecking=accept-new` with `HostKeyAlias=<hand.hostKeyAlias>`. A changed host key fails that check. The git remote that `placeProject` adds holds the old address.
2. Auto-stop is a wall-clock TTL with a default of 1 hour. `boat exec` and SSH sessions do not extend the TTL. A hand without a TTL policy stops during work.
3. `boat new` has no tag, label, or metadata flag. The exe.dev fence depends on the tag `agro-hand`, so the boat provider uses the name prefix `agro-hand-`.

`.agro/tasks/boat-hands/evidence/probe.md` records the read-only probe of 2026-11-25.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `HAND_PROVIDER_IDS`, `isHandProviderId`, `handProviderError` | Provider id registry and validation |
| `.agro/cli/src/lib/hands/provider.ts` | `HandProvider`, `Hand`, `resolveHandProviderId` | Provider seam |
| `.agro/cli/src/lib/hands/exedev-provider.ts` | `createExedevProvider`, `exedevPreflight`, `CONTAINER_REFUSAL` | Pattern to follow for a CLI-backed provider |
| `.agro/cli/src/lib/hands/boat-provider.ts` | `createBoatProvider`, `boatPreflight` | New provider |
| `.agro/cli/src/commands/hands.ts` | `runHands`, `runSsh`, `printRunning`, `runList`, `placeProject`, `runFetch`, `handsHelp` | Provider dispatch, SSH options, remote setup, output |
| `.agro/cli/src/lib/execution/runner.ts` | `LifecycleRunner` | Process runner for the `boat` CLI |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `hands.provider` host config field | Extended enum | Adds the value `boat` |
| `agro hands --provider` | Extended enum | Accepts `boat` |
| `agro hands list --json` | Unchanged contract | Prints the exe.dev row shape for boat hands |
| `agro hands create` flags | Refusal | Console-only flags exit 1 on the boat provider |
| `docs/lifecycle-commands.md`, `docs/configuration.md` | Documentation | Boat provider section and enum value |
| `.agro/skills/sandbox/references/hands.md` | Skill reference | Boat column in the provider table |

## Storage

The provider stores no state of its own. The `boat` CLI keeps its credential in `~/.config/ascii/boat/config.json` on the brain host, or reads `BOAT_API_KEY`. AGRO reads neither. Host keys go to the brain `known_hosts` under the alias `boat-<id>`. The ownership mark is the sandbox name prefix `agro-hand-` at boat.dev.

## Architectural Decisions

- Source of truth: boat.dev holds the sandbox list. `agro hands` keeps no local hand table.
- Transport: the provider calls the `boat` CLI, not the HTTP API. AGRO then holds no token, as with exe.dev. The operator accepted this choice.
- Authority fence: a write verb acts only on a sandbox with the ownership mark, and never on the brain sandbox.
- Address stability: the provider resolves the address and the host key from `boat info` on each call. AGRO stores no IP.
- Execution location: `agro hands` runs on the brain host. The `boat` CLI is a host prerequisite of a boat brain.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | accepts `boat`; rejects other values | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | `config set hands.provider boat`; error lists `boat` | US-002 |
| `.agro/cli/src/commands/__tests__/hands-boat.test.ts` | preflight missing CLI, auth error; list filter; malformed JSON; `--json` stdout purity; fresh `known_hosts`; address change after resume; container refusal | US-003 |
| `.agro/cli/src/commands/__tests__/hands-boat.test.ts` | create ready and error events; 429; fork; pause and resume polling; destroy confirmation; unmarked refusal; brain refusal; console-only flag refusal | US-004 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | field reference matches `HAND_PROVIDER_IDS` | US-002, US-005 |
| `.agro/cli/src/commands/__tests__/hands.test.ts`, `hands-exedev.test.ts` | existing cases pass with no edit | No regression |

## Design Principles

- Follow the exe.dev provider shape. Add no new abstraction to `HandProvider` unless the probe proves a need.
- Keep the credential in the `boat` CLI. AGRO never reads, prints, or forwards it.
- Treat each boat address as temporary. Resolve the address on each call.
- Refuse console-only flags explicitly. Do not ignore them.
- Add no explanatory comments to tracked code.

## Out of Scope

- A validation-driver adapter for boat in `.agro/skills/sandbox/adapters/`.
- The HTTP API and the TypeScript SDK.
- Saved snapshots, `boat run`, `boat prompt`, and the boat integrated agents.
- Region selection. The documentation shows no region flag.
- The legacy `box` CLI and the `ascii.dev` API.

## Open Questions

The operator accepted these advisor recommendations on 2026-11-25:

- Transport: the `boat` CLI. The CLI reads `BOAT_API_KEY` from the environment or from its own session. AGRO reads neither.
- Ownership mark: the name prefix `agro-hand-`. The probe found no tag, label, or metadata flag on `boat new`.
- Address change: on each call, the provider reads the address and the host key from `boat info`, and pins the host key. Before each push and each fetch, the provider runs `git remote set-url`.
- Port: `Hand.sshDest` carries the port as `ssh://user@host:port`. `Hand` gets no new field.
- TTL: `create`, `fork`, and `resume` pass `--no-auto-stop`. A fork does not inherit the setting. On the trial tier, the provider falls back to the trial TTL cap and prints a notice, as the console provider does for the `n4` fallback.
- Plan: the operator directs the use of the free trial for implementation. Live stories use `--type small` and keep at most 2 sandboxes active at the same time.
- Credential: the operator runs `boat login` on the brain host. Agents never pass `BOAT_API_KEY` on a command.
- Brain identity: the provider runs `boat info self --json` on the brain. If that command names a sandbox, each write verb refuses that sandbox.
- Region: the operator accepts EU-only machines.

These questions remain:

1. Billing: `boat limits --all --json` reports `canStart: false` with `blockedReason: subscription_required` and no card. The free trial needs a card. Until `canStart` is `true`, US-001 and US-006 stay blocked. US-002 to US-005 use fake runners and need no live sandbox.
2. Address change: the probe did not measure whether `ip`, `sshEndpoint`, and the host key change after a resume. US-001 measures them after `canStart` is `true`.
3. Brain identity: the probe did not confirm that `boat info self` resolves inside a sandbox. US-001 measures it after `canStart` is `true`.

## Acceptance Criteria

- [ ] `agro hands list --provider boat --json` lists only marked boat sandboxes.
- [ ] `agro hands create`, `exec`, `pause`, `resume`, `fork`, `fetch`, and `destroy` work on a live boat account, as the US-006 transcript shows.
- [ ] `agro hands exec <hand> -- true` exits 0 after a resume changes the IP and the host key.
- [ ] No file under `.agro/` reads `BOAT_API_KEY` or `~/.config/ascii/boat/config.json`.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.
- [ ] Existing console and exe.dev hand tests pass with no edit.

## Lessons
