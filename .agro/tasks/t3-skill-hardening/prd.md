# PRD: T3 skill hardening

Status: DRAFT

## User Stories

### US-001: Clear Herdr variables from the T3 server environment

**Description:** As an operator, I want `/t3 start` to launch `t3 serve` without `HERDR_*` variables so that `herdr` runs in a T3 Code terminal.

**Acceptance Criteria:**

- [ ] A new test file `.agro/scripts/__tests__/t3-code.test.ts` runs `.agro/skills/t3/scripts/t3-code.sh start` with stub `tmux`, `npx`, `node`, and `tailscale` binaries on `PATH`.
- [ ] The test sets `HERDR_ENV`, `HERDR_PANE_ID`, `HERDR_SOCKET_PATH`, `HERDR_TAB_ID`, and `HERDR_WORKSPACE_ID` in the caller environment.
- [ ] The test fails on the current `t3-code.sh` before the fix. The worker records the red run in the story notes.
- [ ] After the fix, the stub `npx` process receives no variable whose name starts with `HERDR_`. The test asserts this result for both `start` and `start --tailscale`.
- [ ] The fix removes every variable whose name starts with `HERDR_`. The fix does not depend on a fixed list of names.
- [ ] The fix applies to the `t3 serve` launch in `start` and to the `t3 pair` command in `pair`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/t3-code.test.ts` exits 0.

### US-002: Report the tailnet pairing URL after `start --tailscale`

**Description:** As an operator, I want `/t3 start --tailscale` to print a tailnet pairing URL and a QR code. Then I pair a phone with one command.

**Acceptance Criteria:**

- [ ] In the test, the stub server prints a `http://localhost:3773/pair#token=<token>` line to the log. The stub `npx t3 pair --tailscale` prints a `https://<node>.<tailnet>.ts.net/pair#token=<token>` line.
- [ ] The test fails on the current `t3-code.sh` before the fix. The worker records the red run in the story notes.
- [ ] After the server prints its pairing URL, `start --tailscale` runs the `pair_argv` command one time.
- [ ] The `Pairing URL:` line of `start --tailscale` shows the `ts.net` URL. No `Pairing URL:` line shows a `localhost` URL in Tailscale mode.
- [ ] `start --tailscale` passes the output of `t3 pair` to the operator unchanged, so that the QR code appears.
- [ ] `start` without `--tailscale` keeps the current behavior. The test asserts that `start` prints the `localhost` URL and does not run `t3 pair`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/t3-code.test.ts` exits 0.

### US-003: Document the QR command, the rename cleanup, and the Herdr rule

**Description:** As an operator, I want the T3 references to name the QR pairing command and the rename cleanup. Then I recover without help.

**Acceptance Criteria:**

- [ ] `.agro/skills/t3/references/sandbox-processes.md` states that a headless tmux launch from a Herdr pane must remove every `HERDR_*` variable, and gives the reason.
- [ ] `.agro/skills/t3/references/tailscale-mobile.md` and `docs/connecting.md` show `npx --yes t3 pair --tailscale --label <device> --ttl 15m` as the command that prints a QR code in another terminal.
- [ ] `.agro/skills/t3/references/tailscale-mobile.md` and `docs/connecting.md` state that a Tailscale node rename leaves the Serve mapping on the old name, and give `tailscale serve reset` as the cleanup.
- [ ] `.agro/skills/t3/SKILL.md` states that `start --tailscale` prints the tailnet pairing URL and the QR code.
- [ ] `CHANGELOG.md` has one entry under the unreleased section for US-001 and US-002.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file, or each remaining finding exists on the base branch too.

### US-004: Record the manual review evidence

**Description:** As the advisor, I want a command transcript of the changed script so that the pull request shows the behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/t3-skill-hardening/evidence/manual-review.md` holds the output of `bash .agro/skills/t3/scripts/t3-code.sh help` and the full output of `pnpm vitest run .agro/scripts/__tests__/t3-code.test.ts`.
- [ ] The transcript holds no real pairing token. Each token shows as `<token>`.
- [ ] The story does not stop or restart the live `agent-t3code` or `agent-tailscaled` tmux sessions.

