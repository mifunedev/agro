# PRD: Supervisor monitor-only observation

Status: BLOCKED

## User Stories

### US-001: Observe advisors through bounded monitors

**Description:** As a supervisor, I want each wait to run as a bounded `MonitorCreate` command so that no recurring loop keeps supervision alive. Each monitor sets a completion callback.

**Acceptance Criteria:**

- [ ] Duty 1 of `.agro/skills/supervisor/SKILL.md` wraps the readiness wait `herdr agent wait <pane> --status idle --timeout 90000` in one `MonitorCreate` call that sets `command`, `description`, and `onDone`.
- [ ] Duty 3 of `.agro/skills/supervisor/SKILL.md` wraps the progress wait `herdr agent wait <pane> --status idle --timeout 900000` in one `MonitorCreate` call that sets `command`, `description`, and `onDone`.
- [ ] Each `MonitorCreate` command in `.agro/skills/supervisor/SKILL.md` carries an explicit `--timeout` value.
- [ ] Duty 3 states the recovery rules for three outcomes: the wait exits 0, the wait times out, and the supervisor session restarts or compacts with a monitor still open.
- [ ] The restart rule tells the supervisor to run `MonitorList`, to arm one monitor for each owned advisor that has no monitor, and to run `MonitorStop` for each monitor whose advisor tab is closed.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits `LoopCreate`, `/loop`, and shell `while`/`sleep` polling for supervision.
- [ ] `grep -c 'LoopCreate' .agro/skills/supervisor/SKILL.md` counts only lines that prohibit `LoopCreate`.

### US-002: Remove reverse Herdr messages from advisors and workers

**Description:** As a supervisor, I want advisors and workers to report through pane output and task artifacts so that no message enters the supervisor pane.

**Acceptance Criteria:**

- [ ] The role boundary in `.agro/skills/supervisor/SKILL.md` states that an advisor and a worker send no Herdr message to the supervisor pane.
- [ ] Duty 3 names the report channels: the advisor pane output, `progress.txt`, `evidence.md`, the `passes` flags in `prd.json`, and the commit log. The text adds no new artifact.
- [ ] Duty 5 states that an advisor records a blocker in `evidence.md` and in its pane output. The supervisor reads the blocker through the Duty 3 monitor.
- [ ] Duty 1 no longer passes `--env AGRO_SUPERVISOR_PANE=<pane>` to `herdr tab create`.
- [ ] Duty 1 launches the advisor harness with `AGRO_SUPERVISOR_PANE` unset, so an inherited value cannot reach the advisor or its workers.
- [ ] `.agro/skills/escalate/SKILL.md` no longer tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE`.
- [ ] `.agro/skills/escalate/SKILL.md` states that an advisor and a worker pass no `--supervisor` value and run no escalation to the operator.

### US-003: Keep guarded downward steering and supervisor-owned escalation

**Description:** As an operator, I want the supervisor to own every operator escalation so that the operator keeps one route to a person. The guarded brief path stays.

**Acceptance Criteria:**

- [ ] Duty 2 keeps the two-step send (`herdr agent send`, then `herdr pane send-keys <pane> Enter`) and the `Message @` check before every send.
- [ ] Duty 5 states that only the supervisor runs `/escalate`. The call passes no `--supervisor` value, so the call reaches the Slack destination only.
- [ ] Failure modes 1 through 8 in `.agro/skills/supervisor/SKILL.md` keep their text. The change adds no failure mode.

### US-004: Guard the contract with a regression probe

**Description:** As a maintainer, I want one probe to fail on a return to loops or upward messages so that the lesson survives edits.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-monitor-contract.sh` exists, is executable, and follows the 3-state exit contract in `.agro/evals/README.md`.
- [ ] The probe exits 1 when `.agro/skills/supervisor/SKILL.md` names no `MonitorCreate`.
- [ ] The probe exits 1 when `.agro/skills/supervisor/SKILL.md` or `.agro/skills/escalate/SKILL.md` sets `AGRO_SUPERVISOR_PANE=` to a non-empty value.
- [ ] The probe exits 1 when `.agro/skills/supervisor/SKILL.md` recommends `LoopCreate` outside a prohibition line.
- [ ] The probe exits 0 against the changed tree.
- [ ] `CHANGELOG.md` carries one entry under `## [Unreleased]` for the change.

## Summary

Verified current state:

