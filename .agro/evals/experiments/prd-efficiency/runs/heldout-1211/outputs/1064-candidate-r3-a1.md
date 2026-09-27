# PRD: Supervisor observes through MonitorCreate and receives no reverse messages

Status: BLOCKED

## User Stories

### US-001: Observe advisors with bounded MonitorCreate commands

**Description:** As a supervisor, I want each observation and readiness wait to run as a bounded `MonitorCreate` command. Each wait then survives in the runtime and ends with a completion callback.

**Acceptance Criteria:**

- [ ] Duty 1 in `.agro/skills/supervisor/SKILL.md` runs the readiness wait `herdr agent wait <pane> --status idle --timeout 90000` inside a `MonitorCreate` command with an `onDone` callback.
- [ ] Duty 3 in `.agro/skills/supervisor/SKILL.md` runs the observation wait `herdr agent wait <pane> --status idle --timeout 900000` inside a `MonitorCreate` command with an `onDone` callback.
- [ ] Each `MonitorCreate` command in the skill carries an explicit `--timeout` value, and no command in the skill uses an unbounded `while` loop or `sleep` loop.
- [ ] The skill states one recovery rule for each monitor outcome: timeout, non-zero exit, and Herdr server unavailable.
- [ ] The skill prohibits `LoopCreate` for supervisor observation, and `grep -n 'LoopCreate' .agro/skills/supervisor/SKILL.md` prints only that prohibition.

### US-002: Keep the Herdr channel one-way from supervisor to advisor

**Description:** As an operator, I want the supervisor to steer down and receive no Herdr messages from an advisor or a worker. No instruction then reaches a pane through an unguarded route.

**Acceptance Criteria:**

- [ ] The skill prohibits `herdr agent send` and `herdr pane send-keys` from an advisor or a worker to the supervisor pane.
- [ ] The skill states that the advisor reports progress through its pane output and through `progress.txt`, `evidence.md`, `prd.json`, and the commit log.
- [ ] The Duty 1 `herdr tab create` command carries no `--env AGRO_SUPERVISOR_PANE=<pane>` argument.
- [ ] The Duty 1 harness launch command is `env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions`, so the advisor inherits no supervisor destination.
- [ ] The two-step downward send and the `Message @` guard from failure mode 8 stay in the skill without change.
- [ ] Duty 5 states that the supervisor reads advisor blockers from the pane and the artifacts, and that the supervisor runs `/escalate` to reach the operator.
- [ ] `.agro/skills/escalate/SKILL.md` no longer tells a supervisor to start an advisor with `--env AGRO_SUPERVISOR_PANE=<pane>`.

### US-003: Guard the contract with a regression probe

**Description:** As a maintainer, I want one deterministic probe to guard the monitor contract and the one-way channel. A later edit then cannot restore polling loops or reverse messages without a red probe.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-monitor-contract.sh` exists, is executable, and carries the `# tier: A`, `# source:`, and `# desc:` headers.
- [ ] The probe exits 0 against the changed skills.
- [ ] The probe exits 1 when a copy of the skill restores `--env AGRO_SUPERVISOR_PANE=` in the tab command.
- [ ] The probe exits 1 when a copy of the skill drops the `MonitorCreate` readiness wait.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` exit 0.

## Summary

The supervisor skill at `.agro/skills/supervisor/SKILL.md` runs two blocking waits in the attached turn. Duty 1 waits with `herdr agent wait w7:p4 --status idle --timeout 90000` at line 95. Duty 3 waits with `herdr agent wait w6:p7 --status idle --timeout 900000` at line 197. The skill names no `MonitorCreate` and no `LoopCreate`.

Duty 1 creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1` at lines 69 and 70. `/escalate` reads that variable and sends text into the supervisor pane with `herdr agent send` and `herdr pane send-keys`. The escalate script is `.agro/skills/escalate/scripts/escalate.sh`, and the default sits at line 67. That route is a reverse Herdr message from an advisor. A worker process under the advisor inherits the same variable.

`.agro/skills/fanout/SKILL.md` lines 119 to 129 already prefer `MonitorCreate` with `onDone` over recurring `LoopCreate` polling. `docs/harnesses/pi.md` lines 74 to 92 document `MonitorCreate`, `MonitorList`, `MonitorStop`, and `LoopCreate`.

