# PRD: Supervisor monitor observation

Status: DRAFT

Source: `work/issue-1064.md` (issue #1064).

## User Stories

### US-001: Add the supervisor observation probe

**Description:** As the operator, I want a probe for supervisor observation so that a polling loop or an upward message fails the probe.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-observation-contract.sh` exists and is executable.
- [ ] The probe exits 1 against the current `.agro/skills/supervisor/SKILL.md` at commit `3e98ddc`.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` names no `MonitorCreate` call.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` names `LoopCreate` outside a prohibition line.
- [ ] The probe fails when the `herdr tab create` example in `.agro/skills/supervisor/SKILL.md` sets `AGRO_SUPERVISOR_PANE` to a pane id.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` drops the `grep -c 'Message @'` check before a downward send.
- [ ] The probe fails when `.agro/skills/escalate/SKILL.md` tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] The probe prints one `PASS:` line and exits 0 after US-002 and US-003 land.

### US-002: Require MonitorCreate for observation and readiness waits

**Description:** As a supervisor, I want each wait to run as a bounded `MonitorCreate` call so that no polling loop runs.

**Acceptance Criteria:**

- [ ] Duty 1 runs the harness readiness wait as `MonitorCreate` with the command `herdr agent wait <pane> --status idle --timeout 90000` and an `onDone` callback.
- [ ] Duty 3 runs the advisor observation wait as `MonitorCreate` with a `herdr agent wait` command that carries an explicit `--timeout` value and an `onDone` callback.
- [ ] Each `onDone` callback names the reads that follow: `herdr agent list`, the status-line context percentage, and `herdr pane read <pane> --source recent --lines 120`.
- [ ] Duty 3 states a recovery rule for each of three outcomes: the wait timed out, the `herdr` command exited with an error, and the pane no longer exists.
- [ ] Duty 3 caps each advisor at one active monitor.
- [ ] The skill prohibits `LoopCreate`, `/loop`, and shell `sleep` loops for supervisor observation.
- [ ] Duty 3 states that the advisor reports progress through its pane output and through `progress.txt`, `evidence.md`, `prd.json`, and the commit log.

### US-003: Prohibit upward Herdr messages and clear inherited supervisor destinations

**Description:** As a supervisor, I want advisors and workers to send no upward Herdr message so that Herdr traffic flows one way.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example passes `--env AGRO_SUPERVISOR_PANE=` with an empty value.
- [ ] Duty 1 states that the empty value clears a destination that the advisor inherits from the supervisor environment.
- [ ] The brief template adds a step: the advisor and its workers send no `herdr agent send`, no `herdr pane run`, and no `/escalate --supervisor` to any pane.
- [ ] Duty 2 keeps the two-step downward send and the `grep -c 'Message @'` check before every send.
- [ ] Duty 5 states that the supervisor reads blockers from pane output and artifacts, and that only the supervisor runs `/escalate` to reach the operator.
- [ ] `.agro/skills/escalate/SKILL.md` no longer shows `herdr agent start <name> --cwd <harness root> --env AGRO_SUPERVISOR_PANE=<pane>` as the supervisor launch pattern.
- [ ] `.agro/skills/escalate/scripts/escalate.sh` is unchanged.
- [ ] `CHANGELOG.md` under `## [Unreleased]` carries one `### Changed` entry for issue #1064.

## Summary

Verified current state at commit `3e98ddc`:

- `.agro/skills/supervisor/SKILL.md` Duty 1 creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. The advisor then inherits an upward Herdr destination.
- Duty 1 and Duty 3 call `herdr agent wait` directly in the supervisor shell. No `MonitorCreate` call and no recovery rule exist.
- Duty 5 states that an advisor escalation arrives at the supervisor first. That route is an upward Herdr message.
- `.agro/skills/escalate/SKILL.md:73` tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- `.agro/skills/escalate/scripts/escalate.sh:67` reads `${AGRO_SUPERVISOR_PANE:-}`. An empty value skips the supervisor destination.
- `.agro/skills/fanout/SKILL.md:121-131` already prefers `MonitorCreate` over `LoopCreate` polling for a Pi supervisor.
- `docs/harnesses/pi.md:74-95` documents `MonitorCreate`, `onDone`, and `LoopCreate`.
- No probe reads `.agro/skills/supervisor/SKILL.md`.
- `herdr` is version 0.7.4 in the sandbox.

Selected approach: the supervisor observes. The advisor reports through output and artifacts. Herdr traffic flows one way, from the supervisor down to the advisor. The supervisor alone reaches the operator through `/escalate`. The escalate script keeps its supervisor destination for callers outside a supervisor-owned advisor tree.

Affected surfaces:

