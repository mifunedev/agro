# PRD: Supervisor monitor observation

Status: DRAFT

Issue: `#1064`
Input: `work/issue-1064.md`

## User Stories

### US-001: Clear inherited supervisor destinations at advisor launch

**Description:** As a supervisor, I want each advisor to start with no supervisor destination so that no advisor or worker messages the supervisor pane.

**Acceptance Criteria:**

- [ ] Duty 1 in `.agro/skills/supervisor/SKILL.md` contains no `--env AGRO_SUPERVISOR_PANE=` argument.
- [ ] Duty 1 launches the harness with `env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions`.
- [ ] Duty 1 states that the launch removes an inherited `AGRO_SUPERVISOR_PANE` from the advisor and from every worker that the advisor starts.
- [ ] `.agro/skills/escalate/SKILL.md` contains no instruction that sets `AGRO_SUPERVISOR_PANE` on an advisor launch.
- [ ] `.agro/skills/escalate/SKILL.md` states that an advisor and a worker never pass `--supervisor`.

### US-002: Wait for advisor readiness with a monitor

**Description:** As a supervisor, I want a bounded `MonitorCreate` readiness wait so that the supervisor briefs an advisor only after the status line reports bypass mode.

**Acceptance Criteria:**

- [ ] Duty 1 replaces the attached `herdr agent wait` readiness call with one `MonitorCreate` call.
- [ ] The monitor command is `herdr wait output <pane> --match 'bypass permissions on' --timeout 90000`.
- [ ] The monitor call carries an `onDone` callback that names the brief on success and the recovery rules on failure.
- [ ] Duty 1 keeps the rule "Never brief an advisor in manual mode."

### US-003: Observe advisors through monitors with recovery rules

**Description:** As a supervisor, I want bounded monitors with callbacks so that I recover from each failed wait by a fixed rule.

**Acceptance Criteria:**

- [ ] Duty 3 requires `MonitorCreate` for every observation wait and every readiness wait.
- [ ] Every `MonitorCreate` example in the file carries `--timeout` in the command and an `onDone` callback.
- [ ] Duty 3 prohibits `LoopCreate`.
- [ ] Duty 3 prohibits shell `while` and `sleep` polling loops.
- [ ] Duty 3 states one recovery rule for each outcome: a timeout, a missing pane, a Herdr server failure, and a duplicate monitor.
- [ ] Duty 3 names `MonitorList` as the duplicate check before each new `MonitorCreate`.
- [ ] The multi-advisor section replaces "poll cycle" with the monitor model and keeps the cap of three advisors.

### US-004: Route advisor progress and blockers through output and artifacts

**Description:** As a supervisor, I want advisors to report progress in pane output and task artifacts so that nobody sends a reverse Herdr message.

**Acceptance Criteria:**

- [ ] The role-boundary section prohibits `herdr agent send`, `herdr pane send-keys`, and `herdr pane run` from an advisor or a worker to the supervisor pane.
- [ ] Brief template step 4 tells the advisor to record each blocker in `evidence.md` and in `progress.txt`, then stop at the blocker.
- [ ] Duty 3 names pane output, the commit log, `prd.json`, `progress.txt`, and `evidence.md` as the only progress sources.
- [ ] Duty 5 states that the supervisor alone runs `/escalate` to reach the operator.
- [ ] Duty 5 no longer states that an advisor escalation arrives at the supervisor through `/escalate`.
- [ ] Duty 2 keeps the `Message @` prompt check and the two-step send for downward steering.

### US-005: Guard the contract with a probe and record the change

**Description:** As a harness maintainer, I want a probe and a changelog entry so that a restored upward message or loop poll fails a check.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-monitor-contract.sh` exists, is executable, and carries the `tier`, `source`, and `desc` header lines.
- [ ] The probe exits 1 when the supervisor skill sets `AGRO_SUPERVISOR_PANE` in a launch command.
- [ ] The probe exits 1 when the supervisor skill loses the `LoopCreate` prohibition or the `MonitorCreate` requirement.
- [ ] The probe exits 1 when a `herdr` subcommand in the supervisor skill is absent from `.agro/skills/herdr/references/command-map.md`.
- [ ] The probe exits 0 on the finished tree.
- [ ] The implementer records one fault injection per failure rule above, with the observed exit 1, in `evidence.md`.
- [ ] `CHANGELOG.md` carries one `### Changed` entry under `[Unreleased]` that cites `#1064`.

