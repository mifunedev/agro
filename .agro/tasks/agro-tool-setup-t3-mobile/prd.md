# PRD: agro tool setup t3-mobile

Status: DRAFT

## User Stories

### US-001: Parse and dispatch `agro tool setup t3-mobile <action>`

**Description:** As an operator, I want `agro tool setup t3-mobile <action>` to be a known command with help and clear errors. I can then discover the verb and get a clear error for a wrong action.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/command-table.ts` gives `tool` its own verb list, `TOOL_SUBCOMMANDS`, with `setup` added. `harness` keeps `INSTALLER_SUBCOMMANDS` unchanged.
- [ ] `agro tool setup t3-mobile enable|pair|disable|status` reaches one handler in a new `.agro/cli/src/commands/t3-mobile.ts`.
- [ ] `agro tool setup` with no target, an unknown target, or an unknown action prints usage to stderr and exits 2.
- [ ] `agro tool setup t3-mobile --help` prints the four actions with one line each and exits 0.
- [ ] `agro tool --help` lists `setup t3-mobile <enable|pair|disable|status>`.
- [ ] Tests in `.agro/cli/src/__tests__/t3-mobile.test.ts` cover each parse case. The tests fail before the change and pass after the change.

### US-002: Start the userspace Tailscale daemon where the verb runs

**Description:** As a node owner, I want `enable` to install Tailscale and start one userspace daemon on this machine. The plain `tailscale` CLI then works with no `--socket` flag.

**Acceptance Criteria:**

- [ ] The verb acts on the machine where it runs. The verb never uses `docker exec` and never targets another container.
- [ ] If `tailscale` is not on `PATH`, `enable` runs the `tailscale` catalog install argv from `.agro/cli/src/lib/tools/catalog.ts` on this machine.
- [ ] If `/run/systemd/system` exists, `enable` writes `/etc/systemd/system/agro-tailscaled.service` through `sudo -n`, runs `sudo -n systemctl daemon-reload`, and runs `sudo -n systemctl enable --now agro-tailscaled.service`.
- [ ] The unit text equals the console unit in `mifunedev/agro-console` `packages/shared/src/tailscaled-assets.ts`:
  - `--tun=userspace-networking --statedir=<home>/.tailscale`
  - `RuntimeDirectory=tailscale`
  - `RuntimeDirectoryMode=0755`
  - `Conflicts=tailscaled.service`
  - `User=` and `Group=` set to the invoking user
- [ ] If `/run/systemd/system` does not exist, `enable` starts `tailscaled --tun=userspace-networking --statedir=$HOME/.tailscale` in the detached tmux session `agent-tailscaled`.
- [ ] If the unit file already has the same text, `enable` does not write the file again. If the daemon already answers `tailscale status`, `enable` does not start a second daemon.
- [ ] Tests with an injected runner cover the systemd path, the tmux path, the missing-binary install, and the second run with no change.

### US-003: Connect, publish, pair, disable, and report status

**Description:** As a node owner, I want `enable`, `pair`, `disable`, and `status` to call the upstream `tailscale` and `t3` commands. I then pair my phone with one command and manage access later.

**Acceptance Criteria:**

- [ ] After US-002, `enable` runs these commands in order and stops at the first nonzero exit status:
  1. `tailscale up`, which prints the login URL;
  2. `tailscale serve --bg --https=443 http://127.0.0.1:3773`;
  3. the pair command.
- [ ] The pair command is `t3 pair --tailscale` when `t3` is on `PATH`. Otherwise the pair command is `npx --yes t3@latest pair --tailscale`.
- [ ] `pair` runs the pair command only.
- [ ] `disable` runs `tailscale serve --https=443 off`.
- [ ] `status` runs `tailscale status` and then `tailscale serve status`.
- [ ] Each action passes stdin, stdout, and stderr of the upstream command through. The verb exits with the exit status of the first command that fails, or 0.
- [ ] The verb has no `update` action, and the verb parses no upstream output.
- [ ] Tests with an injected runner assert the argv order, the stop at the first failure, the exit status passthrough, and the pair-command choice.

### US-004: Make `/t3` use the verb

**Description:** As a sandbox agent, I want `/t3` to use `agro tool setup t3-mobile` for phone access. The harness and the console then share one procedure.

**Acceptance Criteria:**