| Surface | Mark |
|---|---|
| Host and sandbox | Applied. Every edit runs in the sandbox at the harness root. |
| Lifecycle door | Not applicable. No `agro` verb changes. |
| Canonical and provider surfaces | Applied. Edits land in `.agro/skills/`. `link-providers.sh --check` proves the mirrors. |
| Root and scaffold | Applied to the harness root. Initialized projects receive the skill through the existing scaffold. |
| Interactive and headless processes | Applied. Monitors run inside the supervisor session in Herdr. |
| Local and remote operation | Applied. Artifacts on disk survive a terminal disconnect. |
| Parallel operation | Applied. One monitor per advisor. Advisors keep separate worktrees. |
| Public documentation | Open. See Open Questions. |
| Verification | Applied. See Test Plan. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, Duty 2, Duty 3, Duty 5, Failure modes | Canonical supervisor contract |
| `.agro/skills/escalate/SKILL.md` | Destinations section, `herdr agent start` example | Escalation contract |
| `.agro/skills/escalate/scripts/escalate.sh` | `AGRO_SUPERVISOR_PANE` resolution | Unchanged. The empty-value behavior clears the destination. |
| `.agro/evals/probes/supervisor-observation-contract.sh` | New probe | Guards the new contract |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing probe | Must stay green |
| `.agro/evals/probes/escalate-contract.sh` | Existing probe | Must stay green |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill body | Modified | `MonitorCreate` waits, recovery rules, one-way Herdr traffic |
| `/escalate` skill body | Modified | Removes the supervisor-sets-destination launch example |
| `herdr tab create` example | Modified | `--env AGRO_SUPERVISOR_PANE=` with an empty value |
| Probe suite | Added | `supervisor-observation-contract.sh` |

## Storage

N/A. The change edits skill prose and adds one stateless probe. The advisor artifacts `progress.txt`, `evidence.md`, and `prd.json` keep their current location under `.agro/tasks/<slug>/`.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the one source of truth for supervisor observation. `/herdr` keeps the command catalog. `/escalate` keeps the operator channel.
- The supervisor owns observation state: one `MonitorCreate` per advisor. The advisor owns no channel to the supervisor.
- Herdr traffic flows downward only. The `Message @` guard from failure mode 8 stays in force for every downward send.
- The supervisor clears `AGRO_SUPERVISOR_PANE` with an empty value at tab creation. The escalate script already treats an empty value as unset, so no script change follows.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-observation-contract.sh` | Red against commit `3e98ddc`; green after US-002 and US-003 | US-001 through US-003 |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing cases | The escalate script keeps its supervisor destination |
| `.agro/evals/probes/escalate-contract.sh` | Existing cases | The escalate JSON contract |
| `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` | Exit 0 | STE prose |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 | Provider links |
| `herdr agent wait --help`, `herdr tab create --help` | Each flag in the skill appears in the help text | Command checks |
| `git diff --check` | Exit 0 | Whitespace |

## Design Principles

- Observe; do not poll. A bounded monitor with a completion callback replaces each wait loop.
- One direction of Herdr traffic. The supervisor steers down. The advisor reports through files.
- Artifacts over messages. A file on disk needs no message.
- One owner per rule. Restate no `/herdr`, `/escalate`, or `/delegate` rule.
- No explanatory comments in the probe. Name each check through its failure message.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`. This task adds no failure-mode entry for that change and does not rebase over that change.
- Any edit to `.agro/skills/escalate/scripts/escalate.sh`.
- Any edit to `.agro/skills/fanout/SKILL.md` or `docs/harnesses/pi.md`.
- Scheduling that the operator requests explicitly through `/loop` or `LoopCreate`.
- Worker-level Herdr policy inside `/delegate`.

## Open Questions

1. Does the supervisor harness always expose `MonitorCreate`? Claude Code exposes a `Monitor` tool, and Pi exposes `MonitorCreate` through `@trevonistrevon/pi-loop`. Default: name `MonitorCreate` as the issue states, and add no per-harness mapping.
2. Which exit code does `herdr agent wait` return on a timeout? The recovery rule needs `<herdr agent wait timeout exit code>`. The implementation owner reads the value from Herdr 0.7.4 before writing the rule.
3. Does the supervisor destination in `escalate.sh` stay for callers outside a supervisor-owned advisor tree? Default: keep the destination, because `escalate-destination-fan-out.sh` requires the variable in the script.
4. Does `mifunedev/agro-web` document the supervisor launch pattern? If yes, the page needs a matching change.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/supervisor-observation-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `grep -n 'LoopCreate' .agro/skills/supervisor/SKILL.md` matches only prohibition lines.
- [ ] The diff touches no failure-mode entry that the concurrent change adds.

## Lessons

Filled by the advisor before undraft.
