# PRD: Supervisor monitor-only observation

Status: DRAFT

Issue: #1064
Source: `work/issue-1064.md`

## User Stories

### US-001: Observe advisors through bounded monitors

**Description:** As a supervisor, I want each observation and readiness wait inside a bounded `MonitorCreate` call so that I never poll and never attach.

**Acceptance Criteria:**

- [ ] Duty 1 in `.agro/skills/supervisor/SKILL.md` wraps the harness readiness wait in one `MonitorCreate` call.
- [ ] Duty 3 in `.agro/skills/supervisor/SKILL.md` wraps each blocking wait in one `MonitorCreate` call.
- [ ] Each `MonitorCreate` example runs one `herdr agent wait` or `herdr wait output` command that carries an explicit `--timeout` value.
- [ ] Each `MonitorCreate` example sets `onDone` to a completion callback that names the next supervisor action.
- [ ] The skill states one recovery rule for each of three results: the wait matched, the wait timed out, and the `herdr` command exited nonzero.
- [ ] The timeout recovery rule reads the pane one time and arms at most one new monitor before the supervisor escalates.
- [ ] The skill prohibits `LoopCreate`, `/loop`, and shell `while`/`sleep` loops for supervisor observation.
- [ ] `grep -n 'LoopCreate' .agro/skills/supervisor/SKILL.md` prints only lines that prohibit `LoopCreate`.

### US-002: Remove the reverse Herdr channel from advisors and workers

**Description:** As a supervisor, I want advisors and workers to send no Herdr message to my pane so that steering flows only downward.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example in `.agro/skills/supervisor/SKILL.md` carries no `--env AGRO_SUPERVISOR_PANE=` argument.
- [ ] The Duty 1 launch command clears an inherited value with `env -u AGRO_SUPERVISOR_PANE` ahead of `claude --dangerously-skip-permissions`.
- [ ] The role boundary table states that an advisor and a worker send no Herdr message to the supervisor pane.
- [ ] The brief template tells the advisor to record progress in `progress.txt`, `evidence.md`, `prd.json`, and the commit log.
- [ ] The brief template tells the advisor to record a blocker in `evidence.md` and stop at the next safe point.
- [ ] Duty 3 names pane output and the existing artifacts as the only advisor progress channels.
- [ ] Duty 5 states that the supervisor detects an advisor blocker through a monitor callback or an artifact read.
- [ ] The Duty 2 prompt-target check (`grep -c 'Message @'`) and failure mode 8 stay in the skill without change.

### US-003: Keep operator escalation with the supervisor

**Description:** As an operator, I want only the supervisor to call `/escalate` for an advisor run so that the run history backs each escalation.

**Acceptance Criteria:**

- [ ] Duty 5 in `.agro/skills/supervisor/SKILL.md` states that the supervisor calls `/escalate` for the operator.
- [ ] The Duty 5 escalation example runs `env -u AGRO_SUPERVISOR_PANE bash .agro/skills/escalate/scripts/escalate.sh`, so an inherited target cannot route the escalation to a pane.
- [ ] `.agro/skills/escalate/SKILL.md` carries no `herdr agent start ... --env AGRO_SUPERVISOR_PANE=<pane>` example.
- [ ] `.agro/skills/escalate/SKILL.md` states that a `/supervisor` advisor starts with `AGRO_SUPERVISOR_PANE` unset.
- [ ] `.agro/skills/escalate/scripts/escalate.sh` shows no diff.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.

### US-004: Pass the gates and record the change