- [ ] `.agro/skills/t3/scripts/t3-code.sh` has no `--tailscale` and no `--tailscale-port` option. `/t3 start` serves on `127.0.0.1:3773` only.
- [ ] `.agro/skills/t3/SKILL.md` tells the agent to run `/t3 start`, then `agro tool setup t3-mobile enable` for phone access.
- [ ] `.agro/skills/t3/references/tailscale-mobile.md` lists the four verb actions and keeps the `tailscale serve reset` rename note.
- [ ] `.agro/scripts/__tests__/t3-code.test.ts` passes, with the Tailscale flag cases removed.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/t3/SKILL.md .agro/skills/t3/references/tailscale-mobile.md` reports no finding on a changed line.

### US-005: Document the verb

**Description:** As an operator, I want the docs to describe the verb. I can then find the command without reading the source.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` has a row for `agro tool setup t3-mobile` with its four actions.
- [ ] `docs/harnesses/t3code.md` and `docs/connecting.md` show `agro tool setup t3-mobile enable` for phone access, in place of the raw `tailscale` and `t3 pair --tailscale` chain.
- [ ] `CHANGELOG.md` has one Unreleased entry that references #1540.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md docs/harnesses/t3code.md docs/connecting.md` reports no finding on a changed line.

### US-006: Capture manual review evidence in the sandbox

**Description:** As the advisor, I want a transcript of the verb in this sandbox. The PR then proves the tmux path and the action order.

**Acceptance Criteria:**

- [ ] With operator approval, the reviewer runs the built CLI in the sandbox: `agro tool setup t3-mobile enable`. The operator completes the `tailscale up` login, and the operator pairs one phone.
- [ ] `.agro/tasks/agro-tool-setup-t3-mobile/evidence/manual-review.md` shows the output of `enable`, `status`, a second `enable` with no change, `pair`, and `disable`.
- [ ] The transcript shows `tmux has-session -t agent-tailscaled` exit 0 after `enable`.
- [ ] The reviewer runs `tailscale logout` and kills the `agent-tailscaled` session at the end, and the transcript records both.

## Summary

mifunedev/agro-console#603 removed the console `agro-t3-mobile` helper. The Connect dialog now lists raw upstream commands. Console cloud-init writes `agro-tailscaled.service`. The harness `/t3` skill starts its own tmux daemon and uses `t3 serve --tailscale-serve`. That gives three copies of one procedure.

This plan adds one thin verb to the AGRO CLI, the lifecycle door. The verb acts on the machine where the operator runs the verb: on a console node over systemd, or in the sandbox over tmux. Each action calls upstream `tailscale` and `t3` and passes the upstream output through. The verb has no custom exit codes and no output parsing. The removed helper had both faults.

Verified current state:

- `agro tool` shares `INSTALLER_SUBCOMMANDS` (`list`, `install`, `status`, `uninstall`) with `agro harness` (`.agro/cli/src/command-table.ts:9`).
- `parseInstallerArgs` in `.agro/cli/src/cli.ts:983` parses both nouns. `cli.ts:1367` dispatches both nouns.
- The `tailscale` catalog entry installs pinned `tailscale` and `tailscaled` binaries into `${NPM_USER_PREFIX:-$HOME/.local}/bin` and starts no daemon (`.agro/cli/src/lib/tools/catalog.ts:257`).
- `t3-code.sh` has `--tailscale` and `--tailscale-port` flags and a tmux session `agent-tailscaled` hint (`.agro/skills/t3/scripts/t3-code.sh:23`, `:34`, `:107`).

Affected surfaces:

- **Host and sandbox:** applied. The verb runs on the machine where it is invoked.
- **Lifecycle door:** applied. The change adds `agro tool setup`.
- **Canonical and provider surfaces:** applied. The `/t3` skill is under `.agro/skills/`.
- **Root and scaffold:** applied to the root. It does not apply to scaffold.
- **Interactive and headless processes:** applied. `tailscaled` runs in the named tmux session `agent-tailscaled` or as a systemd unit.
- **Local and remote:** applied. Both runtimes survive a terminal disconnect.
- **Parallel operation:** not applicable. One daemon serves one machine.
- **Public documentation:** applied in US-005.
- **Verification:** applied in the Test Plan and in US-006.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/command-table.ts` | `INSTALLER_SUBCOMMANDS`, `AGRO_COMMANDS.tool` | Verb list for `agro tool` |
| `.agro/cli/src/cli.ts` | `parseInstallerArgs`, the `first === "tool"` dispatch, `printToolHelp` | Parse and route `setup` |
| `.agro/cli/src/commands/t3-mobile.ts` | new handler for `enable`, `pair`, `disable`, `status` | Verb behavior |
| `.agro/cli/src/lib/tools/catalog.ts` | the `tailscale` entry `installArgv` | Install when the binary is missing |
| `.agro/cli/src/lib/execution/runner.ts` | `spawnRunner`, `LifecycleRunner` | Injected runner for tests |
| `.agro/skills/t3/scripts/t3-code.sh` | `serve_argv`, `pair_argv`, `--tailscale` parsing | Remove the Tailscale path |
| `.agro/skills/t3/SKILL.md`, `references/tailscale-mobile.md` | command table | Point to the verb |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool setup t3-mobile enable` | Added | Installs Tailscale if missing, starts the daemon, then runs `tailscale up`, `tailscale serve`, and the pair command |
| `agro tool setup t3-mobile pair` | Added | Runs the pair command |
| `agro tool setup t3-mobile disable` | Added | Removes the Serve mapping |
| `agro tool setup t3-mobile status` | Added | Prints `tailscale status` and `tailscale serve status` |
| `/t3 start --tailscale`, `/t3 pair --tailscale` | Removed | The verb replaces both flags |

