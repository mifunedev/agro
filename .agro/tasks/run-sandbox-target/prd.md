# PRD: agro run --sandbox targets an existing sandbox

Status: DRAFT

## User Stories

### US-001: Parse --sandbox in agro run

**Description:** As an operator, I want `agro run` to accept `--sandbox <name>` so that I can name an existing sandbox as the run target.

**Acceptance Criteria:**

- [ ] `parseRunArgs` reads `--sandbox <name>` and `--sandbox=<name>` into `args.sandbox`.
- [ ] `parseRunArgs` returns a usage error when `--sandbox` has no value or an empty value.
- [ ] `parseRunArgs` returns the error `--image cannot be combined with --sandbox` when both flags are present.
- [ ] `parseRunArgs` accepts `--sandbox` together with `--isolation container` and `--isolation microvm`.
- [ ] The `run` branch in `cli.ts` passes `sandbox` to `runRun`.
- [ ] `printRunHelp` shows `--sandbox <name>` in the usage line and in the options list. The help states that the run uses the workspace of the sandbox, mounts no host path, and leaves the sandbox running.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/run.test.ts` exits 0.

### US-002: Run in an existing AGRO sandbox

**Description:** As an operator, I want `agro run --sandbox <name> -- <command...>` to run the command in the registered AGRO sandbox `<name>`. Then I can use a persistent sandbox without a shell session.

**Acceptance Criteria:**

- [ ] `lifecycle.ts` exports one function that returns the registry root and the container name for a sandbox name. `runShell` and `runRun` both call this function.
- [ ] When the target status is not `ready`, `runRun` returns 1 and runs no command. The stderr text is `<bin> run: sandbox <name> is not running — start it with \`<bin> restart <name>\``.
- [ ] `runRun` passes no host `cwd` to `exec`, so the command runs in the default working directory of the sandbox.
- [ ] `runRun` returns the exit code of the command.
- [ ] When the target status is not `ready`, `runRun` writes `<bin> run: sandbox <name> is not running — start it with \`<bin> restart <name>\`` to stderr and returns 1. `runRun` runs no command.
- [ ] When no registry entry has the name, `runRun` writes the `resolveSandboxRoot` error to stderr and returns 1.
- [ ] `runRun` with `sandbox` creates no network, starts no service container, starts no proxy, and ignores `run.services`, `run.env`, and `access.egress`.
- [ ] Inside a sandbox, `runRun` with `sandbox` still writes the `HostOnlyError` message and returns 1.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/run.test.ts` exits 0.

### US-003: Run in an existing msb microVM

**Description:** As an operator, I want `agro run --isolation microvm --sandbox <name> -- <command...>` to run the command in the running msb microVM `<name>`. Then I can use a persistent microVM through the same door.

**Acceptance Criteria:**

- [ ] `microvm-target.ts` exports `MsbVmExecutionTarget`. Its `exec` runs `msb exec -u <user> [-e K=V ...] <name> -- <argv...>`, with `<user>` equal to `request.user` or `MICROVM_USER`.
- [ ] `MsbVmExecutionTarget.status` runs `msb inspect <name>`. The method returns `ready` when the `Status:` line is `running`, `stopped` for any other status, and `absent` when the command exits non-zero.
- [ ] `MsbVmExecutionTarget.status` runs `msb inspect <name>`. It returns `ready` when the `Status:` line is `running`, `stopped` for any other status, and `absent` when the command exits non-zero.
- [ ] `MsbVmExecutionTarget` has no `destroy` method.
- [ ] `runRun` with `isolation` equal to `microvm` and `sandbox` provisions `MsbVmExecutionTarget`, runs the command with `stdio` equal to `inherit`, and returns the exit code of the command.
- [ ] When the status is not `ready`, `runRun` writes `<bin> run: microVM <name> is not running — start it with \`msb start <name>\`` to stderr and returns 1.
- [ ] `runRun` in this mode runs no `msb rm`, writes no line to `microvm.jsonl`, and does not refuse because of `run.services` or `access.egress`.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/microvm-target.test.ts .agro/cli/src/__tests__/run.test.ts` exits 0.

### US-004: Document --sandbox

**Description:** As an operator, I want the public documentation and the changelog to describe `--sandbox` so that I can find the existing-sandbox mode.

**Acceptance Criteria:**

- [ ] The verb table row for `agro run` in `docs/lifecycle-commands.md` shows `[--sandbox <name>]`.
- [ ] `docs/lifecycle-commands.md` has a section that describes both `--sandbox` modes, the workspace rule, the not-running errors, and the `--image` refusal.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` → `### Added` for `--sandbox`. The entry is one sentence of 250 characters or less and links the issue.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` reports no finding in the new section.

### US-005: Capture manual review evidence

**Description:** As a reviewer, I want a command transcript from the built CLI so that I can see both modes work on a real host.

**Acceptance Criteria:**

- [ ] The worker runs `npm --prefix .agro/cli run build`, then runs every command below through `node .agro/cli/dist/agro.js` on the host.
- [ ] Before the live run, the worker runs `msb inspect agro-console`. If the command exits non-zero or the status is not `running`, the worker sets the story to blocked and runs nothing else.
- [ ] The transcript shows `node .agro/cli/dist/agro.js run --isolation microvm --sandbox agro-console -- ls /home/sandbox` with exit 0 and the listing.
- [ ] The transcript shows `node .agro/cli/dist/agro.js run --isolation microvm --sandbox agro-console -- sh -c 'exit 7'` with exit 7.
- [ ] The transcript shows `node .agro/cli/dist/agro.js run --sandbox <a new name that is not in the registry> -- true` with exit 1 and the registry error.
- [ ] The transcript shows `node .agro/cli/dist/agro.js run --sandbox agro-console --image alpine -- true` with exit 1 and the usage error.
- [ ] After the run, `msb ls` still lists `agro-console` as `running`.
- [ ] The worker writes the transcript to `.agro/tasks/run-sandbox-target/evidence/manual-review.md`. The worker creates no sandbox and deletes no sandbox.

## Summary

`agro run` always creates a disposable target. With `--isolation container`, `EphemeralExecutionTarget` runs `docker run --rm`. With `--isolation microvm`, `MicrovmExecutionTarget` runs `msb run`. After the command stops, `MicrovmExecutionTarget` runs `msb rm --force`. Both modes mount the git root of the host at the same path. No flag selects an existing sandbox. The operator must use `agro shell <name>` for an AGRO sandbox or `msb exec` for an msb microVM.

This task adds `--sandbox <name>`. The `--isolation` flag keeps its meaning: it selects the runtime. The `--sandbox` flag selects a persistent target in place of a disposable one:

- `--isolation container --sandbox <name>`: the registered AGRO sandbox `<name>`, through `resolveExecutionTarget`. The resolver returns `DockerComposeExecutionTarget` or `OpenShellExecutionTarget`.
- `--isolation microvm --sandbox <name>`: the msb microVM `<name>`, through the new `MsbVmExecutionTarget`.

The command runs as the user `sandbox` in the default working directory of the target. The run mounts no host path. The run never stops or removes the target.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/cli.ts` | `parseRunArgs`, `printRunHelp`, `run` branch near line 1430 | Flag parsing, help text, wiring to `runRun` |
| `.agro/cli/src/commands/run.ts` | `RunOptions`, `runRun`, `runMicrovm` | Mode selection and status gate |
| `.agro/cli/src/commands/lifecycle.ts` | `sandboxRoot`, `sandboxName`, `runShell` | Name to registry root and container name |
| `.agro/cli/src/lib/registry.ts` | `resolveSandboxRoot` | Registry lookup and the missing-name error |
| `.agro/cli/src/lib/execution/index.ts` | `resolveExecutionTarget`, exports | Target selection for AGRO sandboxes; export of the new target |
| `.agro/cli/src/lib/execution/microvm-target.ts` | `MicrovmExecutionTarget`, `MSB_VERSION`, `MICROVM_USER` | Home of `MsbVmExecutionTarget` and the shared msb version check |
| `.agro/cli/src/lib/execution/target.ts` | `ExecutionTarget`, `ExecRequest` | Contract that the new target implements |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro run --sandbox <name>` | New flag | Runs the command in an existing sandbox |
| `agro run --help` | Text change | Documents the flag and its rules |
| `docs/lifecycle-commands.md` | Documentation | Verb table row and a new section |
| `CHANGELOG.md` | Entry | One `### Added` line |