**Description:** As a maintainer, I want the change to pass the prose, link, command, and probe gates so that the change lands with evidence.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] Each `herdr` subcommand in the changed skills matches the usage that the installed `herdr` CLI prints, and `evidence.md` records the output.
- [ ] Each `MonitorCreate` example uses the argument names in `docs/harnesses/pi.md`: `command`, `description`, and `onDone`.
- [ ] `bash .agro/evals/run.sh` reports no new REGRESSION.
- [ ] `CHANGELOG.md` holds one `[Unreleased]` entry for this change.
- [ ] The failure-mode list in `.agro/skills/supervisor/SKILL.md` holds eight entries, and the introduction still says "Eight failures".
- [ ] `git diff --name-only` lists only `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, `CHANGELOG.md`, `.agro/evals/RESULTS.md`, and files under `.agro/tasks/supervisor-monitor-observation/`.

## Summary

#1059 shipped `/supervisor`, and #1062 aligned the skill. The skill now carries three behaviors that this task changes.

1. Duty 1 and Duty 3 wait with bare `herdr agent wait` calls. The skill names no monitor primitive and no recovery rule for a timeout.
2. Duty 1 creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. `/escalate` reads that variable, so an advisor escalation types into the supervisor pane. That route is a reverse Herdr message.
3. `.agro/skills/escalate/SKILL.md` documents the same `--env AGRO_SUPERVISOR_PANE=<pane>` start pattern.

A reverse message lands in the supervisor prompt mid-turn. Failure mode 8 records the mirror defect: a send that reaches an unintended pane. The fix makes the pane graph one-way. The supervisor steers down with the guarded two-step send. Advisors report up through pane output and files on disk.

`.agro/skills/fanout/SKILL.md` § 6 already prefers `MonitorCreate` over `LoopCreate` for Pi supervision. `docs/harnesses/pi.md` documents the `MonitorCreate` arguments `command`, `description`, and `onDone`. This task applies the same rule to `/supervisor` and makes the rule mandatory.

The selected approach edits prose only. The `escalate.sh` supervisor destination stays. The `escalate-destination-fan-out.sh` probe guards that destination. The supervisor skips the destination because the supervisor clears `AGRO_SUPERVISOR_PANE` at each advisor launch and at each own escalation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Role boundary, Duty 1, Duty 2, Duty 3, Duty 5 | Canonical supervisor procedure. The task edits this file. |
| `.agro/skills/escalate/SKILL.md` | § Destinations | Documents the advisor start pattern with `AGRO_SUPERVISOR_PANE`. The task edits this section. |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor="${AGRO_SUPERVISOR_PANE:-}"` (line 67) | Resolves the pane destination. The task reads this file and changes nothing. |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | supervisor destination checks | Guards the script behavior that stays. |
| `.agro/evals/probes/escalate-contract.sh` | `SKILL.md` literal checks | Guards `Exit 0 is not proof` and `conversations.info` in the escalate skill. |
| `.agro/skills/fanout/SKILL.md` | § 6 Monitor without attaching | Existing `MonitorCreate` precedent. The task reads this file and changes nothing. |
| `docs/harnesses/pi.md` | § Monitor and loops | Source for the `MonitorCreate` argument names. |
| `.agro/scripts/link-providers.sh` | `--check` | Proves the provider mirrors resolve. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` Duty 1 | Modified | The tab create example drops `--env AGRO_SUPERVISOR_PANE=`. The launch clears the variable. The readiness wait runs inside `MonitorCreate`. |
| `/supervisor` Duty 3 | Modified | Each wait runs inside `MonitorCreate` with a timeout, an `onDone` callback, and recovery rules. The skill prohibits `LoopCreate`. |
| `/supervisor` Duty 5 | Modified | The supervisor alone calls `/escalate`. Advisors record blockers in `evidence.md`. |
| `/escalate` § Destinations | Modified | The advisor start example with `AGRO_SUPERVISOR_PANE` leaves the skill. |
| `escalate.sh --supervisor` and `AGRO_SUPERVISOR_PANE` | Unchanged | The script keeps both inputs. |

## Storage

N/A. The task changes skill prose. Advisor progress uses the existing task artifacts `progress.txt`, `evidence.md`, and `prd.json`. The task adds no new store.

## Architectural Decisions

- **One-way pane graph.** The supervisor sends down with `herdr agent send` plus `herdr pane send-keys <pane> Enter`, after the `Message @` check. No advisor and no worker sends a Herdr message up.
- **Files carry state up.** `progress.txt`, `evidence.md`, `prd.json`, and the commit log carry advisor progress and blockers. Pane output carries live status.
- **Monitors carry waits.** One bounded `MonitorCreate` call wraps one blocking `herdr` wait. The `onDone` callback wakes the supervisor one time. No recurring loop runs.
- **Recovery rules.** A matched wait runs the next duty step. A timeout triggers one pane read and at most one new monitor, then an escalation. A nonzero `herdr` exit triggers an escalation with the quoted error.
- **Explicit clearing.** The supervisor clears `AGRO_SUPERVISOR_PANE` with `env -u` at each advisor launch and at each own `/escalate` call. The supervisor does not rely on an unverified Herdr environment-inheritance rule.
- **Script unchanged.** The escalate script keeps the supervisor destination for callers outside `/supervisor`. Open question 2 tracks retirement.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/ste/scripts/ste-check.sh` | Run against both changed `SKILL.md` files | STE prose rules |
| `.agro/scripts/link-providers.sh --check` | Full check | Provider mirrors resolve |
| `.agro/evals/probes/escalate-contract.sh` | Full probe | Escalate skill literals and no-op behavior |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Full probe | The unchanged supervisor destination |
| `.agro/evals/run.sh` | Full suite | No new REGRESSION |
| `<command check>` | Each `herdr` subcommand in the changed skills against the installed CLI usage | Commands run as written |