## Storage

The verb keeps no state of its own. Tailscale state stays in `$HOME/.tailscale` with mode `0700`. The tailnet and the Serve mapping hold the rest.

## Architectural Decisions

- **Execution location.** The verb acts on the current machine. It does not use the container target that `agro tool install` uses.
- **Daemon runtime.** The verb detects systemd with `/run/systemd/system`. The sandbox keeps compose init as PID 1, so the sandbox takes the tmux path.
- **One unit definition.** The verb writes the same unit text as console cloud-init. The agro-console follow-up deletes the cloud-init copy after an AGRO release ships the verb.
- **Pair command.** The verb prefers `t3` on `PATH`, which nodes have, and falls back to `npx --yes t3@latest`, which the sandbox uses.
- **Branch base.** This work depends on mifunedev/agro#1539, which changes the same `/t3` files to `t3@latest`. The task branch starts from `development` after #1539 merges.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/t3-mobile.test.ts` | parse: valid actions, no target, unknown target, unknown action, help | US-001 |
| `.agro/cli/src/__tests__/t3-mobile.test.ts` | systemd path, tmux path, missing binary, second run with no change | US-002 |
| `.agro/cli/src/__tests__/t3-mobile.test.ts` | argv order, stop at first failure, exit status passthrough, pair-command choice | US-003 |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | `agro tool --help` lists `setup` | US-001 |
| `.agro/scripts/__tests__/t3-code.test.ts` | no Tailscale flag cases | US-004 |

Run `npm test`, `pnpm run typecheck`, and `pnpm run build:harness` at the repository root.

## Design Principles

- The verb is a thin wrapper. It passes the upstream behavior through. The verb defines no exit codes and parses no output.
- The verb keeps one source of truth for the unit text and the action order.
- The verb puts every persistent process in a named tmux session or a systemd unit, never in an attached shell.
- The change deletes the obsolete `/t3` Tailscale flags. The change keeps no dormant path.
- The tracked code carries no explanatory comments.

## Out of Scope

- The agro-console follow-up: remove `buildTailscaledUnit` from cloud-init, and reduce the Connect dialog to `agro tool setup t3-mobile enable`.
- An `update` action. Users run `t3 update`.
- Other `setup` targets, such as `rdp`.
- `agro tool setup` through the container target from the host.

## Open Questions

None. Issue #1540 holds the operator decisions.

## Acceptance Criteria

- [ ] `agro tool setup t3-mobile enable` pairs a T3 Code phone app in the sandbox (US-006).
- [ ] `npm test`, `pnpm run typecheck`, and `pnpm run build:harness` exit 0 at the repository root.
- [ ] `git grep -n "tailscale-serve\|--tailscale-port" -- .agro/skills/t3` prints no match.

## Lessons

1. **The AGRO sandbox runs systemd without passwordless sudo.** Evidence: the US-006 live run found `/run/systemd/system` present and `sudo -n` failing. Outcome: fixed in this PR. US-002 round 1 added the `sudo -n true` probe.
2. **The systemd unit could name a missing `tailscaled` binary.** Evidence: the review found a unit with `<binDir>/tailscaled` on a host with the binary elsewhere on `PATH`. Outcome: fixed in this PR. The `enable` action resolves the binary once and exits 1 early when the binary is missing.
3. **`t3 pair` depends on the current directory.** Evidence: in a linked git worktree, `t3 pair` reported `NoRunningServerError`. Outcome: dropped, because the behavior comes from upstream. The docs now say where to run the verb.
4. **The console still writes its own unit and lists raw commands.** Evidence: agro-console `tailscaled-assets.ts` and `T3_MOBILE_STEPS`. Outcome: dropped from this PR. The console change needs an AGRO release with this verb and an `agroVersion` bump. The operator decides after the release.