## Storage

N/A. The mode reads the existing AGRO registry and the msb state. The mode writes no file. The mode does not append to `microvm.jsonl`, because that log records disposable boots.

## Architectural Decisions

- `--isolation` selects the runtime, and `--sandbox` selects persistent or disposable. This keeps one meaning per flag. It also keeps the two name spaces apart: AGRO registry names for containers, msb names for microVMs.
- The command uses the workspace of the sandbox, not the host checkout. A persistent sandbox owns its own files. A bind mount into a running target is not possible.
- `--image` is a usage error with `--sandbox`, because the sandbox fixes the image.
- `run.services`, `run.env`, and `access.egress` configure disposable runs. The persistent mode does not apply them.
- The mode stays host-only. Inside a sandbox, the existing `HostOnlyError` refusal applies to every `agro run` form.
- The status gate never starts a stopped target. The error names the start command.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/run.test.ts` | `parseRunArgs --sandbox`: both forms, empty value, `--image` conflict, both isolations | US-001 |
| `.agro/cli/src/__tests__/run.test.ts` | `runRun --sandbox`: exec argv and user, exit code, not running, missing name, no network, inside-sandbox refusal | US-002 |
| `.agro/cli/src/__tests__/microvm-target.test.ts` | `MsbVmExecutionTarget`: exec argv, env flags, version check, status from `msb inspect`, no `destroy` | US-003 |
| `.agro/cli/src/__tests__/run.test.ts` | `runRun --isolation microvm --sandbox`: exec, exit code, not running, no `msb rm`, no usage log | US-003 |

Write each test first and confirm it fails before the change.

## Design Principles

- One lifecycle door: `agro` reaches every sandbox kind.
- No explanatory comments in tracked code. Names and tests carry intent.
- Reuse `resolveExecutionTarget` and the existing msb version check. Add no second resolver.
- The smallest change that makes the behavior unsurprising.

## Out of Scope

- `agro run` inside an msb guest. The `HostOnlyError` refusal stays.
- Creation, start, or stop of a sandbox from `agro run`.
- Interactive TTY sessions. `agro shell` keeps that role.
- `msb` microVMs in `agro sandbox list` or the AGRO registry.
- A host `cwd` mapping into the sandbox.

## Open Questions

None.

## Acceptance Criteria
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `agro run` without `--sandbox` keeps the current behavior. The existing tests in `run.test.ts` and `microvm-target.test.ts` pass with no change to their assertions.
- [ ] `.agro/tasks/run-sandbox-target/evidence/manual-review.md` exists and shows each US-005 command with its exit code.

## Lessons

- Claim: the live run did not exercise the two not-running messages. Evidence: `evidence/manual-review.md` runs only against the running `agro-console` VM; `run.test.ts` covers both messages with stubbed `docker inspect` and `msb inspect` output. Outcome: dropped, because a live check needs a stop of an operator VM and the unit tests pin the exact text.
- Claim: `MsbVmExecutionTarget.workspace` holds empty strings, because the mode mounts no host path and the guest workdir is not known to the CLI. Evidence: `microvm-target.ts` in commit `5c90c495`; no caller reads `workspace` for this target. Outcome: dropped, because no behavior depends on the value.
- Claim: `ste-check.sh docs/lifecycle-commands.md` reports one `PASSIVE` finding. Evidence: the finding is on the `composeOverrides[]` line, which exists on the base at line 631, outside the new section. Outcome: dropped, because the line is outside this change and is not a correctness risk.