## Summary

The operator paired a phone with T3 Code over Tailscale. The session found two defects and two documentation gaps.

Defect 1: `.agro/skills/t3/scripts/t3-code.sh` starts the server with `tmux new-session`. If an agent runs the script from a Herdr pane, the tmux server and the `t3 serve` process inherit the `HERDR_*` variables. Each T3 Code terminal then inherits the variables too. `herdr` in that terminal exits with the message `nested herdr is disabled by default`.

Defect 2: in Tailscale mode, `t3 serve` prints a `localhost` pairing URL. The `start` loop accepts the first URL that `pairing_url` finds. The phone cannot use that URL. The operator ran `t3 pair --tailscale` as a second command to get the `ts.net` URL.

Gap 1: no reference names the command that prints a fresh QR code in another terminal. Gap 2: a rename of the Tailscale node left a Serve mapping on the old MagicDNS name.

The approach removes `HERDR_*` variables inside the launch command, mints the tailnet URL at the end of `start --tailscale`, and adds the two documentation entries.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/t3/scripts/t3-code.sh` | `start` case, `tmux new-session` line | Launches `t3 serve`; receives the variable cleanup |
| `.agro/skills/t3/scripts/t3-code.sh` | `pair` case, `pair_argv` | Mints a pairing URL; runs at the end of `start --tailscale` |
| `.agro/skills/t3/scripts/t3-code.sh` | `pairing_url`, `print_summary` | Select and print the pairing URL |
| `.agro/skills/t3/references/sandbox-processes.md` | tmux convention | Holds the Herdr variable rule |
| `.agro/skills/t3/references/tailscale-mobile.md` | "Start the server and pair the phone" | Holds the QR command and the rename cleanup |
| `docs/connecting.md` | "Mobile access over Tailscale" | Public copy of the recipe |
| `.agro/skills/t3/SKILL.md` | Run table, Report section | States the `start --tailscale` output |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/t3 start --tailscale` | Behavior | Prints the `ts.net` pairing URL and the QR code |
| `/t3 start`, `/t3 pair` | Behavior | The child process gets no `HERDR_*` variable |
| `docs/connecting.md` | Documentation | Adds the QR command and the rename cleanup |

## Storage

N/A. The change stores no new state. T3 Code and Tailscale keep their current state locations.

## Architectural Decisions

- `t3-code.sh` stays the single owner of the T3 launch commands.
- The launch command removes the `HERDR_*` variables itself. A fix inside the command works when the tmux server already holds the variables in its global environment.
- The script reuses `pair_argv` for the tailnet URL. The script adds no second pairing path.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/t3-code.test.ts` | `start` and `start --tailscale` with `HERDR_*` set | US-001 |
| `.agro/scripts/__tests__/t3-code.test.ts` | `start --tailscale` prints the `ts.net` URL and runs `t3 pair` one time | US-002 |
| `.agro/scripts/__tests__/t3-code.test.ts` | `start` without `--tailscale` prints the `localhost` URL and does not run `t3 pair` | US-002 |

Each test uses stub binaries in a temporary directory. No test starts a real `t3`, `tmux`, or `tailscaled` process.

## Design Principles

- Follow the AGRO rule: no explanatory comments in tracked code.
- Make the smallest change in `t3-code.sh`. Keep the action names and the flags.
- Write the prose to `/ste` rules.

## Out of Scope

- The same Herdr variable leak in `.agro/skills/cloudflared/scripts/run.sh` and in other tmux launchers. The reference rule in US-003 covers them. A code fix for them needs a separate task.
- A start of `tailscaled` or `tailscale up` from `/t3`.
- A `/t3 doctor` probe of the `ts.net` URL. The sandbox cannot resolve MagicDNS names in userspace mode.

## Open Questions

None

## Acceptance Criteria

- [ ] Each story US-001 to US-004 passes its acceptance criteria.
- [ ] `pnpm vitest run` exits 0 in the worktree.
- [ ] No change touches the live `agent-t3code` or `agent-tailscaled` tmux sessions.

## Lessons

Filled by the advisor before undraft.