- `.agro/skills/supervisor/SKILL.md:69-74` creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. `/escalate` reads that variable, so an advisor escalation types into the supervisor pane.
- `.agro/skills/supervisor/SKILL.md:95` and `:197` run `herdr agent wait` directly. The skill names no `MonitorCreate`, no completion callback, and no recovery rule.
- `.agro/skills/supervisor/SKILL.md:270-279` routes an advisor escalation to the supervisor first.
- `.agro/skills/escalate/SKILL.md:56` and `:69-74` document the supervisor destination and the `AGRO_SUPERVISOR_PANE` start command.
- `.agro/skills/escalate/scripts/escalate.sh:67` falls back to `AGRO_SUPERVISOR_PANE` when the caller passes no `--supervisor`.
- `.agro/skills/fanout/SKILL.md:120-133` and `docs/harnesses/pi.md:74-98` already document `MonitorCreate` with `onDone` for the Pi harness.
- `.claude/skills` is a symlink to `../.agro/skills`. `bash .agro/scripts/link-providers.sh --check` verifies the provider links.

Selected approach: change prose in two canonical skills, add one probe, and add one changelog entry. The supervisor observes through bounded `MonitorCreate` waits. The advisor harness starts with `AGRO_SUPERVISOR_PANE` unset. Advisors and workers report through pane output and existing artifacts. The supervisor keeps the guarded downward send and owns every `/escalate` call. `escalate.sh` stays unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Role boundary, Duty 1, Duty 2, Duty 3, Duty 5 | Canonical supervisor contract |
| `.agro/skills/escalate/SKILL.md` | Destinations, Resolution | Documents the supervisor destination and the start command |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` resolution at line 67 | Reads `AGRO_SUPERVISOR_PANE`; unchanged by this task |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | new probe | Guards the contract |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing probe | Must stay green |
| `.agro/evals/probes/escalate-contract.sh` | existing probe | Must stay green |
| `CHANGELOG.md` | `## [Unreleased]` | Records the change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill text | Modified | `MonitorCreate` waits, recovery rules, `LoopCreate` prohibition, cleared destination |
| `/escalate` skill text | Modified | Removes the advisor start command; states that only the supervisor escalates |
| `escalate.sh` command-line interface | None | `--supervisor` and `AGRO_SUPERVISOR_PANE` keep their behavior |
| `mifunedev/agro-web` | `<decision>` | See Open Question 3 |

## Storage

N/A. The task changes skill prose and adds one stateless probe. Advisors keep the existing `progress.txt`, `evidence.md`, and `prd.json` artifacts.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the source of truth for supervision. `.agro/skills/escalate/SKILL.md` points at it and restates no monitor rule.
- Information moves in one direction. The supervisor sends briefs down. Advisors write artifacts and pane output. The supervisor reads both.
- The supervisor owns every operator escalation. An advisor never calls `/escalate`.
- The script keeps its `--supervisor` path. The contract stops every documented use of that path. Open Question 2 records the choice to delete the path.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Write first. Confirm exit 1 against the current tree. | US-001, US-002, US-004 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Exit 0 after the skill edits | US-001, US-002, US-004 |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Exit 0 after the edits | US-003 |
| `.agro/evals/probes/escalate-contract.sh` | Exit 0 after the edits | US-003 |
| `.agro/evals/probes/ste-checker-contract.sh` | Exit 0 after the edits | STE checker integrity |
| `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` | Exit 0 | STE prose |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 | Provider links |
| `<command check>` | See Open Question 1 | Documented commands |

## Design Principles

- Apply the repository non-negotiables: work stays in the sandbox, `.agro/` stays canonical, and persistent work survives a disconnect.
- Bound every wait. Each monitor carries an explicit timeout and a completion callback.
- Keep one direction of message flow between supervisor and advisor.
- Add no artifact. Advisors report through files that exist today.
- Make the smallest realistic change. Keep `escalate.sh` unchanged.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`.
- Any change to `.agro/skills/escalate/scripts/escalate.sh`.
- Any change to `.agro/skills/fanout/SKILL.md` or `docs/harnesses/pi.md`.
- Scheduling that the operator requests explicitly outside supervision.

## Open Questions

1. The issue requires passing "command checks". The repository names no single command-check script. Which command runs the check: `<command check>`?
2. Should a later task delete the `--supervisor` destination from `escalate.sh` and rewrite `escalate-destination-fan-out.sh`? This plan keeps the path, because no documented caller remains.
3. Does the change need a matching page change in `mifunedev/agro-web`?
4. `MonitorCreate` comes from `@trevonistrevon/pi-loop` for Pi. Which tool does a supervisor use under Claude Code or Codex: `<equivalent tool>`?

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `<command check>` exits 0.
- [ ] `git diff --stat` names no file outside the paths in Key Integration Points.
- [ ] The diff adds no failure mode to `.agro/skills/supervisor/SKILL.md`.

## Lessons

Filled by the advisor before undraft.