The selected approach edits two canonical skill documents and adds one probe. The supervisor wraps each wait in `MonitorCreate`. The launch command clears `AGRO_SUPERVISOR_PANE`. The supervisor keeps the downward two-step send and the only route to the operator through `/escalate`. The escalate script stays unchanged. When no supervisor target resolves, the script skips the supervisor destination and delivers to Slack.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, lines 60 to 96 | Tab creation, harness launch, readiness wait |
| `.agro/skills/supervisor/SKILL.md` | Duty 3, lines 189 to 222 | Observation commands and artifact signals |
| `.agro/skills/supervisor/SKILL.md` | Duty 5, lines 258 to 279 | Escalation route to the operator |
| `.agro/skills/supervisor/SKILL.md` | Failure mode 8, lines 350 to 360 | Guard for the downward send |
| `.agro/skills/escalate/SKILL.md` | Destinations, lines 50 to 75 | Supervisor destination and `AGRO_SUPERVISOR_PANE` launch example |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` default, line 67 | Skips the supervisor destination when the variable is unset |
| `.agro/skills/fanout/SKILL.md` | Section 6, lines 119 to 129 | Existing `MonitorCreate` convention to follow |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | line 76 | Requires `AGRO_SUPERVISOR_PANE` in the escalate script |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill | Modify | Adds `MonitorCreate` waits, recovery rules, the `LoopCreate` prohibition, and the one-way channel rule |
| `/escalate` skill document | Modify | Removes the advisor launch example that sets `AGRO_SUPERVISOR_PANE` |
| `/escalate` script | None | Keeps the `--supervisor` flag and the `AGRO_SUPERVISOR_PANE` default |
| Eval probe suite | Add | Adds `supervisor-monitor-contract.sh` |
| `mifunedev/agro-web` | N/A | The change touches no public command or term |

## Storage

N/A. The change edits skill documents and adds one stateless probe.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` owns the observation contract. `/herdr` owns the pane command catalog. `/escalate` owns the operator channel.
- The Herdr channel runs one way. The supervisor steers the advisor. The advisor reports through pane output and task artifacts.
- The launch command clears `AGRO_SUPERVISOR_PANE` with `env -u`. The shell performs the clear, so the clear holds for every child process.
- The supervisor alone runs `/escalate` for an advisor blocker.
- The runtime owns each monitor. A monitor ends at its `--timeout` value and wakes the supervisor through `onDone`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-contract.sh` | `MonitorCreate` wraps both `herdr agent wait` commands | US-001 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | `LoopCreate` appears only in the prohibition line | US-001 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | No `--env AGRO_SUPERVISOR_PANE=` in the supervisor skill or the escalate skill | US-002 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | The launch command contains `env -u AGRO_SUPERVISOR_PANE` | US-002 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | The `Message @` guard stays present | US-002 |
| `.agro/evals/probes/escalate-contract.sh` | Existing cases | Operator escalation stays intact |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing cases | Supervisor destination stays optional |
| `.agro/skills/ste/scripts/ste-check.sh` | Run on both changed skill documents | Prose passes STE |
| `.agro/scripts/link-providers.sh --check` | Provider links | Provider mirrors resolve to `.agro/skills/` |
| `<command check>` | Commands in the changed skills | Each cited command exists; see Open Questions |

Write the probe first. The probe exits 1 against the current skill. The probe exits 0 after US-001 and US-002 land.

## Design Principles

- Edit the canonical `.agro/skills/` source. Do not edit a provider mirror.
- Add no explanatory comment to tracked code.
- Keep one source of truth. Point at `/herdr`, `/escalate`, and `/fanout` rather than restating their rules.
- Bound every wait. Name the recovery rule for every monitor outcome.
- Keep the change to two documents and one probe.

## Out of Scope

- The unrelated concurrent failure-mode addition. Keep the failure-mode list at eight entries.
- Changes to `.agro/skills/escalate/scripts/escalate.sh`.
- Changes to `/herdr`, `/fanout`, `/delegate`, or `/spec`.
- A new Herdr transport or a new gateway.

## Open Questions

1. The issue names "command checks". The repository holds no single command-check script that this plan can cite. Name the command for `<command check>`.
2. The plan assumes that the supervisor harness exposes `MonitorCreate` through `@trevonistrevon/pi-loop` or a provider equivalent. Confirm the `MonitorCreate` name for Claude Code and Codex, or confirm that the skill names `MonitorCreate` alone.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `<command check>` exits 0.
- [ ] `git diff --stat` lists only the two skill documents and the new probe.

## Lessons

Filled by the advisor before undraft.