This task adds no new probe by default. A probe that greps for `MonitorCreate` pins prose, not behavior. `pattern-evals-prose-literal-pinning` records that risk. Open question 3 tracks this decision.

## Design Principles

- Code is the source of truth. Add no explanatory comment to tracked code.
- Edit the canonical `.agro/skills/` source. Never patch a provider mirror.
- Compose owning skills. `/herdr` owns the command catalog. `/escalate` owns the operator channel. Restate neither.
- Keep the change to prose. Add no script and no new mechanism.
- Keep the supervisor out of implementation and out of code review.

## Out of Scope

- The unrelated concurrent failure-mode addition to `/supervisor`. This task adds no failure-mode entry.
- Any change to `.agro/skills/escalate/scripts/escalate.sh` or its probes.
- Any change to `.agro/skills/fanout/SKILL.md`, `/herdr`, or `/delegate`.
- Scheduling that the operator requests explicitly. The `LoopCreate` prohibition covers supervisor observation only.
- Public documentation in `mifunedev/agro-web`, unless open question 4 resolves otherwise.

## Open Questions

1. `MonitorCreate` is the Pi tool name from `@trevonistrevon/pi-loop`. The supervisor can run in Claude Code or Codex. Which tool name does the skill give for each harness? Default: name `MonitorCreate` and state `<harness monitor tool>` for other harnesses.
2. No `/supervisor` caller sets `AGRO_SUPERVISOR_PANE` after this change. Does a later task retire the `escalate.sh` supervisor destination?
3. Does the task add a behavioral probe for the one-way pane graph? Default: no probe, because no deterministic oracle exists beyond prose literals.
4. Does `mifunedev/agro-web` document `/supervisor` or `AGRO_SUPERVISOR_PANE`? If yes, the public page needs a matching change.
5. Which command defines the command check? Default: run each `herdr` group in the sandbox and compare the printed usage with the skill.

## Acceptance Criteria

- [ ] Each story criterion above passes, and `evidence.md` records the command and exit status for each executed check.
- [ ] `.agro/skills/supervisor/SKILL.md` contains no `LoopCreate` usage and no reverse Herdr route from an advisor or a worker.
- [ ] `.agro/skills/supervisor/SKILL.md` keeps the guarded downward send and the supervisor-owned `/escalate` call.
- [ ] The diff adds no failure-mode entry to `/supervisor`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Lessons

Filled by the advisor before undraft.