## Summary

Verified current state at commit `3e98ddc`:

- `.agro/skills/supervisor/SKILL.md:69-74` creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. The advisor and its workers inherit that variable.
- `.agro/skills/escalate/scripts/escalate.sh:67` reads `AGRO_SUPERVISOR_PANE` as the default supervisor target. Lines 131-142 send a Herdr message to that target. An advisor or a worker that runs `/escalate` sends a reverse Herdr message.
- `.agro/skills/escalate/SKILL.md:69-74` tells the reader to start an advisor with `--env AGRO_SUPERVISOR_PANE=<pane>`.
- `.agro/skills/supervisor/SKILL.md:95` and `:197` run `herdr agent wait` as attached blocking calls. The file names no `MonitorCreate` and no `LoopCreate`.
- `.agro/skills/supervisor/SKILL.md:270-273` states that an advisor escalation arrives at the supervisor first.
- `.agro/skills/fanout/SKILL.md:119-137` already prefers `MonitorCreate` over `LoopCreate` polling. `docs/harnesses/pi.md:74-95` documents `MonitorCreate`, `MonitorList`, `MonitorStop`, and `onDone`.
- `.agro/skills/herdr/references/command-map.md:172` documents `herdr wait output <pane_id> --match <text> --timeout MS`.
- `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0 today.
- `bash .agro/scripts/link-providers.sh --check` exits 0 today.

Selected approach:

1. Remove the upward destination at its source. The supervisor launches the harness through `env -u AGRO_SUPERVISOR_PANE`. The advisor process and every worker process then carry no supervisor target.
2. Keep `escalate.sh` unchanged. With no target, the script skips the supervisor destination and still reaches Slack. The existing probe `escalate-destination-fan-out.sh` stays green.
3. Move every supervisor wait into `MonitorCreate`. Each monitor runs one bounded `herdr` wait. Each `onDone` callback names the next action.
4. Keep downward steering unchanged: the `Message @` check, then `herdr agent send`, then `herdr pane send-keys <pane> Enter`.
5. Keep operator escalation with the supervisor through `/escalate`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Role boundary, Duty 1, Duty 2 step 4, Duty 3, Duty 5, multi-advisor section, Composition | Canonical supervisor contract; all behavior changes land here |
| `.agro/skills/escalate/SKILL.md` | Destinations section, lines 69-74 | Removes the advisor-launch `AGRO_SUPERVISOR_PANE` instruction |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` default at line 67 | Read only; an empty target skips the supervisor destination |
| `.agro/skills/herdr/references/command-map.md` | `wait` group, `agent` group | Source of valid `herdr` subcommands for the command check |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | new probe | Guards the monitor, loop, destination, and command rules |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing probe | Regression floor for the unchanged escalate script |
| `.agro/evals/probes/escalate-contract.sh` | existing probe | Regression floor for the escalate skill text |
| `CHANGELOG.md` | `[Unreleased]` `### Changed` | Records the contract change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill text | Modified | Adds the monitor requirement, the loop prohibition, the reverse-message prohibition, and the recovery rules |
| `/escalate` skill text | Modified | Drops the advisor-launch environment instruction; the flags and the exit codes stay the same |
| `escalate.sh` CLI | Unchanged | Flags, exit codes, and the `destinations` object stay the same |
| Advisor process environment | Modified | `AGRO_SUPERVISOR_PANE` is absent in the advisor and in its workers |
| Provider mirrors under `.claude/skills/` and other provider directories | Unchanged | Symlinks resolve to the edited canonical files |
| Public documentation in `mifunedev/agro-web` | N/A | No lifecycle verb, CLI flag, or user-facing term changes |

## Storage

N/A. The change edits skill text and adds one probe. The monitors keep their state in the harness session, and the task artifacts `progress.txt`, `evidence.md`, and `prd.json` already exist.

## Architectural Decisions

- **Source of truth:** `.agro/skills/supervisor/SKILL.md` owns the observation contract. `/herdr` owns the command catalog. `/escalate` owns the operator channel. `docs/harnesses/pi.md` owns the `MonitorCreate` tool reference.
- **Direction of messages:** Herdr messages flow down only, from the supervisor to an advisor. Progress flows up only through pane output and task artifacts.
- **Clear at the source:** The launch command removes `AGRO_SUPERVISOR_PANE`. The plan adds no guard inside `escalate.sh`, because a guard there duplicates the launch rule.
- **Bounded waits:** Every monitor command carries a `--timeout`. The `onDone` callback runs once per monitor, so no recurring wake exists.
- **Recovery rules:** The supervisor applies these rules inside the `onDone` callback.
  1. If the wait times out, the supervisor reads `herdr agent list` and the last 120 pane lines once, then creates one new monitor.
  2. If the pane does not resolve, the supervisor records the blocker in `evidence.md` and runs `/escalate`.
  3. If the Herdr server fails, the supervisor records the blocker in `evidence.md` and runs `/escalate`.
  4. If `MonitorList` already shows a monitor for the pane, the supervisor creates no second monitor.
- **Execution location:** All edits happen in the task worktree inside the sandbox. No host command changes.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Write first; run on the current tree; expect exit 1 | The probe detects the current `--env AGRO_SUPERVISOR_PANE=` launch |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Run on the finished tree; expect exit 0 | US-001 through US-004 |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Fault injection: restore `--env AGRO_SUPERVISOR_PANE=w7:p1`; expect exit 1 | US-001 guard |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Fault injection: delete the `LoopCreate` prohibition; expect exit 1 | US-003 guard |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | Fault injection: add `herdr agent nosuchverb`; expect exit 1 | Command check |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Run unchanged; expect exit 0 | The escalate script keeps its destinations contract |
| `.agro/evals/probes/escalate-contract.sh` | Run unchanged; expect exit 0 | The escalate skill text keeps its contract |
| `.agro/evals/probes/spec-single-owner.sh` | Run unchanged; expect exit 0 | The supervisor text adds no second build owner |
| `.agro/skills/ste/scripts/ste-check.sh` | Run on `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, and this PRD; expect exit 0 | STE gate |
| `.agro/scripts/link-providers.sh --check` | Run; expect exit 0 | Provider links |
| `shellcheck .agro/evals/probes/supervisor-monitor-contract.sh` | Run; expect exit 0 | Probe script quality |
| `bash .claude/skills/eval/run.sh --probe supervisor-monitor-contract` | Run; expect exit 0 and a PASS row in `.agro/evals/RESULTS.md` | Runner integration |

## Design Principles

- Apply the root `AGENTS.md` non-negotiables. Change only canonical files under `.agro/`. Add no explanatory comments to tracked code.
- Remove the upward path instead of adding a second rule that fights the path.
- Name each wait with a timeout and a callback. A wait with no bound hides a stall.
- Keep one owner per rule. The supervisor skill points at `/herdr`, `/escalate`, and `docs/harnesses/pi.md`, and restates none of them.
- Apply `/ste` to every changed sentence.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`. This task adds no numbered failure-mode entry and does not carry that addition.
- Code changes to `.agro/skills/escalate/scripts/escalate.sh`.
- Removal of the `escalate.sh` supervisor destination for callers outside the supervisor model.
- The `LoopCreate` wording in `.agro/skills/fanout/SKILL.md` and in `.agro/skills/builder/references/command.md`.
- Changes to `mifunedev/agro-web`.

## Open Questions

1. The issue names `MonitorCreate`, which `@trevonistrevon/pi-loop` provides in Pi. Claude Code exposes a tool named `Monitor`. Does the supervisor skill name the Claude Code tool as the equivalent, or does the supervisor run in Pi only? Default: name `MonitorCreate` only, as the issue states.
2. The exit code of `herdr wait output` and `herdr agent wait` on timeout is not documented in `.agro/skills/herdr/references/command-map.md`. The recovery rules need `<timeout exit code>`. The implementer measures the value in the sandbox and records the command and the result in `evidence.md`.
3. After this change, no documented caller sets `AGRO_SUPERVISOR_PANE`. Does the operator want the `escalate.sh` supervisor destination deleted in a follow-up task? Default: keep the destination; this task does not change the script.
4. The repository holds no trace of the concurrent failure-mode addition. Which branch or pull request carries that addition, so the implementer can confirm that the diff excludes it?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/spec-single-owner.sh` exits 0.
- [ ] `git diff --stat 3e98ddc` lists only `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, `.agro/evals/probes/supervisor-monitor-contract.sh`, `.agro/evals/RESULTS.md`, `CHANGELOG.md`, and files under `.agro/tasks/supervisor-monitor-observation/`.
- [ ] `git diff 3e98ddc -- .agro/skills/supervisor/SKILL.md` adds no numbered entry under `## Failure modes`.

## Lessons

Filled by the advisor before undraft.
